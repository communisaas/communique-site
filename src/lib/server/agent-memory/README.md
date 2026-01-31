# Agent Memory Service

The Agent Memory Service provides contextual intelligence retrieval for agent reasoning in Communique. It retrieves relevant information from MongoDB (news, legislative activity, corporate announcements, organization profiles) and synthesizes it into a prompt-ready context string.

## Overview

Agents should call this service **before** processing a user's request to gather current information about the topic and target. This provides the agent with:

- **Recent news and developments** - What's happening now
- **Legislative activity** - Bills, regulations, and policy changes
- **Corporate announcements** - Company statements and actions
- **Organizational context** - Leadership, policy positions, contact info

## Quick Start

```typescript
import { AgentMemoryService } from '$lib/server/agent-memory';

// Basic usage
const context = await AgentMemoryService.retrieveContext({
  topic: 'climate change legislation',
  targetType: 'congress',
  location: { state: 'CA' }
});

// Use in agent prompt
const prompt = `
You are helping a citizen contact their representatives about climate policy.

${context.synthesizedContext}

User's message: ${userMessage}

Draft a compelling message to their representatives.
`;
```

## API Reference

### `retrieveContext(params)`

Main entry point for retrieving contextual intelligence.

**Parameters:**

```typescript
interface RetrieveContextParams {
  // User's core message/intent - used for semantic search
  topic: string;

  // Type of target being contacted
  targetType?: 'congress' | 'state_legislature' | 'local_government' |
                'corporate' | 'nonprofit' | 'education' | 'healthcare' |
                'labor' | 'media';

  // Specific organization name if known
  targetEntity?: string;

  // Geographic context for filtering local/state content
  location?: {
    state?: string;
    city?: string;
    country?: string;
  };

  // Maximum items per category (default: 5)
  limit?: number;

  // Minimum relevance score for intelligence items (default: 0.6)
  minRelevanceScore?: number;

  // Use semantic search vs keyword search (default: true)
  useSemanticSearch?: boolean;

  // Days to look back for intelligence (default: 30)
  lookbackDays?: number;
}
```

**Returns:**

```typescript
interface AgentContext {
  // Intelligence items grouped by category
  intelligence: {
    news: IntelligenceItem[];
    legislative: IntelligenceItem[];
    corporate: IntelligenceItem[];
    regulatory: IntelligenceItem[];
    social: IntelligenceItem[];
  };

  // Target organization profile if applicable
  organization?: OrganizationContext;

  // Synthesized context ready for prompt injection
  synthesizedContext: string;

  // Metadata about the retrieval
  metadata: {
    totalItems: number;
    method: 'semantic' | 'keyword';
    latencyMs: number;
    hasOrganization: boolean;
  };
}
```

### `getOrganization(name)`

Quick lookup of a specific organization's cached profile.

```typescript
const org = await AgentMemoryService.getOrganization('ExxonMobil');

if (org) {
  console.log(`CEO: ${org.leadership[0]?.name}`);
  console.log(`Contact: ${org.contacts?.general}`);
}
```

### `searchIntelligence(query, options)`

Search intelligence items semantically.

```typescript
const items = await AgentMemoryService.searchIntelligence(
  'renewable energy policy',
  {
    categories: ['legislative', 'news'],
    limit: 10,
    minScore: 0.7,
    dateRange: {
      start: new Date('2025-01-01')
    }
  }
);
```

## Usage Examples

### Example 1: Congressional Contact

```typescript
const context = await AgentMemoryService.retrieveContext({
  topic: 'affordable housing legislation',
  targetType: 'congress',
  location: { state: 'CA' },
  limit: 5
});

// context.intelligence.legislative will contain recent bills
// context.synthesizedContext is ready to inject into prompt
```

### Example 2: Corporate Campaign

```typescript
const context = await AgentMemoryService.retrieveContext({
  topic: 'net neutrality policy',
  targetType: 'corporate',
  targetEntity: 'Comcast',
  limit: 5
});

// context.organization will have Comcast leadership and contacts
// context.intelligence.corporate will have recent company announcements
```

### Example 3: Local Government Issue

```typescript
const context = await AgentMemoryService.retrieveContext({
  topic: 'public transit funding',
  targetType: 'local_government',
  location: { city: 'San Francisco', state: 'CA' },
  limit: 3
});

// context.intelligence.news will have local news about transit
// Filtered to San Francisco area
```

### Example 4: Custom Intelligence Search

```typescript
// Direct search without full context retrieval
const recentBills = await AgentMemoryService.searchIntelligence(
  'environmental protection act',
  {
    categories: ['legislative'],
    limit: 10,
    minScore: 0.75,
    dateRange: {
      start: new Date('2025-01-01')
    }
  }
);

for (const bill of recentBills) {
  console.log(`${bill.title} (${bill.publishedAt})`);
  console.log(bill.snippet);
}
```

## Integration Patterns

### Pattern 1: Pre-Flight Context Retrieval

Retrieve context before agent processing:

```typescript
export async function generateMessageWithContext(params: {
  userMessage: string;
  targetType: DecisionMakerTargetType;
  targetEntity?: string;
  location?: GeographicScope;
}) {
  // 1. Retrieve context
  const context = await AgentMemoryService.retrieveContext({
    topic: params.userMessage,
    targetType: params.targetType,
    targetEntity: params.targetEntity,
    location: params.location
  });

  // 2. Build prompt with context
  const prompt = buildPrompt({
    userMessage: params.userMessage,
    context: context.synthesizedContext
  });

  // 3. Generate with agent
  const result = await gemini.generateContent(prompt);

  return {
    message: result.text,
    contextUsed: context.metadata
  };
}
```

### Pattern 2: Streaming with Progressive Context

Stream context as it arrives:

```typescript
async function* streamMessageGeneration(params: {
  topic: string;
  targetType: DecisionMakerTargetType;
}) {
  // Yield context gathering status
  yield { type: 'status', message: 'Gathering context...' };

  const context = await AgentMemoryService.retrieveContext({
    topic: params.topic,
    targetType: params.targetType,
    limit: 5
  });

  // Yield context summary
  yield {
    type: 'context',
    summary: `Found ${context.metadata.totalItems} relevant items`,
    hasOrg: context.metadata.hasOrganization
  };

  // Yield intelligence items
  for (const category in context.intelligence) {
    const items = context.intelligence[category];
    if (items.length > 0) {
      yield { type: 'intelligence', category, items };
    }
  }

  // Now generate message
  yield { type: 'status', message: 'Generating message...' };

  // ... rest of generation logic
}
```

### Pattern 3: Cached Context with TTL

Cache context retrieval for repeated requests:

```typescript
const contextCache = new Map<string, {
  context: AgentContext;
  timestamp: number;
}>();

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getCachedContext(params: RetrieveContextParams): Promise<AgentContext> {
  const cacheKey = JSON.stringify(params);
  const cached = contextCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.context;
  }

  const context = await AgentMemoryService.retrieveContext(params);

  contextCache.set(cacheKey, {
    context,
    timestamp: Date.now()
  });

  return context;
}
```

## Performance Considerations

### Semantic Search Performance

- **Vector search** is more accurate but requires embeddings
- Falls back to keyword search if vector search fails
- Typical latency: 100-300ms for semantic, 50-100ms for keyword
- Embeddings are cached in MongoDB (no re-computation)

### Optimization Tips

1. **Adjust limit**: Lower limits = faster responses
   ```typescript
   limit: 3  // Get only top 3 most relevant items
   ```

2. **Tune relevance threshold**: Higher scores = fewer but better results
   ```typescript
   minRelevanceScore: 0.75  // Only high-quality matches
   ```

3. **Narrow date range**: Recent items are often more relevant
   ```typescript
   lookbackDays: 7  // Last week only
   ```

4. **Disable semantic search** for simple queries
   ```typescript
   useSemanticSearch: false  // Use faster keyword search
   ```

## Error Handling

The service handles errors gracefully:

```typescript
try {
  const context = await AgentMemoryService.retrieveContext({
    topic: 'climate policy',
    targetType: 'congress'
  });

  // Use context
} catch (error) {
  console.error('Context retrieval failed:', error);

  // Fallback: proceed without context
  // or show error to user
}
```

**Built-in fallbacks:**
- Semantic search → Keyword search
- Organization not found → Continue without org context
- No intelligence found → Empty context with message

## Monitoring

Track context retrieval performance:

```typescript
const context = await AgentMemoryService.retrieveContext(params);

// Log metrics
console.log(`[AgentMemory] Retrieved ${context.metadata.totalItems} items`);
console.log(`[AgentMemory] Method: ${context.metadata.method}`);
console.log(`[AgentMemory] Latency: ${context.metadata.latencyMs}ms`);
console.log(`[AgentMemory] Has org: ${context.metadata.hasOrganization}`);
```

## See Also

- `/src/lib/server/mongodb/service.ts` - MongoDB service layer
- `/src/lib/server/mongodb/vector-search.ts` - Vector search implementation
- `/src/lib/server/embeddings/voyage-client.ts` - Embedding client
- `/src/lib/core/intelligence/types.ts` - Intelligence types
