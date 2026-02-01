# Vote Components - Usage Examples

Complete examples for integrating the L1/L2/L3 vote components into your application.

## File Structure

```
src/lib/components/votes/
├── index.ts                 # Main export file
├── types.ts                 # TypeScript type definitions
├── VoteIndicator.svelte     # L1: Peripheral badge
├── VoteContext.svelte       # L2: Hover preview card
├── RollCall.svelte          # L3: Full roll call table
├── README.md                # Component documentation
└── USAGE_EXAMPLES.md        # This file
```

## Example 1: Simple Vote List (L1 only)

Display a list of recent votes with just the indicator badge:

```svelte
<script lang="ts">
  import { VoteIndicator } from '$lib/components/votes';
  import type { VoteWithDisclosure } from '$lib/server/congress';

  interface Props {
    votes: VoteWithDisclosure[];
  }

  let { votes }: Props = $props();
</script>

<div class="space-y-2">
  {#each votes as vote}
    <div class="flex items-center gap-3 rounded-lg border border-gray-200 p-3">
      <VoteIndicator position={vote.vote} size="sm" />
      <div class="min-w-0 flex-1">
        <div class="text-sm font-medium text-gray-900">{vote.billTitle}</div>
        <div class="text-xs text-gray-600">{vote.l1Summary}</div>
      </div>
    </div>
  {/each}
</div>
```

## Example 2: Vote List with Hover Preview (L1 + L2)

Show VoteContext on hover with proper timing:

```svelte
<script lang="ts">
  import { VoteIndicator, VoteContext } from '$lib/components/votes';
  import type { VoteWithDisclosure } from '$lib/server/congress';
  import type { VoteRecord } from '$lib/components/votes';

  interface Props {
    votes: VoteWithDisclosure[];
  }

  let { votes }: Props = $props();

  let hoveredVoteId = $state<string | null>(null);
  let hoverTimeout: ReturnType<typeof setTimeout>;

  function handleMouseEnter(voteId: string) {
    // 300ms delay for perceptual engineering
    hoverTimeout = setTimeout(() => {
      hoveredVoteId = voteId;
    }, 300);
  }

  function handleMouseLeave() {
    clearTimeout(hoverTimeout);
    hoveredVoteId = null;
  }

  // Transform backend vote to VoteRecord
  function toVoteRecord(vote: VoteWithDisclosure): VoteRecord {
    return {
      billNumber: vote.billId,
      billTitle: vote.billTitle,
      voteDate: vote.date,
      position: vote.vote,
      result: vote.result,
      partyBreakdown: {
        // TODO: Fetch from additional API endpoint
        democratic: { yea: 0, nay: 0 },
        republican: { yea: 0, nay: 0 }
      },
      summary: vote.l1Summary || ''
    };
  }
</script>

<div class="space-y-2">
  {#each votes as vote}
    <div
      class="relative flex items-center gap-3 rounded-lg border border-gray-200 p-3 transition-colors hover:border-congressional-300 hover:bg-gray-50"
      onmouseenter={() => handleMouseEnter(vote.rollCallId)}
      onmouseleave={handleMouseLeave}
      role="button"
      tabindex="0"
    >
      <VoteIndicator position={vote.vote} size="md" showLabel={true} />
      <div class="min-w-0 flex-1">
        <div class="text-sm font-medium text-gray-900">{vote.billTitle}</div>
        <div class="text-xs text-gray-600">
          {new Date(vote.date).toLocaleDateString()}
        </div>
      </div>

      <!-- L2: Hover card -->
      {#if hoveredVoteId === vote.rollCallId}
        <div class="absolute left-full top-0 z-50 ml-4">
          <VoteContext vote={toVoteRecord(vote)} />
        </div>
      {/if}
    </div>
  {/each}
</div>
```

## Example 3: Complete L1/L2/L3 Flow with Modal

Full progressive disclosure pattern with modal for L3:

```svelte
<script lang="ts">
  import { VoteIndicator, VoteContext, RollCall } from '$lib/components/votes';
  import { UnifiedModal } from '$lib/components/ui';
  import type { VoteWithDisclosure } from '$lib/server/congress';
  import type { VoteRecord, RollCallVote } from '$lib/components/votes';

  interface Props {
    votes: VoteWithDisclosure[];
  }

  let { votes }: Props = $props();

  let hoveredVoteId = $state<string | null>(null);
  let selectedVote = $state<VoteWithDisclosure | null>(null);
  let hoverTimeout: ReturnType<typeof setTimeout>;

  function handleMouseEnter(voteId: string) {
    hoverTimeout = setTimeout(() => {
      hoveredVoteId = voteId;
    }, 300);
  }

  function handleMouseLeave() {
    clearTimeout(hoverTimeout);
    hoveredVoteId = null;
  }

  function handleViewFull(vote: VoteWithDisclosure) {
    hoveredVoteId = null;
    selectedVote = vote;
  }

  function toVoteRecord(vote: VoteWithDisclosure): VoteRecord {
    return {
      billNumber: vote.billId,
      billTitle: vote.billTitle,
      voteDate: vote.date,
      position: vote.vote,
      result: vote.result,
      partyBreakdown: {
        democratic: { yea: 0, nay: 0 },
        republican: { yea: 0, nay: 0 }
      },
      summary: vote.l1Summary || ''
    };
  }

  // Mock function - replace with actual API call
  async function fetchFullRollCall(rollCallId: string): Promise<RollCallVote[]> {
    // Call API to get all member votes
    return [];
  }

  let rollCallVotes = $state<RollCallVote[]>([]);

  $effect(() => {
    if (selectedVote) {
      fetchFullRollCall(selectedVote.rollCallId).then(votes => {
        rollCallVotes = votes;
      });
    }
  });
</script>

<!-- Vote List -->
<div class="space-y-2">
  {#each votes as vote}
    <div
      class="relative flex items-center gap-3 rounded-lg border border-gray-200 p-3 transition-colors hover:border-congressional-300 hover:bg-gray-50"
      onmouseenter={() => handleMouseEnter(vote.rollCallId)}
      onmouseleave={handleMouseLeave}
      onclick={() => handleViewFull(vote)}
      role="button"
      tabindex="0"
      onkeydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleViewFull(vote);
        }
      }}
    >
      <VoteIndicator position={vote.vote} size="md" showLabel={true} />
      <div class="min-w-0 flex-1">
        <div class="text-sm font-medium text-gray-900">{vote.billTitle}</div>
        <div class="text-xs text-gray-600">
          {new Date(vote.date).toLocaleDateString()}
        </div>
      </div>

      {#if hoveredVoteId === vote.rollCallId}
        <div class="absolute left-full top-0 z-50 ml-4">
          <VoteContext
            vote={toVoteRecord(vote)}
            onViewFull={() => handleViewFull(vote)}
          />
        </div>
      {/if}
    </div>
  {/each}
</div>

<!-- L3: Full Roll Call Modal -->
{#if selectedVote}
  <UnifiedModal onClose={() => selectedVote = null}>
    <RollCall
      billNumber={selectedVote.billId}
      billTitle={selectedVote.billTitle}
      voteDate={selectedVote.date}
      result={selectedVote.result}
      votes={rollCallVotes}
      rollCallUrl={selectedVote.l3RollCallUrl}
      summary={selectedVote.l1Summary || ''}
      context={selectedVote.l2Summary || ''}
    />
  </UnifiedModal>
{/if}
```

## Example 4: Representative Profile Page

Show all votes for a specific representative:

```svelte
<script lang="ts">
  import { VoteIndicator, RollCall } from '$lib/components/votes';
  import type { MemberVoteHistory } from '$lib/server/congress';
  import type { RollCallVote } from '$lib/components/votes';

  interface Props {
    voteHistory: MemberVoteHistory;
  }

  let { voteHistory }: Props = $props();

  let selectedVoteIndex = $state<number | null>(null);

  // Mock - replace with actual API call
  async function fetchRollCallForVote(rollCallId: string): Promise<RollCallVote[]> {
    return [];
  }

  let rollCallVotes = $state<RollCallVote[]>([]);

  $effect(() => {
    if (selectedVoteIndex !== null) {
      const vote = voteHistory.votes[selectedVoteIndex];
      fetchRollCallForVote(vote.rollCallId).then(votes => {
        rollCallVotes = votes;
      });
    }
  });
</script>

<div class="space-y-6">
  <!-- Member Info -->
  <div class="rounded-lg bg-white p-6 shadow">
    <h1 class="text-2xl font-bold text-gray-900">{voteHistory.memberName}</h1>
    <div class="mt-2 flex items-center gap-4 text-sm text-gray-600">
      <span>{voteHistory.party} - {voteHistory.state}{voteHistory.district ? `-${voteHistory.district}` : ''}</span>
      <span>Participation: {voteHistory.voteStats.participationRate}%</span>
    </div>
  </div>

  <!-- Vote Statistics -->
  <div class="grid grid-cols-4 gap-4">
    <div class="rounded-lg bg-emerald-50 p-4">
      <div class="text-2xl font-bold text-emerald-700">{voteHistory.voteStats.yeas}</div>
      <div class="text-sm text-emerald-600">Yea Votes</div>
    </div>
    <div class="rounded-lg bg-red-50 p-4">
      <div class="text-2xl font-bold text-red-700">{voteHistory.voteStats.nays}</div>
      <div class="text-sm text-red-600">Nay Votes</div>
    </div>
    <div class="rounded-lg bg-amber-50 p-4">
      <div class="text-2xl font-bold text-amber-700">{voteHistory.voteStats.present}</div>
      <div class="text-sm text-amber-600">Present</div>
    </div>
    <div class="rounded-lg bg-gray-50 p-4">
      <div class="text-2xl font-bold text-gray-700">{voteHistory.voteStats.notVoting}</div>
      <div class="text-sm text-gray-600">Not Voting</div>
    </div>
  </div>

  <!-- Recent Votes -->
  <div class="rounded-lg bg-white shadow">
    <div class="border-b border-gray-200 px-6 py-4">
      <h2 class="text-lg font-semibold text-gray-900">Recent Votes</h2>
    </div>
    <div class="divide-y divide-gray-200">
      {#each voteHistory.votes as vote, index}
        <button
          type="button"
          onclick={() => selectedVoteIndex = index}
          class="w-full px-6 py-4 text-left transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-congressional-500"
        >
          <div class="flex items-start gap-4">
            <VoteIndicator position={vote.vote} size="md" showLabel={true} />
            <div class="min-w-0 flex-1">
              <div class="text-sm font-medium text-gray-900">{vote.billTitle}</div>
              <div class="mt-1 text-xs text-gray-600">{vote.l1Summary}</div>
              <div class="mt-2 text-xs text-gray-500">
                {new Date(vote.date).toLocaleDateString()} • {vote.result}
              </div>
            </div>
          </div>
        </button>
      {/each}
    </div>
  </div>
</div>

<!-- Roll Call Modal -->
{#if selectedVoteIndex !== null}
  {@const vote = voteHistory.votes[selectedVoteIndex]}
  <UnifiedModal onClose={() => selectedVoteIndex = null}>
    <RollCall
      billNumber={vote.billId}
      billTitle={vote.billTitle}
      voteDate={vote.date}
      result={vote.result}
      votes={rollCallVotes}
      rollCallUrl={vote.l3RollCallUrl}
      summary={vote.l1Summary || ''}
      context={vote.l2Summary || ''}
    />
  </UnifiedModal>
{/if}
```

## Example 5: Standalone VoteIndicator in Cards

Use just the indicator badge in compact UI:

```svelte
<script lang="ts">
  import { VoteIndicator } from '$lib/components/votes';
  import type { VotePosition } from '$lib/components/votes';

  interface Props {
    billTitle: string;
    position: VotePosition;
    date: Date;
  }

  let { billTitle, position, date }: Props = $props();
</script>

<div class="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4">
  <VoteIndicator {position} size="md" showLabel={true} />
  <div class="min-w-0 flex-1">
    <div class="text-sm font-medium text-gray-900">{billTitle}</div>
    <time datetime={date.toISOString()} class="text-xs text-gray-500">
      {date.toLocaleDateString()}
    </time>
  </div>
</div>
```

## Example 6: Custom Hover Positioning

Position VoteContext relative to viewport for edge cases:

```svelte
<script lang="ts">
  import { VoteIndicator, VoteContext } from '$lib/components/votes';
  import type { VoteRecord } from '$lib/components/votes';

  let showContext = $state(false);
  let contextPosition = $state({ x: 0, y: 0 });
  let hoverTimeout: ReturnType<typeof setTimeout>;

  const vote: VoteRecord = {
    // ... vote data
  };

  function handleMouseEnter(event: MouseEvent) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();

    hoverTimeout = setTimeout(() => {
      // Position to the right if space available, otherwise to the left
      const spaceOnRight = window.innerWidth - rect.right > 350;

      contextPosition = {
        x: spaceOnRight ? rect.right + 16 : rect.left - 336,
        y: rect.top
      };

      showContext = true;
    }, 300);
  }

  function handleMouseLeave() {
    clearTimeout(hoverTimeout);
    showContext = false;
  }
</script>

<div
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
  class="inline-flex items-center gap-2"
>
  <VoteIndicator position={vote.position} size="sm" />
  <span>H.R. 1234</span>
</div>

{#if showContext}
  <div
    style="position: fixed; left: {contextPosition.x}px; top: {contextPosition.y}px; z-index: 9999;"
  >
    <VoteContext {vote} />
  </div>
{/if}
```

## API Integration Helper

Helper function to fetch party breakdown for VoteContext:

```typescript
// src/lib/utils/voteHelpers.ts
import type { VoteRecord, PartyBreakdown } from '$lib/components/votes';
import type { VoteWithDisclosure } from '$lib/server/congress';

/**
 * Fetch party breakdown for a specific vote
 */
export async function fetchPartyBreakdown(rollCallId: string): Promise<PartyBreakdown> {
  // Extract congress, chamber, session, roll number from rollCallId
  // Example: "118-H-123" -> congress: 118, chamber: house, roll: 123
  const [congress, chamber, roll] = rollCallId.split('-');

  // Call Congress.gov API endpoint
  // GET /house-vote/{congress}/{session}/{rollNumber}/members
  const response = await fetch(
    `/api/congress/vote/${congress}/${chamber}/${roll}/breakdown`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch party breakdown');
  }

  return await response.json();
}

/**
 * Transform backend VoteWithDisclosure to UI VoteRecord
 */
export async function toVoteRecord(vote: VoteWithDisclosure): Promise<VoteRecord> {
  const partyBreakdown = await fetchPartyBreakdown(vote.rollCallId);

  return {
    billNumber: vote.billId,
    billTitle: vote.billTitle,
    voteDate: vote.date,
    position: vote.vote,
    result: vote.result,
    partyBreakdown,
    summary: vote.l1Summary || ''
  };
}
```

## Testing Example

Component testing with Vitest/Testing Library:

```typescript
// VoteIndicator.test.ts
import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import VoteIndicator from './VoteIndicator.svelte';

describe('VoteIndicator', () => {
  it('renders yea vote with correct styling', () => {
    render(VoteIndicator, { position: 'yea', showLabel: true });

    const indicator = screen.getByRole('status');
    expect(indicator).toHaveTextContent('Yea');
    expect(indicator).toHaveClass('bg-emerald-50');
  });

  it('announces position to screen readers', () => {
    render(VoteIndicator, { position: 'nay' });

    const indicator = screen.getByRole('status');
    expect(indicator).toHaveAttribute('aria-label', 'Voted against');
  });

  it('renders compact dot when label is hidden', () => {
    render(VoteIndicator, { position: 'yea', showLabel: false });

    const srOnly = screen.getByText('Yea', { selector: '.sr-only' });
    expect(srOnly).toBeInTheDocument();
  });
});
```

---

## Common Patterns

### 1. Loading States

```svelte
{#if loading}
  <div class="animate-pulse space-y-2">
    {#each Array(5) as _}
      <div class="h-16 rounded-lg bg-gray-200"></div>
    {/each}
  </div>
{:else}
  <!-- Vote list -->
{/if}
```

### 2. Empty States

```svelte
{#if votes.length === 0}
  <div class="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
    <p class="text-gray-600">No votes found for this member.</p>
  </div>
{:else}
  <!-- Vote list -->
{/if}
```

### 3. Error Handling

```svelte
{#if error}
  <div class="rounded-lg border border-red-200 bg-red-50 p-4">
    <p class="text-sm text-red-700">{error}</p>
  </div>
{/if}
```

---

These examples cover the most common use cases. Refer to README.md for full component documentation and accessibility guidelines.
