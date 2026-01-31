# Provider Architecture — Visual Guide

## Type Hierarchy

```
DecisionMakerTargetType (Provider-specific)
├── Government
│   ├── congress
│   ├── state_legislature
│   └── local_government
├── Institutional
│   ├── corporate
│   ├── nonprofit
│   ├── education
│   └── healthcare
└── Other
    ├── labor
    └── media

vs.

TargetType (Clarification agent — broader categories)
├── government
├── corporate
├── institutional
└── other
```

## Request Flow

```
User Input: "Stop the pipeline construction"
     │
     ▼
┌────────────────────────────────────────┐
│  Subject Line Agent (Clarification)   │
│  Infers: detected_target_type          │
│  → "government" (broad category)       │
└────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────┐
│  Template Creator UI                   │
│  User selects:                         │
│  → DecisionMakerTargetType             │
│  → "local_government" (specific)       │
└────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────┐
│  decisionMakerRouter.resolve()         │
│  Input: ResolveContext                 │
│    - targetType: 'local_government'    │
│    - subjectLine: "..."                │
│    - topics: [...]                     │
└────────────────────────────────────────┘
     │
     ├─── Provider Selection ───┐
     │                           │
     ▼                           ▼
[congress,              [corporate,
 state_legislature,      nonprofit,
 local_government]       education]
     │                           │
     ▼                           ▼
GeminiProvider          FirecrawlProvider
(Google Search)         (Web Scraping)
     │                           │
     └──────────┬────────────────┘
                │
                ▼
     DecisionMakerResult
     {
       decisionMakers: [...],
       provider: "gemini-search",
       latencyMs: 12500,
       researchSummary: "..."
     }
```

## Provider Interface Contract

```typescript
interface DecisionMakerProvider {
  // Metadata
  name: string
  supportedTargetTypes: DecisionMakerTargetType[]

  // Methods
  canResolve(context: ResolveContext): boolean
  resolve(context: ResolveContext): Promise<DecisionMakerResult>
}
```

### Example: Gemini Provider

```
Input (ResolveContext)
{
  targetType: 'local_government',
  subjectLine: 'Stop pipeline construction',
  coreMessage: 'Environmental concerns...',
  topics: ['environment', 'energy'],
  geographicScope: { city: 'San Francisco', state: 'CA' }
}

↓ Phase 1: Role Discovery (No grounding)

{
  roles: [
    {
      position: "Mayor",
      organization: "City of San Francisco",
      jurisdiction: "San Francisco, CA",
      reasoning: "Has executive authority over city infrastructure",
      search_query: "current Mayor of San Francisco 2026"
    },
    {
      position: "Board of Supervisors President",
      organization: "San Francisco Board of Supervisors",
      jurisdiction: "San Francisco, CA",
      reasoning: "Legislative authority over land use",
      search_query: "current President San Francisco Board of Supervisors 2026"
    }
  ]
}

↓ Phase 2: Person Lookup (Google Search grounding)

Output (DecisionMakerResult)
{
  decisionMakers: [
    {
      name: "London Breed",
      title: "Mayor",
      organization: "City of San Francisco",
      email: "mayorlondonbreed@sfgov.org",
      reasoning: "Has executive authority...",
      source: "https://sf.gov/mayor",
      recencyCheck: "Verified via SF.gov dated Jan 2026"
    }
  ],
  provider: "gemini-search",
  latencyMs: 12500,
  researchSummary: "Two-phase research completed."
}
```

## Provider Registration

```typescript
// At app startup (automatic)
import { decisionMakerRouter } from '$lib/core/agents/providers';

decisionMakerRouter.register(
  new GeminiDecisionMakerProvider(),
  10  // Priority
);

decisionMakerRouter.register(
  new FirecrawlDecisionMakerProvider(),
  20  // Higher priority
);
```

### Priority Resolution

When multiple providers support the same target type:

```
Request: { targetType: 'corporate' }

Registered Providers:
  1. GeminiProvider (priority: 10) → supports 'corporate'
  2. FirecrawlProvider (priority: 20) → supports 'corporate'

Selection:
  ✓ FirecrawlProvider selected (highest priority)
  ✓ GeminiProvider available as fallback
```

## Geographic Scope Integration

```typescript
interface ResolveContext {
  // ... other fields
  geographicScope?: {
    country?: string;     // "US"
    state?: string;       // "CA"
    city?: string;        // "San Francisco"
    district?: string;    // "CA-11"
    displayName?: string; // "San Francisco, CA"
  }
}
```

### Usage in Providers

```typescript
class GeminiProvider {
  async resolve(context: ResolveContext) {
    const location = context.geographicScope;

    // Use in role discovery prompt
    const jurisdictionHint = location?.displayName
      ? `Focus on positions in ${location.displayName}`
      : 'Identify relevant jurisdictions';

    // Use in search queries
    const searchSuffix = location?.city
      ? `${location.city}, ${location.state}`
      : location?.state || '';
  }
}
```

## Streaming Support

```typescript
interface StreamingCallbacks {
  onThought?: (thought: string, phase: PipelinePhase) => void;
  onPhase?: (phase: PipelinePhase, message: string) => void;
  onProgress?: (progress: {
    current: number;
    total: number;
    status?: string;
  }) => void;
}
```

### Example Stream

```
[Phase] discover | "Mapping institutional power structure..."
[Thought] "Analyzing power dynamics in San Francisco city government..."
[Thought] "The Mayor has executive authority over infrastructure decisions..."
[Thought] "Board of Supervisors has legislative oversight..."
[Phase] lookup | "Verifying current holders of 3 positions..."
[Progress] { current: 1, total: 3, status: "Searching for Mayor..." }
[Thought] "Searching for current Mayor of San Francisco..."
[Thought] "Found: London Breed verified via sf.gov dated Jan 28, 2026..."
[Progress] { current: 2, total: 3, status: "Searching for Board President..." }
[Phase] complete | "Found 3 decision-makers with verified contact info"
```

## Error Handling & Fallback

```
Request → Primary Provider (fails)
                ↓
         Fallback Enabled?
           ↙         ↘
        YES          NO
         ↓            ↓
    Try Next    Throw Error
    Provider
         ↓
    Success? → Return Result
         ↓
        NO
         ↓
    All Failed
         ↓
    Throw Error
```

### Example with Fallback

```typescript
try {
  const result = await router.resolve(context, {
    allowFallback: true,
    timeoutMs: 60000
  });
} catch (error) {
  // Only thrown if ALL providers fail
  console.error('Resolution failed:', error.message);
}
```

## Type Conversions

### Legacy API → Router

```typescript
// Legacy call
resolveDecisionMakers({
  subjectLine: "...",
  coreMessage: "...",
  topics: [],
  streaming: { /* ... */ }
})

// Converts to:
decisionMakerRouter.resolve({
  targetType: 'local_government', // Default
  subjectLine: "...",
  coreMessage: "...",
  topics: [],
  streaming: { /* ... */ }
})
```

### Router Result → Legacy Response

```typescript
// DecisionMakerResult (provider output)
{
  decisionMakers: ProcessedDecisionMaker[],
  provider: string,
  latencyMs: number,
  researchSummary?: string
}

// DecisionMakerResponse (legacy format)
{
  decision_makers: DecisionMaker[],
  research_summary?: string,
  pipeline_stats: {
    candidates_found: number,
    enrichments_succeeded: number,
    validations_passed: number,
    total_latency_ms: number
  }
}
```

## Testing Strategy

### Unit Tests (Provider Isolation)

```typescript
describe('GeminiDecisionMakerProvider', () => {
  it('resolves government targets', async () => {
    const provider = new GeminiDecisionMakerProvider();
    const result = await provider.resolve({
      targetType: 'congress',
      // ... mock context
    });
    expect(result.provider).toBe('gemini-search');
  });
});
```

### Integration Tests (Router)

```typescript
describe('DecisionMakerRouter', () => {
  it('selects correct provider for target type', async () => {
    const router = new DecisionMakerRouter();
    router.register(geminiProvider, 10);
    router.register(firecrawlProvider, 20);

    const result = await router.resolve({
      targetType: 'corporate',
      // ...
    });

    expect(result.provider).toBe('firecrawl-corporate');
  });
});
```

### Mock Provider (Test Utilities)

```typescript
class MockProvider implements DecisionMakerProvider {
  readonly name = 'mock';
  readonly supportedTargetTypes = ['corporate'];

  async resolve(ctx: ResolveContext) {
    return {
      decisionMakers: [/* ... */],
      provider: this.name,
      cacheHit: false,
      latencyMs: 10
    };
  }
}
```

## Migration Checklist

- [x] Extract provider interface
- [x] Refactor Gemini logic into provider class
- [x] Create router with priority system
- [x] Maintain backward compatibility
- [x] Add comprehensive tests
- [x] Document architecture
- [ ] Create UI for target type selection
- [ ] Implement Firecrawl provider
- [ ] Add provider analytics/monitoring
- [ ] Migrate all callsites to new API
- [ ] Remove legacy compatibility layer
