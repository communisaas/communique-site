import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'node',
		globals: true,
		setupFiles: ['src/test/setup.ts'],
		coverage: {
			provider: 'istanbul',
			reporter: ['text', 'json', 'html', 'lcov'],
			include: [
				'src/lib/services/**/*.{js,ts}',
				'src/lib/congress/**/*.{js,ts}',
				'src/routes/api/**/*.{js,ts}'
			],
			exclude: [
				'node_modules/',
				'src/**/*.{test,spec}.{js,ts}',
				'src/**/*.d.ts',
				'src/test/**/*',
				'src/app.html',
				'**/.svelte-kit/**',
				'src/lib/components/**/*'
			],
			thresholds: {
				branches: 80,
				functions: 80,
				lines: 80,
				statements: 80
			},
			ignoreEmptyLines: true,
			skipFull: true
		},
		env: {
			// Test environment variables
			CONGRESS_API_KEY: 'test-congress-key',
			GOOGLE_CIVIC_API_KEY: 'test-civic-key'
		}
	}
});