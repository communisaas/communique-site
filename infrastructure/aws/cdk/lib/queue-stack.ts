import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';
import { EnvironmentConfig } from './config';

export interface QueueStackProps extends cdk.StackProps {
	readonly config: EnvironmentConfig;
	readonly kmsKey?: kms.IKey;
}

/**
 * QueueStack creates SQS FIFO queues for Senate and House CWC submissions
 * with dead letter queues, encryption, and monitoring configurations.
 */
export class QueueStack extends cdk.Stack {
	public readonly senateQueue: sqs.Queue;
	public readonly houseQueue: sqs.Queue;
	public readonly senateDlq: sqs.Queue;
	public readonly houseDlq: sqs.Queue;

	constructor(scope: Construct, id: string, props: QueueStackProps) {
		super(scope, id, props);

		const { config, kmsKey } = props;

		// Create Dead Letter Queues first
		this.senateDlq = this.createDeadLetterQueue(
			'SenateDlq',
			`${config.sqs.senateQueue.queueName.replace('.fifo', '')}-dlq.fifo`,
			config
		);

		this.houseDlq = this.createDeadLetterQueue(
			'HouseDlq',
			`${config.sqs.houseQueue.queueName.replace('.fifo', '')}-dlq.fifo`,
			config
		);

		// Create main queues
		this.senateQueue = this.createMainQueue(
			'SenateQueue',
			config.sqs.senateQueue,
			this.senateDlq,
			config,
			kmsKey
		);

		this.houseQueue = this.createMainQueue(
			'HouseQueue',
			config.sqs.houseQueue,
			this.houseDlq,
			config,
			kmsKey
		);

		// Create CloudWatch alarms for queue monitoring
		this.createQueueAlarms(config);

		// Add tags to all resources
		this.addResourceTags(config.tags);

		// Create outputs
		this.createOutputs(config);
	}

	/**
	 * Create a dead letter queue with appropriate configuration
	 */
	private createDeadLetterQueue(
		id: string,
		queueName: string,
		config: EnvironmentConfig
	): sqs.Queue {
		return new sqs.Queue(this, id, {
			queueName: queueName,
			fifo: true,
			contentBasedDeduplication: true,
			retentionPeriod: cdk.Duration.days(config.sqs.dlqRetentionDays),
			visibilityTimeout: cdk.Duration.seconds(60), // Short timeout for DLQ
			removalPolicy:
				config.environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY
		});
	}

	/**
	 * Create a main queue with dead letter queue configuration
	 */
	private createMainQueue(
		id: string,
		queueConfig: any,
		deadLetterQueue: sqs.Queue,
		config: EnvironmentConfig,
		kmsKey?: kms.IKey
	): sqs.Queue {
		const queue = new sqs.Queue(this, id, {
			queueName: queueConfig.queueName,
			fifo: queueConfig.fifoQueue,
			contentBasedDeduplication: queueConfig.contentBasedDeduplication,
			visibilityTimeout: cdk.Duration.seconds(queueConfig.visibilityTimeoutSeconds),
			retentionPeriod: cdk.Duration.days(config.sqs.messageRetentionDays),
			deadLetterQueue: queueConfig.enableDlq
				? {
					queue: deadLetterQueue,
					maxReceiveCount: queueConfig.maxReceiveCount
				}
				: undefined,
			encryption: kmsKey ? sqs.QueueEncryption.KMS : sqs.QueueEncryption.SQS_MANAGED,
			encryptionMasterKey: kmsKey,
			dataKeyReuse: kmsKey ? cdk.Duration.minutes(5) : undefined, // Cost optimization
			removalPolicy:
				config.environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY
		});

		// Add queue policy for Lambda access
		queue.addToResourcePolicy(
			new cdk.aws_iam.PolicyStatement({
				sid: 'AllowLambdaAccess',
				effect: cdk.aws_iam.Effect.ALLOW,
				principals: [new cdk.aws_iam.ServicePrincipal('lambda.amazonaws.com')],
				actions: [
					'sqs:ReceiveMessage',
					'sqs:DeleteMessage',
					'sqs:GetQueueAttributes',
					'sqs:ChangeMessageVisibility'
				],
				resources: [queue.queueArn],
				conditions: {
					StringEquals: {
						'aws:SourceAccount': this.account
					}
				}
			})
		);

		return queue;
	}

	/**
	 * Create CloudWatch alarms for queue monitoring
	 */
	private createQueueAlarms(config: EnvironmentConfig): void {
		if (!config.monitoring.enableDetailedMonitoring) {
			return;
		}

		// Senate Queue Alarms
		this.createQueueAlarmsForQueue('Senate', this.senateQueue, this.senateDlq, config);

		// House Queue Alarms
		this.createQueueAlarmsForQueue('House', this.houseQueue, this.houseDlq, config);
	}

	/**
	 * Create alarms for a specific queue
	 */
	private createQueueAlarmsForQueue(
		prefix: string,
		queue: sqs.Queue,
		dlq: sqs.Queue,
		config: EnvironmentConfig
	): void {
		// Queue depth alarm
		new cloudwatch.Alarm(this, `${prefix}QueueDepthAlarm`, {
			alarmName: `${config.appName}-${prefix.toLowerCase()}-queue-depth`,
			alarmDescription: `${prefix} queue depth is too high`,
			metric: queue.metricApproximateNumberOfMessagesVisible({
				period: cdk.Duration.minutes(5),
				statistic: 'Average'
			}),
			threshold: config.environment === 'production' ? 100 : 50,
			comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
			evaluationPeriods: 2,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
		});

		// Queue age alarm
		new cloudwatch.Alarm(this, `${prefix}QueueAgeAlarm`, {
			alarmName: `${config.appName}-${prefix.toLowerCase()}-queue-age`,
			alarmDescription: `${prefix} queue messages are too old`,
			metric: queue.metricApproximateAgeOfOldestMessage({
				period: cdk.Duration.minutes(5),
				statistic: 'Average'
			}),
			threshold: 600, // 10 minutes
			comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
			evaluationPeriods: 1,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
		});

		// DLQ messages alarm
		new cloudwatch.Alarm(this, `${prefix}DlqMessagesAlarm`, {
			alarmName: `${config.appName}-${prefix.toLowerCase()}-dlq-messages`,
			alarmDescription: `${prefix} DLQ has messages indicating failures`,
			metric: dlq.metricApproximateNumberOfMessagesVisible({
				period: cdk.Duration.minutes(5),
				statistic: 'Sum'
			}),
			threshold: 0,
			comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
			evaluationPeriods: 1,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
		});

		// Queue throughput alarm (low throughput may indicate issues)
		new cloudwatch.Alarm(this, `${prefix}QueueLowThroughputAlarm`, {
			alarmName: `${config.appName}-${prefix.toLowerCase()}-low-throughput`,
			alarmDescription: `${prefix} queue throughput is unusually low`,
			metric: queue.metricNumberOfMessagesSent({
				period: cdk.Duration.minutes(15),
				statistic: 'Sum'
			}),
			threshold: 1,
			comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
			evaluationPeriods: 4, // 1 hour of low activity
			treatMissingData: cloudwatch.TreatMissingData.BREACHING
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
		// Senate Queue outputs
		new cdk.CfnOutput(this, 'SenateQueueName', {
			value: this.senateQueue.queueName,
			description: 'Senate CWC submissions queue name',
			exportName: `${config.appName}-senate-queue-name`
		});

		new cdk.CfnOutput(this, 'SenateQueueArn', {
			value: this.senateQueue.queueArn,
			description: 'Senate CWC submissions queue ARN',
			exportName: `${config.appName}-senate-queue-arn`
		});

		new cdk.CfnOutput(this, 'SenateQueueUrl', {
			value: this.senateQueue.queueUrl,
			description: 'Senate CWC submissions queue URL',
			exportName: `${config.appName}-senate-queue-url`
		});

		// House Queue outputs
		new cdk.CfnOutput(this, 'HouseQueueName', {
			value: this.houseQueue.queueName,
			description: 'House CWC submissions queue name',
			exportName: `${config.appName}-house-queue-name`
		});

		new cdk.CfnOutput(this, 'HouseQueueArn', {
			value: this.houseQueue.queueArn,
			description: 'House CWC submissions queue ARN',
			exportName: `${config.appName}-house-queue-arn`
		});

		new cdk.CfnOutput(this, 'HouseQueueUrl', {
			value: this.houseQueue.queueUrl,
			description: 'House CWC submissions queue URL',
			exportName: `${config.appName}-house-queue-url`
		});

		// DLQ outputs
		new cdk.CfnOutput(this, 'SenateDlqArn', {
			value: this.senateDlq.queueArn,
			description: 'Senate DLQ ARN',
			exportName: `${config.appName}-senate-dlq-arn`
		});

		new cdk.CfnOutput(this, 'HouseDlqArn', {
			value: this.houseDlq.queueArn,
			description: 'House DLQ ARN',
			exportName: `${config.appName}-house-dlq-arn`
		});
	}
}
