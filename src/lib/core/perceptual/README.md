# Perceptual Engineering Module

Centralized timing constants based on human perception research and cognitive load management.

## Philosophy

All timing values in the UI should be grounded in perceptual research:
- **<100ms**: Feels instant (causality preserved - Miller's Rule)
- **<400ms**: Perceived as responsive (Nielsen's threshold)
- **>1000ms**: Requires loading indicator (user attention wanders)

This module ensures consistent timing across the entire application.

## Usage

### Import Specific Constants

```typescript
import { L2_HOVER_DELAY, TRANSITION, PHASE_PAUSE } from '$lib/core/perceptual';

// L2 hover delay for progressive disclosure
setTimeout(() => showPreview(), L2_HOVER_DELAY); // 300ms

// Standard transition duration
element.style.transition = `transform ${TRANSITION}ms ease-out`; // 300ms

// Phase pause between streaming phases
await sleep(PHASE_PAUSE); // 500ms
```

### Import All Timing Constants

```typescript
import { PERCEPTUAL_TIMING } from '$lib/core/perceptual';

console.log(PERCEPTUAL_TIMING.L2_HOVER_DELAY); // 300
console.log(PERCEPTUAL_TIMING.DISCOVERY_EXPECTED); // 45000
```

## Available Constants

### Causality Budget
- `INSTANT` (0ms) - Direct state changes
- `CAUSALITY_MAX` (100ms) - Maximum delay where action feels connected to response

### UI Transitions
- `SNAP` (150ms) - Quick UI reorganization
- `TRANSITION` (300ms) - Standard view changes, drawer slides

### L2 Preview Behavior (Hover-based Progressive Disclosure)
- `L2_HOVER_DELAY` (300ms) - Delay before preview appears
- `L2_LINGER` (150ms) - Grace period when leaving trigger area
- `L2_FADE_IN` (150ms) - Fade-in animation duration

### Streaming Rhythm (Thought Flow)
- `THOUGHT_PAUSE` (300ms) - Pause between thought chunks
- `PHASE_PAUSE` (500ms) - Pause between phase transitions

### Loading Thresholds
- `LOADING_THRESHOLD` (1000ms) - Minimum duration before showing loading indicator

### Composite Flow Specific
- `DISCOVERY_EXPECTED` (45000ms) - Expected discovery phase duration
- `DISCOVERY_THOUGHT_INTERVAL` (2000ms) - Thought emission interval during discovery
- `DISCOVERY_PROGRESS_PULSE` (500ms) - Ambient activity indicator pulse
- `VERIFICATION_EXPECTED` (8000ms) - Expected verification phase duration
- `VERIFICATION_THOUGHT_INTERVAL` (3000ms) - Thought emission interval during verification
- `CONFIDENCE_BOOST` (0.15) - Confidence increase per verified thought

## Migration Guide

### Before (Scattered Constants)

```typescript
// DecisionMakerResolver.svelte
const HOVER_DELAY_MS = 300;

// composite-emitter.ts
export const COMPOSITE_TIMING = {
  DISCOVERY: { expected: 45_000 },
  VERIFICATION: { confidenceBoost: 0.15 },
  TRANSITION: { pauseBeforeVerify: 500 }
};

// DocumentPreview.svelte
animation: fadeSlideIn 150ms ease-out;
```

### After (Centralized)

```typescript
// DecisionMakerResolver.svelte
import { L2_HOVER_DELAY } from '$lib/core/perceptual';
setTimeout(() => showPreview(), L2_HOVER_DELAY);

// composite-emitter.ts
import { PERCEPTUAL_TIMING } from '$lib/core/perceptual/timing';
export const COMPOSITE_TIMING = {
  DISCOVERY: { expected: PERCEPTUAL_TIMING.DISCOVERY_EXPECTED },
  VERIFICATION: { confidenceBoost: PERCEPTUAL_TIMING.CONFIDENCE_BOOST },
  TRANSITION: { pauseBeforeVerify: PERCEPTUAL_TIMING.PHASE_PAUSE }
};

// DocumentPreview.svelte
import { L2_FADE_IN } from '$lib/core/perceptual';
animation: fadeSlideIn calc(var(--l2-fade-in, 150) * 1ms) ease-out;
```

## Design Principles

### 1. Causality Preservation
Actions and their effects must feel connected. Use `CAUSALITY_MAX` (100ms) as the upper bound for feedback loops.

### 2. Progressive Disclosure Timing
L2 hover delays prevent accidental triggers while maintaining responsiveness:
- `L2_HOVER_DELAY` (300ms): Below 400ms "perceived delay" threshold
- `L2_LINGER` (150ms): Allows smooth traversal to preview without re-triggering

### 3. Streaming Rhythm
Thought emissions should feel natural, not robotic:
- `THOUGHT_PAUSE` (300ms): Comfortable reading rhythm
- `PHASE_PAUSE` (500ms): Clear phase boundary without jarring transition

### 4. Motion Sensitivity
All animations respect `prefers-reduced-motion`:
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## References

- Miller, R.B. (1968). "Response time in man-computer conversational transactions"
- Nielsen, J. (1993). "Response Times: The 3 Important Limits"
- WCAG 2.1 Animation Guidelines
- Card, S.K. et al. (1983). "The Psychology of Human-Computer Interaction"

## Files Updated

This centralization effort updated the following files:
- `/src/lib/core/thoughts/composite-emitter.ts` - Composite timing
- `/src/lib/components/template/creator/DecisionMakerResolver.svelte` - L2 hover delay
- `/src/routes/representatives/[id]/+page.svelte` - L2 hover delay
- `/src/lib/components/thoughts/DocumentPreview.svelte` - L2 fade-in, timing comments
- `/src/lib/components/thoughts/PhaseAmbient.svelte` - Transition duration
- `/src/lib/components/thoughts/ThoughtStream.svelte` - Snap duration, timing comments
- `/src/lib/components/thoughts/InlineCitation.svelte` - L2 hover, linger, fade-in
- `/src/lib/core/agents/providers/constants.ts` - Confidence boost reference
