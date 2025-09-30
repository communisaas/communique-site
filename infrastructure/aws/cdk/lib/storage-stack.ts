import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as backup from 'aws-cdk-lib/aws-backup';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { EnvironmentConfig } from './config';

export interface StorageStackProps extends cdk.StackProps {
	readonly config: EnvironmentConfig;
}

/**
 * StorageStack creates DynamoDB tables for rate limiting and job tracking
 * with appropriate backup, encryption, and monitoring configurations.
 */
export class StorageStack extends cdk.Stack {
	public readonly rateLimitTable: dynamodb.Table;
	public readonly jobTrackingTable: dynamodb.Table;
	public readonly kmsKey?: kms.Key;

	constructor(scope: Construct, id: string, props: StorageStackProps) {
		super(scope, id, props);

		const { config } = props;

		// Create KMS key for encryption if enabled
		if (config.security.enableKmsEncryption) {
			this.kmsKey = new kms.Key(this, 'CommuniqueKmsKey', {
				description: `KMS key for ${config.appName} DynamoDB encryption`,
				enableKeyRotation: config.security.kmsKeyRotation,
				keySpec: kms.KeySpec.SYMMETRIC_DEFAULT,
				keyUsage: kms.KeyUsage.ENCRYPT_DECRYPT,
				policy: this.createKmsKeyPolicy(),
				removalPolicy:
					config.environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY
			});

			// Add alias for easier management
			new kms.Alias(this, 'CommuniqueKmsKeyAlias', {
				aliasName: `alias/${config.appName}-dynamodb`,
				targetKey: this.kmsKey
			});
		}

		// Create Rate Limiting Table
		this.rateLimitTable = this.createRateLimitTable(config);

		// Create Job Tracking Table
		this.jobTrackingTable = this.createJobTrackingTable(config);

		// Create backup vault and plan if in production
		if (config.environment === 'production' || config.environment === 'staging') {
			this.createBackupResources(config);
		}

		// Add tags to all resources
		this.addResourceTags(config.tags);

		// Create outputs
		this.createOutputs(config);
	}

	/**
	 * Create the Rate Limiting DynamoDB table
	 */
	private createRateLimitTable(config: EnvironmentConfig): dynamodb.Table {
		const tableConfig = config.dynamodb.rateLimitTable;

		return new dynamodb.Table(this, 'RateLimitTable', {
			tableName: tableConfig.tableName,
			partitionKey: {
				name: 'pk',
				type: dynamodb.AttributeType.STRING
			},
			sortKey: {
				name: 'sk',
				type: dynamodb.AttributeType.STRING
			},
			billingMode:
				tableConfig.billingMode === 'PAY_PER_REQUEST'
					? dynamodb.BillingMode.PAY_PER_REQUEST
					: dynamodb.BillingMode.PROVISIONED,
			readCapacity: tableConfig.readCapacity,
			writeCapacity: tableConfig.writeCapacity,
			encryption: tableConfig.enableEncryption
				? this.kmsKey
					? dynamodb.TableEncryption.CUSTOMER_MANAGED
					: dynamodb.TableEncryption.AWS_MANAGED
				: dynamodb.TableEncryption.DEFAULT,
			encryptionKey: this.kmsKey,
			pointInTimeRecovery: tableConfig.enablePointInTimeRecovery,
			timeToLiveAttribute: tableConfig.ttlAttributeName,
			removalPolicy:
				config.environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
			contributorInsightsEnabled: config.monitoring.enableDetailedMonitoring,
			stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES, // For monitoring changes
			globalSecondaryIndexes: [
				{
					indexName: 'UserIdIndex',
					partitionKey: {
						name: 'userId',
						type: dynamodb.AttributeType.STRING
					},
					sortKey: {
						name: 'createdAt',
						type: dynamodb.AttributeType.NUMBER
					},
					projectionType: dynamodb.ProjectionType.ALL
				},
				{
					indexName: 'ExpirationIndex',
					partitionKey: {
						name: 'expiresAt',
						type: dynamodb.AttributeType.NUMBER
					},
					projectionType: dynamodb.ProjectionType.KEYS_ONLY
				}
			]
		});
	}

	/**
	 * Create the Job Tracking DynamoDB table
	 */
	private createJobTrackingTable(config: EnvironmentConfig): dynamodb.Table {
		const tableConfig = config.dynamodb.jobTrackingTable;

		return new dynamodb.Table(this, 'JobTrackingTable', {
			tableName: tableConfig.tableName,
			partitionKey: {
				name: 'jobId',
				type: dynamodb.AttributeType.STRING
			},
			sortKey: {
				name: 'version',
				type: dynamodb.AttributeType.NUMBER
			},
			billingMode:
				tableConfig.billingMode === 'PAY_PER_REQUEST'
					? dynamodb.BillingMode.PAY_PER_REQUEST
					: dynamodb.BillingMode.PROVISIONED,
			readCapacity: tableConfig.readCapacity,
			writeCapacity: tableConfig.writeCapacity,
			encryption: tableConfig.enableEncryption
				? this.kmsKey
					? dynamodb.TableEncryption.CUSTOMER_MANAGED
					: dynamodb.TableEncryption.AWS_MANAGED
				: dynamodb.TableEncryption.DEFAULT,
			encryptionKey: this.kmsKey,
			pointInTimeRecovery: tableConfig.enablePointInTimeRecovery,
			timeToLiveAttribute: tableConfig.ttlAttributeName,
			removalPolicy:
				config.environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
			contributorInsightsEnabled: config.monitoring.enableDetailedMonitoring,
			stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES, // For monitoring and audit
			globalSecondaryIndexes: [
				{
					indexName: 'UserJobIndex',
					partitionKey: {
						name: 'userId',
						type: dynamodb.AttributeType.STRING
					},
					sortKey: {
						name: 'createdAt',
						type: dynamodb.AttributeType.NUMBER
					},
					projectionType: dynamodb.ProjectionType.ALL
				},
				{
					indexName: 'StatusIndex',
					partitionKey: {
						name: 'status',
						type: dynamodb.AttributeType.STRING
					},
					sortKey: {
						name: 'createdAt',
						type: dynamodb.AttributeType.NUMBER
					},
					projectionType: dynamodb.ProjectionType.ALL
				},
				{
					indexName: 'CompletionIndex',
					partitionKey: {
						name: 'completedAt',
						type: dynamodb.AttributeType.NUMBER
					},
					projectionType: dynamodb.ProjectionType.KEYS_ONLY
				}
			]
		});
	}

	/**
	 * Create backup vault and backup plan for production environments
	 */
	private createBackupResources(config: EnvironmentConfig): void {
		// Create backup vault
		const backupVault = new backup.BackupVault(this, 'DynamoBackupVault', {
			backupVaultName: `${config.appName}-dynamodb-backup-vault`,
			encryptionKey: this.kmsKey,
			removalPolicy:
				config.environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY
		});

		// Create backup plan
		const backupPlan = new backup.BackupPlan(this, 'DynamoBackupPlan', {
			backupPlanName: `${config.appName}-dynamodb-backup-plan`,
			backupVault: backupVault,
			backupPlanRules: [
				{
					ruleName: 'DailyBackups',
					scheduleExpression: backup.Schedule.cron({
						hour: '2',
						minute: '0'
					}),
					startWindow: cdk.Duration.hours(1),
					completionWindow: cdk.Duration.hours(2),
					deleteAfter: cdk.Duration.days(30),
					moveToColdStorageAfter: cdk.Duration.days(7)
				}
			]
		});

		// Add DynamoDB tables to backup selection
		backupPlan.addSelection('DynamoBackupSelection', {
			resources: [
				backup.BackupResource.fromDynamoDbTable(this.rateLimitTable),
				backup.BackupResource.fromDynamoDbTable(this.jobTrackingTable)
			]
		});
	}

	/**
	 * Create IAM policy for KMS key access
	 */
	private createKmsKeyPolicy(): iam.PolicyDocument {
		return new iam.PolicyDocument({
			statements: [
				new iam.PolicyStatement({
					sid: 'Enable IAM User Permissions',
					effect: iam.Effect.ALLOW,
					principals: [new iam.AccountRootPrincipal()],
					actions: ['kms:*'],
					resources: ['*']
				}),
				new iam.PolicyStatement({
					sid: 'Allow DynamoDB Service',
					effect: iam.Effect.ALLOW,
					principals: [new iam.ServicePrincipal('dynamodb.amazonaws.com')],
					actions: [
						'kms:Encrypt',
						'kms:Decrypt',
						'kms:ReEncrypt*',
						'kms:GenerateDataKey*',
						'kms:DescribeKey'
					],
					resources: ['*']
				}),
				new iam.PolicyStatement({
					sid: 'Allow Lambda Access',
					effect: iam.Effect.ALLOW,
					principals: [new iam.ServicePrincipal('lambda.amazonaws.com')],
					actions: [
						'kms:Encrypt',
						'kms:Decrypt',
						'kms:ReEncrypt*',
						'kms:GenerateDataKey*',
						'kms:DescribeKey'
					],
					resources: ['*']
				})
			]
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
		new cdk.CfnOutput(this, 'RateLimitTableName', {
			value: this.rateLimitTable.tableName,
			description: 'Rate limit DynamoDB table name',
			exportName: `${config.appName}-rate-limit-table-name`
		});

		new cdk.CfnOutput(this, 'RateLimitTableArn', {
			value: this.rateLimitTable.tableArn,
			description: 'Rate limit DynamoDB table ARN',
			exportName: `${config.appName}-rate-limit-table-arn`
		});

		new cdk.CfnOutput(this, 'JobTrackingTableName', {
			value: this.jobTrackingTable.tableName,
			description: 'Job tracking DynamoDB table name',
			exportName: `${config.appName}-job-tracking-table-name`
		});

		new cdk.CfnOutput(this, 'JobTrackingTableArn', {
			value: this.jobTrackingTable.tableArn,
			description: 'Job tracking DynamoDB table ARN',
			exportName: `${config.appName}-job-tracking-table-arn`
		});

		if (this.kmsKey) {
			new cdk.CfnOutput(this, 'KmsKeyId', {
				value: this.kmsKey.keyId,
				description: 'KMS key ID for DynamoDB encryption',
				exportName: `${config.appName}-kms-key-id`
			});

			new cdk.CfnOutput(this, 'KmsKeyArn', {
				value: this.kmsKey.keyArn,
				description: 'KMS key ARN for DynamoDB encryption',
				exportName: `${config.appName}-kms-key-arn`
			});
		}
	}
}
