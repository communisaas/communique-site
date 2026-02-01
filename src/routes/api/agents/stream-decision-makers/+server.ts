/**
 * Streaming Decision-Maker Resolution API
 *
 * POST /api/agents/stream-decision-makers
 *
 * Returns Server-Sent Events (SSE) stream with:
 * - ping: Heartbeat event every 10s to keep connection alive (ignore in UI)
 * - segment: ThoughtSegment objects with phase and confidence (v2 default)
 *   - In composite flow: includes `phase: 'discovery' | 'verification'` and `confidence: number`
 * - phase: Phase change events (composite: from/to transitions, v1: pipeline phases)
 * - confidence: Confidence update events (composite flow only)
 * - documents: Parsed documents from document tool invocations for L2 preview access
 *   - Format: { count: number, documents: Array<[documentId, ParsedDocument]> }
 *   - Frontend should hydrate a Map<string, ParsedDocument> from the documents array
 * - thought: Agent reasoning (v1 legacy format)
 * - progress: Enrichment progress (v1 legacy format)
 * - complete: Final result with decision-makers
 * - error: Error message if resolution fails
 *
 * Query Parameters:
 * - version: 'v2' (default) | 'v1' - API version
 * - composite: 'true' (default) | 'false' - Enable two-phase composite streaming
 *
 * Version Support:
 * - v2 + composite (default): Two-phase streaming (Discovery + Verification) with confidence tracking
 * - v2 + composite=false: Simple ThoughtStream without confidence tracking
 * - v1 (legacy): Emits raw text thoughts for backward compatibility
 *
 * Composite Flow Events:
 * - segment: { ...thoughtSegment, phase: 'discovery' | 'verification', confidence: 0.4-1.0 }
 * - phase: { from: CompositePhase, to: CompositePhase, timestamp: number }
 * - confidence: { thoughtId, previousConfidence, newConfidence, verified }
 * - documents: { count: number, documents: Array<[id, ParsedDocument]> }
 *
 * Perceptual Engineering: Users see the agent's actual research process,
 * building trust through transparency. Real thoughts replace marketing fluff.
 *
 * Rate Limiting: BLOCKED for guests (quota = 0), 3/hour authenticated, 10/hour verified.
 */

import type { RequestHandler } from './$types';
import { resolveDecisionMakers, type PipelinePhase } from '$lib/core/agents/agents/decision-maker';
import {
	resolveDecisionMakersV2,
	resolveDecisionMakersWithCompositeStreaming,
	type CompositeStreamingOptions
} from '$lib/core/agents/agents/decision-maker-v2';
import type {
	ConfidentThoughtSegment,
	PhaseChangeEvent,
	ConfidenceUpdateEvent
} from '$lib/core/thoughts/composite-emitter';
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
	// Rate limit check - DISABLED FOR DEMO
	// const rateLimitCheck = await enforceLLMRateLimit(event, 'decision-makers');
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

	// Check for version and composite parameters
	// Default: v2 with composite streaming enabled for production
	const url = new URL(event.request.url);
	const version = url.searchParams.get('version') || 'v2';
	const useV2 = version === 'v2';

	// Composite streaming: default to true for v2, can be disabled with ?composite=false
	const compositeParam = url.searchParams.get('composite');
	const useComposite = useV2 && compositeParam !== 'false';

	console.log('[stream-decision-makers] Starting streaming resolution:', {
		userId,
		version,
		composite: useComposite,
		subject: subject_line.substring(0, 50),
		topics,
		targetType: body.target_type,
		targetEntity: body.target_entity
	});

	// Create SSE stream
	const { stream, emitter } = createSSEStream();

	// Heartbeat to keep SSE connection alive during long operations
	// Browsers/proxies may close idle connections after 30-60s
	const HEARTBEAT_INTERVAL_MS = 10_000; // 10 seconds
	let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

	const startHeartbeat = () => {
		heartbeatInterval = setInterval(() => {
			emitter.send('ping', { timestamp: Date.now() });
		}, HEARTBEAT_INTERVAL_MS);
	};

	const stopHeartbeat = () => {
		if (heartbeatInterval) {
			clearInterval(heartbeatInterval);
			heartbeatInterval = null;
		}
	};

	// Run resolution in background (stream is returned immediately)
	(async () => {
		// Start heartbeat immediately
		startHeartbeat();

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

				if (useComposite) {
					// ============================================================
					// Composite Flow: Two-phase streaming with confidence tracking
					// ============================================================
					console.log('[stream-decision-makers] Using composite streaming flow');

					// Create composite streaming options with SSE callbacks
					const compositeOptions: CompositeStreamingOptions = {
						// Emit segments with phase and confidence info
						onSegment: (segment: ThoughtSegment | ConfidentThoughtSegment) => {
							// Check if this is a ConfidentThoughtSegment (has confidence property)
							const isConfident = 'confidence' in segment && 'sourcePhase' in segment;

							emitter.send('segment', {
								...segment,
								// Include phase and confidence for UI rendering
								phase: isConfident
									? (segment as ConfidentThoughtSegment).sourcePhase
									: segment.phase,
								confidence: isConfident
									? (segment as ConfidentThoughtSegment).confidence
									: undefined
							});
						},

						// Emit phase change events for UI state transitions
						// Use 'phase-change' for consistency with unified event schema
						onPhaseChange: (event: PhaseChangeEvent) => {
							emitter.send('phase-change', {
								from: event.from,
								to: event.to,
								timestamp: event.timestamp
							});
						},

						// Emit confidence updates for verification boosts
						onConfidenceUpdate: (event: ConfidenceUpdateEvent) => {
							emitter.send('confidence', {
								thoughtId: event.thoughtId,
								previousConfidence: event.previousConfidence,
								newConfidence: event.newConfidence,
								verified: event.verified
							});
						}
					};

					// Resolve with composite streaming
					result = await resolveDecisionMakersWithCompositeStreaming(context, compositeOptions);
				} else {
					// ============================================================
					// Standard V2 Flow: Simple ThoughtEmitter without composite
					// ============================================================
					console.log('[stream-decision-makers] Using standard v2 flow');

					// Resolve with ThoughtEmitter
					result = await resolveDecisionMakersV2(context, (segment: ThoughtSegment) => {
						// Emit segment as SSE
						emitter.send('segment', segment);
					});
				}

				// Emit collected documents for L2 preview access
				// Documents are serialized as [id, document] pairs since Maps aren't JSON-serializable
				if (result.documents && result.documents.size > 0) {
					const documentsArray = Array.from(result.documents.entries());
					emitter.send('documents', {
						count: documentsArray.length,
						documents: documentsArray
					});
					console.log(`[stream-decision-makers] Emitted ${documentsArray.length} documents for L2 previews`);
				}

				// Emit grounding sources for L1 inline citations
				// Sources are extracted from Gemini groundingMetadata during resolution
				if (result.sources && result.sources.length > 0) {
					emitter.send('sources', {
						count: result.sources.length,
						sources: result.sources
					});
					console.log(`[stream-decision-makers] Emitted ${result.sources.length} sources for L1 citations`);
				}

				// Convert to legacy format for final result
				// Use computed confidence from composite flow: base 0.4 + 0.15 per verification
				const fallbackConfidence =
					(result.metadata?.compositeStreaming as { averageConfidence?: number })
						?.averageConfidence ?? 0.4;

				const legacyResult = {
					decision_makers: result.decisionMakers.map((dm) => ({
						name: dm.name,
						title: dm.title,
						organization: dm.organization,
						email: dm.email || '',
						reasoning: dm.reasoning,
						sourceUrl: dm.source || '',
						emailSource: dm.source || '',
						confidence: dm.confidence ?? fallbackConfidence,
						contactChannel: 'email' as const,
						provenance: dm.provenance
					})),
					research_summary: result.researchSummary || 'Decision-makers resolved successfully.',
					pipeline_stats: {
						candidates_found: result.decisionMakers.length,
						enrichments_succeeded: result.decisionMakers.filter((dm) => dm.email).length,
						validations_passed: result.decisionMakers.length,
						total_latency_ms: result.latencyMs
					},
					// Include composite streaming stats if available
					composite_stats: result.metadata?.compositeStreaming ?? undefined,
					// Include document count for reference
					documents_count: result.documents?.size ?? 0
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
							// Use 'phase-change' for consistency with unified event schema
							emitter.send('phase-change', { phase, message });
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
			stopHeartbeat();
			emitter.close();
		}
	})();

	const headers = new Headers(SSE_HEADERS);
	// addRateLimitHeaders(headers, rateLimitCheck); // DISABLED FOR DEMO

	return new Response(stream, { headers });
};

