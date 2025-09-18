/**
 * Configuration management for Delivery Platform
 */

import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

// Define the EnvironmentConfig type locally
export interface EnvironmentConfig {
	nodeEnv: string;
	smtp: {
		host: string;
		port: number;
		secure: boolean;
		auth?: {
			user: string;
			pass: string;
		};
	};
	api: {
		communiqueUrl: string;
		communiqueApiKey: string;
		cwcUrl: string;
		cwcApiKey: string;
		voterUrl: string;
		voterApiKey: string;
		n8nUrl: string;
		n8nApiKey: string;
		n8nWebhookSecret: string;
		mailServerKey: string;
	};
	features: {
		enableVoterCertification: boolean;
		enableN8NWorkflows: boolean;
		enableBetaFeatures: boolean;
	};
}

// Load environment variables
dotenvConfig();

// ============================================================================
// Environment Variable Schema
// ============================================================================

const EnvSchema = z.object({
	// Node environment
	NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

	// SMTP Configuration
	SMTP_HOST: z.string().default('0.0.0.0'),
	SMTP_PORT: z.coerce.number().default(25),
	SMTP_SECURE: z.coerce.boolean().default(false),
	SMTP_AUTH_USER: z.string().optional(),
	SMTP_AUTH_PASS: z.string().optional(),

	// API Configuration
	COMMUNIQUE_API_URL: z.string().url().default('https://communi.app'),
	COMMUNIQUE_API_KEY: z.string(),

	CWC_API_URL: z.string().url().default('https://api.house.gov/cwc/v1'),
	CWC_API_KEY: z.string().default(''),

	VOTER_API_URL: z.string().url().default('http://localhost:3000'),
	VOTER_API_KEY: z.string().default(''),

	N8N_URL: z.string().url().default('http://localhost:5678'),
	N8N_API_KEY: z.string().default(''),
	N8N_WEBHOOK_SECRET: z.string().default(''),

	MAIL_SERVER_KEY: z.string().default(''),

	// Feature Flags
	ENABLE_VOTER_CERTIFICATION: z.coerce.boolean().default(false),
	ENABLE_N8N_WORKFLOWS: z.coerce.boolean().default(true),
	ENABLE_BETA_FEATURES: z.coerce.boolean().default(false),

	// Optional configurations
	LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
	MAX_MESSAGE_SIZE: z.coerce.number().default(25 * 1024 * 1024), // 25MB
	RATE_LIMIT_WINDOW: z.coerce.number().default(60000), // 1 minute
	RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100)
});

type EnvConfig = z.infer<typeof EnvSchema>;

// ============================================================================
// Configuration Class
// ============================================================================

class ConfigManager {
	private config: EnvironmentConfig | null = null;
	private envConfig: EnvConfig | null = null;

	/**
	 * Get validated environment configuration
	 */
	private getEnvConfig(): EnvConfig {
		if (!this.envConfig) {
			try {
				this.envConfig = EnvSchema.parse(process.env);
			} catch (_error) {
				if (_error instanceof z.ZodError) {
					console.error('Environment configuration error:');
					_error.errors.forEach((err) => {
						console.error(`  - ${err.path.join('.')}: ${err.message}`);
					});
					throw new Error('Invalid environment configuration');
				}
				throw _error;
			}
		}
		return this.envConfig;
	}

	/**
	 * Get full application configuration
	 */
	public getConfig(): EnvironmentConfig {
		if (!this.config) {
			const env = this.getEnvConfig();

			this.config = {
				nodeEnv: env.NODE_ENV,

				smtp: {
					host: env.SMTP_HOST,
					port: env.SMTP_PORT,
					secure: env.SMTP_SECURE,
					auth:
						env.SMTP_AUTH_USER && env.SMTP_AUTH_PASS
							? {
									user: env.SMTP_AUTH_USER,
									pass: env.SMTP_AUTH_PASS
								}
							: undefined
				},

				api: {
					communiqueUrl: env.COMMUNIQUE_API_URL,
					communiqueApiKey: env.COMMUNIQUE_API_KEY,
					cwcUrl: env.CWC_API_URL,
					cwcApiKey: env.CWC_API_KEY,
					voterUrl: env.VOTER_API_URL,
					voterApiKey: env.VOTER_API_KEY,
					n8nUrl: env.N8N_URL,
					n8nApiKey: env.N8N_API_KEY,
					n8nWebhookSecret: env.N8N_WEBHOOK_SECRET,
					mailServerKey: env.MAIL_SERVER_KEY
				},

				features: {
					enableVoterCertification: env.ENABLE_VOTER_CERTIFICATION,
					enableN8NWorkflows: env.ENABLE_N8N_WORKFLOWS,
					enableBetaFeatures: env.ENABLE_BETA_FEATURES
				}
			};
		}

		return this.config!;
	}

	/**
	 * Get a specific configuration value
	 */
	public get<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
		const env = this.getEnvConfig();
		return env[key];
	}

	/**
	 * Check if running in production
	 */
	public isProduction(): boolean {
		return this.get('NODE_ENV') === 'production';
	}

	/**
	 * Check if running in development
	 */
	public isDevelopment(): boolean {
		return this.get('NODE_ENV') === 'development';
	}

	/**
	 * Check if running in test
	 */
	public isTest(): boolean {
		return this.get('NODE_ENV') === 'test';
	}

	/**
	 * Get log level
	 */
	public getLogLevel(): 'error' | 'warn' | 'info' | 'debug' {
		return this.get('LOG_LEVEL');
	}

	/**
	 * Check if a feature is enabled
	 */
	public isFeatureEnabled(feature: 'voter' | 'n8n' | 'beta'): boolean {
		switch (feature) {
			case 'voter':
				return this.get('ENABLE_VOTER_CERTIFICATION');
			case 'n8n':
				return this.get('ENABLE_N8N_WORKFLOWS');
			case 'beta':
				return this.get('ENABLE_BETA_FEATURES');
			default:
				return false;
		}
	}

	/**
	 * Validate required API keys are present
	 */
	public validateApiKeys(): void {
		const config = this.getConfig();
		const errors: string[] = [];

		if (!config.api.communiqueApiKey) {
			errors.push('COMMUNIQUE_API_KEY is required');
		}

		if (!config.api.cwcApiKey) {
			errors.push('CWC_API_KEY is required');
		}

		if (config.features.enableVoterCertification && !config.api.voterApiKey) {
			errors.push('VOTER_API_KEY is required when VOTER certification is enabled');
		}

		if (config.features.enableN8NWorkflows && !config.api.n8nWebhookSecret) {
			errors.push('N8N_WEBHOOK_SECRET is required when N8N workflows are enabled');
		}

		if (errors.length > 0) {
			throw new Error(`Configuration errors:\n${errors.join('\n')}`);
		}
	}

	/**
	 * Get rate limiting configuration
	 */
	public getRateLimitConfig(): { windowMs: number; maxRequests: number } {
		return {
			windowMs: this.get('RATE_LIMIT_WINDOW'),
			maxRequests: this.get('RATE_LIMIT_MAX_REQUESTS')
		};
	}

	/**
	 * Reset configuration (mainly for testing)
	 */
	public reset(): void {
		this.config = null;
		this.envConfig = null;
	}
}

// ============================================================================
// Singleton Instance
// ============================================================================

const configManager = new ConfigManager();

/**
 * Get application configuration
 */
export function getConfig(): EnvironmentConfig {
	return configManager.getConfig();
}

/**
 * Get specific configuration value
 */
export function getConfigValue<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
	return configManager.get(key);
}

/**
 * Check environment
 */
export const isProduction = (): boolean => configManager.isProduction();
export const isDevelopment = (): boolean => configManager.isDevelopment();
export const isTest = (): boolean => configManager.isTest();

/**
 * Check feature flags
 */
export const isFeatureEnabled = (feature: 'voter' | 'n8n' | 'beta'): boolean =>
	configManager.isFeatureEnabled(feature);

/**
 * Validate configuration
 */
export const validateConfig = (): void => configManager.validateApiKeys();

/**
 * Export the manager for advanced usage
 */
export { configManager };

// ============================================================================
// Default Export
// ============================================================================

export default {
	getConfig,
	getConfigValue,
	isProduction,
	isDevelopment,
	isTest,
	isFeatureEnabled,
	validateConfig
};
