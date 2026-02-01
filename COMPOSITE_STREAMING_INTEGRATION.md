# Composite Streaming Integration

## Overview

ConfidenceIndicator and PhaseAmbient are now fully integrated into the ThoughtStream UI. These components provide subtle, peripheral awareness of reasoning confidence and phase progression without demanding focal attention.

## Integration Points

### 1. PhaseAmbient in ThoughtStream

**Location**: `/Users/noot/Documents/communique/src/lib/components/thoughts/ThoughtStream.svelte`

The PhaseAmbient component wraps the entire ThoughtStream, providing ambient background gradients that shift based on the current phase:

```svelte
<PhaseAmbient phase={currentPhase}>
  <!-- entire stream content -->
</PhaseAmbient>
```

**Phase Detection**:
The current phase is automatically derived from the `phases` prop:

- **discovery**: Research, discovery phases (warm amber)
- **verification**: Verification, context, validation phases (cool teal)
- **complete**: All phases complete (calm green)
- **idle**: No active phase (transparent)

The phase mapping logic:
```typescript
const currentPhase = $derived.by(() => {
  const activePhase = phases.find((p) => p.status === 'active');
  if (activePhase) {
    const phaseName = activePhase.name.toLowerCase();
    if (phaseName.includes('research') || phaseName.includes('discovery')) {
      return 'discovery';
    }
    if (phaseName.includes('verif') || phaseName.includes('context') || phaseName.includes('validat')) {
      return 'verification';
    }
  }

  const allComplete = phases.length > 0 && phases.every((p) => p.status === 'complete');
  if (allComplete) return 'complete';

  return 'idle';
});
```

### 2. ConfidenceIndicator in ThoughtSegment

**Location**: `/Users/noot/Documents/communique/src/lib/components/thoughts/ThoughtSegment.svelte`

Each thought segment displays a confidence indicator when `segment.confidence` is defined:

```svelte
{#if segment.confidence !== undefined}
  <div class="flex-shrink-0 pt-1.5">
    <ConfidenceIndicator confidence={segment.confidence} size="sm" />
  </div>
{/if}
```

**Positioning**: The indicator is placed at the **left edge** of the segment, before type icons and content, maintaining peripheral awareness without blocking the primary content.

### 3. Type System Updates

**Location**: `/Users/noot/Documents/communique/src/lib/core/thoughts/types.ts`

#### ThoughtSegment Interface

Added `confidence` field:

```typescript
export interface ThoughtSegment {
  // ... existing fields

  /**
   * Confidence level for this segment (0.0 - 1.0)
   * Used by composite streaming to show verification progress
   * - 0.4: Base confidence (discovery phase)
   * - 0.55: Single verification
   * - 0.70: Double verification
   * - 0.85+: Triple+ verification
   */
  confidence?: number;
}
```

#### ThoughtStreamEvent Union

Added phase transition and confidence update events:

```typescript
export type ThoughtStreamEvent =
  | { type: 'segment'; segment: ThoughtSegment }
  | { type: 'phase'; phase: PhaseState; from?: string; to: string }
  | { type: 'confidence'; thoughtId: string; previousConfidence: number; newConfidence: number }
  | { type: 'key_moment'; moment: KeyMoment }
  | { type: 'complete'; totalSegments: number; duration: number }
  | { type: 'error'; error: string };
```

## SSE Integration Pattern

### Expected Event Format

When implementing SSE streaming from the backend, emit these event types:

#### 1. Segment Events (with confidence)

```typescript
{
  type: 'segment',
  segment: {
    id: 'seg-123',
    timestamp: Date.now(),
    type: 'reasoning',
    phase: 'discovery',
    content: 'Analyzing corporate sustainability reports...',
    expandable: false,
    confidence: 0.4  // Initial discovery confidence
  }
}
```

#### 2. Phase Transition Events

```typescript
{
  type: 'phase',
  phase: {
    name: 'verification',
    status: 'active',
    startTime: Date.now()
  },
  from: 'discovery',
  to: 'verification'
}
```

#### 3. Confidence Update Events

```typescript
{
  type: 'confidence',
  thoughtId: 'seg-123',
  previousConfidence: 0.4,
  newConfidence: 0.55  // After first verification
}
```

### Consumer Implementation

In your SSE consumer (e.g., MessageGenerationResolver.svelte), handle these events:

```typescript
const eventSource = new EventSource('/api/agents/stream');

eventSource.addEventListener('segment', (e) => {
  const segment = JSON.parse(e.data);
  segments = [...segments, segment];
});

eventSource.addEventListener('phase', (e) => {
  const { phase, from, to } = JSON.parse(e.data);
  phases = [...phases.filter(p => p.name !== phase.name), phase];
});

eventSource.addEventListener('confidence', (e) => {
  const { thoughtId, newConfidence } = JSON.parse(e.data);
  segments = segments.map(seg =>
    seg.id === thoughtId
      ? { ...seg, confidence: newConfidence }
      : seg
  );
});
```

## Confidence Model

The confidence system follows this progression:

| Stage | Confidence | Visual | Description |
|-------|-----------|--------|-------------|
| Discovery | 0.4 | ●○○ | Initial exploration, base confidence |
| First Verification | 0.55 | ●●○ | Cross-referenced once |
| Second Verification | 0.70 | ●●● | Cross-referenced twice |
| High Confidence | 0.85+ | ●●● + ✓ | Triple+ verification, verified badge |

Thresholds:
- **0.33**: First dot fills (low confidence)
- **0.66**: Second dot fills (medium confidence)
- **1.0**: Third dot fills (high confidence)

Colors:
- **Low** (0.33-0.65): Amber (#f59e0b)
- **Medium** (0.66-0.99): Indigo (#6366f1)
- **High** (1.0): Emerald (#10b981)

## Perceptual Engineering Notes

### PhaseAmbient
- **Opacity**: 8% maximum (0.08)
- **Transition**: 300ms ease-out
- **Position**: Behind all content (z-index: 0)
- **Effect**: Subtle gradient that creates peripheral awareness without blocking content

### ConfidenceIndicator
- **Size**: Small (1.5px dots with 0.5px gap in 'sm' mode)
- **Position**: Left edge, aligned with text baseline
- **Transition**: 200ms ease-out for smooth confidence changes
- **Animation**: Verified checkmark pops in with 300ms scale animation

Both components respect `prefers-reduced-motion` for accessibility.

## Migration Guide

### For Existing Components Using ThoughtStream

No changes needed! The integration is backward compatible:

1. **PhaseAmbient** wraps automatically based on `phases` prop
2. **ConfidenceIndicator** only appears when `segment.confidence` is defined
3. If you don't emit confidence data, the UI degrades gracefully

### To Enable Full Composite Streaming

Update your SSE endpoint to:

1. Include `confidence` field in segment events
2. Emit `phase` events with `from` and `to` fields
3. Emit `confidence` events when verification updates occur

Example server-side (pseudo-code):

```typescript
// Discovery phase
emitter.sendPhase({ name: 'discovery', status: 'active' });
emitter.sendSegment({
  content: 'Researching...',
  phase: 'discovery',
  confidence: 0.4
});

// Verification phase
emitter.sendPhase({
  name: 'verification',
  status: 'active'
}, { from: 'discovery', to: 'verification' });

// Update confidence after cross-reference
emitter.sendConfidence({
  thoughtId: 'seg-123',
  previousConfidence: 0.4,
  newConfidence: 0.55
});
```

## Testing

### Visual Verification

1. Run the demo: `/demo/thought-stream`
2. Add test segments with varying confidence levels:
   - 0.3 (●○○ amber)
   - 0.6 (●●○ indigo)
   - 0.9 (●●● emerald)
3. Transition between phases to verify ambient background changes

### Integration Test

```typescript
// Mock data for testing
const testSegments: ThoughtSegment[] = [
  {
    id: '1',
    timestamp: Date.now(),
    type: 'reasoning',
    phase: 'discovery',
    content: 'Initial thought',
    expandable: false,
    confidence: 0.4  // Should show ●○○
  },
  {
    id: '2',
    timestamp: Date.now(),
    type: 'insight',
    phase: 'verification',
    content: 'Verified insight',
    expandable: false,
    confidence: 0.85,  // Should show ●●● + checkmark
    verified: true
  }
];

const testPhases: PhaseState[] = [
  {
    name: 'discovery',
    status: 'complete',
    startTime: Date.now() - 3000,
    endTime: Date.now() - 1000
  },
  {
    name: 'verification',
    status: 'active',
    startTime: Date.now() - 1000
  }
];
```

## Files Modified

1. `/Users/noot/Documents/communique/src/lib/core/thoughts/types.ts`
   - Added `confidence?: number` to `ThoughtSegment`
   - Updated `ThoughtStreamEvent` union with phase and confidence events

2. `/Users/noot/Documents/communique/src/lib/components/thoughts/ThoughtStream.svelte`
   - Imported `PhaseAmbient`
   - Added `currentPhase` derivation logic
   - Wrapped stream content with `<PhaseAmbient>`

3. `/Users/noot/Documents/communique/src/lib/components/thoughts/ThoughtSegment.svelte`
   - Imported `ConfidenceIndicator`
   - Added conditional rendering of confidence indicator
   - Positioned indicator at left edge (flex-shrink-0)

## Next Steps

1. **Update Backend**: Modify SSE endpoints to emit confidence and phase transition events
2. **Update ThoughtEmitter**: Add confidence tracking to the client-side emitter
3. **Add Transitions**: Consider animating confidence changes (already has 200ms transitions)
4. **Analytics**: Track how users respond to confidence indicators (do they trust high confidence more?)

## Resources

- **ConfidenceIndicator Component**: `/Users/noot/Documents/communique/src/lib/components/thoughts/ConfidenceIndicator.svelte`
- **PhaseAmbient Component**: `/Users/noot/Documents/communique/src/lib/components/thoughts/PhaseAmbient.svelte`
- **Type Definitions**: `/Users/noot/Documents/communique/src/lib/core/thoughts/types.ts`
- **Demo Page**: `/Users/noot/Documents/communique/src/routes/demo/thought-stream/+page.svelte`
