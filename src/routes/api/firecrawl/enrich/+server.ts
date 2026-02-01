/**
 * Fire Enrich API - Contact Enrichment Endpoint
 *
 * POST /api/firecrawl/enrich
 *
 * Enriches contact data from email addresses or LinkedIn URLs.
 * Uses web scraping and LLM synthesis to build comprehensive profiles.
 *
 * Request:
 * - email?: string - Email address to enrich from
 * - linkedinUrl?: string - LinkedIn profile URL to enrich from
 * - includeCompany?: boolean - Include company data (default: true)
 *
 * Response:
 * - success: boolean - Whether enrichment succeeded
 * - person: { name, title?, company?, location?, bio? }
 * - contact: { email?, phone?, linkedin?, twitter? }
 * - company?: { name, domain, industry?, size?, description? }
 * - cached: boolean - Whether result came from cache
 * - sources?: string[] - URLs used for enrichment
 *
 * Rate Limiting: Verified users only, 20/hour
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { enrichContact } from '$lib/server/firecrawl';
import {
	enforceLLMRateLimit,
	addRateLimitHeaders,
	getUserContext,
	logLLMOperation
} from '$lib/server/llm-cost-protection';

interface RequestBody {
	email?: string;
	linkedinUrl?: string;
	includeCompany?: boolean;
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
}

/**
 * Validate LinkedIn URL format
 */
function isValidLinkedInUrl(url: string): boolean {
	try {
		const parsed = new URL(url);
		return parsed.hostname.includes('linkedin.com') && parsed.pathname.includes('/in/');
	} catch {
		return false;
	}
}

export const POST: RequestHandler = async (event) => {
	// Rate limit check - throws 429 if exceeded
	// Verified users only (20/hour) - this is a moderately expensive operation
	const rateLimitCheck = await enforceLLMRateLimit(event, 'firecrawl-enrich');
	const userContext = getUserContext(event);
	const startTime = Date.now();

	// Auth check - require verified user
	const session = event.locals.session;
	if (!session?.userId) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	// Check verification status
	const user = event.locals.user;
	if (!user?.is_verified) {
		return json(
			{ error: 'Contact enrichment requires a verified account. Please verify your identity.' },
			{ status: 403 }
		);
	}

	// Parse request body
	let body: RequestBody;
	try {
		body = (await event.request.json()) as RequestBody;
	} catch {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}

	// Validate that at least one lookup method is provided
	if (!body.email && !body.linkedinUrl) {
		return json({ error: 'Either email or linkedinUrl is required' }, { status: 400 });
	}

	// Validate email if provided
	if (body.email && !isValidEmail(body.email)) {
		return json({ error: 'Invalid email format' }, { status: 400 });
	}

	// Validate LinkedIn URL if provided
	if (body.linkedinUrl && !isValidLinkedInUrl(body.linkedinUrl)) {
		return json(
			{ error: 'Invalid LinkedIn URL format. Expected: https://linkedin.com/in/username' },
			{ status: 400 }
		);
	}

	// Use email if both are provided
	const lookupType = body.email ? 'email' : 'linkedin';
	const lookupValue = body.email || body.linkedinUrl;

	console.log('[firecrawl-enrich-api] Starting contact enrichment:', {
		userId: session.userId,
		lookupType,
		lookupValue: lookupValue?.substring(0, 30) + '...',
		includeCompany: body.includeCompany ?? true
	});

	try {
		const result = await enrichContact({
			email: body.email,
			linkedinUrl: body.linkedinUrl,
			includeCompany: body.includeCompany ?? true
		});

		const latencyMs = Date.now() - startTime;

		if (!result.success) {
			console.error('[firecrawl-enrich-api] Enrichment failed:', result.error);
			return json(
				{
					success: false,
					error: result.error || 'Failed to enrich contact'
				},
				{ status: 500 }
			);
		}

		console.log('[firecrawl-enrich-api] Enrichment complete:', {
			userId: session.userId,
			person: result.person.name,
			company: result.company?.name,
			cached: result.cached,
			latencyMs
		});

		// Log operation for cost tracking
		// Enrichment typically makes 3-5 Firecrawl calls + 1 LLM call
		logLLMOperation('firecrawl-enrich', userContext, {
			callCount: result.cached ? 0 : 4,
			durationMs: latencyMs,
			success: true
		});

		const headers = new Headers({ 'Content-Type': 'application/json' });
		addRateLimitHeaders(headers, rateLimitCheck);

		return new Response(
			JSON.stringify({
				success: true,
				person: result.person,
				contact: result.contact,
				company: result.company,
				cached: result.cached,
				sources: result.sources
			}),
			{ headers }
		);
	} catch (error) {
		console.error('[firecrawl-enrich-api] Error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Internal server error' },
			{ status: 500 }
		);
	}
};
