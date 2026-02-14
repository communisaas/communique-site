/**
 * SSE Stream - Server-side helpers
 *
 * createSSEStream and SSE_HEADERS for server endpoints.
 * Separated from $lib/utils/sse-stream.ts (client-side parsers) to avoid
 * leaking $lib/server/agent-trace into the client bundle.
 */

import { traceEvent } from '$lib/server/agent-trace';

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
				traceEvent(
					traceConfig.traceId,
					traceConfig.endpoint,
					type,
					data as Record<string, unknown>,
					{ userId: traceConfig.userId }
				);
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
