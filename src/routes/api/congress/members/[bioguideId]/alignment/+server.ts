/**
 * Congress Member Alignment API
 *
 * POST /api/congress/members/[bioguideId]/alignment - Calculate alignment score
 *
 * Calculates how well a representative's voting record aligns with
 * the user's policy positions on specific topics.
 *
 * Path Parameters:
 * - bioguideId: Member's bioguide ID (e.g., "P000197")
 *
 * Request Body:
 * {
 *   positions: [
 *     { topic: "healthcare", stance: "support", keywords?: string[], importance?: number },
 *     { topic: "climate", stance: "oppose", keywords?: string[], importance?: number }
 *   ],
 *   options?: {
 *     congress?: number,
 *     maxVotesPerTopic?: number,
 *     includeVoteDetails?: boolean
 *   }
 * }
 *
 * Response: AlignmentResult with overall score and per-topic breakdown
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rateLimiter } from '$lib/server/rate-limiter';
import {
	calculateAlignment,
	type PolicyPosition,
	type AlignmentOptions,
	TOPIC_KEYWORDS
} from '$lib/server/congress/alignment';

interface AlignmentRequest {
	positions: PolicyPosition[];
	options?: AlignmentOptions;
}

export const POST: RequestHandler = async ({ params, request, getClientAddress }) => {
	const { bioguideId } = params;

	// Validate bioguideId format
	if (!bioguideId || !/^[A-Z]\d{5,6}$/i.test(bioguideId)) {
		return json(
			{
				error: 'Invalid bioguide ID format. Expected format: "P000197"'
			},
			{ status: 400 }
		);
	}

	// Rate limiting: 20 requests per minute per IP (more conservative than votes)
	const clientIp = getClientAddress();
	const rateLimitResult = await rateLimiter.limit(`congress-alignment:${clientIp}`, 20, 60 * 1000);

	if (!rateLimitResult.success) {
		return json(
			{
				error: 'Rate limit exceeded',
				retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
			},
			{
				status: 429,
				headers: {
					'Retry-After': String(Math.ceil((rateLimitResult.reset - Date.now()) / 1000))
				}
			}
		);
	}

	// Parse request body
	let body: AlignmentRequest;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	// Validate positions
	if (!body.positions || !Array.isArray(body.positions) || body.positions.length === 0) {
		return json(
			{
				error: 'positions array is required and must not be empty',
				example: {
					positions: [
						{ topic: 'healthcare', stance: 'support' },
						{ topic: 'climate', stance: 'support' }
					]
				}
			},
			{ status: 400 }
		);
	}

	// Validate each position
	for (const pos of body.positions) {
		if (!pos.topic || typeof pos.topic !== 'string') {
			return json({ error: 'Each position must have a topic string' }, { status: 400 });
		}
		if (!pos.stance || !['support', 'oppose'].includes(pos.stance)) {
			return json(
				{ error: 'Each position must have stance of "support" or "oppose"' },
				{ status: 400 }
			);
		}
		if (pos.importance !== undefined && (pos.importance < 1 || pos.importance > 10)) {
			return json({ error: 'importance must be between 1 and 10' }, { status: 400 });
		}
	}

	// Limit positions to prevent abuse
	if (body.positions.length > 10) {
		return json({ error: 'Maximum 10 positions per request' }, { status: 400 });
	}

	try {
		const alignment = await calculateAlignment(
			bioguideId.toUpperCase(),
			body.positions,
			body.options || {}
		);

		return json({
			alignment,
			meta: {
				availableTopics: Object.keys(TOPIC_KEYWORDS),
				requestedAt: new Date().toISOString()
			}
		});
	} catch (error) {
		console.error(`[Alignment API] Error for ${bioguideId}:`, error);

		const errorMessage = error instanceof Error ? error.message : 'Unknown error';

		if (errorMessage.includes('not found')) {
			return json({ error: `Member not found: ${bioguideId}` }, { status: 404 });
		}

		if (errorMessage.includes('Rate limit')) {
			return json(
				{ error: 'Congress.gov API rate limit exceeded. Please try again later.' },
				{ status: 503 }
			);
		}

		return json({ error: 'Failed to calculate alignment' }, { status: 500 });
	}
};

/**
 * GET /api/congress/members/[bioguideId]/alignment
 *
 * Returns available topics and usage instructions
 */
export const GET: RequestHandler = async ({ params }) => {
	const { bioguideId } = params;

	return json({
		message: 'Use POST to calculate alignment',
		bioguideId,
		usage: {
			method: 'POST',
			contentType: 'application/json',
			body: {
				positions: [
					{
						topic: 'string (required)',
						stance: '"support" | "oppose" (required)',
						keywords: 'string[] (optional, enhances matching)',
						importance: 'number 1-10 (optional, default 5)'
					}
				],
				options: {
					congress: 'number (optional, defaults to current)',
					maxVotesPerTopic: 'number (optional, default 20)',
					includeVoteDetails: 'boolean (optional, default true)'
				}
			}
		},
		availableTopics: Object.entries(TOPIC_KEYWORDS).map(([topic, keywords]) => ({
			topic,
			sampleKeywords: keywords.slice(0, 5)
		}))
	});
};
