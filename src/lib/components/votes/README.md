# Legislative Vote UI Components

Progressive disclosure components for displaying congressional vote data following L1/L2/L3 information architecture.

## Design Philosophy

These components implement **perceptual engineering** principles:

- **L1 (VoteIndicator)**: Peripheral awareness through color-coded badges
- **L2 (VoteContext)**: Recognition card with 300ms hover delay for contextual preview
- **L3 (RollCall)**: Focal immersion with full filtering and sorting capabilities

### Color Semantics

The color system follows established political UI patterns and WCAG AA contrast requirements:

- **Green (Yea)**: Affirmative vote - consistent with success states
- **Red (Nay)**: Negative vote - consistent with rejection states
- **Gray (Not Voting)**: Neutral/inactive - low visual weight
- **Yellow (Present)**: Attention without commitment

### Party Colors

- **Blue**: Democratic (D)
- **Red**: Republican (R)
- **Purple**: Independent (I)

## Components

### VoteIndicator

**L1 peripheral awareness component** - minimal visual indicator for scanning dense information.

```svelte
<script>
  import { VoteIndicator } from '$lib/components/votes';
</script>

<!-- Compact dot indicator -->
<VoteIndicator position="yea" size="sm" />

<!-- With text label -->
<VoteIndicator position="nay" size="md" showLabel={true} />
```

**Props:**
- `position`: `'yea' | 'nay' | 'not_voting' | 'present'` (required)
- `size`: `'sm' | 'md'` (default: `'sm'`)
- `showLabel`: `boolean` (default: `false`)

**Accessibility:**
- Color is NOT the only indicator (includes text or dot shape)
- Full aria-label announces position to screen readers
- Semantic HTML with `role="status"`

---

### VoteContext

**L2 recognition card component** - hover preview with bill context and party breakdown.

```svelte
<script>
  import { VoteContext } from '$lib/components/votes';

  const vote = {
    billNumber: 'H.R. 1234',
    billTitle: 'Infrastructure Investment Act',
    voteDate: new Date('2024-03-15'),
    position: 'yea',
    result: 'passed',
    partyBreakdown: {
      democratic: { yea: 180, nay: 20 },
      republican: { yea: 50, nay: 150 }
    },
    summary: 'Voted in favor of $2T infrastructure package.'
  };
</script>

<VoteContext
  {vote}
  onViewFull={() => {
    // Navigate to L3 detail view
  }}
/>
```

**Props:**
- `vote`: `VoteRecord` object (required)
  - `billNumber`: string
  - `billTitle`: string
  - `voteDate`: Date
  - `position`: vote position
  - `result`: `'passed' | 'failed'`
  - `partyBreakdown`: object with party vote counts
  - `summary`: L1 summary text from backend
- `onViewFull`: optional callback for L3 navigation

**UX Timing:**
- 300ms hover delay (configured outside component)
- 200ms entry animation
- 150ms exit animation

**Features:**
- Bill metadata display
- Party breakdown bar charts
- Result status badge
- Progressive enhancement to L3

---

### RollCall

**L3 focal immersion component** - full roll call with filtering, sorting, and search.

```svelte
<script>
  import { RollCall } from '$lib/components/votes';

  const votes = [
    {
      member: {
        name: 'Nancy Pelosi',
        party: 'D',
        state: 'CA',
        district: '11'
      },
      position: 'yea'
    },
    // ... more votes
  ];
</script>

<RollCall
  billNumber="H.R. 1234"
  billTitle="Infrastructure Investment Act"
  voteDate={new Date('2024-03-15')}
  result="passed"
  {votes}
  rollCallUrl="https://www.congress.gov/roll-call/..."
  summary="L1 summary text"
  context="L2 context text"
/>
```

**Props:**
- `billNumber`: string (required)
- `billTitle`: string (required)
- `voteDate`: Date (required)
- `result`: `'passed' | 'failed'` (required)
- `votes`: `RollCallVote[]` (required)
  - Each vote has `member` (name, party, state, district) and `position`
- `rollCallUrl`: optional string - link to official congress.gov record
- `summary`: string - L1 summary text
- `context`: string - L2 context text

**Features:**
- **Search**: Filter members by name
- **Filters**: Party, position, state
- **Sorting**: Name, party, state (ascending/descending)
- **Sticky header**: Maintains context during scroll
- **Party-coded rows**: Subtle background colors for visual grouping
- **Vote totals**: Summary statistics at top
- **Responsive**: Works on mobile and desktop

**Accessibility:**
- Full keyboard navigation
- ARIA grid pattern for data table
- Sortable column headers with announcements
- Filter controls with proper labels
- Reduced motion support

---

## Integration with Backend

These components work seamlessly with the vote history API:

```svelte
<script lang="ts">
  import { VoteIndicator, VoteContext, RollCall } from '$lib/components/votes';
  import type { VoteWithDisclosure, MemberVoteHistory } from '$lib/server/congress';

  // Fetch from API
  let voteHistory: MemberVoteHistory;

  // Map backend types to component props
  const voteRecord = {
    billNumber: voteHistory.votes[0].rollCallId,
    billTitle: voteHistory.votes[0].billTitle,
    voteDate: voteHistory.votes[0].date,
    position: voteHistory.votes[0].vote,
    result: voteHistory.votes[0].result,
    partyBreakdown: {
      // Fetch party breakdown from additional API call
    },
    summary: voteHistory.votes[0].l1Summary
  };
</script>
```

**Backend Types:**
- `Vote` - Individual vote record
- `VoteWithDisclosure` - Vote with L1/L2/L3 summaries
- `MemberVoteHistory` - Complete vote history for a member
- `VoteStats` - Vote statistics

## Progressive Disclosure Pattern

The components follow a strict information hierarchy:

```
User Journey:
1. Scanning list → sees VoteIndicator (L1)
2. Hovers on item → sees VoteContext card (L2)
3. Clicks "View Full" → opens RollCall drawer/modal (L3)
```

**Timing:**
- L1: Instant (peripheral awareness)
- L2: 300ms delay (prevents accidental triggers)
- L3: On explicit user action (no timing)

**Information Density:**
- L1: Vote position only (color + icon)
- L2: Bill title, date, result, party breakdown, summary
- L3: All member votes, filtering, sorting, full metadata

## Example: Complete Integration

```svelte
<script lang="ts">
  import { VoteIndicator, VoteContext, RollCall } from '$lib/components/votes';
  import { UnifiedModal } from '$lib/components/ui';

  let showHoverCard = $state(false);
  let showFullRollCall = $state(false);
  let hoverTimeout: ReturnType<typeof setTimeout>;

  const vote = {
    // ... vote data
  };

  function handleMouseEnter() {
    // 300ms delay for L2
    hoverTimeout = setTimeout(() => {
      showHoverCard = true;
    }, 300);
  }

  function handleMouseLeave() {
    clearTimeout(hoverTimeout);
    showHoverCard = false;
  }

  function handleViewFull() {
    showHoverCard = false;
    showFullRollCall = true;
  }
</script>

<!-- L1: In a list item -->
<div
  role="button"
  tabindex="0"
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
>
  <VoteIndicator position={vote.position} size="sm" />
  <span>H.R. 1234 - Infrastructure Act</span>

  <!-- L2: Hover card -->
  {#if showHoverCard}
    <VoteContext {vote} onViewFull={handleViewFull} />
  {/if}
</div>

<!-- L3: Full roll call in modal -->
{#if showFullRollCall}
  <UnifiedModal onClose={() => showFullRollCall = false}>
    <RollCall
      billNumber={vote.billNumber}
      billTitle={vote.billTitle}
      voteDate={vote.voteDate}
      result={vote.result}
      votes={allMemberVotes}
      rollCallUrl={vote.l3RollCallUrl}
      summary={vote.summary}
      context={vote.l2Summary}
    />
  </UnifiedModal>
{/if}
```

## Accessibility Checklist

- ✅ WCAG AA contrast ratios (4.5:1 for normal text)
- ✅ Color is NOT the only differentiator (text labels + icons)
- ✅ Keyboard navigation support
- ✅ Screen reader announcements (ARIA labels)
- ✅ Focus indicators on interactive elements
- ✅ Reduced motion support (`motion-reduce:transition-none`)
- ✅ Semantic HTML (`<time>`, `role="status"`, etc.)
- ✅ Progressive enhancement (works without JS for core reading)

## Performance Considerations

- Components are lightweight (no external dependencies except Svelte)
- Derived values use `$derived.by()` for efficient reactivity
- Animations respect `prefers-reduced-motion`
- Large roll call tables use virtual scrolling (sticky header)
- Party breakdown charts use CSS transforms (GPU-accelerated)

## Design Tokens

If you need to customize colors, these Tailwind classes are used:

**Vote Positions:**
- Yea: `bg-emerald-50 text-emerald-700 border-emerald-300`
- Nay: `bg-red-50 text-red-700 border-red-300`
- Not Voting: `bg-gray-50 text-gray-600 border-gray-200`
- Present: `bg-amber-50 text-amber-700 border-amber-300`

**Party Colors:**
- Democratic: `text-blue-700 bg-blue-50`
- Republican: `text-red-700 bg-red-50`
- Independent: `text-purple-700 bg-purple-50`

**Focus Rings:**
- `focus:ring-2 focus:ring-congressional-500 focus:ring-offset-2`

---

## Testing

**Manual Testing:**
1. Test with keyboard only (Tab, Enter, Space)
2. Test with screen reader (VoiceOver, NVDA, JAWS)
3. Test with reduced motion enabled
4. Test with high contrast mode
5. Test responsive breakpoints

**Edge Cases:**
- Empty vote arrays
- Very long bill titles
- Members without districts (senators)
- Filtering that returns no results
- Sorting with identical values

---

## Future Enhancements

- [ ] Virtual scrolling for 400+ member roll calls
- [ ] Export roll call as CSV
- [ ] Member vote history comparison
- [ ] Vote prediction based on historical patterns
- [ ] Share roll call link with filters applied
