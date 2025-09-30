/**
 * Environment configuration types for Communique CDK infrastructure
 */

export interface EnvironmentConfig {
	readonly environment: 'development' | 'staging' | 'production';
	readonly region: string;
	readonly account?: string;
	readonly appName: string;
	readonly vpcCidr: string;
	readonly enableVpcLogs: boolean;
	readonly enableNatGateway: boolean;

	// DynamoDB Configuration
	readonly dynamodb: {
		readonly rateLimitTable: TableConfig;
		readonly jobTrackingTable: TableConfig;
	};

	// SQS Configuration
	readonly sqs: {
		readonly senateQueue: QueueConfig;
		readonly houseQueue: QueueConfig;
		readonly dlqRetentionDays: number;
		readonly messageRetentionDays: number;
	};

	// Lambda Configuration
	readonly lambda: {
		readonly timeout: number;
		readonly memorySize: number;
		readonly runtime: string;
		readonly logRetentionDays: number;
		readonly reservedConcurrency?: number;
		readonly environment: Record<string, string>;
	};

	// Monitoring Configuration
	readonly monitoring: {
		readonly enableXray: boolean;
		readonly enableDetailedMonitoring: boolean;
		readonly alarmEmail?: string;
		readonly dashboardName: string;
	};

	// Cost Configuration
	readonly cost: {
		readonly monthlyBudgetUsd: number;
		readonly enableBudgetAlerts: boolean;
	};

	// Security Configuration
	readonly security: {
		readonly enableKmsEncryption: boolean;
		readonly kmsKeyRotation: boolean;
		readonly enableVpcEndpoints: boolean;
	};

	// Tagging
	readonly tags: Record<string, string>;
}

export interface TableConfig {
	readonly tableName: string;
	readonly billingMode: 'PAY_PER_REQUEST' | 'PROVISIONED';
	readonly readCapacity?: number;
	readonly writeCapacity?: number;
	readonly enablePointInTimeRecovery: boolean;
	readonly enableEncryption: boolean;
	readonly ttlAttributeName?: string;
}

export interface QueueConfig {
	readonly queueName: string;
	readonly fifoQueue: boolean;
	readonly contentBasedDeduplication: boolean;
	readonly visibilityTimeoutSeconds: number;
	readonly maxReceiveCount: number;
	readonly enableDlq: boolean;
}

/**
 * Multi-region configuration for disaster recovery
 */
export interface MultiRegionConfig {
	readonly primaryRegion: string;
	readonly backupRegions: string[];
	readonly enableCrossRegionBackup: boolean;
	readonly rpoMinutes: number; // Recovery Point Objective
	readonly rtoMinutes: number; // Recovery Time Objective
}

/**
 * Integration configuration for external services
 */
export interface IntegrationConfig {
	readonly communiqueDatabase: {
		readonly connectionStringSecretName: string;
		readonly enableConnectionPooling: boolean;
		readonly maxConnections: number;
	};
	readonly cwcApi: {
		readonly baseUrl: string;
		readonly apiKeySecretName: string;
		readonly timeoutMs: number;
		readonly retryAttempts: number;
	};
}
