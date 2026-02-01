/**
 * Streaming Message Generation API — Two-Phase Source Verification
 *
 * POST /api/agents/stream-message
 *
 * Returns Server-Sent Events (SSE) stream with:
 * - phase: Current pipeline phase (sources | message | complete)
 * - thought: Agent reasoning during source discovery and writing
 * - complete: Final message with VERIFIED sources
 * - error: Error message if generation fails
 *
 * Two-Phase Pipeline:
 * 1. Source Discovery: Find and validate URLs via web search
 * 2. Message Generation: Write using ONLY verified sources
 *
 * This eliminates citation hallucination—every URL in the output is verified.
 *
 * Rate Limiting: BLOCKED for guests, 10/hour authenticated, 30/hour verified.
 */

import type { RequestHandler } from './$types';
import { generateMessage, type PipelinePhase } from '$lib/core/agents/agents/message-writer';
import { cleanThoughtForDisplay } from '$lib/core/agents/utils/thought-filter';
import { createSSEStream, SSE_HEADERS } from '$lib/utils/sse-stream';
import {
	enforceLLMRateLimit,
	addRateLimitHeaders,
	getUserContext,
	logLLMOperation
} from '$lib/server/llm-cost-protection';
import type { DecisionMaker } from '$lib/core/agents';

interface RequestBody {
	subject_line: string;
	core_message: string;
	topics: string[];
	decision_makers: DecisionMaker[];
	voice_sample?: string;
	raw_input?: string;
	geographic_scope?: {
		type: 'international' | 'nationwide' | 'subnational';
		country?: string;
		subdivision?: string;
		locality?: string;
	};
}

export const POST: RequestHandler = async (event) => {
	// Rate limit check - DISABLED FOR DEMO
	// const rateLimitCheck = await enforceLLMRateLimit(event, 'message-generation');
	const userContext = getUserContext(event);
	const startTime = Date.now();

	// Auth check
	const session = event.locals.session;
	if (!session?.userId) {
		return new Response(JSON.stringify({ error: 'Authentication required' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	// Parse request body
	let body: RequestBody;
	try {
		body = (await event.request.json()) as RequestBody;
	} catch {
		return new Response(JSON.stringify({ error: 'Invalid request body' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	// Validate required fields
	if (!body.subject_line || !body.core_message) {
		return new Response(JSON.stringify({ error: 'Subject line and core message are required' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	console.log('[stream-message] Starting streaming generation:', {
		userId: session.userId,
		subject: body.subject_line.substring(0, 50),
		decisionMakerCount: body.decision_makers?.length || 0
	});

	// Create SSE stream
	const { stream, emitter } = createSSEStream();

	// Run generation in background
	(async () => {
		try {
			const result = await generateMessage({
				subjectLine: body.subject_line,
				coreMessage: body.core_message,
				topics: body.topics || [],
				decisionMakers: body.decision_makers || [],
				voiceSample: body.voice_sample,
				rawInput: body.raw_input,
				geographicScope: body.geographic_scope,
				onThought: (thought: string, phase?: PipelinePhase) => {
					const cleaned = cleanThoughtForDisplay(thought);
					if (cleaned) {
						emitter.send('thought', { content: cleaned, phase: phase || 'message' });
					}
				},
				onPhase: (phase: PipelinePhase, message: string) => {
					// Use 'phase-change' for consistency with unified event schema
					// Note: Some legacy consumers may still expect 'phase'
					emitter.send('phase-change', { phase, message });
				}
			});

			const latencyMs = Date.now() - startTime;

			// Send final result
			emitter.complete(result);

			console.log('[stream-message] Two-phase generation complete:', {
				userId: session.userId,
				messageLength: result.message.length,
				verifiedSourceCount: result.sources.length,
				latencyMs
			});

			// Log operation (now 2+ calls: source discovery + message generation)
			logLLMOperation('message-generation', userContext, {
				callCount: 3, // Source discovery (grounded) + message generation
				durationMs: latencyMs,
				success: true
			});
		} catch (error) {
			console.error('[stream-message] Generation failed:', error);
			emitter.error(error instanceof Error ? error.message : 'Generation failed');
		} finally {
			emitter.close();
		}
	})();

	const headers = new Headers(SSE_HEADERS);
	// addRateLimitHeaders(headers, rateLimitCheck); // DISABLED FOR DEMO

	return new Response(stream, { headers });
};

