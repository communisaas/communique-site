/**
 * Streaming Message Generation API
 *
 * POST /api/agents/stream-message
 *
 * Returns Server-Sent Events (SSE) stream with:
 * - thought: Agent reasoning during research and writing
 * - complete: Final message with sources and research log
 * - error: Error message if generation fails
 *
 * Perceptual Engineering: Users see the agent researching their issue
 * in real-time, building trust through transparency.
 *
 * Rate Limiting: BLOCKED for guests, 10/hour authenticated, 30/hour verified.
 */

import type { RequestHandler } from './$types';
import { generateMessage } from '$lib/core/agents/agents/message-writer';
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
	core_issue: string;
	topics: string[];
	decision_makers: DecisionMaker[];
	voice_sample?: string;
	raw_input?: string;
}

export const POST: RequestHandler = async (event) => {
	// Rate limit check - throws 429 if exceeded (also blocks guests)
	const rateLimitCheck = await enforceLLMRateLimit(event, 'message-generation');
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
	if (!body.subject_line || !body.core_issue) {
		return new Response(JSON.stringify({ error: 'Subject line and core issue are required' }), {
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
			// Send initial phase
			emitter.send('phase', { phase: 'research', message: 'Researching your issue...' });

			const result = await generateMessage({
				subjectLine: body.subject_line,
				coreIssue: body.core_issue,
				topics: body.topics || [],
				decisionMakers: body.decision_makers || [],
				voiceSample: body.voice_sample,
				rawInput: body.raw_input,
				onThought: (thought: string) => {
					const cleaned = cleanThoughtForDisplay(thought);
					if (cleaned) {
						emitter.send('thought', { content: cleaned });
					}
				}
			});

			const latencyMs = Date.now() - startTime;

			// Send completion phase then result
			emitter.send('phase', { phase: 'complete', message: 'Message ready' });
			emitter.complete(result);

			console.log('[stream-message] Generation complete:', {
				userId: session.userId,
				messageLength: result.message.length,
				sourceCount: result.sources.length,
				latencyMs
			});

			// Log operation
			logLLMOperation('message-generation', userContext, {
				callCount: 2,
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
	addRateLimitHeaders(headers, rateLimitCheck);

	return new Response(stream, { headers });
};

/**
 * Clean thought content for UI display
 */
function cleanThoughtForDisplay(thought: string): string {
	if (!thought?.trim()) return '';

	let cleaned = thought.replace(/^\*\*([^*]+)\*\*\s*[-–—]?\s*/i, '');
	cleaned = cleaned.replace(/^\n+/, '').trim();

	if (cleaned.length < 15) return '';

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
