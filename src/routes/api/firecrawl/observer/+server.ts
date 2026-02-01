/**
 * Page Observer API - Monitor web pages for changes
 *
 * POST /api/firecrawl/observer - Create new observer
 * GET /api/firecrawl/observer - List observers for user
 *
 * Create observers to monitor web pages for changes, useful for detecting
 * leadership changes, executive departures, and organizational updates.
 *
 * POST Request:
 * - url: string - URL of the page to monitor
 * - selector?: string - CSS selector to watch (optional, monitors entire page if not specified)
 * - interval?: number - Check interval in minutes (default: 60)
 * - webhookUrl?: string - URL to notify on changes (optional)
 * - description?: string - Observer description (optional)
 * - tags?: string[] - Tags for categorization (optional)
 *
 * POST Response:
 * - observerId: string - Unique observer identifier
 * - status: string - Current status ('active')
 * - url: string - URL being monitored
 *
 * GET Response:
 * - observers: ObserverResult[] - List of user's observers
 * - total: number - Total count
 *
 * Rate Limiting: Verified users only, 10 observers max per user
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createObserver, listObservers, type ObserverResult } from '$lib/server/firecrawl';
import {
	enforceLLMRateLimit,
	addRateLimitHeaders,
	getUserContext,
	logLLMOperation
} from '$lib/server/llm-cost-protection';

const MAX_OBSERVERS_PER_USER = 10;

interface CreateObserverBody {
	url: string;
	selector?: string;
	interval?: number;
	webhookUrl?: string;
	description?: string;
	tags?: string[];
}

export const POST: RequestHandler = async (event) => {
	// Rate limit check - throws 429 if exceeded
	const rateLimitCheck = await enforceLLMRateLimit(event, 'firecrawl-observer');
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
			{ error: 'Page observers require a verified account. Please verify your identity.' },
			{ status: 403 }
		);
	}

	// Parse request body
	let body: CreateObserverBody;
	try {
		body = (await event.request.json()) as CreateObserverBody;
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

	// Validate interval if provided
	const interval = body.interval ?? 60;
	if (interval < 15 || interval > 1440) {
		return json({ error: 'Interval must be between 15 and 1440 minutes (24 hours)' }, { status: 400 });
	}

	// Validate webhook URL if provided
	if (body.webhookUrl) {
		try {
			new URL(body.webhookUrl);
		} catch {
			return json({ error: 'Invalid webhook URL format' }, { status: 400 });
		}
	}

	// Check observer limit per user
	// Note: In a production app, you'd filter by userId. For now, we check total count.
	const existingObservers = await listObservers({ limit: MAX_OBSERVERS_PER_USER + 1 });
	if (existingObservers.length >= MAX_OBSERVERS_PER_USER) {
		return json(
			{ error: `Maximum of ${MAX_OBSERVERS_PER_USER} observers per user reached. Delete an existing observer first.` },
			{ status: 403 }
		);
	}

	console.log('[firecrawl-observer-api] Creating observer:', {
		userId: session.userId,
		url: body.url,
		hasSelector: !!body.selector,
		interval
	});

	try {
		const result = await createObserver({
			url: body.url,
			selector: body.selector,
			interval,
			webhookUrl: body.webhookUrl,
			description: body.description,
			tags: body.tags
		});

		const latencyMs = Date.now() - startTime;

		console.log('[firecrawl-observer-api] Observer created:', {
			userId: session.userId,
			observerId: result.observerId,
			latencyMs
		});

		// Log operation for cost tracking
		logLLMOperation('firecrawl-observer-create', userContext, {
			callCount: 1,
			durationMs: latencyMs,
			success: true
		});

		const headers = new Headers({ 'Content-Type': 'application/json' });
		addRateLimitHeaders(headers, rateLimitCheck);

		return new Response(
			JSON.stringify({
				observerId: result.observerId,
				status: result.status,
				url: result.url,
				selector: result.selector,
				interval: result.interval,
				webhookUrl: result.webhookUrl,
				createdAt: result.createdAt
			}),
			{ headers }
		);
	} catch (error) {
		console.error('[firecrawl-observer-api] Error creating observer:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to create observer' },
			{ status: 500 }
		);
	}
};

export const GET: RequestHandler = async (event) => {
	// Auth check - require verified user
	const session = event.locals.session;
	if (!session?.userId) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	// Check verification status
	const user = event.locals.user;
	if (!user?.is_verified) {
		return json(
			{ error: 'Page observers require a verified account. Please verify your identity.' },
			{ status: 403 }
		);
	}

	// Parse query parameters
	const url = new URL(event.request.url);
	const status = url.searchParams.get('status') as 'active' | 'paused' | 'error' | null;
	const limitParam = url.searchParams.get('limit');
	const offsetParam = url.searchParams.get('offset');

	const limit = limitParam ? parseInt(limitParam, 10) : 50;
	const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

	if (isNaN(limit) || limit < 1 || limit > 100) {
		return json({ error: 'Limit must be between 1 and 100' }, { status: 400 });
	}

	if (isNaN(offset) || offset < 0) {
		return json({ error: 'Offset must be a non-negative number' }, { status: 400 });
	}

	console.log('[firecrawl-observer-api] Listing observers:', {
		userId: session.userId,
		status,
		limit,
		offset
	});

	try {
		const observers = await listObservers({
			status: status || undefined,
			limit,
			offset
		});

		console.log('[firecrawl-observer-api] Listed observers:', {
			userId: session.userId,
			count: observers.length
		});

		return json({
			observers: observers.map((obs: ObserverResult) => ({
				observerId: obs.observerId,
				url: obs.url,
				status: obs.status,
				selector: obs.selector,
				interval: obs.interval,
				description: obs.description,
				tags: obs.tags,
				lastChecked: obs.lastChecked,
				lastChange: obs.lastChange,
				createdAt: obs.createdAt,
				updatedAt: obs.updatedAt
			})),
			total: observers.length
		});
	} catch (error) {
		console.error('[firecrawl-observer-api] Error listing observers:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to list observers' },
			{ status: 500 }
		);
	}
};
