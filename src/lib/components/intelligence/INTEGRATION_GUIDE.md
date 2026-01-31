# IntelligencePanel Integration Guide

> Quick-start guide for integrating IntelligencePanel into the template creator

## Quick Start (5 minutes)

### Step 1: Import the Component

```svelte
<script lang="ts">
  import { IntelligencePanel } from '$lib/components/intelligence';
  import { intelligenceOrchestrator } from '$lib/core/intelligence';
  import type { IntelligenceItem } from '$lib/core/intelligence/types';
</script>
```

### Step 2: Add State Management

```svelte
<script lang="ts">
  // Intelligence state
  let intelligenceItems = $state<IntelligenceItem[]>([]);
  let streamingIntelligence = $state(false);
  let intelligenceExpanded = $state(true);
</script>
```

### Step 3: Create Streaming Function

```svelte
<script lang="ts">
  async function fetchIntelligence(topics: string[]) {
    if (topics.length === 0) return;

    streamingIntelligence = true;
    intelligenceItems = [];

    const query = {
      topics,
      targetType: selectedTargetType, // From your form state
      timeframe: 'week' as const      // Or make configurable
    };

    try {
      for await (const item of intelligenceOrchestrator.stream(query)) {
        intelligenceItems = [item, ...intelligenceItems].slice(0, 20);
      }
    } catch (error) {
      console.error('Intelligence streaming error:', error);
      // Optional: Show error toast
    } finally {
      streamingIntelligence = false;
    }
  }

  function handleIntelligenceClick(item: IntelligenceItem) {
    // Add item as a source citation
    selectedSources = [
      ...selectedSources,
      {
        url: item.sourceUrl,
        title: item.title,
        snippet: item.summary
      }
    ];
  }
</script>
```

### Step 4: Add to Layout

```svelte
<div class="template-creator grid grid-cols-[1fr_400px] gap-6">
  <!-- Main editor column -->
  <div class="editor-panel space-y-6">
    <!-- Your existing template fields -->
  </div>

  <!-- Intelligence sidebar -->
  <aside class="intelligence-sidebar">
    <IntelligencePanel
      items={intelligenceItems}
      streaming={streamingIntelligence}
      bind:expanded={intelligenceExpanded}
      maxItems={20}
      onitemclick={handleIntelligenceClick}
    />
  </aside>
</div>
```

### Step 5: Trigger Streaming

Call `fetchIntelligence()` when topics change:

```svelte
<script lang="ts">
  // Watch for topic changes
  $effect(() => {
    if (topicsInput.length > 0) {
      const topicsArray = topicsInput.split(',').map(t => t.trim());
      fetchIntelligence(topicsArray);
    }
  });
</script>
```

---

## Advanced Integration

### Debounced Streaming

Avoid fetching on every keystroke:

```svelte
<script lang="ts">
  import { debounce } from '$lib/utils/debounce';

  const debouncedFetch = debounce((topics: string[]) => {
    fetchIntelligence(topics);
  }, 500); // 500ms delay

  $effect(() => {
    if (topicsInput.length > 0) {
      const topicsArray = topicsInput.split(',').map(t => t.trim());
      debouncedFetch(topicsArray);
    }
  });
</script>
```

### Cache Management

Avoid re-fetching for same topics:

```svelte
<script lang="ts">
  let lastQuery = '';

  async function fetchIntelligence(topics: string[]) {
    const queryKey = topics.sort().join('|');

    // Skip if same query
    if (queryKey === lastQuery) return;
    lastQuery = queryKey;

    // ... rest of fetch logic
  }
</script>
```

### Error Handling

Show user-friendly errors:

```svelte
<script lang="ts">
  import { toast } from '$lib/components/ui/toast';

  async function fetchIntelligence(topics: string[]) {
    try {
      // ... streaming logic
    } catch (error) {
      console.error('Intelligence fetch failed:', error);

      toast.error('Failed to load intelligence', {
        description: 'We couldn\'t fetch the latest information. Try again?'
      });

      intelligenceItems = [];
    } finally {
      streamingIntelligence = false;
    }
  }
</script>
```

### Source Citation Integration

Full example with source tracking:

```svelte
<script lang="ts">
  interface Source {
    url: string;
    title: string;
    snippet: string;
    category?: string;
    addedAt: Date;
  }

  let selectedSources = $state<Source[]>([]);

  function handleIntelligenceClick(item: IntelligenceItem) {
    // Check if already added
    if (selectedSources.some(s => s.url === item.sourceUrl)) {
      toast.info('Source already added');
      return;
    }

    // Add to sources
    selectedSources = [
      ...selectedSources,
      {
        url: item.sourceUrl,
        title: item.title,
        snippet: item.summary,
        category: item.category,
        addedAt: new Date()
      }
    ];

    toast.success('Source added', {
      description: item.title
    });
  }

  function removeSource(url: string) {
    selectedSources = selectedSources.filter(s => s.url !== url);
  }
</script>

<!-- Display selected sources -->
<div class="selected-sources space-y-2">
  <h3 class="text-sm font-semibold text-slate-700">Sources ({selectedSources.length})</h3>
  {#each selectedSources as source}
    <div class="source-item flex items-center justify-between p-2 bg-slate-50 rounded">
      <span class="text-sm text-slate-700 truncate">{source.title}</span>
      <button
        onclick={() => removeSource(source.url)}
        class="text-slate-400 hover:text-red-600 transition-colors"
      >
        <XIcon class="h-4 w-4" />
      </button>
    </div>
  {/each}
</div>
```

---

## Layout Variations

### Sidebar (Recommended)

```svelte
<div class="grid grid-cols-[1fr_400px] gap-6">
  <main><!-- Editor --></main>
  <aside><IntelligencePanel {...props} /></aside>
</div>
```

### Bottom Panel

```svelte
<div class="flex flex-col h-screen">
  <main class="flex-1 overflow-auto"><!-- Editor --></main>
  <div class="border-t">
    <IntelligencePanel {...props} />
  </div>
</div>
```

### Modal/Overlay

```svelte
{#if showIntelligence}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
    <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
      <IntelligencePanel {...props} />
    </div>
  </div>
{/if}
```

---

## Responsive Layouts

### Desktop-First (Sidebar)

```svelte
<div class="grid gap-6
  grid-cols-1
  lg:grid-cols-[1fr_400px]">
  <main><!-- Editor --></main>
  <aside class="lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
    <IntelligencePanel {...props} />
  </aside>
</div>
```

### Mobile-Optimized (Tabs)

```svelte
<div class="mobile-layout">
  <div class="tabs">
    <button onclick={() => activeTab = 'editor'}>Editor</button>
    <button onclick={() => activeTab = 'intelligence'}>Intelligence</button>
  </div>

  {#if activeTab === 'editor'}
    <main><!-- Editor --></main>
  {:else}
    <IntelligencePanel {...props} />
  {/if}
</div>
```

---

## Performance Optimization

### Virtual Scrolling (For >100 items)

```svelte
<script lang="ts">
  import VirtualList from 'svelte-virtual-list';
  import { IntelligenceItem as ItemCard } from '$lib/components/intelligence';

  // In IntelligencePanel.svelte (custom fork)
</script>

<VirtualList items={sortedItems} let:item>
  <ItemCard {item} onclick={handleItemClick} />
</VirtualList>
```

### Memoization

```svelte
<script lang="ts">
  // Memoize category counts (computed only when items change)
  const categoryCounts = $derived.by(() => {
    return items.reduce((acc, item) => {
      const existing = acc.find(c => c.category === item.category);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ category: item.category, count: 1 });
      }
      return acc;
    }, [] as Array<{ category: IntelligenceCategory; count: number }>);
  });
</script>
```

---

## Accessibility Integration

### Focus Management

When opening intelligence panel, move focus:

```svelte
<script lang="ts">
  import { tick } from 'svelte';

  let panelRef: HTMLElement;

  async function openIntelligence() {
    intelligenceExpanded = true;
    await tick();
    panelRef?.focus();
  }
</script>

<aside bind:this={panelRef} tabindex="-1">
  <IntelligencePanel {...props} />
</aside>
```

### Skip Link

Add skip link for keyboard users:

```svelte
<div class="template-creator">
  <a
    href="#main-editor"
    class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4
      bg-white px-4 py-2 rounded shadow-lg z-50"
  >
    Skip to editor
  </a>

  <main id="main-editor"><!-- Editor --></main>
  <aside><IntelligencePanel {...props} /></aside>
</div>
```

---

## Testing Integration

### Component Test

```typescript
import { render, fireEvent } from '@testing-library/svelte';
import IntelligencePanel from './IntelligencePanel.svelte';

test('streams items and shows them', async () => {
  const mockItems = [
    { id: '1', title: 'Test Item', category: 'news', /* ... */ }
  ];

  const { getByText, rerender } = render(IntelligencePanel, {
    items: [],
    streaming: true
  });

  // Initially empty
  expect(getByText('Researching...')).toBeInTheDocument();

  // Update with items
  await rerender({ items: mockItems, streaming: false });

  expect(getByText('Test Item')).toBeInTheDocument();
});
```

### Integration Test

```typescript
test('template creator with intelligence', async () => {
  const { getByLabelText, getByText } = render(TemplateCreator);

  // Enter topics
  const topicsInput = getByLabelText('Topics');
  await fireEvent.input(topicsInput, { target: { value: 'climate change' } });

  // Wait for intelligence to stream
  await waitFor(() => {
    expect(getByText('Issue Intelligence')).toBeInTheDocument();
  });

  // Click an item
  const item = getByText(/Senate Passes/);
  await fireEvent.click(item);

  // Verify source added
  expect(getByText('Sources (1)')).toBeInTheDocument();
});
```

---

## Troubleshooting

### Items Not Appearing

**Problem:** Panel shows "No intelligence found" but items should exist.

**Solutions:**
1. Check `items` prop is bound correctly: `{items}`
2. Verify items have all required fields (id, title, category, etc.)
3. Check browser console for errors
4. Ensure `streaming` is set to `false` after fetch completes

### Streaming Never Stops

**Problem:** Streaming indicator keeps spinning.

**Solutions:**
1. Add `finally` block to ensure `streaming = false`:
   ```svelte
   try {
     // ... streaming
   } catch (error) {
     // ... error handling
   } finally {
     streamingIntelligence = false; // Always runs
   }
   ```
2. Check for infinite loops in streaming logic
3. Add timeout to streaming:
   ```svelte
   const timeout = setTimeout(() => {
     streamingIntelligence = false;
   }, 30000); // 30s max
   ```

### Category Filter Not Working

**Problem:** Clicking category chips doesn't filter items.

**Solutions:**
1. Ensure `selected` is bound: `bind:selected={selectedCategory}`
2. Check filtering logic uses correct category value
3. Verify category enum matches types: `'news' | 'legislative' | ...`

### Layout Shift Issues

**Problem:** Panel causes page to jump when opening.

**Solutions:**
1. Use sticky positioning:
   ```svelte
   <aside class="sticky top-6 h-[calc(100vh-3rem)]">
     <IntelligencePanel {...props} />
   </aside>
   ```
2. Set max-height to prevent overflow
3. Use fixed width for sidebar: `w-96` or `w-[400px]`

---

## Configuration Options

### Custom Timeframes

```svelte
<script lang="ts">
  let timeframe = $state<'day' | 'week' | 'month'>('week');

  async function fetchIntelligence(topics: string[]) {
    const query = { topics, timeframe };
    // ... streaming
  }
</script>

<select bind:value={timeframe}>
  <option value="day">Last 24 hours</option>
  <option value="week">Past week</option>
  <option value="month">Past month</option>
</select>
```

### Category Filtering

```svelte
<script lang="ts">
  let enabledCategories = $state<IntelligenceCategory[]>([
    'news',
    'legislative'
  ]);

  async function fetchIntelligence(topics: string[]) {
    const query = {
      topics,
      categories: enabledCategories
    };
    // ... streaming
  }
</script>
```

### Max Items

```svelte
<IntelligencePanel
  items={intelligenceItems}
  streaming={streamingIntelligence}
  maxItems={10}  <!-- Show fewer items -->
/>
```

---

## Next Steps

1. ✅ Copy code examples above into your template creator
2. ✅ Test streaming with real topics
3. ✅ Wire up source citation system
4. ✅ Test accessibility with keyboard navigation
5. ✅ Add error handling and loading states
6. ✅ Deploy and gather user feedback

---

## Support

- **Component Docs:** `/src/lib/components/intelligence/README.md`
- **Design Spec:** `/docs/INTELLIGENCE_PANEL_DESIGN_SPEC.md`
- **Demo Page:** `/demo/intelligence`
- **Type Definitions:** `/src/lib/core/intelligence/types.ts`

---

**Happy integrating!** 🚀
