import { EnvironmentConfig } from './types';

export const devConfig: EnvironmentConfig = {
	environment: 'development',
	region: 'us-east-1',
	appName: 'communique-dev',
	vpcCidr: '10.0.0.0/16',
	enableVpcLogs: false,
	enableNatGateway: true, // Enabled (using NAT Instance for cost savings)

	dynamodb: {
		rateLimitTable: {
			tableName: 'communique-dev-rate-limits',
			billingMode: 'PAY_PER_REQUEST',
			enablePointInTimeRecovery: false,
			enableEncryption: true,
			ttlAttributeName: 'expiresAt'
		},
		jobTrackingTable: {
			tableName: 'communique-dev-job-tracking',
			billingMode: 'PAY_PER_REQUEST',
			enablePointInTimeRecovery: false,
			enableEncryption: true,
			ttlAttributeName: 'completedAt'
		}
	},

	sqs: {
		senateQueue: {
			queueName: 'communique-dev-senate-submissions.fifo',
			fifoQueue: true,
			contentBasedDeduplication: true,
			visibilityTimeoutSeconds: 300, // 5 minutes
			maxReceiveCount: 3,
			enableDlq: true
		},
		houseQueue: {
			queueName: 'communique-dev-house-submissions.fifo',
			fifoQueue: true,
			contentBasedDeduplication: true,
			visibilityTimeoutSeconds: 300, // 5 minutes
			maxReceiveCount: 3,
			enableDlq: true
		},
		dlqRetentionDays: 7,
		messageRetentionDays: 4
	},

	lambda: {
		timeout: 300, // 5 minutes
		memorySize: 512, // MB
		runtime: 'nodejs18.x',
		logRetentionDays: 7,
		reservedConcurrency: 5, // Limit for dev environment
		environment: {
			NODE_ENV: 'development',
			LOG_LEVEL: 'debug',
			RATE_LIMIT_TABLE: 'communique-dev-rate-limits',
			JOB_TRACKING_TABLE: 'communique-dev-job-tracking',
			CWC_API_TIMEOUT: '30000',
			MAX_RETRY_ATTEMPTS: '3'
		}
	},

	monitoring: {
		enableXray: false,
		enableDetailedMonitoring: false,
		alarmEmail: 'dev-alerts@communique.app',
		dashboardName: 'Communique-Dev-CWC'
	},

	cost: {
		monthlyBudgetUsd: 20,
		enableBudgetAlerts: false // Disabled to avoid deployment errors and cost
	},

	security: {
		enableKmsEncryption: true,
		kmsKeyRotation: false,
		enableVpcEndpoints: false
	},

	tags: {
		Environment: 'development',
		Project: 'communique',
		Component: 'cwc-integration',
		Owner: 'dev-team',
		CostCenter: 'development',
		Backup: 'none'
	}
};
