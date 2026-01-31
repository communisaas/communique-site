/**
 * Streaming Decision-Maker Resolution API
 *
 * POST /api/agents/stream-decision-makers
 *
 * Returns Server-Sent Events (SSE) stream with:
 * - segment: ThoughtSegment objects (v2 format, default)
 * - phase: Pipeline phase changes (v1 legacy format)
 * - thought: Agent reasoning (v1 legacy format)
 * - progress: Enrichment progress (v1 legacy format)
 * - complete: Final result with decision-makers
 * - error: Error message if resolution fails
 *
 * Version Support:
 * - v2 (default): Emits structured ThoughtSegments with citations and progressive disclosure
 * - v1 (legacy): Emits raw text thoughts for backward compatibility
 *
 * Set `?version=v1` query param to use legacy format.
 *
 * Perceptual Engineering: Users see the agent's actual research process,
 * building trust through transparency. Real thoughts replace marketing fluff.
 *
 * Rate Limiting: BLOCKED for guests (quota = 0), 3/hour authenticated, 10/hour verified.
 */

import type { RequestHandler } from './$types';
import { resolveDecisionMakers, type PipelinePhase } from '$lib/core/agents/agents/decision-maker';
import { resolveDecisionMakersV2 } from '$lib/core/agents/agents/decision-maker-v2';
import { cleanThoughtForDisplay } from '$lib/core/agents/utils/thought-filter';
import { createSSEStream, SSE_HEADERS } from '$lib/utils/sse-stream';
import type { ThoughtSegment } from '$lib/core/thoughts/types';
import {
	enforceLLMRateLimit,
	addRateLimitHeaders,
	getUserContext,
	logLLMOperation
} from '$lib/server/llm-cost-protection';

interface RequestBody {
	subject_line: string;
	core_message: string;
	topics: string[];
	voice_sample?: string;
	url_slug?: string;
	target_type?: string; // Optional: specific target type for v2
	target_entity?: string; // Optional: specific entity name for v2
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

	const { subject_line, core_message, topics, voice_sample, url_slug } = body;

	if (!subject_line?.trim()) {
		return new Response(JSON.stringify({ error: 'Subject line is required' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	if (!core_message?.trim()) {
		return new Response(JSON.stringify({ error: 'Core message is required' }), {
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

	// Check for version parameter (default to v2)
	const url = new URL(event.request.url);
	const version = url.searchParams.get('version') || 'v2';
	const useV2 = version === 'v2';

	console.log('[stream-decision-makers] Starting streaming resolution:', {
		userId,
		version,
		subject: subject_line.substring(0, 50),
		topics,
		targetType: body.target_type,
		targetEntity: body.target_entity
	});

	// Create SSE stream
	const { stream, emitter } = createSSEStream();

	// Run resolution in background (stream is returned immediately)
	(async () => {
		try {
			let result;

			if (useV2) {
				// ================================================================
				// V2 Flow: ThoughtStream with structured segments
				// ================================================================

				// Build resolution context
				const context = {
					targetType: (body.target_type as any) || 'local_government',
					targetEntity: body.target_entity,
					subjectLine: subject_line,
					coreMessage: core_message,
					topics,
					voiceSample: voice_sample
				};

				// Resolve with ThoughtEmitter
				result = await resolveDecisionMakersV2(context, (segment: ThoughtSegment) => {
					// Emit segment as SSE
					emitter.send('segment', segment);
				});

				// Convert to legacy format for final result
				const legacyResult = {
					decision_makers: result.decisionMakers.map((dm) => ({
						name: dm.name,
						title: dm.title,
						organization: dm.organization,
						email: dm.email || '',
						reasoning: dm.reasoning,
						sourceUrl: dm.source || '',
						emailSource: dm.source || '',
						confidence: 0.8,
						contactChannel: 'email' as const,
						provenance: dm.provenance
					})),
					research_summary: result.researchSummary || 'Decision-makers resolved successfully.',
					pipeline_stats: {
						candidates_found: result.decisionMakers.length,
						enrichments_succeeded: result.decisionMakers.filter((dm) => dm.email).length,
						validations_passed: result.decisionMakers.length,
						total_latency_ms: result.latencyMs
					}
				};

				emitter.complete(legacyResult);
			} else {
				// ================================================================
				// V1 Flow: Legacy text streaming (backward compatibility)
				// ================================================================

				const legacyResult = await resolveDecisionMakers({
					subjectLine: subject_line,
					coreMessage: core_message,
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

				emitter.complete(legacyResult);
				result = {
					decisionMakers: legacyResult.decision_makers.map((dm) => ({
						name: dm.name,
						title: dm.title,
						organization: dm.organization,
						email: dm.email,
						reasoning: dm.reasoning,
						source: dm.sourceUrl,
						provenance: dm.provenance || '',
						isAiResolved: true,
						powerLevel: 'primary' as const
					})),
					provider: 'legacy',
					cacheHit: false,
					latencyMs: legacyResult.pipeline_stats?.total_latency_ms || 0
				};
			}

			const latencyMs = Date.now() - startTime;

			// Log success
			console.log('[stream-decision-makers] Resolution complete:', {
				userId,
				version,
				count: result.decisionMakers.length,
				latencyMs
			});

			// Log operation for cost tracking (2 Gemini calls: role discovery + person lookup)
			logLLMOperation('decision-makers', userContext, {
				callCount: 2,
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

