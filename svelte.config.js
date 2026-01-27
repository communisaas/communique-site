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
		// BA-010: Explicitly enable CSRF origin checking (defense-in-depth).
		// This is the SvelteKit 2.x default, but we set it explicitly to prevent
		// accidental disabling. All non-GET requests must have a matching Origin header.
		// Note: External webhooks (e.g., Didit) that lack a browser Origin header
		// are allowed through because server-to-server requests typically omit Origin.
		// SvelteKit only blocks requests where Origin is present but mismatched.
		csrf: {
			checkOrigin: true
		},
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
