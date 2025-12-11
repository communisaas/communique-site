import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';
import { Construct } from 'constructs';
import { EnvironmentConfig } from './config';

export interface TeeComputeStackProps extends cdk.StackProps {
	readonly config: EnvironmentConfig;
	readonly vpc: ec2.IVpc;
}

/**
 * TeeComputeStack deploys the infrastructure for Trusted Execution Environments (TEEs)
 * using AWS Nitro Enclaves on Spot Instances with Graviton processors.
 */
export class TeeComputeStack extends cdk.Stack {
	public readonly asg: autoscaling.AutoScalingGroup;
	public readonly namespace: servicediscovery.PrivateDnsNamespace;
	public readonly service: servicediscovery.Service;

	constructor(scope: Construct, id: string, props: TeeComputeStackProps) {
		super(scope, id, props);

		const { config, vpc } = props;

		// 1. Service Discovery (Cloud Map)
		// This allows the Lambda proxy to find healthy TEE instances
		this.namespace = new servicediscovery.PrivateDnsNamespace(this, 'TeeNamespace', {
			name: `${config.appName}.internal`,
			vpc,
			description: 'Service discovery namespace for Communique TEEs'
		});

		this.service = this.namespace.createService('TeeService', {
			name: 'tee-workload',
			dnsRecordType: servicediscovery.DnsRecordType.A,
			dnsTtl: cdk.Duration.seconds(30),
			routingPolicy: servicediscovery.RoutingPolicy.MULTIVALUE,
			customHealthCheck: {
				failureThreshold: 1
			}
		});

		// 2. IAM Role for TEE Instances
		const role = new iam.Role(this, 'TeeInstanceRole', {
			assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
			description: 'IAM role for TEE instances running Nitro Enclaves',
			managedPolicies: [
				iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'), // For Session Manager access
				iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryReadOnly') // To pull TEE images
			]
		});

		// Add permissions for Cloud Map registration (if needed by user data script, though ASG handles it mostly)
		// And logging
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'logs:CreateLogGroup',
					'logs:CreateLogStream',
					'logs:PutLogEvents',
					'logs:DescribeLogStreams'
				],
				resources: ['*'] // Ideally restrict to specific log groups
			})
		);

		// 3. Security Group
		const securityGroup = new ec2.SecurityGroup(this, 'TeeSecurityGroup', {
			vpc,
			description: 'Security group for TEE instances',
			allowAllOutbound: true
		});

		// Allow HTTP ingress from within the VPC (for Lambda proxy)
		securityGroup.addIngressRule(
			ec2.Peer.ipv4(vpc.vpcCidrBlock),
			ec2.Port.tcp(8080),
			'Allow HTTP traffic from VPC'
		);

		// 4. User Data (Startup Script)
		const userData = ec2.UserData.forLinux();
		userData.addCommands(
			'yum update -y',
			'yum install -y aws-nitro-enclaves-cli aws-nitro-enclaves-cli-devel docker',
			'systemctl start docker',
			'systemctl enable docker',
			'usermod -aG docker ec2-user',
			'usermod -aG ne ec2-user',

			// Configure Nitro Enclaves allocator
			// Allocate 1 vCPU and 3GB RAM for the enclave (leaving 1 vCPU / 1GB for host on c6g.large)
			'nitro-cli-config -i -t 1 -m 3072',
			'systemctl start nitro-enclaves-allocator.service',
			'systemctl enable nitro-enclaves-allocator.service',

			// Pull and run the TEE workload
			// Note: In a real deployment, we would pull from ECR. For now, we assume a pre-baked AMI or pull from a repo.
			// This is a placeholder for the actual enclave startup logic.
			`echo "Starting TEE Workload..."`
			// 'docker pull ...',
			// 'nitro-cli build-enclave ...',
			// 'nitro-cli run-enclave ...',

			// Start the host proxy (vsock <-> tcp)
			// 'vsock-proxy 8080 8000 ...'
		);

		// 5. Auto Scaling Group
		this.asg = new autoscaling.AutoScalingGroup(this, 'TeeAsg', {
			vpc,
			vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED }, // Private subnet with NAT Instance
			// Mixed Instances Policy (The "Pain-Free" Spot Strategy)
			mixedInstancesPolicy: {
				instancesDistribution: {
					onDemandPercentageAboveBaseCapacity: 0, // 100% Spot
					spotAllocationStrategy: autoscaling.SpotAllocationStrategy.CAPACITY_OPTIMIZED // Minimize interruptions
				},
				launchTemplate: new ec2.LaunchTemplate(this, 'TeeLaunchTemplate', {
					launchTemplateName: `${config.appName}-tee-launch-template`,
					instanceType: ec2.InstanceType.of(ec2.InstanceClass.C6G, ec2.InstanceSize.LARGE), // Default
					machineImage: ec2.MachineImage.latestAmazonLinux2023({
						cpuType: ec2.AmazonLinuxCpuType.ARM_64
					}),
					role,
					securityGroup,
					userData,
					// IMDSv2 is required for our hardened User Data
					requireImdsv2: true
				}),
				launchTemplateOverrides: [
					{ instanceType: ec2.InstanceType.of(ec2.InstanceClass.C6G, ec2.InstanceSize.LARGE) },
					{ instanceType: ec2.InstanceType.of(ec2.InstanceClass.C6G, ec2.InstanceSize.XLARGE) },
					{ instanceType: ec2.InstanceType.of(ec2.InstanceClass.C7G, ec2.InstanceSize.LARGE) },
					{ instanceType: ec2.InstanceType.of(ec2.InstanceClass.M6G, ec2.InstanceSize.LARGE) }
				]
			},
			// Enable Capacity Rebalancing to proactively replace instances at risk of interruption
			capacityRebalance: true
		});

		// Register ASG with Cloud Map
		// This automatically registers instances as they launch
		// Note: We need to ensure the instances report health or we use EC2 health checks
		// Cloud Map integration with ASG is not direct in L2 construct?
		// Actually, we can use `service.registerNonIpInstance` or similar, but for ASG we usually use a Load Balancer.
		// Since we are doing Client-Side LB (Lambda -> Cloud Map), we need the instances to register themselves or use a custom resource.
		// OR, simpler: Use the ASG integration with Cloud Map if available.
		// It seems ASG doesn't have a direct `serviceRegistry` property like ECS Service.
		// We might need to add a User Data script to register with Cloud Map on startup, OR use a Lambda that listens to ASG events.
		//
		// ALTERNATIVE: Use a Private Application Load Balancer (ALB).
		// Pros: Simple, standard. Cons: Cost (~$16/mo + data).
		// "Lean Unicorn" goal: Avoid ALB.
		//
		// Solution: User Data script registers IP with Cloud Map on startup and deregisters on shutdown.
		// We'll add permissions to the role for `servicediscovery:RegisterInstance`.

		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'servicediscovery:RegisterInstance',
					'servicediscovery:DeregisterInstance',
					'servicediscovery:DiscoverInstances'
				],
				resources: [this.service.serviceArn] // Least Privilege: Only this service
			})
		);

		// Add registration script to User Data
		userData.addCommands(
			// Install AWS CLI (if not present) and jq
			'yum install -y aws-cli jq nc', // Added nc (netcat) for health check

			// Get Instance Metadata using IMDSv2 (more secure/robust than ec2-metadata script)
			`TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")`,
			`INSTANCE_ID=$(curl -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/instance-id)`,
			`IP_ADDRESS=$(curl -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/local-ipv4)`,

			// Wait for TEE Proxy to be ready (prevent "Boot Race Condition")
			// The proxy listens on port 8080. We loop until it's up.
			`echo "Waiting for TEE Proxy on port 8080..."`,
			`until nc -z localhost 8080; do sleep 1; done`,
			`echo "TEE Proxy is up! Registering with Cloud Map..."`,

			`aws servicediscovery register-instance --service-id ${this.service.serviceId} --instance-id $INSTANCE_ID --attributes AWS_INSTANCE_IPV4=$IP_ADDRESS --region ${this.region}`,

			// Create a shutdown script to deregister from Cloud Map
			`cat <<EOF > /usr/local/bin/deregister-tee.sh`,
			`#!/bin/bash`,
			`TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")`,
			`INSTANCE_ID=$(curl -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/instance-id)`,
			`aws servicediscovery deregister-instance --service-id ${this.service.serviceId} --instance-id $INSTANCE_ID --region ${this.region}`,
			`EOF`,
			`chmod +x /usr/local/bin/deregister-tee.sh`,

			// Create a systemd service to run the shutdown script
			`cat <<EOF > /etc/systemd/system/tee-deregister.service`,
			`[Unit]`,
			`Description=Deregister TEE from Cloud Map on shutdown`,
			`DefaultDependencies=no`,
			`Before=shutdown.target reboot.target halt.target`,
			``,
			`[Service]`,
			`Type=oneshot`,
			`ExecStart=/usr/local/bin/deregister-tee.sh`,
			``,
			`[Install]`,
			`WantedBy=halt.target reboot.target shutdown.target`,
			`EOF`,
			`systemctl enable tee-deregister.service`
		);

		// Add tags
		this.addResourceTags(config.tags);
	}

	private addResourceTags(tags: Record<string, string>): void {
		Object.entries(tags).forEach(([key, value]) => {
			cdk.Tags.of(this).add(key, value);
		});
	}
}
