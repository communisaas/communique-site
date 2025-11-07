import { beforeAll, afterAll } from 'vitest';

/**
 * Environment stability checks for CI/local testing
 * Ensures consistent test environment across different systems
 */

interface EnvironmentConfig {
	required: string[];
	optional: string[];
	computed: { [key: string]: () => string };
}

const testEnvironmentConfig: EnvironmentConfig = {
	required: ['NODE_ENV', 'DATABASE_URL'],
	optional: [
		'OAUTH_REDIRECT_BASE_URL',
		'GOOGLE_CLIENT_ID',
		'GOOGLE_CLIENT_SECRET',
		'FACEBOOK_CLIENT_ID',
		'FACEBOOK_CLIENT_SECRET',
		'DISCORD_CLIENT_ID',
		'DISCORD_CLIENT_SECRET',
		'LINKEDIN_CLIENT_ID',
		'LINKEDIN_CLIENT_SECRET',
		'TWITTER_CLIENT_ID',
		'TWITTER_CLIENT_SECRET',
		'ENABLE_BETA'
	],
	computed: {
		IS_CI: () => (process.env.CI === 'true' ? 'true' : 'false'),
		HAS_OAUTH_SETUP: () => {
			const hasGoogle = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
			const hasFacebook = !!(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET);
			const hasDiscord = !!(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET);
			return hasGoogle || hasFacebook || hasDiscord ? 'true' : 'false';
		},
		DATABASE_TYPE: () => {
			const url = process.env.DATABASE_URL || '';
			if (url.includes('postgresql://')) return 'postgresql';
			if (url.includes('sqlite:')) return 'sqlite';
			return 'unknown';
		}
	}
};

export class EnvironmentValidator {
	private static instance: EnvironmentValidator;
	private environmentSnapshot: { [key: string]: string } = {};
	private validationErrors: string[] = [];

	static getInstance(): EnvironmentValidator {
		if (!EnvironmentValidator.instance) {
			EnvironmentValidator.instance = new EnvironmentValidator();
		}
		return EnvironmentValidator.instance;
	}

	/**
	 * Validate environment before tests start
	 */
	validateEnvironment(): void {
		this.validationErrors = [];
		this.captureEnvironmentSnapshot();

		// Check required variables
		for (const variable of testEnvironmentConfig.required) {
			if (!process.env[variable]) {
				this.validationErrors.push(`Required environment variable missing: ${variable}`);
			}
		}

		// Validate database URL format
		if (process.env.DATABASE_URL) {
			const dbUrl = process.env.DATABASE_URL;
			if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('sqlite:')) {
				this.validationErrors.push(
					'DATABASE_URL must be a valid PostgreSQL or SQLite connection string'
				);
			}
		}

		// Check OAuth configuration consistency
		this.validateOAuthConfiguration();

		// Log environment status
		this.logEnvironmentStatus();

		if (this.validationErrors.length > 0) {
			console.error('Environment validation failed:');
			this.validationErrors.forEach((error) => console.error(`  - ${error}`));
			throw new Error(`Environment validation failed with ${this.validationErrors.length} errors`);
		}
	}

	/**
	 * Validate OAuth provider configurations
	 */
	private validateOAuthConfiguration(): void {
		const providers = [
			{ name: 'Google', id: 'GOOGLE_CLIENT_ID', secret: 'GOOGLE_CLIENT_SECRET' },
			{ name: 'Facebook', id: 'FACEBOOK_CLIENT_ID', secret: 'FACEBOOK_CLIENT_SECRET' },
			{ name: 'Discord', id: 'DISCORD_CLIENT_ID', secret: 'DISCORD_CLIENT_SECRET' },
			{ name: 'LinkedIn', id: 'LINKEDIN_CLIENT_ID', secret: 'LINKEDIN_CLIENT_SECRET' },
			{ name: 'Twitter', id: 'TWITTER_CLIENT_ID', secret: 'TWITTER_CLIENT_SECRET' }
		];

		let configuredProviders = 0;

		for (const provider of providers) {
			const hasId = !!process.env[provider.id];
			const hasSecret = !!process.env[provider.secret];

			if (hasId && hasSecret) {
				configuredProviders++;
			} else if (hasId && !hasSecret) {
				this.validationErrors.push(
					`${provider.name} OAuth: CLIENT_ID provided but CLIENT_SECRET missing`
				);
			} else if (!hasId && hasSecret) {
				this.validationErrors.push(
					`${provider.name} OAuth: CLIENT_SECRET provided but CLIENT_ID missing`
				);
			}
		}

		if (configuredProviders === 0) {
			console.warn('⚠️  No OAuth providers configured - OAuth tests will be skipped');
		} else {
			console.log(`✅ ${configuredProviders} OAuth provider(s) configured for testing`);
		}
	}

	/**
	 * Capture snapshot of environment for drift detection
	 */
	private captureEnvironmentSnapshot(): void {
		// Capture required variables
		for (const variable of testEnvironmentConfig.required) {
			this.environmentSnapshot[variable] = process.env[variable] || '';
		}

		// Capture optional variables
		for (const variable of testEnvironmentConfig.optional) {
			this.environmentSnapshot[variable] = process.env[variable] || '';
		}

		// Capture computed variables
		for (const [key, compute] of Object.entries(testEnvironmentConfig.computed)) {
			this.environmentSnapshot[key] = compute();
		}
	}

	/**
	 * Check for environment drift during test execution
	 */
	detectEnvironmentDrift(): string[] {
		const driftDetected: string[] = [];

		// Check required variables
		for (const variable of testEnvironmentConfig.required) {
			const current = process.env[variable] || '';
			const snapshot = this.environmentSnapshot[variable];
			if (current !== snapshot) {
				driftDetected.push(`${variable}: '${snapshot}' → '${current}'`);
			}
		}

		// Check computed variables
		for (const [key, compute] of Object.entries(testEnvironmentConfig.computed)) {
			const current = compute();
			const snapshot = this.environmentSnapshot[key];
			if (current !== snapshot) {
				driftDetected.push(`${key}: '${snapshot}' → '${current}'`);
			}
		}

		return driftDetected;
	}

	/**
	 * Log comprehensive environment status
	 */
	private logEnvironmentStatus(): void {
		console.log('\n📋 Test Environment Status:');
		console.log(`   Node.js: ${process.version}`);
		console.log(`   Platform: ${process.platform}`);
		console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
		console.log(`   CI Environment: ${this.environmentSnapshot.IS_CI}`);
		console.log(`   Database: ${this.environmentSnapshot.DATABASE_TYPE}`);
		console.log(`   OAuth Setup: ${this.environmentSnapshot.HAS_OAUTH_SETUP}`);

		if (process.env.ENABLE_BETA === 'true') {
			console.log('   🧪 Beta features: ENABLED');
		}
		console.log('');
	}

	/**
	 * Generate environment report for debugging
	 */
	generateEnvironmentReport(): object {
		return {
			timestamp: new Date().toISOString(),
			environment: { ...this.environmentSnapshot },
			validationErrors: this.validationErrors,
			nodeVersion: process.version,
			platform: process.platform,
			memoryUsage: process.memoryUsage(),
			uptime: process.uptime()
		};
	}

	/**
	 * Reset environment to known state (for test cleanup)
	 */
	resetTestEnvironment(): void {
		// Reset feature flags
		delete process.env.ENABLE_BETA;

		// Ensure test environment
		process.env.NODE_ENV = 'test';
	}
}

// Global setup for environment validation
beforeAll(() => {
	const validator = EnvironmentValidator.getInstance();
	validator.validateEnvironment();
});

// Global teardown to check for environment drift
afterAll(() => {
	const validator = EnvironmentValidator.getInstance();
	const drift = validator.detectEnvironmentDrift();

	if (drift.length > 0) {
		console.warn('\n⚠️  Environment drift detected during test execution:');
		drift.forEach((change) => console.warn(`   ${change}`));
		console.warn('   This may indicate tests are modifying global state\n');
	}

	validator.resetTestEnvironment();
});

export default EnvironmentValidator;
