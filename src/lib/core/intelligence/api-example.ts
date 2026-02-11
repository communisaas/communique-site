/**
 * SvelteKit API Route Example
 *
 * Demonstrates how to create a streaming intelligence endpoint
 * that can be consumed by UI components.
 *
 * File: src/routes/api/intelligence/+server.ts
 */

import { intelligenceOrchestrator } from '$lib/core/intelligence';
import type { IntelligenceQuery } from '$lib/core/intelligence';
import { error, type RequestHandler } from '@sveltejs/kit';

/**
 * Example 1: Server-Sent Events (SSE) Stream
 *
 * Best for real-time streaming to the UI
 * Usage: new EventSource('/api/intelligence/stream')
 */
export const POST: RequestHandler = async ({ request }) => {
	const query = (await request.json()) as IntelligenceQuery;

	// Validate query
	if (!query.topics || query.topics.length === 0) {
		throw error(400, 'Topics are required');
	}

	// Create SSE stream
	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();

			try {
				// Stream events from orchestrator
				for await (const event of intelligenceOrchestrator.streamWithEvents(query)) {
					// Send as SSE
					const data = `data: ${JSON.stringify(event)}\n\n`;
					controller.enqueue(encoder.encode(data));
				}

				// End stream
				controller.close();
			} catch (err) {
				// Send error event
				const errorEvent = {
					type: 'error',
					error: err instanceof Error ? err.message : 'Unknown error',
					recoverable: false
				};
				const data = `data: ${JSON.stringify(errorEvent)}\n\n`;
				controller.enqueue(encoder.encode(data));
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

/**
 * Example 2: JSON Response (Non-Streaming)
 *
 * For simple use cases where streaming isn't needed
 * Usage: fetch('/api/intelligence', { method: 'POST', body: ... })
 */
export const POST_SIMPLE: RequestHandler = async ({ request }) => {
	const query = (await request.json()) as IntelligenceQuery;

	if (!query.topics || query.topics.length === 0) {
		throw error(400, 'Topics are required');
	}

	try {
		const items = await intelligenceOrchestrator.gather(query, {
			maxItemsPerProvider: 10,
			minRelevanceScore: 0.5,
			providerTimeoutMs: 30000
		});

		return new Response(
			JSON.stringify({
				items,
				total: items.length,
				query
			}),
			{
				headers: {
					'Content-Type': 'application/json'
				}
			}
		);
	} catch (err) {
		throw error(500, err instanceof Error ? err.message : 'Failed to gather intelligence');
	}
};

/**
 * Example 3: Svelte Component Integration
 *
 * How to consume the SSE stream in a Svelte component
 */

/*
<script lang="ts">
  import type { IntelligenceItem, IntelligenceStreamEvent } from '$lib/core/intelligence';

  let items = $state<IntelligenceItem[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);

  async function gatherIntelligence(query: IntelligenceQuery) {
    loading = true;
    error = null;
    items = [];

    try {
      const response = await fetch('/api/intelligence/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query)
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const event = JSON.parse(line.slice(6)) as IntelligenceStreamEvent;

            if (event.type === 'item') {
              items = [...items, event.item];
            } else if (event.type === 'error') {
              error = event.error;
            }
          }
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
    } finally {
      loading = false;
    }
  }
</script>

<div class="intelligence-panel">
  {#if loading}
    <div class="loading">Gathering intelligence...</div>
  {/if}

  {#if error}
    <div class="error">{error}</div>
  {/if}

  <div class="items">
    {#each items as item (item.id)}
      <div class="item">
        <h3>{item.title}</h3>
        <p>{item.summary}</p>
        <span class="category">{item.category}</span>
        <span class="relevance">{(item.relevanceScore * 100).toFixed(0)}%</span>
      </div>
    {/each}
  </div>
</div>
*/

/**
 * Example 4: Form Actions (For Server-Side Rendering)
 *
 * Alternative approach using SvelteKit form actions
 */

/*
// In +page.server.ts
import { intelligenceOrchestrator } from '$lib/core/intelligence';
import type { Actions } from './$types';

export const actions = {
  gatherIntelligence: async ({ request }) => {
    const data = await request.formData();
    const topics = data.get('topics')?.toString().split(',') || [];

    const items = await intelligenceOrchestrator.gather({
      topics,
      timeframe: 'week'
    });

    return {
      success: true,
      items
    };
  }
} satisfies Actions;

// In +page.svelte
<script lang="ts">
  import { enhance } from '$app/forms';

  let { form } = $props();
</script>

<form method="POST" action="?/gatherIntelligence" use:enhance>
  <input name="topics" placeholder="Enter topics (comma separated)" />
  <button type="submit">Gather Intelligence</button>
</form>

{#if form?.success}
  <div class="results">
    {#each form.items as item}
      <div>{item.title}</div>
    {/each}
  </div>
{/if}
*/

/**
 * Example 5: Real-Time Updates with WebSocket
 *
 * For bidirectional communication and real-time updates
 */

/*
// Server: src/routes/api/intelligence/ws/+server.ts
import { intelligenceOrchestrator } from '$lib/core/intelligence';

export async function GET({ url }) {
  const topics = url.searchParams.get('topics')?.split(',') || [];

  // Upgrade to WebSocket
  const { socket, response } = Deno.upgradeWebSocket(request);

  socket.onopen = async () => {
    for await (const event of intelligenceOrchestrator.streamWithEvents({ topics })) {
      socket.send(JSON.stringify(event));
    }
    socket.close();
  };

  return response;
}

// Client
const ws = new WebSocket('ws://localhost:5173/api/intelligence/ws?topics=climate,energy');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
*/

/**
 * Example 6: Background Job Pattern
 *
 * For long-running intelligence gathering
 */

/*
// Queue a background job
import { intelligenceOrchestrator } from '$lib/core/intelligence';

async function scheduleIntelligenceGathering(organizationId: string, query: IntelligenceQuery) {
  // Gather intelligence in background
  const items = await intelligenceOrchestrator.gather(query);

  // Store results in database for later retrieval
  await db.intelligenceResults.create({
    organizationId,
    query,
    items,
    createdAt: new Date()
  });

  // Notify user (email, webhook, etc.)
  await sendNotification(organizationId, `Found ${items.length} intelligence items`);
}
*/

/**
 * Example 7: Caching Strategy
 *
 * How the orchestrator uses MongoDB for caching
 */

/*
// The orchestrator automatically caches via IntelligenceService:

// 1. Check cache
const cached = await IntelligenceService.getRelevantIntelligence({
  topics: query.topics,
  categories: ['news'],
  minRelevanceScore: 0.5
});

// 2. If hit, return cached items
if (cached.length > 0) {
  return cached;
}

// 3. If miss, fetch fresh data
const fresh = await fetchFromAPI();

// 4. Cache the results
await IntelligenceService.bulkStoreIntelligence(fresh);

// 5. Return fresh data
return fresh;

// Cache is automatically cleaned up via MongoDB TTL indexes
*/
