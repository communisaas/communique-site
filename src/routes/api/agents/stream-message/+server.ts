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
	rateLimitResponse,
	addRateLimitHeaders,
	getUserContext,
	logLLMOperation
} from '$lib/server/llm-cost-protection';
import type { DecisionMaker } from '$lib/core/agents';
import { moderatePromptOnly } from '$lib/core/server/moderation';
import { traceRequest } from '$lib/server/agent-trace';

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
	const rateLimitCheck = await enforceLLMRateLimit(event, 'message-generation');
	if (!rateLimitCheck.allowed) {
		return rateLimitResponse(rateLimitCheck);
	}
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

	const traceId = crypto.randomUUID();

	traceRequest(traceId, 'message-generation', {
		metadata: {
			subjectLength: body.subject_line.length,
			coreMessageLength: body.core_message.length,
			topicCount: body.topics?.length || 0,
			topics: body.topics || [],
			decisionMakerCount: body.decision_makers?.length || 0,
			hasVoiceSample: !!body.voice_sample,
			hasRawInput: !!body.raw_input,
			geographicScopeType: body.geographic_scope?.type || null
		},
		content: {
			subjectLine: body.subject_line,
			coreMessage: body.core_message,
			voiceSample: body.voice_sample,
			rawInput: body.raw_input,
			decisionMakerNames: body.decision_makers?.map((dm) => dm.name).filter(Boolean)
		}
	}, { userId: session.userId });

	// Prompt injection detection
	const contentToCheck = [
		body.subject_line,
		body.core_message,
		...(body.topics || []),
		body.voice_sample,
		body.raw_input
	].filter(Boolean).join('\n');

	const injectionCheck = await moderatePromptOnly(contentToCheck);

	if (!injectionCheck.safe) {
		console.log('[stream-message] Prompt injection detected:', {
			score: injectionCheck.score.toFixed(4),
			threshold: injectionCheck.threshold
		});

		return new Response(
			JSON.stringify({
				error: 'Content flagged by safety filter',
				code: 'PROMPT_INJECTION_DETECTED'
			}),
			{
				status: 403,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}

	console.log('[stream-message] Starting streaming generation:', {
		userId: session.userId,
		subject: body.subject_line.substring(0, 50),
		decisionMakerCount: body.decision_makers?.length || 0
	});

	// Create SSE stream
	const { stream, emitter } = createSSEStream({
		traceId,
		endpoint: 'message-generation',
		userId: session.userId
	});

	// Run generation in background
	(async () => {
		let streamSuccess = false;
		let resultTokenUsage: import('$lib/core/agents/types').TokenUsage | undefined;

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
					emitter.send('phase', { phase, message });
				}
			});

			// Strip tokenUsage from SSE payload (internal concern)
			const { tokenUsage, ...clientResult } = result;
			resultTokenUsage = tokenUsage;

			// Send final result
			emitter.complete(clientResult);
			streamSuccess = true;

			console.log('[stream-message] Two-phase generation complete:', {
				userId: session.userId,
				messageLength: result.message.length,
				verifiedSourceCount: result.sources.length,
				latencyMs: Date.now() - startTime
			});
		} catch (error) {
			console.error('[stream-message] Generation failed:', error);
			emitter.error(error instanceof Error ? error.message : 'Generation failed');
		} finally {
			logLLMOperation(
				'message-generation',
				userContext,
				{
					durationMs: Date.now() - startTime,
					success: streamSuccess,
					tokenUsage: resultTokenUsage
				},
				traceId
			);
			emitter.close();
		}
	})();

	const headers = new Headers(SSE_HEADERS);
	addRateLimitHeaders(headers, rateLimitCheck);

	return new Response(stream, { headers });
};

