import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		conditions: ['browser']
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'jsdom',
		setupFiles: ['./src/test-setup.ts'],
		globals: true,
		coverage: {
			provider: 'istanbul',
			reporter: ['text', 'html', 'json', 'lcov'],
			reportsDirectory: './coverage',
			exclude: [
				'node_modules/**',
				'src/test/**',
				'**/*.d.ts',
				'**/*.config.{js,ts}',
				'**/coverage/**',
				'e2e/**',
				'prisma/**',
				'**/*.spec.ts',
				'**/*.test.ts'
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
		}
	},
});