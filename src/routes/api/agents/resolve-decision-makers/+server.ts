/**
 * Decision-Maker Resolver API Endpoint
 *
 * POST /api/agents/resolve-decision-makers
 *
 * Uses Gemini 2.5 Flash with Google Search grounding to identify REAL people
 * with power over social issues.
 *
 * Request body:
 * - subject_line: Subject line of the issue
 * - core_issue: Core problem statement
 * - topics: Topic tags for the issue (1-5 strings)
 * - voice_sample: Optional emotional peak from raw input (for voice continuity)
 * - url_slug: Optional URL slug for the template
 *
 * Response:
 * - decision_makers: Array of decision-makers with provenance and sources
 * - research_summary: Summary of why these people were selected
 *
 * Rate Limiting: BLOCKED for guests (requires auth), 3/hour for authenticated, 10/hour for verified.
 * This is the most expensive endpoint (4-6 Gemini calls with grounding per request).
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveDecisionMakers } from '$lib/core/agents/agents/decision-maker';
import {
	enforceLLMRateLimit,
	getUserContext,
	logLLMOperation
} from '$lib/server/llm-cost-protection';

// ========================================
// Request/Response Types
// ========================================

interface RequestBody {
	subject_line: string;
	core_issue: string;
	topics: string[];
	voice_sample?: string;
	url_slug?: string;
}

// ========================================
// POST Handler
// ========================================

export const POST: RequestHandler = async (event) => {
	// Rate limit check - throws 429 if exceeded
	// CRITICAL: This blocks guests entirely (quota = 0) because this is the most expensive operation
	await enforceLLMRateLimit(event, 'decision-makers');
	const userContext = getUserContext(event);

	// Auth is now effectively required (guests are blocked by rate limiter)
	const session = event.locals.session;
	const userId = session?.userId || 'guest';

	// Parse request body
	let body: RequestBody;
	try {
		body = (await event.request.json()) as RequestBody;
	} catch (err) {
		throw error(400, 'Invalid JSON in request body');
	}

	// Validate required fields
	const { subject_line, core_issue, topics, voice_sample, url_slug } = body;

	if (!subject_line?.trim()) {
		throw error(400, 'Subject line is required');
	}

	if (!core_issue?.trim()) {
		throw error(400, 'Core issue is required');
	}

	if (!topics || topics.length === 0) {
		throw error(400, 'At least one topic is required');
	}

	// Log request
	console.log('[agents/resolve-decision-makers] Starting resolution:', {
		userId,
		subject: subject_line.substring(0, 50),
		topics,
		hasVoiceSample: !!voice_sample,
		hasSlug: !!url_slug
	});

	const startTime = Date.now();

	try {
		// Resolve decision-makers using Gemini agent
		const result = await resolveDecisionMakers({
			subjectLine: subject_line,
			coreIssue: core_issue,
			topics,
			voiceSample: voice_sample,
			urlSlug: url_slug
		});

		const latencyMs = Date.now() - startTime;

		// Log success
		console.log('[agents/resolve-decision-makers] Resolution complete:', {
			userId,
			count: result.decision_makers.length,
			names: result.decision_makers.map((dm) => dm.name),
			avgConfidence:
				result.decision_makers.reduce((sum, dm) => sum + dm.confidence, 0) /
					result.decision_makers.length || 0,
			latencyMs
		});

		// Log operation for cost tracking (4-6 calls with grounding)
		logLLMOperation('decision-makers', userContext, {
			callCount: 1 + result.decision_makers.length, // 1 identification + N enrichments
			durationMs: latencyMs,
			success: true
		});

		// Return result
		return json(result);
	} catch (err) {
		const latencyMs = Date.now() - startTime;

		console.error('[agents/resolve-decision-makers] Resolution failed:', {
			userId,
			error: err instanceof Error ? err.message : String(err),
			latencyMs
		});

		// Check for specific error types
		if (err && typeof err === 'object' && 'message' in err) {
			const errorMessage = (err as Error).message;

			// Rate limit error
			if (errorMessage.includes('RESOURCE_EXHAUSTED')) {
				throw error(
					429,
					'Google Search API rate limit exceeded. Please try again in a few minutes.'
				);
			}

			// API key error
			if (errorMessage.includes('UNAUTHENTICATED') || errorMessage.includes('GEMINI_API_KEY')) {
				throw error(500, 'Gemini API configuration error. Please contact support.');
			}

			// Grounding disabled error
			if (errorMessage.includes('grounding')) {
				throw error(
					500,
					'Google Search grounding is required but not available. Please contact support.'
				);
			}
		}

		// Generic error
		throw error(500, 'Failed to resolve decision-makers. Please try again.');
	}
};
