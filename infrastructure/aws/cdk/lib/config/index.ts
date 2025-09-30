import { EnvironmentConfig } from './types';
import { devConfig } from './dev';
import { stagingConfig } from './staging';
import { productionConfig } from './production';

/**
 * Get environment configuration based on NODE_ENV
 */
export function getEnvironmentConfig(): EnvironmentConfig {
	const env = process.env.NODE_ENV || 'development';

	switch (env) {
		case 'development':
			return devConfig;
		case 'staging':
			return stagingConfig;
		case 'production':
			return productionConfig;
		default:
			throw new Error(
				`Unknown environment: ${env}. Valid values are: development, staging, production`
			);
	}
}

/**
 * Get configuration for a specific environment
 */
export function getConfigForEnvironment(environment: string): EnvironmentConfig {
	switch (environment) {
		case 'development':
			return devConfig;
		case 'staging':
			return stagingConfig;
		case 'production':
			return productionConfig;
		default:
			throw new Error(
				`Unknown environment: ${environment}. Valid values are: development, staging, production`
			);
	}
}

export * from './types';
export { devConfig, stagingConfig, productionConfig };
