import { mdsvex } from 'mdsvex';
import adapterNode from '@sveltejs/adapter-node';
import adapterCloudflare from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Use Node adapter for Fly.io, Cloudflare adapter for CF Pages
const useCloudflare = process.env.ADAPTER === 'cloudflare';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: [vitePreprocess(), mdsvex()],

	kit: {
		adapter: useCloudflare
			? adapterCloudflare({
					// Skip prerendering to avoid post-build analysis issues
					prerender: {
						handleHttpError: 'warn',
						handleMissingId: 'warn'
					}
				})
			: adapterNode(),
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
