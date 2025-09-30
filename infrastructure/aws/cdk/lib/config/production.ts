import { EnvironmentConfig } from './types';

export const productionConfig: EnvironmentConfig = {
	environment: 'production',
	region: 'us-east-1',
	appName: 'communique',
	vpcCidr: '10.2.0.0/16',
	enableVpcLogs: true,
	enableNatGateway: true,

	dynamodb: {
		rateLimitTable: {
			tableName: 'communique-rate-limits',
			billingMode: 'PAY_PER_REQUEST',
			enablePointInTimeRecovery: true,
			enableEncryption: true,
			ttlAttributeName: 'expiresAt'
		},
		jobTrackingTable: {
			tableName: 'communique-job-tracking',
			billingMode: 'PAY_PER_REQUEST',
			enablePointInTimeRecovery: true,
			enableEncryption: true,
			ttlAttributeName: 'completedAt'
		}
	},

	sqs: {
		senateQueue: {
			queueName: 'communique-senate-submissions.fifo',
			fifoQueue: true,
			contentBasedDeduplication: true,
			visibilityTimeoutSeconds: 900, // 15 minutes
			maxReceiveCount: 10, // More retries for production
			enableDlq: true
		},
		houseQueue: {
			queueName: 'communique-house-submissions.fifo',
			fifoQueue: true,
			contentBasedDeduplication: true,
			visibilityTimeoutSeconds: 900, // 15 minutes
			maxReceiveCount: 10, // More retries for production
			enableDlq: true
		},
		dlqRetentionDays: 30,
		messageRetentionDays: 14
	},

	lambda: {
		timeout: 900, // 15 minutes (max)
		memorySize: 2048, // MB - Higher for production reliability
		runtime: 'nodejs18.x',
		logRetentionDays: 30,
		reservedConcurrency: 50, // Higher concurrency for production
		environment: {
			NODE_ENV: 'production',
			LOG_LEVEL: 'warn',
			RATE_LIMIT_TABLE: 'communique-rate-limits',
			JOB_TRACKING_TABLE: 'communique-job-tracking',
			CWC_API_TIMEOUT: '60000',
			MAX_RETRY_ATTEMPTS: '10'
		}
	},

	monitoring: {
		enableXray: true,
		enableDetailedMonitoring: true,
		alarmEmail: 'alerts@communique.app',
		dashboardName: 'Communique-Production-CWC'
	},

	cost: {
		monthlyBudgetUsd: 1000,
		enableBudgetAlerts: true
	},

	security: {
		enableKmsEncryption: true,
		kmsKeyRotation: true,
		enableVpcEndpoints: true
	},

	tags: {
		Environment: 'production',
		Project: 'communique',
		Component: 'cwc-integration',
		Owner: 'platform-team',
		CostCenter: 'production',
		Backup: 'daily',
		Compliance: 'required',
		DataClassification: 'confidential'
	}
};
