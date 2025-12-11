import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { EnvironmentConfig } from './config';

export interface NetworkingStackProps extends cdk.StackProps {
	readonly config: EnvironmentConfig;
}

/**
 * NetworkingStack creates VPC, subnets, security groups, and VPC endpoints
 * for the Communique CWC integration system.
 */
export class NetworkingStack extends cdk.Stack {
	public readonly vpc: ec2.Vpc;
	public readonly lambdaSecurityGroup: ec2.SecurityGroup;
	public readonly vpcEndpointSecurityGroup: ec2.SecurityGroup;
	public readonly privateSubnets: ec2.ISubnet[];
	public readonly publicSubnets: ec2.ISubnet[];

	constructor(scope: Construct, id: string, props: NetworkingStackProps) {
		super(scope, id, props);

		const { config } = props;

		// Create VPC Flow Logs Group
		let vpcLogGroup: logs.LogGroup | undefined;
		if (config.enableVpcLogs) {
			vpcLogGroup = new logs.LogGroup(this, 'VpcFlowLogsGroup', {
				logGroupName: `/aws/vpc/flowlogs/${config.appName}`,
				retention: logs.RetentionDays.ONE_WEEK,
				removalPolicy: cdk.RemovalPolicy.DESTROY
			});
		}

		// Create VPC
		this.vpc = new ec2.Vpc(this, 'CommuniqueVpc', {
			vpcName: `${config.appName}-vpc`,
			ipAddresses: ec2.IpAddresses.cidr(config.vpcCidr),
			maxAzs: 2, // Use 2 AZs for cost optimization while maintaining HA
			enableDnsHostnames: true,
			enableDnsSupport: true,
			natGateways: 0, // We will implement a manual NAT Instance
			subnetConfiguration: [
				{
					cidrMask: 24,
					name: 'PublicSubnet',
					subnetType: ec2.SubnetType.PUBLIC
				},
				{
					cidrMask: 24,
					name: 'PrivateSubnet',
					subnetType: ec2.SubnetType.PRIVATE_ISOLATED
				}
			],
			flowLogs: config.enableVpcLogs
				? {
						CloudWatchLogs: {
							destination: ec2.FlowLogDestination.toCloudWatchLogs(vpcLogGroup!),
							trafficType: ec2.FlowLogTrafficType.ALL
						}
					}
				: undefined
		});

		// Store subnet references
		this.privateSubnets = this.vpc.privateSubnets;
		this.publicSubnets = this.vpc.publicSubnets;

		// Implement DIY NAT Instance if enabled
		if (config.enableNatGateway) {
			this.createNatInstance(config);
		}

		// Create Security Group for Lambda functions
		this.lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
			vpc: this.vpc,
			description: 'Security group for Communique Lambda functions',
			securityGroupName: `${config.appName}-lambda-sg`,
			allowAllOutbound: true
		});

		// Create Security Group for VPC Endpoints
		this.vpcEndpointSecurityGroup = new ec2.SecurityGroup(this, 'VpcEndpointSecurityGroup', {
			vpc: this.vpc,
			description: 'Security group for VPC endpoints',
			securityGroupName: `${config.appName}-vpc-endpoint-sg`,
			allowAllOutbound: false
		});

		// Allow Lambda to access VPC endpoints
		this.vpcEndpointSecurityGroup.addIngressRule(
			this.lambdaSecurityGroup,
			ec2.Port.tcp(443),
			'Allow HTTPS from Lambda functions'
		);

		// Create VPC Endpoints for AWS services (if enabled)
		if (config.security.enableVpcEndpoints) {
			this.createVpcEndpoints();
		}

		// Add tags to all resources in this stack
		this.addResourceTags(config.tags);

		// Output important values
		new cdk.CfnOutput(this, 'VpcId', {
			value: this.vpc.vpcId,
			description: 'VPC ID for Communique infrastructure',
			exportName: `${config.appName}-vpc-id`
		});

		new cdk.CfnOutput(this, 'LambdaSecurityGroupId', {
			value: this.lambdaSecurityGroup.securityGroupId,
			description: 'Security Group ID for Lambda functions',
			exportName: `${config.appName}-lambda-sg-id`
		});

		new cdk.CfnOutput(this, 'PrivateSubnetIds', {
			value: this.privateSubnets.map((subnet) => subnet.subnetId).join(','),
			description: 'Private subnet IDs for Lambda deployment',
			exportName: `${config.appName}-private-subnet-ids`
		});
	}

	/**
	 * Create VPC endpoints for AWS services to reduce NAT Gateway costs
	 * and improve security by keeping traffic within AWS network
	 */
	private createVpcEndpoints(): void {
		// DynamoDB Gateway Endpoint (free)
		this.vpc.addGatewayEndpoint('DynamoDbEndpoint', {
			service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
			subnets: [{ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }]
		});

		// S3 Gateway Endpoint (free)
		this.vpc.addGatewayEndpoint('S3Endpoint', {
			service: ec2.GatewayVpcEndpointAwsService.S3,
			subnets: [{ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }]
		});

		// SQS Interface Endpoint
		this.vpc.addInterfaceEndpoint('SqsEndpoint', {
			service: ec2.InterfaceVpcEndpointAwsService.SQS,
			securityGroups: [this.vpcEndpointSecurityGroup],
			subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
			privateDnsEnabled: true
		});

		// CloudWatch Logs Interface Endpoint
		this.vpc.addInterfaceEndpoint('CloudWatchLogsEndpoint', {
			service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
			securityGroups: [this.vpcEndpointSecurityGroup],
			subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
			privateDnsEnabled: true
		});

		// CloudWatch Monitoring Interface Endpoint
		this.vpc.addInterfaceEndpoint('CloudWatchEndpoint', {
			service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH,
			securityGroups: [this.vpcEndpointSecurityGroup],
			subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
			privateDnsEnabled: true
		});

		// X-Ray Interface Endpoint (if X-Ray is enabled)
		this.vpc.addInterfaceEndpoint('XRayEndpoint', {
			service: ec2.InterfaceVpcEndpointAwsService.XRAY,
			securityGroups: [this.vpcEndpointSecurityGroup],
			subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
			privateDnsEnabled: true
		});
	}

	/**
	 * Create a manual NAT Instance (t4g.nano) for cost optimization
	 */
	private createNatInstance(config: EnvironmentConfig): void {
		// Security Group for NAT Instance
		const natSg = new ec2.SecurityGroup(this, 'NatInstanceSg', {
			vpc: this.vpc,
			description: 'Security Group for NAT Instance',
			allowAllOutbound: true
		});

		// Allow inbound traffic from Private Subnets
		this.privateSubnets.forEach((subnet) => {
			natSg.addIngressRule(
				ec2.Peer.ipv4(subnet.ipv4CidrBlock),
				ec2.Port.allTraffic(),
				'Allow all traffic from Private Subnets'
			);
		});

		// NAT Instance User Data
		const userData = ec2.UserData.forLinux();
		userData.addCommands(
			'yum update -y',
			'yum install -y iptables-services',
			'echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/custom-ip-forwarding.conf',
			'sysctl -p /etc/sysctl.d/custom-ip-forwarding.conf',
			// Dynamically detect the primary network interface
			"PRIMARY_IF=$(ip route show to default | awk '{print $5}')",
			'iptables -t nat -A POSTROUTING -o $PRIMARY_IF -j MASQUERADE',
			'iptables -F FORWARD',
			'service iptables save',
			'systemctl enable iptables',
			'systemctl start iptables'
		);

		// Role for NAT Instance (SSM for debugging)
		const natRole = new iam.Role(this, 'NatInstanceRole', {
			assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
			managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')]
		});

		// Create the NAT Instance
		const natInstance = new ec2.Instance(this, 'NatInstance', {
			vpc: this.vpc,
			vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
			instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.NANO),
			machineImage: ec2.MachineImage.latestAmazonLinux2023({
				cpuType: ec2.AmazonLinuxCpuType.ARM_64
			}),
			securityGroup: natSg,
			role: natRole,
			userData: userData,
			sourceDestCheck: false, // CRITICAL: Must be disabled for NAT
			detailedMonitoring: false
		});

		// Allocate Elastic IP
		const eip = new ec2.CfnEIP(this, 'NatInstanceEIP');
		new ec2.CfnEIPAssociation(this, 'NatInstanceEIPAssociation', {
			eip: eip.ref,
			instanceId: natInstance.instanceId
		});

		// Update Route Tables for Private Subnets
		this.privateSubnets.forEach((subnet, index) => {
			new ec2.CfnRoute(this, `PrivateRouteToNat${index}`, {
				routeTableId: subnet.routeTable.routeTableId,
				destinationCidrBlock: '0.0.0.0/0',
				instanceId: natInstance.instanceId
			});
		});

		// Add Auto Recovery Alarm
		// If the instance fails system status checks, automatically reboot/recover it.
		// This provides high availability for the single NAT instance at no extra cost.
		const cloudwatch = require('aws-cdk-lib/aws-cloudwatch');
		new cloudwatch.CfnAlarm(this, 'NatInstanceRecoveryAlarm', {
			alarmName: `${config.appName}-nat-recovery`,
			alarmDescription: 'Recover NAT Instance if system status check fails',
			namespace: 'AWS/EC2',
			metricName: 'StatusCheckFailed_System',
			dimensions: [
				{
					name: 'InstanceId',
					value: natInstance.instanceId
				}
			],
			statistic: 'Maximum',
			period: 60,
			evaluationPeriods: 2,
			threshold: 1,
			comparisonOperator: 'GreaterThanOrEqualToThreshold',
			alarmActions: [`arn:aws:automate:${this.region}:ec2:recover`]
		});

		new cdk.CfnOutput(this, 'NatInstanceIp', {
			value: eip.ref,
			description: 'Public IP of the NAT Instance (Whitelist this)',
			exportName: `${config.appName}-nat-ip`
		});
	}

	/**
	 * Add tags to all resources in this stack
	 */
	private addResourceTags(tags: Record<string, string>): void {
		Object.entries(tags).forEach(([key, value]) => {
			cdk.Tags.of(this).add(key, value);
		});
	}
}
