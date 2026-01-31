# TargetTypeSelector Component

A perceptually-engineered UI component for selecting decision-maker target types in Communiqué.

## Overview

The `TargetTypeSelector` implements a two-tier selection interface that balances discoverability with cognitive load reduction. Government targets (the most common use case) are always visible, while organization targets are collapsible to reduce visual noise.

## Design Principles

### Perceptual Engineering

1. **Visual Hierarchy** - Two-tier structure (Government primary, Organizations secondary)
2. **Color Coding** - Distinct color palettes create instant recognition patterns:
   - Blue: Government (authority, trust)
   - Gray: Corporate (professional)
   - Green: Nonprofit (impact, mission)
   - Purple: Education (knowledge)
   - Red: Healthcare (care, urgency)
   - Orange: Labor (solidarity)
   - Cyan: Media (information)

3. **Progressive Disclosure** - Entity input appears only when selecting organization targets
4. **Gestalt Grouping** - Related items are spatially clustered
5. **Clear Affordances** - Hover states, smooth transitions, visual feedback

### Cognitive Load Reduction

- Government targets always visible (most common path)
- Organizations fold away to reduce initial visual noise
- Icons enable pre-attentive processing
- Color patterns support parallel processing
- Progressive disclosure prevents overwhelming the user

### Accessibility

- Full keyboard navigation (Tab, Enter, Escape)
- ARIA attributes for screen readers (`aria-pressed`, `aria-expanded`, `aria-disabled`)
- Focus-visible rings for keyboard users
- Touch-friendly 44px minimum target size
- Semantic HTML structure

## Components

### TargetTypeSelector

Main component for target type and entity selection.

**Props:**
- `selected` (bindable): `DecisionMakerTargetType | null` - Currently selected target type
- `entity` (bindable): `string` - Entity name for organization targets
- `disabled`: `boolean` - Disable all interactions (default: false)
- `onselect`: `(type: DecisionMakerTargetType) => void` - Selection callback
- `onentitychange`: `(entity: string) => void` - Entity change callback

**Example:**
```svelte
<script lang="ts">
  import { TargetTypeSelector } from '$lib/components/targets';
  import type { DecisionMakerTargetType } from '$lib/core/agents/providers/types';

  let targetType = $state<DecisionMakerTargetType | null>(null);
  let entity = $state('');
</script>

<TargetTypeSelector
  bind:selected={targetType}
  bind:entity={entity}
  onselect={(type) => console.log('Selected:', type)}
  onentitychange={(val) => console.log('Entity:', val)}
/>
```

### TargetCard

Individual target type card (used internally by TargetTypeSelector).

**Props:**
- `label`: `string` - Display label
- `description`: `string` - Short description
- `icon`: `ComponentType<IconProps>` - Lucide icon component
- `selected`: `boolean` - Selected state
- `disabled`: `boolean` - Disabled state
- `colorScheme`: Color palette identifier
- `onclick`: `() => void` - Click handler

## Target Types

```typescript
type DecisionMakerTargetType =
  | 'congress'           // US Congress (federal)
  | 'state_legislature'  // State legislators
  | 'local_government'   // City, county, school boards
  | 'corporate'          // Companies (requires entity)
  | 'nonprofit'          // NGOs, foundations (requires entity)
  | 'education'          // Universities, schools (requires entity)
  | 'healthcare'         // Hospitals, health systems (requires entity)
  | 'labor'              // Labor unions (requires entity)
  | 'media';             // News organizations (requires entity)
```

## Icon Mapping

- **congress**: `Building2` (federal building)
- **state_legislature**: `Landmark` (state capitol)
- **local_government**: `MapPin` (local location)
- **corporate**: `Building` (office building)
- **nonprofit**: `Heart` (mission-driven)
- **education**: `GraduationCap` (learning)
- **healthcare**: `Stethoscope` (medical care)
- **labor**: `HardHat` (workers)
- **media**: `Newspaper` (journalism)

## Responsive Behavior

```css
/* Desktop: 3 columns */
grid-template-columns: repeat(3, minmax(0, 1fr));

/* Tablet (< 640px): 2 columns */
@media (max-width: 640px) {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

/* Mobile (< 400px): 1 column */
@media (max-width: 400px) {
  grid-template-columns: 1fr;
}
```

## Integration Points

### Template Creator Flow

```svelte
<!-- In TemplateCreator.svelte -->
<script lang="ts">
  import { TargetTypeSelector } from '$lib/components/targets';

  let targetType = $state<DecisionMakerTargetType | null>(null);
  let targetEntity = $state('');

  // Pass to DecisionMakerResolver
  const resolveContext = {
    targetType,
    targetEntity,
    // ... other context
  };
</script>

<section>
  <h2>Who should receive this message?</h2>
  <TargetTypeSelector
    bind:selected={targetType}
    bind:entity={targetEntity}
  />
</section>
```

### Decision Maker Router

```typescript
// The router uses targetType to select the appropriate provider
import { decisionMakerRouter } from '$lib/core/agents/decision-maker-router';

const result = await decisionMakerRouter.resolve({
  targetType,      // From TargetTypeSelector
  targetEntity,    // From TargetTypeSelector entity input
  subjectLine,
  coreMessage,
  topics,
  // ...
});
```

## Color Scheme Reference

Each target type has a dedicated color scheme for instant recognition:

```typescript
const colorSchemes = {
  blue: {   // Government (authority, trust)
    base: 'bg-blue-50 border-blue-200 text-blue-700',
    hover: 'hover:bg-blue-100 hover:border-blue-300',
    selected: 'border-blue-500 bg-blue-100 shadow-md ring-2 ring-blue-500/20',
    icon: 'text-blue-600'
  },
  gray: {   // Corporate (professional)
    // ...
  },
  // ... other color schemes
};
```

## Testing

Visit `/demo/target-selector` to see the component in action with:
- Live state display
- Selection history
- Interactive controls (disable, reset)
- Design principles documentation
- Usage examples

## Accessibility Checklist

- [x] Keyboard navigation (Tab, Enter, Space)
- [x] Screen reader support (ARIA attributes)
- [x] Focus-visible indicators
- [x] Touch-friendly targets (44px min)
- [x] Color contrast (WCAG AA)
- [x] Semantic HTML structure
- [x] Disabled state handling

## Future Enhancements

1. **Search/Filter** - For organizations, add search to quickly find specific sectors
2. **Recent Selections** - Show recently used target types for quick access
3. **Tooltips** - Add hover tooltips with more context about each target type
4. **Keyboard Shortcuts** - Add number keys (1-9) for quick selection
5. **Analytics** - Track which target types are most commonly selected

## Files

- `/src/lib/components/targets/TargetTypeSelector.svelte` - Main component
- `/src/lib/components/targets/TargetCard.svelte` - Individual card component
- `/src/lib/components/targets/index.ts` - Public exports
- `/src/lib/components/targets/README.md` - This file
- `/src/routes/demo/target-selector/+page.svelte` - Demo page

## Dependencies

- `@lucide/svelte` - Icon components
- `svelte/transition` - Slide/fade animations
- Tailwind CSS - Styling utilities
- Communiqué design tokens - Color palette, spacing

## Related

- `/src/lib/core/agents/providers/types.ts` - Type definitions
- `/src/lib/core/agents/decision-maker-router.ts` - Provider routing
- `/docs/FIRECRAWL_MONGODB_IMPLEMENTATION_PLAN.md` - Architecture docs
