/**
 * Firecrawl API Client Singleton
 *
 * HMR-safe lazy singleton for Firecrawl headless browser scraping.
 * Used for all page content fetching — renders JavaScript,
 * captures what the browser actually sees.
 */

import FirecrawlApp from '@mendable/firecrawl-js';

declare global {
	// eslint-disable-next-line no-var
	var __firecrawlClient: FirecrawlApp | undefined;
}

let firecrawlClient: FirecrawlApp | null = null;

function getFirecrawlApiKey(): string {
	const key = process.env.FIRECRAWL_API_KEY;
	if (!key) {
		throw new Error(
			'FIRECRAWL_API_KEY environment variable is required. ' +
				'Get your API key at https://firecrawl.dev and add it to your .env file.'
		);
	}
	return key;
}

export function getFirecrawlClient(): FirecrawlApp {
	const isDevelopment = process.env.NODE_ENV === 'development';

	if (isDevelopment) {
		if (!global.__firecrawlClient) {
			global.__firecrawlClient = new FirecrawlApp({ apiKey: getFirecrawlApiKey() });
		}
		return global.__firecrawlClient;
	}

	if (!firecrawlClient) {
		firecrawlClient = new FirecrawlApp({ apiKey: getFirecrawlApiKey() });
	}
	return firecrawlClient;
}
