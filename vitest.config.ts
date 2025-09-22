import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		conditions: ['browser']
	},
	test: {
		// File patterns
		include: ['tests/**/*.{test,spec}.{js,ts}'],
		exclude: ['tests/e2e/**/*'],

		// Environment configuration
		environment: 'jsdom',
		setupFiles: ['tests/config/setup.ts', 'tests/config/test-monitoring.ts'],
		globals: true,

		// Performance optimizations
		pool: 'forks', // Better isolation for integration tests
		poolOptions: {
			forks: {
				singleFork: true, // Use single fork for better performance
				minForks: 1,
				maxForks: 1
			}
		},

		// Test execution settings (CI-aware)
		testTimeout: process.env.CI ? 15000 : 10000, // Longer timeouts for CI
		hookTimeout: process.env.CI ? 8000 : 5000, // Extended hooks for CI

		// Mock optimizations
		clearMocks: true, // Clear mocks between tests
		restoreMocks: true, // Restore original implementations

		// Coverage configuration
		coverage: {
			provider: 'istanbul',
			reporter: ['text', 'html', 'json', 'lcov'],
			reportsDirectory: './coverage',

			// Performance: exclude non-essential files
			exclude: [
				'node_modules/**',
				'tests/**',
				'src/lib/experimental/**', // Exclude experimental code
				'src/lib/features/**', // Feature flags excluded
				'**/*.d.ts',
				'**/*.config.{js,ts}',
				'**/coverage/**',
				'e2e/**',
				'prisma/**',
				'**/*.spec.ts',
				'**/*.test.ts',
				'build/',
				'.svelte-kit/',
				'src/app.html', // Static files
				'src/routes/**/+*.{js,ts}' // SvelteKit route files
			],

			// Focus coverage on core application code
			include: [
				'src/lib/core/**/*.{js,ts,svelte}',
				'src/lib/components/**/*.{js,ts,svelte}',
				'src/lib/utils/**/*.{js,ts}',
				'src/lib/types/**/*.{js,ts}',
				'src/routes/api/**/*.{js,ts}'
			],

			// Coverage thresholds based on analysis
			thresholds: {
				global: {
					branches: 70, // Current achievement: >70%
					functions: 70, // Current achievement: >70%
					lines: 70, // Current achievement: >70%
					statements: 70 // Current achievement: >70%
				},
				// Per-file thresholds for critical components
				perFile: {
					branches: 60,
					functions: 60,
					lines: 60,
					statements: 60
				}
			},

			// Skip coverage for certain patterns
			skipFull: true, // Skip files with 100% coverage in reports
			all: true // Include all files in coverage report
		},

		// Enhanced reporting for CI
		reporter: process.env.CI ? ['verbose', 'junit', 'json'] : ['verbose'],
		outputFile: {
			junit: './coverage/junit-results.xml',
			json: './coverage/test-results.json'
		}
	}
});
