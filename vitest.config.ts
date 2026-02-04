import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env file for tests (needed for smoke tests that hit real APIs)
const env = loadEnv('test', process.cwd(), '');
Object.assign(process.env, env);

export default defineConfig({
	plugins: [
		sveltekit(),
		svelteTesting({
			resolveBrowser: false, // Don't automatically modify resolve.conditions
			autoCleanup: true, // Use automatic cleanup from @testing-library/svelte/vitest
			noExternal: false // Don't modify ssr.noExternal
		})
	],
	resolve: {
		// Standard conditions for Node.js test environment
		// This allows msw/node to resolve correctly
		conditions: ['node', 'import', 'module', 'default']
	},
	test: {
		// File patterns
		include: ['tests/**/*.{test,spec}.{js,ts}'],
		exclude: [
			// Exclude Playwright E2E tests (UI-based) but include voter-protocol E2E tests (MSW-based)
			'tests/e2e/basic-functionality.spec.ts',
			'tests/e2e/identity-verification-flow.spec.ts',
			// Temporarily exclude Svelte component tests - require Svelte 5 browser environment
			// (incompatible with MSW Node.js environment in current config)
			// See: docs/testing/svelte-component-testing.md for migration path
			'tests/unit/ProofGenerator.test.ts',
			'tests/integration/template-creator-ui.test.ts'
		],

		// Environment configuration
		environment: 'jsdom',
		setupFiles: [
			'tests/setup/api-test-setup.ts', // MSW setup FIRST so it can intercept fetch
			'tests/config/setup.ts',
			'tests/config/test-monitoring.ts',
			'@testing-library/svelte/vitest' // Adds setup() and cleanup() for Svelte 5
		],
		globals: true,

		// MSW v2 Node.js compatibility - resolve server imports correctly
		server: {
			deps: {
				inline: ['msw'], //  MSW must be inlined for Node.js environment
				external: [] // Don't externalize anything else unnecessarily
			}
		},

		// Performance optimizations
		pool: 'forks', // Better isolation for integration tests
		poolOptions: {
			forks: {
				singleFork: false, // Enable parallelism for unit tests
				minForks: 1,
				maxForks: 4 // Use up to 4 parallel processes
			}
		},
		// Run integration tests sequentially to avoid database interference
		// Unit tests can still run in parallel
		fileParallelism: false, // Prevent race conditions in shared database tests

		// Test execution settings (CI-aware)
		testTimeout: process.env.CI ? 15000 : 10000, // Longer timeouts for CI
		hookTimeout: process.env.CI ? 8000 : 5000, // Extended hooks for CI

		// Mock optimizations
		clearMocks: true, // Clear mocks between tests
		restoreMocks: true, // Restore original implementations

		// Coverage configuration - HONEST MEASUREMENT
		coverage: {
			provider: 'v8', // Svelte-aware coverage provider
			reporter: ['text', 'html', 'json', 'lcov', 'cobertura'],
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
