# Thought Stream Components

Progressive disclosure UI for agent reasoning visualization, built with perceptual engineering principles.

## Overview

These components enable rich, explorable displays of agent reasoning with citations, research traces, and key moments.

### Component Architecture

```
ThoughtStream (main container)
├── PhaseContainer (phase grouping)
│   ├── ThoughtSegment (reasoning display)
│   ├── ActionSegment (research/retrieval)
│   └── InlineCitation (clickable citations)
├── StreamControls (playback controls)
├── KeyMoments (sticky footer)
└── DetailDrawer (slide-in expansion)
    ├── CitationDetail (L1 depth)
    └── ActionDetail (L2 depth)
```

## KeyMoments Component

Sticky footer that captures important items as they appear in the stream.

### Features

- **Spatial Constancy**: Never scrolls away, maintains position
- **Information Scent**: Icon + label provide pre-attentive processing cues
- **Horizontal Layout**: Minimizes vertical intrusion on main content
- **Subtle Animations**: Entrance animations maintain continuity
- **Semi-Transparent**: Shows auxiliary nature, not primary content

### Usage

```svelte
<script>
  import { KeyMoments } from '$lib/components/thoughts';
  import type { KeyMoment } from '$lib/core/thoughts/types';

  let moments = $state<KeyMoment[]>([
    {
      id: 'moment-1',
      type: 'citation',
      label: "Apple's 2025 Report",
      icon: '📄',
      segmentId: 'thought-5'
    },
    {
      id: 'moment-2',
      type: 'insight',
      label: 'Carbon neutrality commitment',
      icon: '💡',
      segmentId: 'thought-8'
    }
  ]);

  function handleMomentClick(moment: KeyMoment) {
    // Open detail drawer or scroll to segment
    console.log('Clicked moment:', moment);
  }
</script>

<KeyMoments {moments} onmomentclick={handleMomentClick} />
```

### Moment Types & Icons

- **citation** (📄, 📚, 🔗): Important source references
- **action** (🔍, 🌐, ⚙️): Significant research/retrieval operations
- **insight** (💡, ✨, 🎯): Key findings or discoveries
- **decision_maker** (👤, 🏛️, 🏢): Identified decision-makers

## DetailDrawer Component

Slide-in panel from right showing expanded citation or action details.

### Features

- **Continuity**: Slides alongside stream, doesn't replace it
- **Progressive Disclosure**: Shows L1/L2 depth without overwhelming
- **Easy Escape**: Overlay click, X button, Escape key
- **Focus Trap**: Keyboard navigation stays within drawer
- **Responsive**: Full-width on mobile, 480px on desktop

## Integration Example

Complete example showing how these components work together in a real implementation.

## Perceptual Engineering Principles

### 1. Information Scent
- Icons and labels hint at content type before interaction
- Color coding reduces cognitive load through perceptual grouping
- Badges provide quick classification (pre-attentive processing)

### 2. Spatial Constancy
- KeyMoments never scrolls away (maintains fixed position)
- DetailDrawer slides alongside, doesn't replace stream
- Users always know where to find important affordances

### 3. Progressive Disclosure
- L1: Citations show excerpt + metadata
- L2: Actions show research trace details
- L3: (Future) Full documents from Reducto parse
- Users control depth, not overwhelmed by default

### 4. Continuity
- Smooth animations maintain perceptual continuity
- Entrance/exit transitions signal state changes
- No jarring replacements or pops

### 5. Escape Hatches
- Multiple ways to close drawer (overlay, X, Escape)
- Clear visual hierarchy (what's primary, what's auxiliary)
- Easy to return to main stream

## Accessibility

All components follow WCAG 2.1 AA standards with keyboard navigation, screen reader support, and proper focus management.
