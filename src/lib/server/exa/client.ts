/**
 * Exa Search API Client Singleton
 * @module exa-client
 *
 * Provides an HMR-safe Exa client that handles:
 * - Development mode (global caching across Vite hot reloads)
 * - Production mode (standard module-level singleton)
 * - Lazy initialization — no import-time side effects
 */

import Exa from 'exa-js';

// Global cache for development HMR safety
// In dev, Vite may reload modules but we want to preserve the client instance
declare global {
	// eslint-disable-next-line no-var
	var __exaClient: Exa | undefined;
}

// Module-level cache for production
let exaClient: Exa | null = null;

/**
 * Get Exa API key from environment (lazy to avoid build-time errors)
 */
function getExaApiKey(): string {
	const key = process.env.EXA_API_KEY;
	if (!key) {
		throw new Error(
			'EXA_API_KEY environment variable is required. ' +
				'Get your API key at https://dashboard.exa.ai and add it to your .env file.'
		);
	}
	return key;
}

/**
 * Get the Exa client instance
 *
 * Returns a singleton Exa client, creating one lazily on first call.
 * In development, the instance is cached on `globalThis` to survive HMR.
 * In production, a module-level variable is used.
 *
 * @returns Exa client instance
 *
 * @example
 * import { getExaClient } from '$lib/server/exa';
 *
 * const exa = getExaClient();
 * const results = await exa.search('latest AI research');
 */
export function getExaClient(): Exa {
	const isDevelopment = process.env.NODE_ENV === 'development';

	if (isDevelopment) {
		if (!global.__exaClient) {
			global.__exaClient = new Exa(getExaApiKey());
		}
		return global.__exaClient;
	}

	if (!exaClient) {
		exaClient = new Exa(getExaApiKey());
	}
	return exaClient;
}
