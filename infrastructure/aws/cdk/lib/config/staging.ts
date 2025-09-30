import { EnvironmentConfig } from './types';

export const stagingConfig: EnvironmentConfig = {
	environment: 'staging',
	region: 'us-east-1',
	appName: 'communique-staging',
	vpcCidr: '10.1.0.0/16',
	enableVpcLogs: true,
	enableNatGateway: true,

	dynamodb: {
		rateLimitTable: {
			tableName: 'communique-staging-rate-limits',
			billingMode: 'PAY_PER_REQUEST',
			enablePointInTimeRecovery: true,
			enableEncryption: true,
			ttlAttributeName: 'expiresAt'
		},
		jobTrackingTable: {
			tableName: 'communique-staging-job-tracking',
			billingMode: 'PAY_PER_REQUEST',
			enablePointInTimeRecovery: true,
			enableEncryption: true,
			ttlAttributeName: 'completedAt'
		}
	},

	sqs: {
		senateQueue: {
			queueName: 'communique-staging-senate-submissions.fifo',
			fifoQueue: true,
			contentBasedDeduplication: true,
			visibilityTimeoutSeconds: 600, // 10 minutes
			maxReceiveCount: 5,
			enableDlq: true
		},
		houseQueue: {
			queueName: 'communique-staging-house-submissions.fifo',
			fifoQueue: true,
			contentBasedDeduplication: true,
			visibilityTimeoutSeconds: 600, // 10 minutes
			maxReceiveCount: 5,
			enableDlq: true
		},
		dlqRetentionDays: 14,
		messageRetentionDays: 7
	},

	lambda: {
		timeout: 600, // 10 minutes
		memorySize: 1024, // MB
		runtime: 'nodejs18.x',
		logRetentionDays: 14,
		reservedConcurrency: 10,
		environment: {
			NODE_ENV: 'staging',
			LOG_LEVEL: 'info',
			RATE_LIMIT_TABLE: 'communique-staging-rate-limits',
			JOB_TRACKING_TABLE: 'communique-staging-job-tracking',
			CWC_API_TIMEOUT: '45000',
			MAX_RETRY_ATTEMPTS: '5'
		}
	},

	monitoring: {
		enableXray: true,
		enableDetailedMonitoring: true,
		alarmEmail: 'staging-alerts@communique.app',
		dashboardName: 'Communique-Staging-CWC'
	},

	cost: {
		monthlyBudgetUsd: 200,
		enableBudgetAlerts: true
	},

	security: {
		enableKmsEncryption: true,
		kmsKeyRotation: true,
		enableVpcEndpoints: true
	},

	tags: {
		Environment: 'staging',
		Project: 'communique',
		Component: 'cwc-integration',
		Owner: 'platform-team',
		CostCenter: 'staging',
		Backup: 'daily'
	}
};
