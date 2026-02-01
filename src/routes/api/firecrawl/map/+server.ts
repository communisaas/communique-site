/**
 * Site Map API - Discover URLs on a site for leadership pages
 *
 * POST /api/firecrawl/map
 *
 * Maps a website to discover all URLs, categorizing them into leadership,
 * about, and other pages. Useful for pre-crawling analysis.
 *
 * Request:
 * - url: string - URL of the site to map
 * - limit?: number - Maximum URLs to return (default: 100)
 *
 * Response:
 * - leadershipPages: string[] - URLs matching leadership patterns
 * - aboutPages: string[] - URLs matching about/company patterns
 * - allUrls: string[] - All discovered URLs
 * - cached: boolean - Whether result came from cache
 *
 * Rate Limiting: Authenticated users only, 5/hour
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { mapSiteForLeadership } from '$lib/server/firecrawl';
import {
	enforceLLMRateLimit,
	addRateLimitHeaders,
	getUserContext,
	logLLMOperation
} from '$lib/server/llm-cost-protection';

interface RequestBody {
	url: string;
	limit?: number;
}

export const POST: RequestHandler = async (event) => {
	// Rate limit check - throws 429 if exceeded
	const rateLimitCheck = await enforceLLMRateLimit(event, 'firecrawl-map');
	const userContext = getUserContext(event);
	const startTime = Date.now();

	// Auth check
	const session = event.locals.session;
	if (!session?.userId) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	// Parse request body
	let body: RequestBody;
	try {
		body = (await event.request.json()) as RequestBody;
	} catch {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}

	// Validate required fields
	if (!body.url) {
		return json({ error: 'URL is required' }, { status: 400 });
	}

	// Validate URL format
	try {
		new URL(body.url);
	} catch {
		return json({ error: 'Invalid URL format' }, { status: 400 });
	}

	// Validate limit if provided
	const limit = body.limit ?? 100;
	if (limit < 1 || limit > 500) {
		return json({ error: 'Limit must be between 1 and 500' }, { status: 400 });
	}

	console.log('[firecrawl-map-api] Starting site map:', {
		userId: session.userId,
		url: body.url,
		limit
	});

	try {
		const result = await mapSiteForLeadership({
			url: body.url,
			limit
		});

		const latencyMs = Date.now() - startTime;

		if (!result.success) {
			console.error('[firecrawl-map-api] Map failed:', result.error);
			return json(
				{ error: result.error || 'Failed to map site' },
				{ status: 500 }
			);
		}

		console.log('[firecrawl-map-api] Map complete:', {
			userId: session.userId,
			url: body.url,
			leadershipCount: result.leadershipPages.length,
			aboutCount: result.aboutPages.length,
			totalUrls: result.links.length,
			cached: result.cached,
			latencyMs
		});

		// Log operation for cost tracking
		logLLMOperation('firecrawl-map', userContext, {
			callCount: result.cached ? 0 : 1,
			durationMs: latencyMs,
			success: true
		});

		const headers = new Headers({ 'Content-Type': 'application/json' });
		addRateLimitHeaders(headers, rateLimitCheck);

		return new Response(
			JSON.stringify({
				leadershipPages: result.leadershipPages,
				aboutPages: result.aboutPages,
				allUrls: result.links,
				cached: result.cached ?? false
			}),
			{ headers }
		);
	} catch (error) {
		console.error('[firecrawl-map-api] Error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Internal server error' },
			{ status: 500 }
		);
	}
};
