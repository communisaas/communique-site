import { mdsvex } from 'mdsvex';
import adapterNode from '@sveltejs/adapter-node';
import adapterCloudflare from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Use Node adapter for Fly.io, Cloudflare adapter for CF Pages
// Auto-detect Cloudflare Pages via CF_PAGES env var, or explicit ADAPTER=cloudflare
const useCloudflare = process.env.ADAPTER === 'cloudflare' || process.env.CF_PAGES === '1';

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
		// BR5-015: Content Security Policy — SvelteKit auto-injects nonces for its inline scripts.
		// Mode 'auto' uses hashes for prerendered pages, nonces for dynamic pages.
		// 'wasm-unsafe-eval' required for Noir/Barretenberg WASM execution.
		// COOP/COEP headers remain in hooks.server.ts (not part of CSP).
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'script-src': ['self', 'wasm-unsafe-eval'],
				'style-src': ['self', 'unsafe-inline', 'https://fonts.googleapis.com'],
				'img-src': ['self', 'data:', 'blob:'],
				'font-src': ['self', 'https://fonts.gstatic.com'],
				'connect-src': ['self'],
				'worker-src': ['self', 'blob:'],
				'object-src': ['none'],
				'frame-ancestors': ['none'],
				'base-uri': ['self'],
				'form-action': ['self'],
				'upgrade-insecure-requests': true
			}
		},
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
