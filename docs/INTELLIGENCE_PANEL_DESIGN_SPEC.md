# IntelligencePanel Design Specification

> Visual design system and perceptual engineering rationale for the IntelligencePanel UI

## Overview

The IntelligencePanel is a real-time streaming interface that surfaces contextual intelligence during template creation. It follows perceptual engineering principles to create a smooth, non-disruptive experience for information consumption.

---

## Visual Design System

### Category Color Mapping

Each intelligence category has a distinct color + icon pairing for instant recognition:

| Category | Color | Icon | Border Class | Use Case |
|----------|-------|------|--------------|----------|
| **News** | Cyan (`#3BC4B8`) | Newspaper | `border-l-cyan-500` | Breaking news, media coverage |
| **Legislative** | Blue (`#4F46E5`) | Gavel | `border-l-blue-500` | Bills, votes, committee activity |
| **Regulatory** | Purple (`#7C3AED`) | Scale | `border-l-purple-500` | Rules, agency actions, compliance |
| **Corporate** | Gray (`#64748B`) | Building2 | `border-l-slate-500` | Earnings, announcements, filings |
| **Social** | Green (`#10B981`) | Users | `border-l-green-500` | Public sentiment, trends, polls |

**Rationale:**
- **Cyan (News):** Fresh, current, fluid - matches the dynamic nature of news
- **Blue (Legislative):** Authority, stability - traditional government color
- **Purple (Regulatory):** Balance, judgment - evokes judicial/regulatory oversight
- **Gray (Corporate):** Neutral, professional - corporate/business aesthetic
- **Green (Social):** Growth, community - public movement and grassroots

---

## Relevance Score Visual Hierarchy

Intelligence items are visually weighted by their relevance score:

### High Relevance (≥ 0.8)
- **Prominence:** Full opacity, subtle emerald gradient accent on right edge
- **Badge:** `bg-emerald-100 text-emerald-700 border-emerald-300`
- **Behavior:** Appears at top of list, draws subtle attention
- **Use case:** Critical/timely information user should notice

### Medium Relevance (0.5 - 0.79)
- **Prominence:** Full opacity, standard display
- **Badge:** `bg-blue-100 text-blue-700 border-blue-300`
- **Behavior:** Normal list position
- **Use case:** Relevant information worth reviewing

### Low Relevance (< 0.5)
- **Prominence:** 70% opacity, standard display
- **Badge:** `bg-slate-100 text-slate-600 border-slate-300`
- **Behavior:** Muted but readable
- **Use case:** Contextual information, less critical

**Perceptual Rationale:**
- Opacity reduction is subtle enough to maintain readability
- High-relevance gradient is peripheral (doesn't interrupt reading flow)
- Badge color creates scannable pattern across the list

---

## Layout Structure

### Panel States

#### Expanded (Default)
```
┌─────────────────────────────────────────┐
│ ⚡ Issue Intelligence              [−] │  ← Header (always visible)
├─────────────────────────────────────────┤
│ [All] [News] [Legislative] [Corporate] │  ← Category filter
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ 📰 Senate Passes Climate Bill     │  │  ← Intelligence item
│  │ Washington Post • 2 hours ago  95%│  │
│  │ After months of negotiations...   │  │
│  │ [climate] [legislation]           │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ ⚖️ H.R. 2547: Clean Energy Tax   │  │
│  │ Congress.gov • 3 days ago     88% │  │
│  │ Introduces new tax incentives...  │  │
│  │ [renewable energy] [tax policy]   │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ... (scrollable, max-h-32rem)         │
│                                         │
└─────────────────────────────────────────┘
```

#### Collapsed
```
┌─────────────────────────────────────────┐
│ ⚡ Issue Intelligence          8   [+] │  ← Header only
└─────────────────────────────────────────┘
```

**Rationale:**
- Collapsed state preserves awareness (count visible)
- Expanded state has max-height to avoid pushing content down
- Internal scroll keeps panel contained

---

## Item Card Anatomy

```
┌────────────────────────────────────────────────────┐
│ ┃  ┌─┐                                    ┌────┐  │
│ ┃  │📰│  Senate Passes Landmark Climate   │ 95%│  │  ← Header row
│ ┃  └─┘   Bill with Bipartisan Support    └────┘  │     (icon + title + relevance)
│ ┃                                                  │
│ ┃  Washington Post • 2 hours ago                  │  ← Metadata scanline
│ ┃                                                  │
│ ┃  After months of negotiations, the Senate       │  ← Summary (truncated)
│ ┃  voted 68-32 to pass the Climate Action and...  │
│ ┃                                                  │
│ ┃  [Read more]                                    │  ← Expansion control
│ ┃                                                  │
│ ┃  [climate] [legislation] [senate]               │  ← Topic chips
│ ┃                                                  │
│ ┃  • US Senate  • Climate Action Act              │  ← Entity mentions
│ ┃                                                  │
└────────────────────────────────────────────────────┘
  ↑ 4px colored left border
```

**Visual Flow (top to bottom):**
1. **Pre-attentive:** Color border + icon register category in <100ms
2. **Primary:** Title read (bold, dark, largest text)
3. **Secondary:** Source + time context (smaller, gray)
4. **Tertiary:** Summary scan (normal weight, comfortable line height)
5. **Metadata:** Topics + entities for deeper context

---

## Animation Specifications

### Item Fade-In (Streaming)
- **Trigger:** New item added to list
- **Duration:** 300ms
- **Delay:** 50ms (prevents simultaneous burst)
- **Easing:** `cubic-bezier(0.4, 0, 0.2, 1)` (ease-out)
- **Properties:** `opacity: 0 → 1`

### Item Reorder (Flip)
- **Trigger:** Relevance sort or filter change
- **Duration:** 200ms
- **Easing:** Default flip easing
- **Properties:** Position transform

### Panel Expand/Collapse (Slide)
- **Trigger:** Header click
- **Duration:** 250ms
- **Easing:** `cubic-bezier(0.4, 0, 0.2, 1)`
- **Properties:** `max-height` via Svelte slide transition

### Hover Elevation
- **Trigger:** Mouse enter item
- **Duration:** 200ms
- **Easing:** `cubic-bezier(0.4, 0, 0.2, 1)`
- **Properties:**
  - `transform: translateY(-2px)`
  - `box-shadow: 0 4px 6px rgba(0,0,0,0.1)`

**Performance Notes:**
- All animations use CSS transforms (GPU-accelerated)
- No layout thrashing (no width/height animations)
- Opacity changes are optimized by browser compositing

---

## Typography Hierarchy

| Element | Font | Size | Weight | Color | Purpose |
|---------|------|------|--------|-------|---------|
| **Item Title** | Satoshi | 14px (0.875rem) | 600 (semibold) | `text-slate-900` | Primary content, most important |
| **Source Name** | Satoshi | 12px (0.75rem) | 500 (medium) | `text-slate-700` | Source credibility |
| **Time Ago** | Satoshi | 12px (0.75rem) | 400 (regular) | `text-slate-500` | Temporal context |
| **Summary** | Satoshi | 14px (0.875rem) | 400 (regular) | `text-slate-600` | Body content |
| **Topics** | Satoshi | 12px (0.75rem) | 400 (regular) | `text-slate-700` | Metadata tags |
| **Entities** | Satoshi | 12px (0.75rem) | 400 (regular) | `text-slate-500` | Secondary metadata |
| **Relevance Badge** | Satoshi | 12px (0.75rem) | 500 (medium) | (varies) | Importance signal |

**Line Heights:**
- Title: 1.25 (tight, multi-line)
- Summary: 1.6 (relaxed, readable)
- Metadata: 1.5 (standard)

---

## Spacing System

Based on 4px grid (Tailwind spacing scale):

- **Panel padding:** 16px (p-4)
- **Item spacing:** 12px gap (space-y-3)
- **Internal item padding:** 16px (p-4)
- **Header padding:** 12px vertical, 16px horizontal (py-3 px-4)
- **Topic chip spacing:** 6px gap (gap-1.5)
- **Section spacing:** 12px (space-y-3)

**Rationale:**
- Multiples of 4px create visual rhythm
- 12-16px provides comfortable breathing room
- Consistent spacing reduces cognitive load

---

## Accessibility Specifications

### Color Contrast

All text meets WCAG 2.1 AA standards:

| Element | Foreground | Background | Ratio | Standard |
|---------|-----------|------------|-------|----------|
| Title | `#111827` | `#FFFFFF` | 16.1:1 | AAA |
| Summary | `#475569` | `#FFFFFF` | 8.6:1 | AAA |
| Metadata | `#64748B` | `#FFFFFF` | 5.8:1 | AA |
| Badge text (high) | `#047857` | `#D1FAE5` | 4.7:1 | AA |
| Badge text (med) | `#1E40AF` | `#DBEAFE` | 4.9:1 | AA |

### Focus Indicators

- **Size:** 2px ring with 2px offset
- **Color:** `#4F46E5` (primary-500) at 50% opacity
- **Visibility:** Never removed (`outline: none` only with visible ring replacement)
- **Targets:** All interactive elements

### Keyboard Navigation

- **Tab order:** Logical (header → filter → items)
- **Item activation:** Enter or Space
- **Panel toggle:** Enter or Space on header
- **Category filter:** Arrow keys for navigation (optional enhancement)

### Screen Reader Support

- **Live region:** `aria-live="polite"` on items list
- **Busy state:** `aria-busy="true"` during streaming
- **Item count:** Announced via live region when changed
- **Descriptive labels:** Each item has contextual `aria-label`

---

## Responsive Behavior

### Desktop (≥1024px)
- Full 3-column category filter
- Max width: 400px (sidebar context)
- Max height: 32rem (512px)

### Tablet (768px - 1023px)
- 2-column category filter
- Max width: 100%
- Max height: 28rem (448px)

### Mobile (<768px)
- Horizontal scroll for category filter
- Max width: 100%
- Max height: 24rem (384px)
- Slightly reduced padding (12px → 16px)

---

## Performance Targets

- **Initial render:** <100ms
- **Streaming item add:** <50ms (per item)
- **Filter switch:** <100ms
- **Scroll performance:** Maintains 60fps
- **Animation smoothness:** No dropped frames

**Optimization strategies:**
- Virtual scrolling if item count >100
- Debounced scroll events (100ms)
- Memoized category counts
- CSS containment for item cards

---

## Dark Mode (Future)

Prepared color tokens for dark mode:

```css
@media (prefers-color-scheme: dark) {
  --surface-base: oklch(0.15 0.01 250);
  --text-primary: oklch(0.95 0.01 250);
  --text-secondary: oklch(0.75 0.01 250);
  /* Category colors maintain hue, adjust lightness */
}
```

---

## Inspiration & References

**Design patterns:**
- **Notion:** Smooth real-time sync indicators
- **Linear:** Category-coded issue labels
- **Stripe Dashboard:** Progressive loading states
- **Apple News:** Content card design

**Cognitive science:**
- **Pre-attentive processing:** Color + shape recognition <100ms (Treisman & Gelade, 1980)
- **Visual hierarchy:** F-pattern reading flow (Nielsen Norman Group)
- **Gestalt principles:** Proximity, similarity, continuity (Wertheimer, 1923)
- **Fitts's Law:** Most common action (All) is largest/first target

---

## Implementation Notes

### Component Files

- `IntelligencePanel.svelte` - Main container (collapsible, streaming)
- `IntelligenceItem.svelte` - Individual card (category-coded)
- `CategoryFilter.svelte` - Filter chips
- `IntelligenceSkeleton.svelte` - Loading placeholder

### Dependencies

- `date-fns` - Time formatting (formatDistanceToNow)
- `@lucide/svelte` - Icons
- `svelte/transition` - Fade, slide, flip animations
- `svelte/animate` - Flip animation

### Integration Points

- `intelligenceOrchestrator.stream()` - Real-time item source
- Template creator sidebar - Primary usage context
- Message source selector - Click-to-cite integration

---

## Testing Checklist

- [ ] Items stream smoothly without layout shift
- [ ] Category filter updates item display
- [ ] Relevance sorting is correct (high → low)
- [ ] Panel expands/collapses smoothly
- [ ] Click handler fires on item click
- [ ] Skeleton shows during loading
- [ ] Empty state appears when no items
- [ ] Keyboard navigation works
- [ ] Screen reader announces new items
- [ ] Focus indicators are visible
- [ ] Color contrast meets WCAG AA
- [ ] Mobile horizontal scroll works
- [ ] Long titles/summaries truncate correctly

---

## Version History

- **v1.0.0** (2026-01-31) - Initial implementation
  - Core panel with streaming support
  - Category filtering
  - Relevance-based visual hierarchy
  - Accessibility foundation

---

## License

Part of Communiqué - MIT License
