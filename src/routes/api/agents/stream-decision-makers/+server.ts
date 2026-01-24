/**
 * Streaming Decision-Maker Resolution API
 *
 * POST /api/agents/stream-decision-makers
 *
 * Returns Server-Sent Events (SSE) stream with:
 * - phase: Pipeline phase changes (identify, enrich, validate, complete)
 * - thought: Agent reasoning from identification phase
 * - progress: Enrichment progress (current/total candidates)
 * - complete: Final result with decision-makers
 * - error: Error message if resolution fails
 *
 * Perceptual Engineering: Users see the agent's actual research process,
 * building trust through transparency. Real thoughts replace marketing fluff.
 *
 * Rate Limiting: BLOCKED for guests (quota = 0), 3/hour authenticated, 10/hour verified.
 */

import type { RequestHandler } from './$types';
import { resolveDecisionMakers, type PipelinePhase } from '$lib/core/agents/agents/decision-maker';
import { createSSEStream, SSE_HEADERS } from '$lib/utils/sse-stream';
import {
	enforceLLMRateLimit,
	addRateLimitHeaders,
	getUserContext,
	logLLMOperation
} from '$lib/server/llm-cost-protection';

interface RequestBody {
	subject_line: string;
	core_issue: string;
	topics: string[];
	voice_sample?: string;
	url_slug?: string;
}

export const POST: RequestHandler = async (event) => {
	// Rate limit check - throws 429 if exceeded
	// CRITICAL: Guests are blocked (quota = 0) - this is the most expensive operation
	const rateLimitCheck = await enforceLLMRateLimit(event, 'decision-makers');
	const userContext = getUserContext(event);
	const startTime = Date.now();

	// Parse and validate request
	let body: RequestBody;
	try {
		body = (await event.request.json()) as RequestBody;
	} catch {
		return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const { subject_line, core_issue, topics, voice_sample, url_slug } = body;

	if (!subject_line?.trim()) {
		return new Response(JSON.stringify({ error: 'Subject line is required' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	if (!core_issue?.trim()) {
		return new Response(JSON.stringify({ error: 'Core issue is required' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	if (!topics || topics.length === 0) {
		return new Response(JSON.stringify({ error: 'At least one topic is required' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const userId = event.locals.session?.userId || 'guest';
	console.log('[stream-decision-makers] Starting streaming resolution:', {
		userId,
		subject: subject_line.substring(0, 50),
		topics
	});

	// Create SSE stream
	const { stream, emitter } = createSSEStream();

	// Run resolution in background (stream is returned immediately)
	(async () => {
		try {
			const result = await resolveDecisionMakers({
				subjectLine: subject_line,
				coreIssue: core_issue,
				topics,
				voiceSample: voice_sample,
				urlSlug: url_slug,
				streaming: {
					onPhase: (phase: PipelinePhase, message: string) => {
						emitter.send('phase', { phase, message });
					},
					onThought: (thought: string, phase: PipelinePhase) => {
						// Clean thought for display
						const cleaned = cleanThoughtForDisplay(thought);
						if (cleaned) {
							emitter.send('thought', { content: cleaned, phase });
						}
					},
					onProgress: (progress) => {
						emitter.send('progress', {
							current: progress.current,
							total: progress.total,
							name: progress.candidateName,
							status: progress.status
						});
					}
				}
			});

			const latencyMs = Date.now() - startTime;

			// Send final result
			emitter.complete(result);

			// Log success
			console.log('[stream-decision-makers] Resolution complete:', {
				userId,
				count: result.decision_makers.length,
				latencyMs
			});

			// Log operation for cost tracking
			logLLMOperation('decision-makers', userContext, {
				callCount: 1 + result.decision_makers.length,
				durationMs: latencyMs,
				success: true
			});
		} catch (error) {
			console.error('[stream-decision-makers] Resolution failed:', error);
			emitter.error(error instanceof Error ? error.message : 'Resolution failed');
		} finally {
			emitter.close();
		}
	})();

	const headers = new Headers(SSE_HEADERS);
	addRateLimitHeaders(headers, rateLimitCheck);

	return new Response(stream, { headers });
};

/**
 * Clean thought content for UI display
 *
 * Agent thoughts can be verbose with markdown formatting.
 * Extract core insights for cleaner, more readable display.
 */
function cleanThoughtForDisplay(thought: string): string {
	// Skip empty thoughts
	if (!thought?.trim()) return '';

	// Remove markdown bold headings like "**Analyzing the Issue**"
	let cleaned = thought.replace(/^\*\*([^*]+)\*\*\s*[-–—]?\s*/i, '');

	// Remove leading/trailing whitespace and newlines
	cleaned = cleaned.replace(/^\n+/, '').trim();

	// Skip very short thoughts (likely noise)
	if (cleaned.length < 15) return '';

	// Truncate very long thoughts for UI readability
	if (cleaned.length > 200) {
		const lastPeriod = cleaned.lastIndexOf('.', 200);
		if (lastPeriod > 100) {
			cleaned = cleaned.slice(0, lastPeriod + 1);
		} else {
			cleaned = cleaned.slice(0, 200) + '...';
		}
	}

	return cleaned;
}
