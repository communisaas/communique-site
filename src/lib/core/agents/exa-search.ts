/**
 * Search & Page Fetch — Agentic Tool Wrappers
 *
 * - searchWeb() — Exa semantic search, metadata only ($0.005/search)
 * - readPage() — Firecrawl headless browser scrape (full JS rendering)
 *
 * Architecture: Exa finds pages (semantic search strength),
 * Firecrawl reads them (headless browser captures JS-rendered content,
 * mailto: links, and dynamic contact widgets that text extraction misses).
 *
 * @module agents/exa-search
 */

import { getExaClient, getSearchRateLimiter } from '$lib/server/exa';
import { getFirecrawlClient, getFirecrawlRateLimiter } from '$lib/server/firecrawl';

// ============================================================================
// Types
// ============================================================================

/** A single search result from Exa (metadata only, no content) */
export interface ExaSearchHit {
	url: string;
	title: string;
	publishedDate?: string;
	author?: string;
	score?: number;
}

/** Resolved page content (Firecrawl headless browser render) */
export interface ExaPageContent {
	url: string;
	title: string;
	text: string;           // full rendered markdown from headless browser
	highlights?: string[];  // always [] — Firecrawl captures everything inline
	publishedDate?: string;
	statusCode?: number;
}

// ============================================================================
// searchWeb — Agent tool wrapper for Exa search
// ============================================================================

/**
 * Search the web via Exa. Returns metadata only (no page content).
 * Rate-limited to 4 RPS with exponential backoff.
 *
 * @param query - Search query string
 * @param options - Optional: maxResults (default 25, max before 5x price jump)
 * @returns Array of search hits with URL, title, publishedDate
 */
export async function searchWeb(
	query: string,
	options?: { maxResults?: number }
): Promise<ExaSearchHit[]> {
	const maxResults = options?.maxResults ?? 25;
	const exa = getExaClient();
	const rateLimiter = getSearchRateLimiter();

	console.debug(`[exa-search] searchWeb: "${query}"`);

	const result = await rateLimiter.execute(
		async () => exa.search(query, {
			numResults: maxResults,
			type: 'auto',
			contents: false as const
		}),
		`exa-search-${query.slice(0, 40)}`
	);

	if (!result.success) {
		console.error(`[exa-search] searchWeb failed:`, result.error);
		throw new Error(`Search failed: ${result.error}`);
	}

	if (result.wasRateLimited) {
		console.debug(`[exa-search] searchWeb succeeded after rate limit retry (${result.attempts} attempts)`);
	}

	const hits: ExaSearchHit[] = result.data!.results.map((r) => ({
		url: r.url,
		title: r.title || '',
		publishedDate: r.publishedDate,
		author: r.author,
		score: r.score
	}));

	console.debug(`[exa-search] searchWeb: ${hits.length} results for "${query.slice(0, 50)}"`);
	return hits;
}

// ============================================================================
// readPage — Firecrawl headless browser scrape
// ============================================================================

/**
 * Fetch full rendered page content via Firecrawl headless browser.
 * Renders JavaScript, captures mailto: links, dynamic contact widgets,
 * and everything the browser actually sees.
 * Rate-limited to 10 RPS with exponential backoff.
 *
 * @param url - URL to fetch content from
 * @param options - Optional: maxCharacters (default 12000)
 * @returns Page content or null if fetch failed
 */
export async function readPage(
	url: string,
	options?: { maxCharacters?: number }
): Promise<ExaPageContent | null> {
	const maxCharacters = options?.maxCharacters ?? 12000;
	const firecrawl = getFirecrawlClient();
	const rateLimiter = getFirecrawlRateLimiter();

	console.debug(`[page-fetch] readPage: ${url}`);

	const result = await rateLimiter.execute(
		async () => firecrawl.scrapeUrl(url, { formats: ['markdown', 'links'] }),
		`firecrawl-${url.slice(0, 60)}`
	);

	if (!result.success) {
		console.error(`[page-fetch] readPage failed for ${url}:`, result.error);
		return null;
	}

	const scrapeData = result.data;
	if (!scrapeData?.success || !scrapeData.markdown) {
		console.debug(`[page-fetch] readPage: no content for ${url}`);
		return null;
	}

	// Start with the rendered markdown
	let text = scrapeData.markdown;

	// Extract emails from mailto: links — these are structurally extracted
	// and may include addresses that appear only as link targets, not in
	// visible page text (e.g., obfuscated or JS-generated mailto: hrefs)
	const links: string[] = Array.isArray(scrapeData.links) ? scrapeData.links : [];
	const mailtoEmails = links
		.filter((l: string) => l.startsWith('mailto:'))
		.map((l: string) => l.replace('mailto:', '').split('?')[0]);

	if (mailtoEmails.length > 0) {
		text += '\n\n--- CONTACT EMAILS (from page links) ---\n' + mailtoEmails.join('\n');
		console.debug(`[page-fetch] readPage: ${mailtoEmails.length} mailto emails appended for ${url}`);
	}

	text = text.slice(0, maxCharacters);

	const content: ExaPageContent = {
		url,
		title: scrapeData.metadata?.title || '',
		text,
		highlights: mailtoEmails,
		publishedDate: undefined,
		statusCode: scrapeData.metadata?.statusCode
	};

	console.debug(`[page-fetch] readPage: ${content.text.length} chars from "${content.title.slice(0, 60)}"`);
	return content;
}
