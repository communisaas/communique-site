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
	// Persists across chunks — an event: line in one chunk may pair
	// with a data: line in the next chunk after network buffering splits them.
	let currentEventType = '';

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split('\n');
			buffer = lines.pop() || ''; // Keep incomplete line in buffer

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
				} else if (line.trim() === '') {
					// Empty line resets event type per SSE spec (event boundary)
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

// Server-side SSE helpers (createSSEStream, SSE_HEADERS) are in $lib/server/sse-stream.ts
