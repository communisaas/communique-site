import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import alias from '@rollup/plugin-alias';
import { fileURLToPath } from 'url';

// Resolve paths for alias configuration
const bufferShimPath = fileURLToPath(
	new URL('./src/lib/core/proof/buffer-shim.ts', import.meta.url)
);
const pinoShimPath = fileURLToPath(new URL('./src/lib/core/proof/pino-shim.ts', import.meta.url));

export default defineConfig({
	plugins: [
		// CRITICAL: alias plugin must be in main plugins for DEV mode worker support
		// (worker.plugins only applies at BUILD time - see https://github.com/vitejs/vite/issues/8520)
		alias({
			entries: [
				{ find: 'buffer', replacement: bufferShimPath },
				{ find: 'pino', replacement: pinoShimPath }
			]
		}),
		wasm(),
		topLevelAwait(),
		sveltekit()
	],

	// Polyfill Node.js globals for browser (needed for @aztec/bb.js)
	resolve: {
		alias: {
			// Use local buffer shim for all buffer imports (including @aztec/bb.js)
			// This ensures consistent resolution in both dev and build modes
			buffer: bufferShimPath,
			// Shim pino for @aztec/bb.js - browser.js uses CJS but bb.js expects named export
			pino: pinoShimPath
		}
	},

	optimizeDeps: {
		exclude: [
			'chunk-PCGYAOMB.js',
			// Exclude noir-lang packages so their WASM files load correctly
			'@noir-lang/noir_js',
			'@noir-lang/acvm_js',
			'@noir-lang/noirc_abi',
			// CRITICAL: Exclude bb.js so its internal worker URL resolution works correctly
			// When pre-bundled, new URL('./main.worker.js', import.meta.url) breaks
			// because import.meta.url points to .vite/deps/ instead of node_modules/
			'@aztec/bb.js',
			'@voter-protocol/noir-prover'
		]
		// Note: Buffer alias is applied via resolve.alias which works even without pre-bundling
	},

	// Enable WASM support
	assetsInclude: ['**/*.wasm'],

	ssr: {
		noExternal: ['@selfxyz/qrcode', '@voter-protocol/client']
	},

	worker: {
		format: 'es',
		plugins: () => [
			// CRITICAL: Apply alias plugin to workers so bare 'buffer' imports resolve to our shim
			// Without this, workers in dev mode can't resolve bare imports like 'buffer'
			alias({
				entries: [
					{ find: 'buffer', replacement: bufferShimPath },
					{ find: 'pino', replacement: pinoShimPath }
				]
			}),
			wasm(),
			topLevelAwait()
		],
		rollupOptions: {
			external: [],
			output: {
				inlineDynamicImports: false
			}
		}
	},

	// Add cross-origin isolation headers for SharedArrayBuffer support (required for ZK proving)
	server: {
		headers: {
			'Cross-Origin-Opener-Policy': 'same-origin',
			'Cross-Origin-Embedder-Policy': 'require-corp'
		},
		fs: {
			// Allow serving files from linked npm packages (for local testing)
			// Also allow serving WASM files from node_modules
			allow: ['..', './node_modules']
		},
		watch: {
			ignored: ['**/prisma/schema.prisma']
		}
	},

	// Ensure preview server also has COOP/COEP headers
	preview: {
		headers: {
			'Cross-Origin-Opener-Policy': 'same-origin',
			'Cross-Origin-Embedder-Policy': 'require-corp'
		}
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
			include: ['src/**/*.{js,ts,svelte}'],
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

	// Separate configuration for Svelte component tests
	define: {
		'import.meta.vitest': undefined
	}
});
