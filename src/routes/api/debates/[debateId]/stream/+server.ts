import { createSSEStream, SSE_HEADERS } from '$lib/server/sse-stream';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const { debateId } = params;
	const shadowAtlasUrl = env.SHADOW_ATLAS_URL || 'http://localhost:3000';
	const { stream, emitter } = createSSEStream({
		traceId: crypto.randomUUID(),
		endpoint: 'debate-stream'
	});

	// Connect to shadow-atlas SSE and forward events
	try {
		const upstream = await fetch(`${shadowAtlasUrl}/v1/debate/${debateId}/stream`, {
			headers: { Accept: 'text/event-stream' }
		});

		if (!upstream.ok || !upstream.body) {
			emitter.error(`Shadow atlas unavailable (${upstream.status})`, 'UPSTREAM_ERROR');
			emitter.close();
			return new Response(stream, { headers: SSE_HEADERS });
		}

		// Pipe upstream SSE events to client
		const reader = upstream.body.getReader();
		const decoder = new TextDecoder();

		(async () => {
			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					// Forward raw SSE chunks — they're already formatted as event: / data:
					const chunk = decoder.decode(value, { stream: true });
					// Parse and re-emit each SSE event
					for (const block of chunk.split('\n\n')) {
						if (!block.trim()) continue;
						const lines = block.split('\n');
						let eventType = 'message';
						let data = '';
						for (const line of lines) {
							if (line.startsWith('event: ')) eventType = line.slice(7).trim();
							if (line.startsWith('data: ')) data = line.slice(6);
							if (line.startsWith(':')) continue; // keepalive
						}
						if (data) {
							try {
								emitter.send(eventType, JSON.parse(data));
							} catch {
								// Non-JSON data, skip
							}
						}
					}
				}
			} catch {
				// Upstream closed or errored
			} finally {
				emitter.close();
			}
		})();
	} catch {
		emitter.error('Failed to connect to shadow atlas', 'CONNECTION_ERROR');
		emitter.close();
	}

	return new Response(stream, { headers: SSE_HEADERS });
};
