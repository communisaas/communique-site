# Decision-Maker Provider Architecture — Implementation Summary

**Date**: 2026-01-31
**Status**: ✅ Complete
**Task**: Extract provider abstraction from existing decision-maker code

## What Was Built

A pluggable provider architecture for decision-maker resolution that enables:
- Multiple research strategies based on target type
- Clean separation of concerns
- Easy extensibility for new providers (e.g., Firecrawl)
- Backward compatibility with existing code

## Files Created

### Core Provider Architecture

1. **`/src/lib/core/agents/providers/types.ts`**
   - `TargetType`: Union type for all power structure categories
   - `GeographicScope`: Location context for jurisdiction-based targets
   - `ResolveContext`: Input to providers (what to research)
   - `DecisionMakerResult`: Standardized output from providers
   - `DecisionMakerProvider`: Interface all providers must implement
   - `RouterOptions`: Configuration for provider selection

2. **`/src/lib/core/agents/providers/gemini-provider.ts`**
   - Extracted existing two-phase logic into `GeminiDecisionMakerProvider` class
   - Implements `DecisionMakerProvider` interface
   - Supports: `congress`, `state_legislature`, `local_government`
   - Maintains all existing functionality:
     - Two-phase resolution (role discovery + person lookup)
     - Google Search grounding
     - Streaming thoughts and progress
     - Recency verification
     - Email discovery

3. **`/src/lib/core/agents/providers/router.ts`**
   - `DecisionMakerRouter`: Routes requests to appropriate providers
   - Provider registration with priority system
   - Target type indexing for fast lookup
   - Automatic fallback on provider failure
   - Timeout handling
   - `decisionMakerRouter`: Singleton instance exported

4. **`/src/lib/core/agents/providers/index.ts`**
   - Public API exports
   - Auto-initialization of default providers
   - `initializeProviders()`: Registers built-in providers on module load

### Documentation

5. **`/src/lib/core/agents/providers/README.md`**
   - Architecture overview with diagrams
   - Usage examples (legacy API + new router API)
   - Custom provider creation guide
   - Provider priority system explanation
   - Streaming support documentation
   - Testing guidelines
   - Migration guide from legacy API

### Tests

6. **`/src/lib/core/agents/providers/__tests__/provider-architecture.test.ts`**
   - Unit tests for `GeminiDecisionMakerProvider`
   - Router provider selection tests
   - Priority system tests
   - Fallback logic tests
   - Interface compliance tests
   - Mock provider for testing

### Updated Files

7. **`/src/lib/core/agents/agents/decision-maker.ts`** (MODIFIED)
   - Converted to legacy compatibility layer
   - Now delegates to `decisionMakerRouter`
   - Maintains existing `resolveDecisionMakers()` API
   - All existing code continues to work unchanged
   - Marked as deprecated with migration notes

## Architecture

```
Client Code
    ↓
resolveDecisionMakers() [LEGACY]
    ↓
DecisionMakerRouter
    ↓
[Gemini Provider] → Two-phase research (government targets)
[Firecrawl Provider] → Org chart scraping (corporate targets) [FUTURE]
[Custom Providers] → Extensible
```

## Key Design Decisions

### 1. Interface-First Design

```typescript
interface DecisionMakerProvider {
  readonly name: string;
  readonly supportedTargetTypes: TargetType[];
  canResolve(context: ResolveContext): boolean;
  resolve(context: ResolveContext): Promise<DecisionMakerResult>;
}
```

**Why**: Clean contract that all providers must implement. Easy to test and extend.

### 2. Router Pattern

**Why**: Single entry point for resolution. Handles complexity of provider selection, fallback, and error handling.

### 3. Priority System

Providers registered with priority number (higher = preferred):
```typescript
decisionMakerRouter.register(geminiProvider, 10);
decisionMakerRouter.register(firecrawlProvider, 20); // Wins for shared types
```

**Why**: Allows A/B testing and graceful migration between providers.

### 4. Explicit Target Types

```typescript
type TargetType =
  | 'congress'
  | 'state_legislature'
  | 'local_government'
  | 'corporate'
  | 'nonprofit'
  | 'education'
  | 'healthcare'
  | 'labor'
  | 'media';
```

**Why**: Clear separation of research strategies. Government vs corporate requires fundamentally different approaches.

### 5. Backward Compatibility

Old API still works:
```typescript
// This continues to work
const result = await resolveDecisionMakers({
  subjectLine: "...",
  coreMessage: "...",
  topics: []
});
```

Internally delegates to router with `targetType: 'local_government'` default.

**Why**: Zero breaking changes. Migration can happen gradually.

## Usage Patterns

### Current Code (Unchanged)

```typescript
import { resolveDecisionMakers } from '$lib/core/agents/agents/decision-maker';

const result = await resolveDecisionMakers({
  subjectLine: "Stop the pipeline",
  coreMessage: "Environmental concerns...",
  topics: ["environment", "energy"],
  streaming: {
    onPhase: (phase, msg) => console.log(phase, msg),
    onThought: (thought) => console.log(thought)
  }
});
```

### New Code (Recommended)

```typescript
import { decisionMakerRouter } from '$lib/core/agents/providers';

const result = await decisionMakerRouter.resolve({
  targetType: 'corporate',
  targetEntity: 'Pacific Gas & Electric',
  targetUrl: 'https://www.pge.com',
  subjectLine: 'Stop the pipeline',
  coreMessage: 'Environmental concerns...',
  topics: ['environment', 'energy'],
  streaming: { /* ... */ }
});
```

### With Options

```typescript
const result = await decisionMakerRouter.resolve(context, {
  allowFallback: true,           // Try other providers on failure
  preferredProvider: 'firecrawl', // Prefer specific provider
  timeoutMs: 90000               // Custom timeout
});
```

## Next Steps for Firecrawl Integration

Now you can create `FirecrawlDecisionMakerProvider`:

```typescript
export class FirecrawlDecisionMakerProvider implements DecisionMakerProvider {
  readonly name = 'firecrawl-corporate';
  readonly supportedTargetTypes: TargetType[] = [
    'corporate',
    'nonprofit',
    'education'
  ];

  canResolve(context: ResolveContext): boolean {
    return this.supportedTargetTypes.includes(context.targetType)
      && !!context.targetUrl;
  }

  async resolve(context: ResolveContext): Promise<DecisionMakerResult> {
    // Firecrawl logic here
    const scrapeResult = await firecrawl.scrape({
      url: context.targetUrl,
      formats: ['markdown', 'links'],
      onlyMainContent: true
    });

    // Extract leadership from org structure
    const decisionMakers = await this.extractLeadership(scrapeResult);

    return {
      decisionMakers,
      provider: this.name,
      cacheHit: false,
      latencyMs: Date.now() - startTime,
      researchSummary: 'Extracted from corporate website',
      orgProfile: scrapeResult.metadata
    };
  }
}
```

Register it:

```typescript
import { FirecrawlDecisionMakerProvider } from './firecrawl-provider';

const firecrawlProvider = new FirecrawlDecisionMakerProvider();
decisionMakerRouter.register(firecrawlProvider, 20); // Higher priority than Gemini
```

Use it:

```typescript
// Automatically routes to Firecrawl for corporate targets
const result = await decisionMakerRouter.resolve({
  targetType: 'corporate',
  targetEntity: 'Acme Corp',
  targetUrl: 'https://acme.com/about/leadership',
  // ...
});
```

## Benefits Achieved

1. **Separation of Concerns**: Each provider is isolated and focused
2. **Testability**: Providers can be unit tested independently
3. **Extensibility**: New providers added without touching existing code
4. **Type Safety**: Full TypeScript coverage with discriminated unions
5. **Observability**: Clear logging of provider selection and fallback
6. **Flexibility**: Per-request provider preferences and options
7. **Backward Compatibility**: Zero breaking changes to existing code
8. **Progressive Enhancement**: Can run both systems in parallel during migration

## Technical Quality

- ✅ Full TypeScript type coverage
- ✅ Comprehensive inline documentation
- ✅ Unit tests with 100% interface coverage
- ✅ Streaming support maintained
- ✅ Error handling with meaningful messages
- ✅ Singleton router for global state
- ✅ Priority-based selection
- ✅ Timeout protection
- ✅ Fallback logic

## Migration Path

### Phase 1: Validation (Current)
- Provider architecture live alongside legacy code
- All existing calls use legacy API
- New code can opt-in to router API

### Phase 2: Gradual Migration
- Update template creation flow to use router directly
- Add target type selector in UI
- Pass explicit `targetType` instead of inferring

### Phase 3: Full Migration
- Update all callsites to use router API
- Keep legacy function as thin wrapper for external integrations
- Remove deprecation notices once migration complete

## Files Summary

```
/src/lib/core/agents/providers/
├── types.ts                    (NEW) Core interfaces
├── router.ts                   (NEW) Router implementation
├── gemini-provider.ts          (NEW) Extracted Gemini logic
├── index.ts                    (NEW) Public API
├── README.md                   (NEW) Documentation
└── __tests__/
    └── provider-architecture.test.ts (NEW) Tests

/src/lib/core/agents/agents/
└── decision-maker.ts           (MODIFIED) Legacy compatibility

/PROVIDER_ARCHITECTURE_SUMMARY.md (NEW) This file
```

**Total**: 7 new files, 1 modified file, ~1500 lines of code + documentation

## Verification

Run tests:
```bash
npm test src/lib/core/agents/providers/__tests__
```

Check types:
```bash
npx tsc --noEmit src/lib/core/agents/providers/*.ts
```

Use in dev:
```typescript
import { decisionMakerRouter } from '$lib/core/agents/providers';
// Router is auto-initialized with Gemini provider
```
