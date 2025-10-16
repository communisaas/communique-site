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
		setupFiles: [
			'tests/config/setup.ts',
			'tests/config/test-monitoring.ts',
			'tests/setup/api-test-setup.ts'
		],
		globals: true,

		// Performance optimizations
		pool: 'forks', // Better isolation for integration tests
		poolOptions: {
			forks: {
				singleFork: false, // Enable parallelism for faster test execution
				minForks: 1,
				maxForks: 4 // Use up to 4 parallel processes
			}
		},

		// Test execution settings (CI-aware)
		testTimeout: process.env.CI ? 15000 : 10000, // Longer timeouts for CI
		hookTimeout: process.env.CI ? 8000 : 5000, // Extended hooks for CI

		// Mock optimizations
		clearMocks: true, // Clear mocks between tests
		restoreMocks: true, // Restore original implementations

		// Coverage configuration - HONEST MEASUREMENT
		coverage: {
			provider: 'v8', // Svelte-aware coverage provider
			reporter: ['text', 'html', 'json', 'lcov'],
			reportsDirectory: './coverage',

			// Include ALL source code for honest measurement
			include: ['src/**/*.{js,ts,svelte}'],

			// Minimal exclusions - only build artifacts and tests
			exclude: [
				'node_modules/**',
				'tests/**',
				'**/*.d.ts',
				'**/*.config.{js,ts}',
				'**/coverage/**',
				'e2e/**',
				'prisma/**',
				'**/*.spec.ts',
				'**/*.test.ts',
				'build/',
				'.svelte-kit/',
				'src/app.html'
			],

			// HONEST thresholds - meaningful minimums to prevent regression
			thresholds: {
				global: {
					branches: 20, // Realistic starting point from current reality
					functions: 20, // Build up from current state
					lines: 20, // Incremental improvement targets
					statements: 20 // Honest measurement, not theater
				},
				// Higher standards for critical production paths
				'src/lib/core/auth/': {
					branches: 40,
					functions: 40,
					lines: 40,
					statements: 40
				},
				'src/routes/api/': {
					branches: 30,
					functions: 30,
					lines: 30,
					statements: 30
				}
			},

			// Include all source files in coverage report
			all: true
		},

		// Enhanced reporting for CI
		reporter: process.env.CI ? ['verbose', 'junit', 'json'] : ['verbose'],
		outputFile: {
			junit: './coverage/junit-results.xml',
			json: './coverage/test-results.json'
		}
	}
});
