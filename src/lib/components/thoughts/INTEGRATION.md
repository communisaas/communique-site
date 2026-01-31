# ThoughtStream 2.0 Integration Guide

Complete integration example for Communique agent visualization.

## Full Integration Example

```svelte
<!-- src/routes/send/+page.svelte -->
<script lang="ts">
  import { ThoughtStream, KeyMoments, DetailDrawer } from '$lib/components/thoughts';
  import { ThoughtEmitter } from '$lib/core/thoughts/emitter';
  import type { ThoughtSegment, PhaseState, Citation, ActionTrace, KeyMoment } from '$lib/core/thoughts/types';

  // ============================================================================
  // State Management
  // ============================================================================

  // Thought stream state
  let segments = $state<ThoughtSegment[]>([]);
  let phases = $state<PhaseState[]>([]);
  let keyMoments = $state<KeyMoment[]>([]);
  let streaming = $state(false);

  // Detail drawer state
  let drawerOpen = $state(false);
  let drawerContent = $state<Citation | ActionTrace | null>(null);

  // Initialize ThoughtEmitter
  const emitter = new ThoughtEmitter((segment) => {
    segments = [...segments, segment];
  });

  // ============================================================================
  // Event Handlers
  // ============================================================================

  function handleCitationClick(citation: Citation) {
    drawerContent = citation;
    drawerOpen = true;
  }

  function handleActionExpand(action: ActionTrace) {
    drawerContent = action;
    drawerOpen = true;
  }

  function handleMomentClick(moment: KeyMoment) {
    // Option 1: Scroll to segment in stream
    const element = document.querySelector(`[data-segment-id="${moment.segmentId}"]`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Option 2: Open in detail drawer if it's a citation
    if (moment.type === 'citation' && moment.metadata?.citation) {
      drawerContent = moment.metadata.citation as Citation;
      drawerOpen = true;
    }
  }

  function closeDrawer() {
    drawerOpen = false;
    // Keep content for smooth exit animation
    setTimeout(() => {
      drawerContent = null;
    }, 300);
  }

  // ============================================================================
  // Agent Execution
  // ============================================================================

  async function runAgent(userMessage: string, targetType: string) {
    streaming = true;
    segments = [];
    phases = [];

    try {
      // PHASE 1: Understanding
      emitter.startPhase('understanding');
      emitter.think('Analyzing user message and intent...');

      await simulateDelay(300);
      emitter.insight(`User wants to advocate for climate policy to ${targetType} decision-makers.`);
      emitter.completePhase();

      // PHASE 2: Research
      emitter.startPhase('research');
      emitter.think(`Searching for ${targetType} targets related to climate policy...`);

      await simulateDelay(500);

      // Start research action
      const research = emitter.startResearch('Apple Inc.', 'corporate');

      await simulateDelay(800);
      research.addPage?.('https://apple.com/sustainability', 'Apple Sustainability', true);
      research.addFinding('Lisa Jackson leads Environmental Policy');
      research.addFinding('Committed to carbon neutrality by 2030');
      research.addFinding('Scope 3 emissions increased 12% in 2025');

      await simulateDelay(400);
      research.complete('Found sustainability leadership and emissions data');

      // Create citation
      const citation = emitter.cite("Apple's 2025 Environmental Report", {
        url: 'https://apple.com/environmental-report-2025',
        excerpt: 'We are committed to achieving carbon neutrality across our entire supply chain by 2030. Lisa Jackson, VP Environmental Policy, leads these efforts.',
        mongoId: '507f1f77bcf86cd799439011'
      });

      await simulateDelay(300);
      emitter.insight('Lisa Jackson (VP Environmental Policy) reports directly to CEO Tim Cook.', {
        citations: [citation]
      });

      emitter.completePhase();

      // PHASE 3: Context Retrieval
      emitter.startPhase('context');
      emitter.think('Retrieving relevant intelligence from knowledge base...');

      await simulateDelay(400);

      const retrieval = emitter.startRetrieval('climate policy corporate sustainability Apple');
      await simulateDelay(600);
      retrieval.addFinding('Found 15 relevant intelligence items');
      retrieval.complete('Retrieved context on climate policy and corporate sustainability');

      emitter.completePhase();

      // PHASE 4: Drafting
      emitter.startPhase('drafting');
      emitter.think('Crafting message based on research and user intent...');

      await simulateDelay(1000);

      emitter.recommend(
        'I recommend addressing Lisa Jackson directly, focusing on Scope 3 emissions which increased despite neutrality goals.',
        { pin: true }
      );

      emitter.completePhase();

      // Update phases and key moments
      phases = emitter.getPhases();
      keyMoments = emitter.getKeyMoments();

    } catch (error) {
      console.error('Agent execution failed:', error);
      emitter.think(`Error: ${error.message}`, { emphasis: 'muted' });
    } finally {
      streaming = false;
    }
  }

  function simulateDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================================================
  // Auto-start for demo
  // ============================================================================

  import { onMount } from 'svelte';

  onMount(() => {
    // Auto-run agent for demo
    runAgent('I want to advocate for stronger climate action', 'corporate');
  });
</script>

<!-- ============================================================================
     Layout
     ============================================================================ -->

<div class="agent-workspace flex h-screen flex-col">
  <!-- Header -->
  <header class="border-b border-surface-border bg-surface-base px-6 py-4">
    <h1 class="text-2xl font-bold text-text-primary">Agent Thought Stream Demo</h1>
    <p class="mt-1 text-sm text-text-secondary">
      Real-time visualization of agent reasoning with progressive disclosure
    </p>
  </header>

  <!-- Main content -->
  <main class="flex flex-1 overflow-hidden">
    <!-- Thought stream (takes full width when drawer closed, shrinks when open) -->
    <div
      class="flex-1 overflow-hidden transition-all duration-300"
      class:mr-[480px]={drawerOpen}
    >
      <ThoughtStream
        {segments}
        {phases}
        {streaming}
        oncitationclick={handleCitationClick}
        onactionexpand={handleActionExpand}
      />
    </div>

    <!-- Detail drawer (slides in from right) -->
    <DetailDrawer
      bind:open={drawerOpen}
      content={drawerContent}
      onclose={closeDrawer}
    />
  </main>

  <!-- Key moments footer (sticky at bottom) -->
  <KeyMoments
    moments={keyMoments}
    onmomentclick={handleMomentClick}
  />
</div>

<style>
  /* Ensure full viewport height */
  .agent-workspace {
    height: 100vh;
    max-height: 100vh;
  }
</style>
```

## Minimal Integration

For basic usage without drawer:

```svelte
<script lang="ts">
  import { ThoughtStream } from '$lib/components/thoughts';
  import { ThoughtEmitter } from '$lib/core/thoughts/emitter';

  let segments = $state([]);
  let phases = $state([]);

  const emitter = new ThoughtEmitter((segment) => {
    segments = [...segments, segment];
  });

  async function runAgent() {
    emitter.startPhase('research');
    emitter.think('Analyzing targets...');

    const research = emitter.startResearch('Apple Inc.', 'corporate');
    research.addFinding('Found Lisa Jackson as VP Environmental Policy');
    research.complete('Research complete');

    emitter.completePhase();
    phases = emitter.getPhases();
  }
</script>

<ThoughtStream {segments} {phases} streaming={true} />
```

## Server-Side Integration

For real Gemini agent streaming:

```typescript
// src/lib/agents/decision-maker-agent.ts
import { ThoughtEmitter } from '$lib/core/thoughts/emitter';
import type { ThoughtSegment } from '$lib/core/thoughts/types';

export async function executeDecisionMakerAgent(
  userMessage: string,
  targetType: string,
  onThought: (segment: ThoughtSegment) => void
): Promise<AgentResult> {

  const emitter = new ThoughtEmitter(onThought);

  // Phase 1: Understanding
  emitter.startPhase('understanding');
  emitter.think('Analyzing user message and extracting intent...');

  const intent = await analyzeIntent(userMessage);
  emitter.insight(`Detected intent: ${intent.summary}`);
  emitter.completePhase();

  // Phase 2: Research
  emitter.startPhase('research');

  const research = emitter.startResearch(intent.targetEntity, targetType);

  const firecrawlResults = await firecrawl.search(intent.targetEntity);

  for (const page of firecrawlResults.pages) {
    research.addPage?.(page.url, page.title, page.relevant);
  }

  for (const finding of firecrawlResults.findings) {
    research.addFinding(finding);
  }

  research.complete(`Found ${firecrawlResults.findings.length} key insights`);

  emitter.completePhase();

  // Phase 3: Context
  emitter.startPhase('context');

  const retrieval = emitter.startRetrieval(intent.query);
  const intelligenceItems = await vectorSearch(intent.query);

  retrieval.addFinding(`Retrieved ${intelligenceItems.length} relevant items`);
  retrieval.complete('Context retrieval complete');

  emitter.completePhase();

  // Phase 4: Drafting
  emitter.startPhase('drafting');
  emitter.think('Generating message based on research and context...');

  const draft = await generateMessage(intent, firecrawlResults, intelligenceItems);

  emitter.recommend(`Message drafted for ${draft.target.name}`);
  emitter.completePhase();

  return {
    draft,
    phases: emitter.getPhases(),
    keyMoments: emitter.getKeyMoments()
  };
}
```

## SvelteKit Server Endpoint

```typescript
// src/routes/api/agent/+server.ts
import { json } from '@sveltejs/kit';
import { executeDecisionMakerAgent } from '$lib/agents/decision-maker-agent';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  const { message, targetType } = await request.json();

  const segments: ThoughtSegment[] = [];

  const result = await executeDecisionMakerAgent(
    message,
    targetType,
    (segment) => {
      segments.push(segment);
      // For SSE streaming, emit segment here
    }
  );

  return json({
    segments,
    phases: result.phases,
    keyMoments: result.keyMoments,
    draft: result.draft
  });
};
```

## Real-Time Streaming (SSE)

For live streaming updates to the UI:

```typescript
// Server: src/routes/api/agent/stream/+server.ts
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const message = url.searchParams.get('message');
  const targetType = url.searchParams.get('targetType');

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      await executeDecisionMakerAgent(
        message,
        targetType,
        (segment) => {
          // Send segment as SSE event
          const data = JSON.stringify({ type: 'segment', segment });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        }
      );

      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
};
```

```svelte
<!-- Client: Consume SSE stream -->
<script lang="ts">
  import { ThoughtStream } from '$lib/components/thoughts';
  import type { ThoughtSegment } from '$lib/core/thoughts/types';

  let segments = $state<ThoughtSegment[]>([]);
  let streaming = $state(false);

  async function streamAgent(message: string, targetType: string) {
    streaming = true;
    segments = [];

    const eventSource = new EventSource(
      `/api/agent/stream?message=${encodeURIComponent(message)}&targetType=${targetType}`
    );

    eventSource.addEventListener('message', (event) => {
      const { type, segment } = JSON.parse(event.data);

      if (type === 'segment') {
        segments = [...segments, segment];
      }
    });

    eventSource.addEventListener('error', () => {
      eventSource.close();
      streaming = false;
    });

    eventSource.addEventListener('close', () => {
      eventSource.close();
      streaming = false;
    });
  }
</script>

<ThoughtStream {segments} phases={[]} {streaming} />
```

## Performance Optimization

For long thought streams (>100 segments), consider virtual scrolling:

```svelte
<script lang="ts">
  import { ThoughtStream } from '$lib/components/thoughts';

  // Only render last 50 segments + currently visible phases
  const visibleSegments = $derived(
    segments.slice(-50)
  );
</script>

<ThoughtStream segments={visibleSegments} {phases} {streaming} />
```

## Testing

```typescript
// tests/thoughts/ThoughtStream.test.ts
import { render, screen } from '@testing-library/svelte';
import { ThoughtStream } from '$lib/components/thoughts';
import type { ThoughtSegment, PhaseState } from '$lib/core/thoughts/types';

describe('ThoughtStream', () => {
  it('renders segments grouped by phase', () => {
    const segments: ThoughtSegment[] = [
      {
        id: '1',
        timestamp: Date.now(),
        type: 'reasoning',
        phase: 'research',
        content: 'Analyzing targets...',
        expandable: false
      }
    ];

    const phases: PhaseState[] = [
      {
        name: 'research',
        status: 'active',
        startTime: Date.now()
      }
    ];

    render(ThoughtStream, { segments, phases });

    expect(screen.getByText('Research')).toBeInTheDocument();
    expect(screen.getByText('Analyzing targets...')).toBeInTheDocument();
  });

  it('emits citation click events', async () => {
    const handleCitationClick = vi.fn();

    const segments: ThoughtSegment[] = [
      {
        id: '1',
        timestamp: Date.now(),
        type: 'reasoning',
        phase: 'research',
        content: 'Apple committed to neutrality',
        expandable: true,
        citations: [{
          id: 'cite-1',
          label: 'Apple Report',
          url: 'https://apple.com',
          excerpt: 'We commit...',
          sourceType: 'web'
        }]
      }
    ];

    const { component } = render(ThoughtStream, {
      segments,
      phases: [],
      oncitationclick: handleCitationClick
    });

    const citationButton = screen.getByText('Apple Report');
    await citationButton.click();

    expect(handleCitationClick).toHaveBeenCalled();
  });
});
```

## Styling Customization

Override CSS variables for theming:

```css
/* Custom theme for thought stream */
.agent-workspace {
  --coord-route-solid: #00a896; /* Custom teal */
  --coord-share-solid: #6366f1; /* Keep indigo */
  --surface-base: oklch(0.99 0.003 60); /* Warmer background */
}
```

## Next Steps

1. **Integrate with Gemini agent** - Replace simulated delays with real API calls
2. **Add persistence** - Save thought streams to MongoDB for history
3. **Enable replay** - Allow users to replay agent reasoning at different speeds
4. **Export functionality** - Download thought stream as markdown or JSON
5. **Search/filter** - Find specific thoughts, citations, or phases
6. **Annotations** - Let users add comments to thoughts
7. **Sharing** - Share specific insights or complete streams
