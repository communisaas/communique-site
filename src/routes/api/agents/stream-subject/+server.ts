/**
 * Streaming Subject Line Generation API
 *
 * POST /api/agents/stream-subject
 *
 * Returns Server-Sent Events (SSE) stream with:
 * - thought: Model's reasoning summaries (streamed in real-time)
 * - complete: Final structured output
 * - error: Error message if generation fails
 *
 * Perceptual Engineering: Instead of a spinner, users see the agent
 * "thinking out loud" - building accurate mental model of system behavior.
 *
 * Key insight: responseMimeType='application/json' suppresses thoughts.
 * Solution: Use generateStreamWithThoughts which doesn't use responseMimeType
 * and parses JSON manually, allowing thoughts to flow through.
 *
 * Rate Limiting: 5/hour for guests, 15/hour for authenticated, 30/hour for verified.
 */

import type { RequestHandler } from './$types';
import { generateStreamWithThoughts } from '$lib/core/agents/gemini-client';
import { SUBJECT_LINE_PROMPT } from '$lib/core/agents/prompts/subject-line';
import { cleanThoughtForDisplay } from '$lib/core/agents/utils/thought-filter';
import type { SubjectLineResponseWithClarification } from '$lib/core/agents/types';
import {
	enforceLLMRateLimit,
	rateLimitResponse,
	addRateLimitHeaders,
	getUserContext,
	logLLMOperation
} from '$lib/server/llm-cost-protection';

interface RequestBody {
	message: string;
}

export const POST: RequestHandler = async (event) => {
	const rateLimitCheck = await enforceLLMRateLimit(event, 'subject-line');
	if (!rateLimitCheck.allowed) {
		return rateLimitResponse(rateLimitCheck);
	}
	const userContext = getUserContext(event);
	const startTime = Date.now();

	const body = (await event.request.json()) as RequestBody;

	if (!body.message?.trim()) {
		return new Response(JSON.stringify({ error: 'Message is required' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const prompt = `Analyze this issue and generate a subject line:\n\n${body.message}`;

	// Create readable stream for SSE
	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();

			const sendEvent = (type: string, data: unknown) => {
				const event = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
				controller.enqueue(encoder.encode(event));
			};

			try {
				// Use generateStreamWithThoughts to get actual thinking summaries
				// This doesn't use responseMimeType, allowing thoughts to flow
				const generator = generateStreamWithThoughts<SubjectLineResponseWithClarification>(prompt, {
					systemInstruction: SUBJECT_LINE_PROMPT,
					temperature: 0.4,
					thinkingLevel: 'medium' // Medium gives richer thought summaries
				});

				let iterResult = await generator.next();

				while (!iterResult.done) {
					const chunk = iterResult.value;

					switch (chunk.type) {
						case 'thought':
							// Stream thoughts to UI for real-time visibility
							// Clean up markdown formatting for UI display
							sendEvent('thought', {
								content: cleanThoughtForDisplay(chunk.content)
							});
							break;

						case 'text':
							// Don't stream partial JSON - wait for complete
							break;

						case 'complete':
							// Final parsing happens in generator return value
							break;

						case 'error':
							sendEvent('error', { message: chunk.content });
							break;
					}

					iterResult = await generator.next();
				}

				// Get the final parsed result from the generator
				if (iterResult.done && iterResult.value) {
					const result = iterResult.value;

					if (result.parseSuccess && result.data) {
						const data = result.data;

						// Validate: if needs_clarification but no questions, override
						if (
							data.needs_clarification &&
							(!data.clarification_questions || data.clarification_questions.length === 0)
						) {
							data.needs_clarification = false;
						}

						if (data.needs_clarification) {
							sendEvent('clarification', { data });
						} else {
							sendEvent('complete', { data });
						}
					} else {
						console.error('[stream-subject] JSON parse error:', result.parseError);
						sendEvent('error', { message: 'Failed to parse response' });
					}
				}
			} catch (error) {
				console.error('[stream-subject] Stream error:', error);
				sendEvent('error', {
					message: error instanceof Error ? error.message : 'Generation failed'
				});
			} finally {
				controller.close();
			}
		}
	});

	const headers = new Headers({
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		Connection: 'keep-alive'
	});

	// Add rate limit info to headers
	addRateLimitHeaders(headers, rateLimitCheck);

	// Log operation for cost tracking
	logLLMOperation('subject-line', userContext, {
		callCount: 1,
		durationMs: Date.now() - startTime,
		success: true
	});

	return new Response(stream, { headers });
};

