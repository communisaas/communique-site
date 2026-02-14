/**
 * Streaming Decision-Maker Resolution API
 *
 * POST /api/agents/stream-decision-makers
 *
 * Returns Server-Sent Events (SSE) stream with:
 * - segment: ThoughtSegment objects for real-time reasoning display
 * - complete: Final result with verified decision-makers
 * - error: Error message if resolution fails
 *
 * All emails are verified against grounded sources. Unverified emails are filtered out.
 *
 * Rate Limiting: BLOCKED for guests (quota = 0), 3/hour authenticated, 10/hour verified.
 */

import type { RequestHandler } from './$types';
import { resolveDecisionMakers } from '$lib/core/agents/agents';
import { createSSEStream, SSE_HEADERS } from '$lib/utils/sse-stream';
import type { ThoughtSegment } from '$lib/core/thoughts/types';
import {
	enforceLLMRateLimit,
	rateLimitResponse,
	addRateLimitHeaders,
	getUserContext,
	logLLMOperation
} from '$lib/server/llm-cost-protection';
import { moderatePromptOnly } from '$lib/core/server/moderation';
import { traceRequest } from '$lib/server/agent-trace';

interface RequestBody {
	subject_line: string;
	core_message: string;
	topics: string[];
	voice_sample?: string;
	target_type?: string;
	target_entity?: string;
}

export const POST: RequestHandler = async (event) => {
	const rateLimitCheck = await enforceLLMRateLimit(event, 'decision-makers');
	if (!rateLimitCheck.allowed) {
		return rateLimitResponse(rateLimitCheck);
	}
	const userContext = getUserContext(event);
	const startTime = Date.now();

	let body: RequestBody;
	try {
		body = (await event.request.json()) as RequestBody;
	} catch {
		return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const { subject_line, core_message, topics, voice_sample } = body;

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

	// Auth check
	const session = event.locals.session;
	if (!session?.userId) {
		return new Response(JSON.stringify({ error: 'Authentication required' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const userId = session.userId;
	const traceId = crypto.randomUUID();

	traceRequest(traceId, 'decision-makers', {
		metadata: {
			subjectLength: subject_line.length,
			coreMessageLength: core_message.length,
			topicCount: topics.length,
			topics,
			hasVoiceSample: !!voice_sample,
			targetType: body.target_type || 'local_government',
			targetEntity: body.target_entity || null
		},
		content: {
			subjectLine: subject_line,
			coreMessage: core_message,
			voiceSample: voice_sample
		}
	}, { userId });

	// Prompt injection detection
	// NOTE: core_message is AI-refined (from subject-line agent), not raw user input.
	// The AI's paraphrasing uses phrases like "The user is demanding that..." which
	// Prompt Guard interprets as indirect injection (meta-reference + imperative).
	// The raw input was already checked at the subject-line step, so we use a higher
	// threshold here (0.8) to avoid false positives on AI-generated descriptions
	// while still catching clear attacks (which score 0.9+).
	const contentToCheck = `${subject_line}\n${core_message}\n${topics.join(' ')}`;
	const injectionCheck = await moderatePromptOnly(contentToCheck, 0.8);

	if (!injectionCheck.safe) {
		console.log('[stream-decision-makers] Prompt injection detected:', {
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

	console.log('[stream-decision-makers] Starting resolution:', {
		userId,
		subject: subject_line.substring(0, 50),
		topics,
		targetType: body.target_type,
		targetEntity: body.target_entity
	});

	const { stream, emitter } = createSSEStream({
		traceId,
		endpoint: 'decision-makers',
		userId
	});

	(async () => {
		let streamSuccess = false;
		let resultTokenUsage: import('$lib/core/agents/types').TokenUsage | undefined;

		try {
			const context = {
				targetType: body.target_type || 'local_government',
				targetEntity: body.target_entity,
				subjectLine: subject_line,
				coreMessage: core_message,
				topics,
				voiceSample: voice_sample
			};

			const result = await resolveDecisionMakers(context, (segment: ThoughtSegment) => {
				// Route progressive reveal events to their own SSE event types
				const segmentAny = segment as any;
				if (segmentAny.type === 'identity-found') {
					emitter.send('identity-found', segmentAny.metadata.identities);
				} else if (segmentAny.type === 'candidate-resolved') {
					emitter.send('candidate-resolved', segmentAny.metadata.candidate);
				} else {
					emitter.send('segment', segment);
				}
			});

			resultTokenUsage = result.tokenUsage;

			// Build response - source is the email source (verified)
			const response = {
				decision_makers: result.decisionMakers.map((dm) => ({
					name: dm.name,
					title: dm.title,
					organization: dm.organization,
					email: dm.email || '',
					reasoning: dm.reasoning,
					sourceUrl: dm.emailSource || dm.source || '',
					sourceTitle: dm.emailSourceTitle || '',
					provenance: dm.provenance
				})),
				research_summary: result.researchSummary || 'Decision-makers resolved successfully.',
				pipeline_stats: {
					candidates_found: result.decisionMakers.length,
					verified_emails: result.decisionMakers.filter((dm) => dm.email).length,
					total_latency_ms: result.latencyMs
				}
			};

			emitter.complete(response);
			streamSuccess = true;

			console.log('[stream-decision-makers] Resolution complete:', {
				userId,
				count: result.decisionMakers.length,
				withEmail: result.decisionMakers.filter((dm) => dm.email).length,
				latencyMs: Date.now() - startTime
			});
		} catch (error) {
			console.error('[stream-decision-makers] Resolution failed:', error);
			emitter.error(error instanceof Error ? error.message : 'Resolution failed');
		} finally {
			logLLMOperation(
				'decision-makers',
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
