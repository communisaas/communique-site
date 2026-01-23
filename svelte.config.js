import { mdsvex } from 'mdsvex';
import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: [vitePreprocess(), mdsvex()],

	kit: {
		adapter: adapter({
			// Skip prerendering to avoid post-build analysis issues
			prerender: {
				handleHttpError: 'warn',
				handleMissingId: 'warn'
			}
		}),
		// Add explicit environment configuration
		env: {
			dir: '.',
			publicPrefix: 'PUBLIC_'
		},
		// Experimental: Server instrumentation for Sentry
		// Enables src/instrumentation.server.ts to initialize before SvelteKit
		experimental: {
			instrumentation: {
				server: true
			}
		}
	},

	extensions: ['.svelte', '.svx']
};

export default config;
