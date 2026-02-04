# Decision-Maker Provider Architecture

Pluggable provider system for decision-maker resolution. Enables routing between different research strategies based on target type.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Client Code                           │
│                                                          │
│  resolveDecisionMakers(options)                         │
│           │                                              │
│           └──> DecisionMakerRouter                      │
└─────────────────────────────────────────────────────────┘
                        │
                        │ Routes by targetType
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌───────────────┐ ┌──────────┐ ┌──────────────┐
│    Gemini     │ │ Database │ │   Custom     │
│   Provider    │ │ Provider │ │  Providers   │
│               │ │          │ │              │
│ - Congress    │ │- Cached  │ │- ...         │
│ - State Leg.  │ │- Pre-    │ │              │
│ - Local Govt  │ │  indexed │ │              │
└───────────────┘ └──────────┘ └──────────────┘
```

## Core Concepts

### Target Types

Decision-making power structures that require different research strategies:

- **Government**: `congress`, `state_legislature`, `local_government`
- **Institutional**: `corporate`, `nonprofit`, `education`, `healthcare`
- **Other**: `labor`, `media`

### Provider Interface

All providers implement `DecisionMakerProvider`:

```typescript
interface DecisionMakerProvider {
  readonly name: string;
  readonly supportedTargetTypes: TargetType[];

  canResolve(context: ResolveContext): boolean;
  resolve(context: ResolveContext): Promise<DecisionMakerResult>;
}
```

### Router

The `DecisionMakerRouter` handles:
- Provider registration with priorities
- Target type → provider mapping
- Automatic fallback on failure
- Timeout handling

## File Structure

```
providers/
├── types.ts              # Core interfaces and types
├── router.ts             # Router implementation
├── gemini-provider.ts    # Gemini + Google Search provider
├── index.ts              # Public API and auto-initialization
└── README.md             # This file
```

## Usage

### Basic Usage (Legacy API)

Existing code continues to work unchanged:

```typescript
import { resolveDecisionMakers } from '$lib/core/agents/agents/decision-maker';

const result = await resolveDecisionMakers({
  subjectLine: "Stop the pipeline construction",
  coreMessage: "...",
  topics: ["environment", "energy"],
  streaming: {
    onPhase: (phase, msg) => console.log(phase, msg),
    onThought: (thought) => console.log(thought)
  }
});
```

### Direct Router Usage (Recommended for New Code)

```typescript
import { decisionMakerRouter } from '$lib/core/agents/providers';

const result = await decisionMakerRouter.resolve({
  targetType: 'corporate',
  targetEntity: 'Pacific Gas & Electric',
  targetUrl: 'https://www.pge.com',
  subjectLine: 'Stop the pipeline construction',
  coreMessage: '...',
  topics: ['environment', 'energy'],
  streaming: { /* ... */ }
});
```

### Router Options

```typescript
const result = await decisionMakerRouter.resolve(context, {
  allowFallback: true,           // Try other providers on failure
  preferredProvider: 'gemini',   // Prefer specific provider
  timeoutMs: 90000               // Custom timeout
});
```

## Built-in Providers

### GeminiDecisionMakerProvider

**Strategy**: Two-phase research with Google Search grounding

**Supported Target Types**:
- `congress`
- `state_legislature`
- `local_government`

**How It Works**:

1. **Phase 1 (Role Discovery)**:
   - Identifies POSITIONS with power (not people)
   - Uses Gemini's structural reasoning without grounding
   - Avoids stale parametric memory about specific individuals

2. **Phase 2 (Person Lookup)**:
   - Searches web for current holders of each position
   - Google Search grounding enabled
   - Verifies recency (< 6 months)
   - Discovers contact emails

**Key Features**:
- Thinking summaries streamed during resolution
- Recency verification for accuracy
- Email discovery pipeline
- No caching (always fresh data)

## Creating a Custom Provider

### 1. Implement the Interface

```typescript
import type {
  DecisionMakerProvider,
  ResolveContext,
  DecisionMakerResult,
  TargetType
} from './types';

export class CustomDecisionMakerProvider implements DecisionMakerProvider {
  readonly name = 'custom-corporate';
  readonly supportedTargetTypes: TargetType[] = [
    'corporate',
    'nonprofit',
    'education'
  ];

  canResolve(context: ResolveContext): boolean {
    // Check if we can handle this request
    return this.supportedTargetTypes.includes(context.targetType)
      && !!context.targetUrl;
  }

  async resolve(context: ResolveContext): Promise<DecisionMakerResult> {
    const startTime = Date.now();

    // Your resolution logic here
    const decisionMakers = await this.lookupOrgChart(context.targetUrl);

    return {
      decisionMakers,
      provider: this.name,
      cacheHit: false,
      latencyMs: Date.now() - startTime,
      researchSummary: 'Looked up corporate leadership'
    };
  }
}
```

### 2. Register with Router

```typescript
import { decisionMakerRouter } from '$lib/core/agents/providers';
import { CustomDecisionMakerProvider } from './custom-provider';

// Register with priority (higher = preferred)
const customProvider = new CustomDecisionMakerProvider();
decisionMakerRouter.register(customProvider, 20);
```

### 3. Use It

```typescript
const result = await decisionMakerRouter.resolve({
  targetType: 'corporate',
  targetEntity: 'Acme Corp',
  targetUrl: 'https://acme.com',
  // ... other context
});

// Router automatically selects provider for corporate targets
```

## Provider Priority System

When multiple providers support the same target type:

1. **Preferred Provider**: Use `preferredProvider` option
2. **Priority Order**: Highest priority wins
3. **Capability Check**: Provider's `canResolve()` must return true
4. **Fallback**: If enabled, try next provider on failure

Example:

```typescript
// Both providers support 'corporate'
decisionMakerRouter.register(geminiProvider, 10);
decisionMakerRouter.register(customProvider, 20); // Higher priority

// Higher priority provider will be tried first for corporate targets
```

## Streaming Support

All providers should support streaming callbacks:

```typescript
export interface StreamingCallbacks {
  onThought?: (thought: string, phase: PipelinePhase) => void;
  onPhase?: (phase: PipelinePhase, message: string) => void;
  onProgress?: (progress: {
    current: number;
    total: number;
    status?: string
  }) => void;
}
```

Pass callbacks in the `ResolveContext`:

```typescript
await router.resolve({
  targetType: 'corporate',
  // ...
  streaming: {
    onThought: (thought, phase) => {
      console.log(`[${phase}] ${thought}`);
    },
    onPhase: (phase, message) => {
      updateUI(phase, message);
    },
    onProgress: ({ current, total, status }) => {
      setProgress(current / total, status);
    }
  }
});
```

## Error Handling

Providers should throw meaningful errors:

```typescript
class CustomProvider implements DecisionMakerProvider {
  async resolve(context: ResolveContext): Promise<DecisionMakerResult> {
    if (!context.targetUrl) {
      throw new Error('Custom provider requires a target URL');
    }

    try {
      // Resolution logic
    } catch (error) {
      throw new Error(
        `Provider resolution failed: ${error.message}`
      );
    }
  }
}
```

Router handles errors and attempts fallback if enabled.

## Testing

Test providers in isolation:

```typescript
import { GeminiDecisionMakerProvider } from './gemini-provider';

const provider = new GeminiDecisionMakerProvider();

describe('GeminiDecisionMakerProvider', () => {
  it('supports government target types', () => {
    expect(provider.supportedTargetTypes).toContain('congress');
    expect(provider.supportedTargetTypes).toContain('state_legislature');
  });

  it('can resolve government targets', () => {
    const context = {
      targetType: 'congress',
      subjectLine: 'Test',
      coreMessage: 'Test',
      topics: []
    };
    expect(provider.canResolve(context)).toBe(true);
  });

  it('resolves decision-makers', async () => {
    const result = await provider.resolve({
      targetType: 'local_government',
      subjectLine: 'Stop the pipeline',
      coreMessage: 'Environmental concerns',
      topics: ['environment']
    });

    expect(result.provider).toBe('gemini-search');
    expect(result.decisionMakers).toBeInstanceOf(Array);
  });
});
```

## Migration Guide

### From Legacy API

**Before**:
```typescript
import { resolveDecisionMakers } from '$lib/core/agents/agents/decision-maker';

const result = await resolveDecisionMakers({
  subjectLine: "...",
  coreMessage: "...",
  topics: []
});
```

**After**:
```typescript
import { decisionMakerRouter } from '$lib/core/agents/providers';

const result = await decisionMakerRouter.resolve({
  targetType: 'local_government', // Now explicit
  subjectLine: "...",
  coreMessage: "...",
  topics: []
});
```

### Benefits

1. **Type Safety**: Target type is explicit, not inferred
2. **Extensibility**: Easy to add new providers
3. **Testability**: Providers are isolated and mockable
4. **Observability**: Clear provider selection logic
5. **Flexibility**: Per-request provider preferences

## Roadmap

### Upcoming Providers

- **DatabaseProvider**: Cached/pre-indexed decision-makers
- **APIProvider**: Third-party data sources (GovTrack, OpenSecrets)

### Future Enhancements

- Provider health checks and circuit breakers
- Result caching layer
- A/B testing between providers
- Provider-specific analytics
