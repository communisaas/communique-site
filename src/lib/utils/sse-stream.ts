/**
 * SSE Stream Parser - Unified Server-Sent Events handling
 *
 * Extracts SSE parsing logic into a reusable async generator.
 * Used by all streaming agent consumers (subject line, decision-makers, message generation).
 */

export interface SSEEvent<T = unknown> {
	type: string;
	data: T;
}

/**
 * Parse an SSE stream response into typed events.
 * Handles chunked responses and buffer management.
 *
 * @example
 * ```typescript
 * const response = await fetch('/api/agents/stream-subject', { method: 'POST', body });
 * for await (const event of parseSSEStream<ThoughtEvent>(response)) {
 *   if (event.type === 'thought') {
 *     thoughts.push(event.data.content);
 *   }
 * }
 * ```
 */
export async function* parseSSEStream<T = unknown>(
	response: Response
): AsyncGenerator<SSEEvent<T>, void, unknown> {
	const reader = response.body?.getReader();
	if (!reader) {
		throw new Error('No response body available for streaming');
	}

	const decoder = new TextDecoder();
	let buffer = '';

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split('\n');
			buffer = lines.pop() || ''; // Keep incomplete line in buffer

			let currentEventType = '';

			for (const line of lines) {
				if (line.startsWith('event: ')) {
					currentEventType = line.slice(7).trim();
				} else if (line.startsWith('data: ') && currentEventType) {
					try {
						const parsed = JSON.parse(line.slice(6));
						yield { type: currentEventType, data: parsed as T };
					} catch (error) {
						console.warn('[SSE Stream] Failed to parse SSE data:', error);
					}
					currentEventType = '';
				}
			}
		}
	} finally {
		reader.releaseLock();
	}
}

/**
 * Stream consumer helper - collects events by type while processing.
 * Useful when you need to accumulate thoughts and get a final result.
 */
export interface StreamCollector<TFinal> {
	thoughts: string[];
	result: TFinal | null;
	error: string | null;
}

export async function collectStream<TFinal>(
	response: Response,
	onThought?: (thought: string) => void,
	onProgress?: (current: number, total: number) => void
): Promise<StreamCollector<TFinal>> {
	const collector: StreamCollector<TFinal> = {
		thoughts: [],
		result: null,
		error: null
	};

	for await (const event of parseSSEStream<Record<string, unknown>>(response)) {
		switch (event.type) {
			case 'thought':
				if (typeof event.data.content === 'string') {
					collector.thoughts.push(event.data.content);
					onThought?.(event.data.content);
				}
				break;

			case 'progress':
				if (typeof event.data.current === 'number' && typeof event.data.total === 'number') {
					onProgress?.(event.data.current, event.data.total);
				}
				break;

			case 'complete':
				collector.result = event.data as TFinal;
				break;

			case 'error':
				collector.error =
					typeof event.data.message === 'string' ? event.data.message : 'Unknown error';
				break;
		}
	}

	return collector;
}

/**
 * Create SSE response helper for server endpoints.
 * Provides typed event emitter for consistent SSE formatting.
 */
export function createSSEStream(traceConfig?: {
	traceId: string;
	endpoint: string;
	userId?: string | null;
}) {
	const encoder = new TextEncoder();
	let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
	let closed = false;

	const stream = new ReadableStream<Uint8Array>({
		start(c) {
			controller = c;
		}
	});

	const emitter = {
		/**
		 * Send a typed event to the stream
		 */
		send<T>(type: string, data: T) {
			if (!controller || closed) return;
			try {
				const event = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
				controller.enqueue(encoder.encode(event));
			} catch {
				// Stream already closed by client disconnect or timeout
				closed = true;
				return;
			}

			if (traceConfig) {
				import('$lib/server/agent-trace').then(({ traceEvent }) => {
					traceEvent(
						traceConfig.traceId,
						traceConfig.endpoint,
						type,
						data as Record<string, unknown>,
						{ userId: traceConfig.userId }
					);
				}).catch(() => {});
			}
		},

		/**
		 * Send a thought event (convenience method)
		 */
		thought(content: string) {
			this.send('thought', { content });
		},

		/**
		 * Send a progress event (convenience method)
		 */
		progress(current: number, total: number, phase?: string) {
			this.send('progress', { current, total, phase });
		},

		/**
		 * Send completion event with final data
		 */
		complete<T>(data: T) {
			this.send('complete', data);
		},

		/**
		 * Send error event
		 */
		error(message: string, code?: string) {
			this.send('error', { message, code });
		},

		/**
		 * Close the stream
		 */
		close() {
			if (closed) return;
			closed = true;
			try {
				controller?.close();
			} catch {
				// Already closed
			}
		}
	};

	return { stream, emitter };
}

/**
 * SSE Response headers
 */
export const SSE_HEADERS = {
	'Content-Type': 'text/event-stream',
	'Cache-Control': 'no-cache',
	Connection: 'keep-alive'
} as const;
