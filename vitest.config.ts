import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		conditions: ['browser']
	},
    test: {
        include: ['tests/**/*.{test,spec}.{js,ts}'],
        exclude: ['tests/e2e/**/*'], 
		environment: 'jsdom',
        setupFiles: ['tests/config/setup.ts'],
		globals: true,
		coverage: {
			provider: 'istanbul',
			reporter: ['text', 'html', 'json', 'lcov'],
			reportsDirectory: './coverage',
			exclude: [
				'node_modules/**',
				'tests/**',
				'src/lib/experimental/**', // Exclude experimental code from coverage
				'src/lib/features/**', // Feature flags don't need coverage
				'**/*.d.ts',
				'**/*.config.{js,ts}',
				'**/coverage/**',
				'e2e/**',
				'prisma/**',
				'**/*.spec.ts',
				'**/*.test.ts',
				'build/',
				'.svelte-kit/'
			],
			include: [
                'src/**/*.{js,ts,svelte}'
			],
			thresholds: {
				global: {
					branches: 70,
					functions: 70,
					lines: 70,
					statements: 70
				}
			}
		},
		pool: 'forks', // Better isolation for integration tests
		poolOptions: {
			forks: {
				singleFork: true
			}
		}
	},
});