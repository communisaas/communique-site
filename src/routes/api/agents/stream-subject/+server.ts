/**
 * Streaming Subject Line Generation API
 *
 * POST /api/agents/stream-subject
 *
 * Returns Server-Sent Events (SSE) stream with:
 * - thought: Model's reasoning process (streamed in real-time)
 * - partial: Partial JSON output chunks
 * - complete: Final structured output
 * - error: Error message if generation fails
 *
 * Perceptual Engineering: Instead of a spinner, users see the agent
 * "thinking out loud" - building accurate mental model of system behavior.
 */

import type { RequestHandler } from './$types';
import { generateStream } from '$lib/core/agents/gemini-client';
import { SUBJECT_LINE_SCHEMA } from '$lib/core/agents/schemas';
import { SUBJECT_LINE_PROMPT } from '$lib/core/agents/prompts/subject-line';
import type { SubjectLineResponseWithClarification } from '$lib/core/agents/types';

interface RequestBody {
	message: string;
}

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as RequestBody;

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
				let jsonAccumulator = '';

				for await (const chunk of generateStream(prompt, {
					systemInstruction: SUBJECT_LINE_PROMPT,
					responseSchema: SUBJECT_LINE_SCHEMA,
					temperature: 0.4,
					thinkingLevel: 'low'
				})) {
					switch (chunk.type) {
						case 'thought':
							// Stream thoughts to UI for real-time visibility
							sendEvent('thought', { content: chunk.content });
							break;

						case 'text':
							// Accumulate JSON output
							jsonAccumulator += chunk.content;
							// Don't send partial JSON - wait for complete
							break;

						case 'complete':
							// Parse and send final result
							try {
								const data = JSON.parse(jsonAccumulator) as SubjectLineResponseWithClarification;

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
							} catch (parseError) {
								console.error('[stream-subject] JSON parse error:', parseError);
								sendEvent('error', { message: 'Failed to parse response' });
							}
							break;

						case 'error':
							sendEvent('error', { message: chunk.content });
							break;
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

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
