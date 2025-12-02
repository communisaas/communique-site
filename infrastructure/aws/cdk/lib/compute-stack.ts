import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';
import * as path from 'path';
import { Construct } from 'constructs';
import { EnvironmentConfig } from './config';

export interface ComputeStackProps extends cdk.StackProps {
	readonly config: EnvironmentConfig;
	readonly vpc: ec2.IVpc;
	readonly lambdaSecurityGroup: ec2.ISecurityGroup;
	readonly senateQueue: sqs.IQueue;
	readonly houseQueue: sqs.IQueue;
	readonly rateLimitTable: dynamodb.ITable;
	readonly jobTrackingTable: dynamodb.ITable;
	readonly teeNamespace: servicediscovery.INamespace;
	readonly teeService: servicediscovery.IService;
}

/**
 * ComputeStack creates Lambda functions for processing Senate and House CWC submissions
 * with appropriate IAM roles, VPC configuration, and monitoring.
 */
export class ComputeStack extends cdk.Stack {
	public readonly senateWorkerFunction: lambda.Function;
	public readonly houseWorkerFunction: lambda.Function;
	public readonly senateWorkerRole: iam.Role;
	public readonly houseWorkerRole: iam.Role;
	public readonly teeProxyFunction: lambda.Function;
	public readonly teeProxyRole: iam.Role;

	constructor(scope: Construct, id: string, props: ComputeStackProps) {
		super(scope, id, props);

		const {
			config,
			vpc,
			lambdaSecurityGroup,
			senateQueue,
			houseQueue,
			rateLimitTable,
			jobTrackingTable
		} = props;

		// Create IAM roles for Lambda functions
		this.senateWorkerRole = this.createLambdaRole('SenateWorkerRole', config);
		this.houseWorkerRole = this.createLambdaRole('HouseWorkerRole', config);

		// Grant permissions to access DynamoDB tables
		this.grantDynamoDbPermissions(this.senateWorkerRole, rateLimitTable, jobTrackingTable);
		this.grantDynamoDbPermissions(this.houseWorkerRole, rateLimitTable, jobTrackingTable);

		// Grant permissions to access SQS queues
		senateQueue.grantConsumeMessages(this.senateWorkerRole);
		houseQueue.grantConsumeMessages(this.houseWorkerRole);

		// Create Lambda functions
		this.senateWorkerFunction = this.createWorkerFunction(
			'SenateWorkerFunction',
			'senate-worker',
			this.senateWorkerRole,
			config,
			vpc,
			lambdaSecurityGroup
		);

		this.houseWorkerFunction = this.createWorkerFunction(
			'HouseWorkerFunction',
			'house-worker',
			this.houseWorkerRole,
			config,
			vpc,
			lambdaSecurityGroup
		);

		// Create TEE Proxy Lambda
		this.teeProxyRole = this.createLambdaRole('TeeProxyRole', config);

		// Grant permissions for Service Discovery
		this.teeProxyRole.addToPolicy(new iam.PolicyStatement({
			effect: iam.Effect.ALLOW,
			actions: ['servicediscovery:DiscoverInstances'],
			resources: ['*'] // Ideally restrict to the namespace/service
		}));

		this.teeProxyFunction = this.createWorkerFunction(
			'TeeProxyFunction',
			'tee-proxy',
			this.teeProxyRole,
			config,
			vpc,
			lambdaSecurityGroup
		);

		// Add environment variables for TEE discovery
		this.teeProxyFunction.addEnvironment('TEE_NAMESPACE', props.teeNamespace.namespaceName);
		this.teeProxyFunction.addEnvironment('TEE_SERVICE_NAME', props.teeService.serviceName);

		// Configure SQS event sources for Lambda functions
		this.configureSqsEventSources(config, senateQueue, houseQueue);

		// Create CloudWatch alarms for Lambda monitoring
		this.createLambdaAlarms(config);

		// Add tags to all resources
		this.addResourceTags(config.tags);

		// Create outputs
		this.createOutputs(config);
	}

	/**
	 * Create IAM role for Lambda functions with appropriate permissions
	 */
	private createLambdaRole(id: string, config: EnvironmentConfig): iam.Role {
		const role = new iam.Role(this, id, {
			roleName: `${config.appName}-${id.toLowerCase()}`,
			assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
			description: `IAM role for ${id} Lambda function`,
			managedPolicies: [
				iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
				...(config.monitoring.enableXray
					? [iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess')]
					: [])
			]
		});

		// Add custom policies for CWC integration
		role.addToPolicy(
			new iam.PolicyStatement({
				sid: 'CloudWatchLogs',
				effect: iam.Effect.ALLOW,
				actions: [
					'logs:CreateLogGroup',
					'logs:CreateLogStream',
					'logs:PutLogEvents',
					'logs:DescribeLogStreams'
				],
				resources: [
					`arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/${config.appName}-*`,
					`arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/${config.appName}-*:*`
				]
			})
		);

		// Add SSM permissions for configuration parameters
		role.addToPolicy(
			new iam.PolicyStatement({
				sid: 'SSMParameters',
				effect: iam.Effect.ALLOW,
				actions: ['ssm:GetParameter', 'ssm:GetParameters', 'ssm:GetParametersByPath'],
				resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/${config.appName}/*`]
			})
		);

		// Add Secrets Manager permissions for sensitive data
		role.addToPolicy(
			new iam.PolicyStatement({
				sid: 'SecretsManager',
				effect: iam.Effect.ALLOW,
				actions: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
				resources: [
					`arn:aws:secretsmanager:${this.region}:${this.account}:secret:${config.appName}/*`
				]
			})
		);

		return role;
	}

	/**
	 * Grant DynamoDB permissions to IAM role
	 */
	private grantDynamoDbPermissions(
		role: iam.Role,
		rateLimitTable: dynamodb.ITable,
		jobTrackingTable: dynamodb.ITable
	): void {
		rateLimitTable.grantReadWriteData(role);
		jobTrackingTable.grantReadWriteData(role);
	}

	/**
	 * Create Lambda function with appropriate configuration
	 */
	private createWorkerFunction(
		id: string,
		workerType: string,
		role: iam.Role,
		config: EnvironmentConfig,
		vpc: ec2.IVpc,
		securityGroup: ec2.ISecurityGroup
	): lambda.Function {
		// Create log group with appropriate retention
		const logGroup = new logs.LogGroup(this, `${id}LogGroup`, {
			logGroupName: `/aws/lambda/${config.appName}-${workerType}`,
			retention: this.getRetentionDays(config.lambda.logRetentionDays),
			removalPolicy: cdk.RemovalPolicy.DESTROY
		});

		// Define the Lambda function
		const lambdaFunction = new lambda.Function(this, id, {
			functionName: `${config.appName}-${workerType}`,
			runtime: lambda.Runtime.NODEJS_18_X,
			handler: 'index.handler',
			code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda', workerType, 'dist')),
			role: role,
			timeout: cdk.Duration.seconds(config.lambda.timeout),
			memorySize: config.lambda.memorySize,
			reservedConcurrentExecutions: config.lambda.reservedConcurrency,
			logGroup: logGroup,
			environment: {
				...config.lambda.environment,
				FUNCTION_NAME: `${config.appName}-${workerType}`
			},
			vpc: vpc,
			vpcSubnets: {
				subnetType: ec2.SubnetType.PRIVATE_ISOLATED
			},
			securityGroups: [securityGroup],
			tracing: config.monitoring.enableXray ? lambda.Tracing.ACTIVE : lambda.Tracing.DISABLED,
			description: `${workerType} Lambda function for processing CWC submissions`,
			deadLetterQueueEnabled: true,
			deadLetterQueue: new sqs.Queue(this, `${id}DLQ`, {
				queueName: `${config.appName}-${workerType}-dlq`,
				retentionPeriod: cdk.Duration.days(7)
			})
		});

		// Add function URL for testing (dev environment only)
		if (config.environment === 'development') {
			lambdaFunction.addFunctionUrl({
				authType: lambda.FunctionUrlAuthType.NONE,
				cors: {
					allowedOrigins: ['*'],
					allowedMethods: [lambda.HttpMethod.POST],
					allowedHeaders: ['*']
				}
			});
		}

		return lambdaFunction;
	}

	/**
	 * Configure SQS event sources for Lambda functions
	 */
	private configureSqsEventSources(
		config: EnvironmentConfig,
		senateQueue: sqs.IQueue,
		houseQueue: sqs.IQueue
	): void {
		// Senate queue event source
		this.senateWorkerFunction.addEventSource(
			new lambdaEventSources.SqsEventSource(senateQueue, {
				maxBatchingWindow: undefined
			})
		);

		// House queue event source
		this.houseWorkerFunction.addEventSource(
			new lambdaEventSources.SqsEventSource(houseQueue, {
				maxBatchingWindow: undefined
			})
		);
	}

	/**
	 * Create CloudWatch alarms for Lambda monitoring
	 */
	private createLambdaAlarms(config: EnvironmentConfig): void {
		if (!config.monitoring.enableDetailedMonitoring) {
			return;
		}

		// Create alarms for Senate worker
		this.createLambdaAlarmsForFunction('SenateWorker', this.senateWorkerFunction, config);

		// Create alarms for House worker
		this.createLambdaAlarmsForFunction('HouseWorker', this.houseWorkerFunction, config);
	}

	/**
	 * Create alarms for a specific Lambda function
	 */
	private createLambdaAlarmsForFunction(
		prefix: string,
		lambdaFunction: lambda.Function,
		config: EnvironmentConfig
	): void {
		// Error rate alarm
		new cloudwatch.Alarm(this, `${prefix}ErrorRateAlarm`, {
			alarmName: `${config.appName}-${prefix.toLowerCase()}-error-rate`,
			alarmDescription: `${prefix} Lambda function error rate is too high`,
			metric: lambdaFunction.metricErrors({
				period: cdk.Duration.minutes(5),
				statistic: 'Sum'
			}),
			threshold: config.environment === 'production' ? 5 : 10,
			comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
			evaluationPeriods: 2,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
		});

		// Duration alarm
		new cloudwatch.Alarm(this, `${prefix}DurationAlarm`, {
			alarmName: `${config.appName}-${prefix.toLowerCase()}-duration`,
			alarmDescription: `${prefix} Lambda function duration is too high`,
			metric: lambdaFunction.metricDuration({
				period: cdk.Duration.minutes(5),
				statistic: 'Average'
			}),
			threshold: config.lambda.timeout * 0.8 * 1000, // 80% of timeout in milliseconds
			comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
			evaluationPeriods: 3,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
		});

		// Throttles alarm
		new cloudwatch.Alarm(this, `${prefix}ThrottlesAlarm`, {
			alarmName: `${config.appName}-${prefix.toLowerCase()}-throttles`,
			alarmDescription: `${prefix} Lambda function is being throttled`,
			metric: lambdaFunction.metricThrottles({
				period: cdk.Duration.minutes(5),
				statistic: 'Sum'
			}),
			threshold: 0,
			comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
			evaluationPeriods: 1,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
		});

		// Concurrent executions alarm
		new cloudwatch.Alarm(this, `${prefix}ConcurrentExecutionsAlarm`, {
			alarmName: `${config.appName}-${prefix.toLowerCase()}-concurrent-executions`,
			alarmDescription: `${prefix} Lambda function concurrent executions are high`,
			metric: lambdaFunction.metric('ConcurrentExecutions', {
				period: cdk.Duration.minutes(5),
				statistic: 'Maximum'
			}),
			threshold: (config.lambda.reservedConcurrency || 10) * 0.8, // 80% of reserved concurrency
			comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
			evaluationPeriods: 2,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
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

	/**
	 * Create CloudFormation outputs
	 */
	private createOutputs(config: EnvironmentConfig): void {
		// Senate Worker outputs
		new cdk.CfnOutput(this, 'SenateWorkerFunctionName', {
			value: this.senateWorkerFunction.functionName,
			description: 'Senate worker Lambda function name',
			exportName: `${config.appName}-senate-worker-function-name`
		});

		new cdk.CfnOutput(this, 'SenateWorkerFunctionArn', {
			value: this.senateWorkerFunction.functionArn,
			description: 'Senate worker Lambda function ARN',
			exportName: `${config.appName}-senate-worker-function-arn`
		});

		// House Worker outputs
		new cdk.CfnOutput(this, 'HouseWorkerFunctionName', {
			value: this.houseWorkerFunction.functionName,
			description: 'House worker Lambda function name',
			exportName: `${config.appName}-house-worker-function-name`
		});

		new cdk.CfnOutput(this, 'HouseWorkerFunctionArn', {
			value: this.houseWorkerFunction.functionArn,
			description: 'House worker Lambda function ARN',
			exportName: `${config.appName}-house-worker-function-arn`
		});

		// IAM Role outputs
		new cdk.CfnOutput(this, 'SenateWorkerRoleArn', {
			value: this.senateWorkerRole.roleArn,
			description: 'Senate worker IAM role ARN',
			exportName: `${config.appName}-senate-worker-role-arn`
		});

		new cdk.CfnOutput(this, 'HouseWorkerRoleArn', {
			value: this.houseWorkerRole.roleArn,
			description: 'House worker IAM role ARN',
			exportName: `${config.appName}-house-worker-role-arn`
		});
	}
	/**
	 * Helper to get log retention days from number
	 */
	private getRetentionDays(days: number): logs.RetentionDays {
		switch (days) {
			case 1: return logs.RetentionDays.ONE_DAY;
			case 3: return logs.RetentionDays.THREE_DAYS;
			case 5: return logs.RetentionDays.FIVE_DAYS;
			case 7: return logs.RetentionDays.ONE_WEEK;
			case 14: return logs.RetentionDays.TWO_WEEKS;
			case 30: return logs.RetentionDays.ONE_MONTH;
			case 60: return logs.RetentionDays.TWO_MONTHS;
			case 90: return logs.RetentionDays.THREE_MONTHS;
			case 180: return logs.RetentionDays.SIX_MONTHS;
			case 365: return logs.RetentionDays.ONE_YEAR;
			default: return logs.RetentionDays.ONE_WEEK;
		}
	}
}
