# ThoughtStream Decision-Maker Integration Guide

This guide explains how to use the new ThoughtStream-integrated decision-maker agent (v2) and how it differs from the legacy version (v1).

## Quick Start

### ThoughtStream Integration

```typescript
import { resolveDecisionMakers } from '$lib/core/agents/agents';
import type { ThoughtSegment } from '$lib/core/thoughts/types';

// Collect thought segments
const segments: ThoughtSegment[] = [];

const result = await resolveDecisionMakers(
  {
    targetType: 'corporate',
    targetEntity: 'Apple Inc.',
    subjectLine: 'Climate leadership and sustainability',
    coreMessage: 'We need urgent action on scope 3 emissions...',
    topics: ['climate', 'sustainability', 'emissions'],
    geographicScope: { country: 'US' }
  },
  (segment) => {
    segments.push(segment);
    console.log(`[${segment.type}] ${segment.content}`);
  }
);

console.log(`Found ${result.decisionMakers.length} decision-makers`);
```

## SSE Endpoint Usage

```typescript
// Client-side
const eventSource = new EventSource('/api/agents/stream-decision-makers');

eventSource.addEventListener('segment', (event) => {
  const segment = JSON.parse(event.data);

  if (segment.type === 'insight') {
    console.log('Key insight:', segment.content);

    // Access citations
    segment.citations?.forEach(citation => {
      console.log('Source:', citation.label, citation.url);
    });
  }

  if (segment.type === 'action') {
    console.log('Research action:', segment.action?.target);
  }
});

eventSource.addEventListener('complete', (event) => {
  const result = JSON.parse(event.data);
  console.log(`Found ${result.decision_makers.length} decision-makers`);
});
```

## Key Features

### ThoughtStream Segments

The agent emits structured `ThoughtSegment` objects with rich metadata:

```typescript
interface ThoughtSegment {
  id: string;
  timestamp: number;
  type: 'reasoning' | 'action' | 'citation' | 'insight' | 'recommendation';
  phase: string;
  content: string;
  expandable: boolean;
  expansion?: ThoughtExpansion;
  citations?: Citation[];
  action?: ActionTrace;
  emphasis?: 'normal' | 'highlight' | 'muted';
  pinToKeyMoments?: boolean;
}
```

### Segment Types

1. **reasoning** - Standard agent thoughts
   ```typescript
   {
     type: 'reasoning',
     content: 'Analyzing corporate leadership structure...',
     phase: 'understanding'
   }
   ```

2. **insight** - Key discoveries (automatically highlighted)
   ```typescript
   {
     type: 'insight',
     content: 'Lisa Jackson leads Environmental Policy at Apple',
     citations: [{ label: "Apple's Leadership Page", url: '...' }],
     emphasis: 'highlight',
     pinToKeyMoments: true
   }
   ```

3. **action** - Research/retrieval operations
   ```typescript
   {
     type: 'action',
     content: 'Researching Apple Inc....',
     action: {
       type: 'research',
       target: 'Apple Inc.',
       status: 'pending',
       pagesVisited: [],
       findings: []
     }
   }
   ```

4. **recommendation** - Suggested decision-makers
   ```typescript
   {
     type: 'recommendation',
     content: 'Tim Cook — CEO at Apple Inc.',
     emphasis: 'highlight',
     pinToKeyMoments: true
   }
   ```

### AgentMemoryService Integration

The agent automatically retrieves contextual intelligence before reasoning:

```typescript
// Happens automatically in resolveDecisionMakers
const memory = await AgentMemoryService.retrieveContext({
  topic: context.coreMessage,
  targetType: context.targetType,
  targetEntity: context.targetEntity,
  limit: 3,
  minRelevanceScore: 0.7
});

// Intelligence items are emitted as insights with citations
if (memory.intelligence.news.length > 0) {
  const item = memory.intelligence.news[0];
  emitter.insight(
    `Recent news: ${item.title}`,
    {
      citations: [{
        label: item.title,
        url: item.sourceUrl,
        excerpt: item.snippet,
        sourceType: 'intelligence'
      }]
    }
  );
}
```

### Reasoning Phases

The agent follows a structured two-phase flow:

1. **Role Discovery** - Identify decision-maker roles and titles via Gemini with Google Search grounding
2. **Person Lookup** - Find specific individuals in those roles via Gemini with Google Search grounding

Additional phases may include:
- **understanding** - Comprehend user intent
- **context** - Retrieve relevant intelligence from memory
- **recommendation** - Present findings with citations

UI components can group segments by phase for collapsible sections.

## Architecture Overview

### Single Provider System

The decision-maker agent uses a single-provider architecture:

- **Provider**: `GeminiDecisionMakerProvider` (registered at priority 100)
- **Router**: Selects provider via `canResolve()` — accepts any target type string
- **Resolution**: Two-phase process (Role Discovery → Person Lookup)
- **Grounding**: All phases use Gemini with Google Search grounding
- **Thought Streaming**: Direct `ThoughtEmitter` usage (no composite layer)


## UI Integration Examples

### Basic Thought Display

```svelte
<script lang="ts">
  import type { ThoughtSegment } from '$lib/core/thoughts/types';

  let segments: ThoughtSegment[] = [];

  async function resolve() {
    const result = await resolveDecisionMakers(context, (segment) => {
      segments = [...segments, segment];
    });
  }
</script>

{#each segments as segment}
  <div class="thought {segment.type}">
    <p>{segment.content}</p>

    {#if segment.citations}
      <div class="citations">
        {#each segment.citations as citation}
          <a href={citation.url}>{citation.label}</a>
        {/each}
      </div>
    {/if}
  </div>
{/each}
```

### Phase Grouping

```svelte
<script lang="ts">
  import { groupBy } from 'lodash-es';

  $: phaseGroups = Object.entries(
    groupBy(segments, 'phase')
  );
</script>

{#each phaseGroups as [phase, phaseSegments]}
  <details open={phase === currentPhase}>
    <summary>{phase}</summary>
    {#each phaseSegments as segment}
      <ThoughtSegment {segment} />
    {/each}
  </details>
{/each}
```

### Key Moments Footer

```svelte
<script lang="ts">
  $: keyMoments = segments.filter(s => s.pinToKeyMoments);
</script>

<footer class="key-moments">
  {#each keyMoments as moment}
    <button on:click={() => scrollTo(moment.id)}>
      {moment.content.slice(0, 50)}...
    </button>
  {/each}
</footer>
```

## Best Practices

1. **Group by phase** - Natural visual organization
2. **Pin key moments** - Important items shouldn't scroll away
3. **Expand on demand** - Progressive disclosure reduces cognitive load
4. **Show citations inline** - Build trust through transparency

## Performance Notes

- **Memory retrieval**: ~200-500ms (cached intelligence items)
- **Provider resolution**: ~2-5s (Gemini calls with grounding)
- **Total latency**: ~3-6s for full resolution
- **Segment emission**: Real-time (no buffering)

## Error Handling

```typescript
try {
  const result = await resolveDecisionMakers(context, (segment) => {
    if (segment.type === 'reasoning' && segment.content.startsWith('Error:')) {
      console.error('Agent error:', segment.content);
    }
    segments.push(segment);
  });
} catch (error) {
  console.error('Resolution failed:', error);
}
```

## TypeScript Support

All types are fully exported:

```typescript
import type {
  ThoughtSegment,
  ThoughtSegmentType,
  ThoughtEmphasis,
  Citation,
  ActionTrace,
  KeyMoment
} from '$lib/core/thoughts/types';

import type {
  ResolveContext,
  DecisionMakerResult,
  DecisionMakerTargetType
} from '$lib/core/agents/providers/types';
```

## Debugging

Enable detailed logging:

```typescript
// Set environment variable
DEBUG=decision-maker,agent-memory,thought-emitter

// Or in code
import { resolveDecisionMakers } from '$lib/core/agents/agents';

const result = await resolveDecisionMakers(context, (segment) => {
  console.log('[DEBUG]', {
    type: segment.type,
    phase: segment.phase,
    content: segment.content,
    citations: segment.citations?.length,
    action: segment.action?.type
  });
});
```
