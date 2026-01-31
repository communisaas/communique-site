# IntelligencePanel Components

Real-time streaming intelligence components for Communiqué template creation.

## Overview

The IntelligencePanel system provides contextual intelligence (news, legislative activity, corporate announcements) during template creation. Built with perceptual engineering principles for optimal real-time information streaming UX.

## Components

### IntelligencePanel (Main Container)

Primary component that orchestrates the intelligence display.

```svelte
<script>
  import { IntelligencePanel } from '$lib/components/intelligence';
  import type { IntelligenceItem } from '$lib/core/intelligence/types';

  let items = $state<IntelligenceItem[]>([]);
  let streaming = $state(false);

  async function startStreaming() {
    streaming = true;
    items = [];

    // Stream from orchestrator
    for await (const item of intelligenceOrchestrator.stream(query)) {
      items = [item, ...items];
    }

    streaming = false;
  }
</script>

<IntelligencePanel
  {items}
  {streaming}
  maxItems={20}
  onitemclick={(item) => handleClick(item)}
/>
```

**Props:**
- `items?: IntelligenceItem[]` - Array of intelligence items to display
- `streaming?: boolean` - Whether items are currently being fetched
- `expanded?: boolean` - Panel expansion state (bindable)
- `maxItems?: number` - Maximum items to display (default: 20)
- `onitemclick?: (item: IntelligenceItem) => void` - Click handler for items

**Features:**
- Collapsible design to respect screen real estate
- Category filtering with visual chips
- Relevance-based sorting (high to low)
- Smooth streaming animations
- Skeleton loading states
- ARIA live regions for accessibility
- Max height with internal scroll

---

### IntelligenceItem

Individual intelligence card with category-coded visual design.

```svelte
<IntelligenceItemCard
  {item}
  onclick={(item) => console.log('Clicked:', item)}
/>
```

**Props:**
- `item: IntelligenceItem` - Intelligence item data
- `onclick?: (item: IntelligenceItem) => void` - Click handler (defaults to opening URL in new tab)

**Visual Design:**
- **Category indicator:** Colored left border (4px) + icon
  - `news`: Cyan + Newspaper icon
  - `legislative`: Blue + Gavel icon
  - `regulatory`: Purple + Scale icon
  - `corporate`: Gray + Building icon
  - `social`: Green + Users icon
- **Relevance badge:** Color-coded percentage (≥80% = emerald, ≥50% = blue, <50% = gray)
- **Metadata scanline:** Source • Time ago
- **Progressive disclosure:** Summary truncation with "Read more" expansion
- **Topics:** Chip display (max 4 shown)
- **Entities:** Subtle mention list

**Relevance-based prominence:**
- `≥0.8`: Gradient accent stripe, full opacity
- `≥0.5`: Normal display
- `<0.5`: Reduced opacity (70%)

---

### CategoryFilter

Category selection chips for filtering intelligence.

```svelte
<CategoryFilter
  categories={[
    { category: 'news', count: 5 },
    { category: 'legislative', count: 2 }
  ]}
  bind:selected={selectedCategory}
/>
```

**Props:**
- `categories: Array<{ category: IntelligenceCategory; count: number }>` - Available categories with counts
- `selected: IntelligenceCategory | 'all'` - Currently selected category (bindable)
- `onselect?: (category: IntelligenceCategory | 'all') => void` - Selection handler

**Features:**
- Color-coded chips matching item categories
- Count badges show items per category
- "All" button always first (Fitts's law optimization)
- Horizontal scroll on mobile

---

### IntelligenceSkeleton

Loading skeleton placeholder for streaming states.

```svelte
<IntelligenceSkeleton count={3} />
```

**Props:**
- `count?: number` - Number of skeleton items to show (default: 3)

**Features:**
- Mimics actual card structure to prevent layout shift
- Randomized widths for organic appearance
- Pulse animation (1.5s cycle)
- Cascading animation delay

---

## Perceptual Engineering Principles

### 1. Temporal Awareness
New items fade in smoothly without jarring the user. Layout shifts are minimized through skeleton states.

### 2. Visual Hierarchy
- Relevance score determines prominence (not just recency)
- Category colors enable pre-attentive processing
- Title → Metadata → Summary → Topics (decreasing visual weight)

### 3. Category Distinction
- Color-coded left borders (4px) create instant recognition
- Icon + color pairing enables sub-100ms categorization
- Consistent color mapping across filter chips and items

### 4. Progressive Loading
- Skeleton placeholders reduce perceived latency
- Items stream in as available (no "all or nothing" loading)
- Smooth transitions signal state changes

### 5. Attention Management
- High-relevance items (≥0.8) have subtle gradient accent
- Low-relevance items (<0.5) are muted but still readable
- Streaming indicator pulses without interrupting focus

---

## Integration Example

### Template Creation Flow

```svelte
<script lang="ts">
  import { IntelligencePanel } from '$lib/components/intelligence';
  import { intelligenceOrchestrator } from '$lib/core/intelligence';
  import type { IntelligenceItem } from '$lib/core/intelligence/types';

  let intelligenceItems = $state<IntelligenceItem[]>([]);
  let streamingIntelligence = $state(false);

  // When user enters topics
  async function onTopicsChange(topics: string[]) {
    streamingIntelligence = true;
    intelligenceItems = [];

    const query = {
      topics,
      targetType: selectedTargetType,
      timeframe: 'week'
    };

    try {
      for await (const item of intelligenceOrchestrator.stream(query)) {
        intelligenceItems = [item, ...intelligenceItems].slice(0, 20);
      }
    } catch (error) {
      console.error('Intelligence streaming error:', error);
    } finally {
      streamingIntelligence = false;
    }
  }

  function handleIntelligenceClick(item: IntelligenceItem) {
    // Add as source citation
    selectedSources = [...selectedSources, {
      url: item.sourceUrl,
      title: item.title,
      snippet: item.summary
    }];
  }
</script>

<div class="template-creator grid grid-cols-[1fr_400px] gap-6">
  <!-- Main editor -->
  <div class="editor-panel">
    <!-- Template fields -->
  </div>

  <!-- Intelligence sidebar -->
  <aside class="intelligence-sidebar">
    <IntelligencePanel
      items={intelligenceItems}
      streaming={streamingIntelligence}
      onitemclick={handleIntelligenceClick}
    />
  </aside>
</div>
```

---

## Accessibility

### Keyboard Navigation
- **Tab**: Navigate between items
- **Enter/Space**: Activate item (open URL or trigger onclick)
- **Escape**: Collapse panel (when focused on header)

### Screen Reader Support
- ARIA live region (`aria-live="polite"`) announces new items as they stream
- Item count updates announced via live region
- Category filter uses `role="tablist"` with proper ARIA states
- Each item has descriptive `aria-label`

### Focus Management
- Focus ring on all interactive elements (2px, primary color)
- Skip to content when panel expanded
- Visible focus indicators (never removed)

---

## Performance Considerations

### Deduplication
Items are deduplicated by `sourceUrl` in the orchestrator. If the same article appears from multiple providers, only the first is shown.

### Virtual Scrolling
Not currently implemented, but can be added via `svelte-virtual-list` if item counts exceed 100.

### Animation Performance
- CSS transforms (not position/size changes) for smooth 60fps
- `will-change` hints for animated properties
- Debounced scroll events

---

## Styling Customization

Components use Tailwind classes with design system tokens:

```css
/* Category colors */
--coord-route: #3BC4B8 (cyan/teal)
--coord-share: #4F46E5 (blue/indigo)
--coord-verified: #10B981 (green/emerald)

/* Participation colors */
--participation-primary-500: #6366F1 (indigo)
--participation-primary-600: #4F46E5 (indigo-600)
```

Override via CSS custom properties or Tailwind config.

---

## Demo Page

Visit `/demo/intelligence` to see the component in action with simulated streaming.

**Features demonstrated:**
- Real-time item streaming
- Category filtering
- Relevance sorting
- Expand/collapse behavior
- Skeleton loading states
- Click handling

---

## Type Definitions

See `$lib/core/intelligence/types.ts` for full type documentation.

**Key types:**
```typescript
interface IntelligenceItem {
  id: string;
  category: 'news' | 'legislative' | 'regulatory' | 'corporate' | 'social';
  title: string;
  summary: string;
  sourceUrl: string;
  sourceName: string;
  publishedAt: Date;
  relevanceScore: number; // 0-1
  topics: string[];
  entities: Array<{ name: string; type: string }>;
  sentiment?: 'positive' | 'negative' | 'neutral' | 'mixed';
}
```

---

## Future Enhancements

1. **Semantic grouping:** Cluster related items (same event, different sources)
2. **Trend indicators:** Rising/declining attention signals
3. **Source diversity:** Ensure mix of left/center/right sources
4. **Citation builder:** One-click add to message sources
5. **Saved searches:** Remember queries for future templates
6. **Export:** Download intelligence as PDF/JSON

---

## Related Components

- **TargetTypeSelector** (`$lib/components/targets/`) - Target selection with entity input
- **VerifiedSourcesList** - Source citation display in templates

---

## Troubleshooting

### Items not appearing
1. Check `streaming` prop is true during fetch
2. Verify items array is being updated
3. Check browser console for errors
4. Ensure `date-fns` is installed

### Skeleton stuck showing
1. Ensure `streaming` is set to `false` after fetch completes
2. Check if items array is empty (empty state should show)

### Category filter not working
1. Verify `categories` array has correct structure
2. Check `selected` is bound correctly
3. Ensure `IntelligenceCategory` type matches

---

## License

Part of Communiqué - MIT License
