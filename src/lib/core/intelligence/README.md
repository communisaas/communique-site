# Intelligence Orchestration System

**Status:** ✅ Core Implementation Complete (MVP)
**Version:** 1.0.0
**Author:** Distinguished Systems Engineer

## Overview

The Intelligence Orchestrator surfaces contextual information (news, legislative activity, corporate announcements) during template creation to help users craft timely, informed messages.

### Key Features

- **True Async Streaming**: Uses `AsyncGenerator` for items to flow as they arrive
- **Parallel Execution**: Multiple providers run concurrently, merged with `Promise.race`
- **PostgreSQL Caching**: Automatic caching via `IntelligenceService` (pgvector)
- **Deduplication**: URL-based dedup across providers
- **Graceful Degradation**: Failed providers don't crash the stream
- **Extensible**: Easy to add new providers via `IntelligenceProvider` interface

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  IntelligenceOrchestrator                    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐│
│  │NewsProvider │ │LegisProvider│ │ CorporateProvider       ││
│  └──────┬──────┘ └──────┬──────┘ └────────────┬────────────┘│
│         │               │                      │             │
│         └───────────────┼──────────────────────┘             │
│                         ▼                                     │
│              AsyncMergedStream<IntelligenceItem>             │
│                         │                                     │
│                         ▼                                     │
│           PostgreSQL + pgvector (via IntelligenceService)    │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Basic Usage

```typescript
import { intelligenceOrchestrator } from '$lib/core/intelligence';

// Stream intelligence as it arrives
for await (const item of intelligenceOrchestrator.stream({
  topics: ['climate change', 'renewable energy'],
  targetType: 'congress',
  timeframe: 'week'
})) {
  console.log(item.title, item.category, item.relevanceScore);
}
```

### With Progress Events

```typescript
for await (const event of intelligenceOrchestrator.streamWithEvents({
  topics: ['labor practices'],
  targetType: 'corporate',
  targetEntity: 'Amazon'
})) {
  if (event.type === 'item') {
    console.log('New item:', event.item.title);
  } else if (event.type === 'complete') {
    console.log(`${event.category} done: ${event.totalItems} items`);
  }
}
```

### Gather All at Once

```typescript
const items = await intelligenceOrchestrator.gather({
  topics: ['healthcare'],
  location: { state: 'CA' }
}, {
  maxItemsPerProvider: 5,
  minRelevanceScore: 0.7
});
```

## Core Types

### IntelligenceQuery

Input context describing what intelligence to gather:

```typescript
interface IntelligenceQuery {
  topics: string[];                    // Required: Topics to research
  targetType?: DecisionMakerTargetType; // Optional: Type of target
  targetEntity?: string;                // Optional: Specific org/entity
  location?: GeographicScope;           // Optional: Geographic filter
  timeframe?: 'day' | 'week' | 'month'; // Optional: Time window
}
```

### IntelligenceItem

Single intelligence item (news, bill, announcement):

```typescript
interface IntelligenceItem {
  id: string;                          // Unique identifier
  category: IntelligenceCategory;      // news | legislative | corporate | etc
  title: string;                       // Headline
  summary: string;                     // Brief description
  sourceUrl: string;                   // Full content link
  sourceName: string;                  // Publication/source
  publishedAt: Date;                   // Publication date
  relevanceScore: number;              // 0-1 match to query
  topics: string[];                    // Associated topics
  entities: Array<{                    // Named entities
    name: string;
    type: 'person' | 'organization' | 'location' | 'legislation' | 'other';
  }>;
  sentiment?: 'positive' | 'negative' | 'neutral' | 'mixed';
  isActionable?: boolean;              // Can be cited in message
}
```

### OrchestrationOptions

Configuration for orchestration behavior:

```typescript
interface OrchestrationOptions {
  maxItemsPerProvider?: number;        // Default: 10
  minRelevanceScore?: number;          // Default: 0.5 (0-1 scale)
  useCache?: boolean;                  // Default: true
  maxCacheAgeHours?: number;           // Default: 24
  categories?: IntelligenceCategory[]; // Filter to specific categories
  providerTimeoutMs?: number;          // Default: 30000
}
```

## Provider System

### Built-in Providers

#### NewsProvider
- **Category**: `news`
- **Cache Duration**: 4 hours
- **Status**: MVP placeholder (integrate NewsAPI/Perplexity later)

#### LegislativeProvider
- **Category**: `legislative`
- **Cache Duration**: 24 hours
- **Relevance**: Government targets only
- **Status**: MVP placeholder (integrate Congress.gov API later)

#### CorporateProvider
- **Category**: `corporate`
- **Cache Duration**: 12 hours
- **Relevance**: Corporate targets only
- **Status**: MVP placeholder (integrate SEC EDGAR later)

### Creating Custom Providers

Extend `BaseIntelligenceProvider` for automatic caching:

```typescript
import { BaseIntelligenceProvider } from '$lib/core/intelligence';

class RegulatoryProvider extends BaseIntelligenceProvider {
  readonly name = 'regulatory';
  readonly categories = ['regulatory'] as const;

  protected get cacheHours(): number {
    return 48; // Longer cache for stable regulatory data
  }

  async *fetch(query: IntelligenceQuery): AsyncGenerator<IntelligenceItem> {
    // Check cache
    const cached = await this.checkCache(query, 'regulatory', this.cacheHours);
    if (cached.length > 0) {
      yield* cached;
      return;
    }

    // Fetch fresh data
    const items = await this.fetchRegulations(query);

    // Cache in bulk
    await this.bulkCacheItems(items, 30);

    // Yield items
    yield* items;
  }

  private async fetchRegulations(query: IntelligenceQuery): Promise<IntelligenceItem[]> {
    // Your implementation here
  }
}

// Register with orchestrator
intelligenceOrchestrator.registerProvider(new RegulatoryProvider());
```

## Async Streaming Pattern

The orchestrator uses a sophisticated async merging pattern to stream items from multiple providers in parallel:

```typescript
private async *mergeStreams(
  generators: AsyncGenerator<IntelligenceItem>[]
): AsyncGenerator<IntelligenceItem> {
  const pending = new Map<number, Promise<PendingResult>>();

  // Initialize: get first promise from each generator
  for (let i = 0; i < generators.length; i++) {
    pending.set(i, generators[i].next().then(value => ({ value, index: i })));
  }

  // Race all pending promises until all generators are done
  while (pending.size > 0) {
    const { value, index } = await Promise.race(pending.values());

    if (value.done) {
      pending.delete(index);
    } else {
      yield value.value;
      // Queue next value from this generator
      pending.set(index, generators[index].next().then(v => ({ value: v, index })));
    }
  }
}
```

**Key Points:**
- Items are yielded **immediately** as any provider produces them
- Maintains **true parallelism** - no provider blocks others
- Uses `Promise.race` to find the fastest next item
- Continues until **all providers complete**

## PostgreSQL Caching

All providers automatically cache items via `IntelligenceService` (pgvector):

### Cache Flow
1. Provider checks cache via `checkCache(query, category, maxAgeHours)`
2. If hit: yield cached items and return
3. If miss: fetch fresh data
4. Cache via `cacheItem()` or `bulkCacheItems()`
5. Yield fresh items

### Cache Keys
- Items stored in `intelligence` table (PostgreSQL)
- Indexed by: `category`, `topics`, `publishedAt`, `relevanceScore`
- TTL: Configurable per provider (default: 7 days)

### Deduplication
- By `sourceUrl` - same URL won't be yielded twice
- Across providers - first to find an item wins
- Within stream - `Set<string>` tracks seen URLs

## Performance Characteristics

### Latency
- **Cache hit**: ~10-50ms (PostgreSQL query)
- **Cache miss**: Depends on provider (500-3000ms typical)
- **Parallel speedup**: 3 providers in parallel ≈ 1x slowest provider, not 3x sum

### Memory
- **Streaming**: Constant memory (one item in flight per provider)
- **gather()**: O(n) where n = total items returned

### Cache Hit Rates (Expected)
- News: 30-40% (frequent updates)
- Legislative: 60-70% (slower changes)
- Corporate: 50-60% (medium volatility)

## Error Handling

### Provider Failures
Failed providers **don't crash the stream**:

```typescript
try {
  for await (const item of provider.fetch(query)) {
    yield item;
  }
} catch (error) {
  console.error(`[${provider.name}] Error:`, error);
  // Continue with other providers
}
```

### Timeouts
Each provider has a timeout (default 30s):

```typescript
if (Date.now() - startTime > timeoutMs) {
  console.warn(`[${provider.name}] Timeout reached`);
  break;
}
```

### Cache Failures
Cache operations never throw - they log and continue:

```typescript
try {
  await this.cacheItem(item);
} catch (error) {
  console.error('Failed to cache item:', error);
  // Item still yielded to stream
}
```

## Testing

### Unit Test Example

```typescript
import { IntelligenceOrchestrator } from '$lib/core/intelligence';

test('streams items from multiple providers', async () => {
  const orchestrator = new IntelligenceOrchestrator();
  const items = [];

  for await (const item of orchestrator.stream({
    topics: ['healthcare'],
    timeframe: 'week'
  })) {
    items.push(item);
  }

  expect(items.length).toBeGreaterThan(0);
  expect(items.every(item => item.relevanceScore >= 0.5)).toBe(true);
});
```

### Mock Provider

```typescript
class MockProvider extends BaseIntelligenceProvider {
  readonly name = 'mock';
  readonly categories = ['news'] as const;

  async *fetch(query: IntelligenceQuery): AsyncGenerator<IntelligenceItem> {
    yield {
      id: 'test-1',
      category: 'news',
      title: 'Test Article',
      summary: 'Test summary',
      sourceUrl: 'https://example.com/test',
      sourceName: 'Test Source',
      publishedAt: new Date(),
      relevanceScore: 0.9,
      topics: query.topics,
      entities: []
    };
  }
}
```

## Integration with Template Creation

The intelligence system is designed to integrate with the template creator:

```typescript
// In template creator component
import { intelligenceOrchestrator } from '$lib/core/intelligence';

let intelligenceItems = $state<IntelligenceItem[]>([]);
let isGatheringIntel = $state(false);

async function gatherIntelligence() {
  isGatheringIntel = true;
  intelligenceItems = [];

  try {
    for await (const item of intelligenceOrchestrator.stream({
      topics: extractedTopics,
      targetType: selectedTargetType,
      targetEntity: selectedEntity,
      timeframe: 'week'
    })) {
      intelligenceItems = [...intelligenceItems, item];
    }
  } finally {
    isGatheringIntel = false;
  }
}
```

## Future Enhancements

### Phase 2: Real API Integrations
- [ ] NewsAPI for broad news coverage
- [ ] Perplexity API for AI-curated news
- [ ] Congress.gov API for federal legislation
- [ ] SEC EDGAR API for corporate filings

### Phase 3: Semantic Search
- [ ] Vector embeddings for intelligence items
- [ ] Semantic similarity matching
- [ ] Voyage AI reranking for relevance

### Phase 4: Advanced Features
- [ ] Trend detection (rising/falling topics)
- [ ] Entity extraction and linking
- [ ] Sentiment analysis
- [ ] Geographic filtering
- [ ] Custom RSS feed ingestion

## Files

```
src/lib/core/intelligence/
├── README.md                          (this file)
├── index.ts                           (exports)
├── types.ts                           (type definitions)
├── orchestrator.ts                    (main orchestrator)
└── providers/
    ├── base.ts                        (abstract base provider)
    ├── news-provider.ts              (news intelligence)
    ├── legislative-provider.ts       (bills and votes)
    └── corporate-provider.ts         (corporate announcements)
```

## References

- [Provider Architecture](/src/lib/core/agents/providers/ARCHITECTURE.md)

---

**Built with async streaming expertise by the Distinguished Engineering Team**
