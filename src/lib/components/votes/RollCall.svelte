<script lang="ts">
	/**
	 * RollCall - L3 Focal Immersion Component
	 *
	 * Full roll call display with filtering, sorting, and complete member vote records.
	 * Designed for deep investigation while maintaining scannable hierarchy.
	 *
	 * Cognitive load management:
	 * - Default sorting by party (primary mental model for political context)
	 * - Sticky header preserves context during scroll
	 * - Clear visual grouping through subtle backgrounds
	 * - Progressive enhancement: works without JS for core reading
	 *
	 * Data table accessibility follows WAI-ARIA grid pattern with sortable columns.
	 */

	import VoteIndicator from './VoteIndicator.svelte';

	interface RollCallMember {
		name: string;
		party: 'D' | 'R' | 'I';
		state: string;
		district?: string;
	}

	interface RollCallVote {
		member: RollCallMember;
		position: 'yea' | 'nay' | 'not_voting' | 'present';
	}

	interface Props {
		billNumber: string;
		billTitle: string;
		voteDate: Date;
		result: 'passed' | 'failed';
		votes: RollCallVote[];
		rollCallUrl?: string;
		summary: string;
		context: string;
	}

	let { billNumber, billTitle, voteDate, result, votes, rollCallUrl, summary, context }: Props =
		$props();

	// Filter state
	let partyFilter = $state<'all' | 'D' | 'R' | 'I'>('all');
	let positionFilter = $state<'all' | 'yea' | 'nay' | 'not_voting' | 'present'>('all');
	let stateFilter = $state<string>('all');
	let searchQuery = $state<string>('');

	// Sort state
	let sortBy = $state<'name' | 'party' | 'state'>('party');
	let sortDirection = $state<'asc' | 'desc'>('asc');

	// Filtered and sorted votes
	const filteredVotes = $derived.by(() => {
		let filtered = votes;

		// Apply party filter
		if (partyFilter !== 'all') {
			filtered = filtered.filter((v) => v.member.party === partyFilter);
		}

		// Apply position filter
		if (positionFilter !== 'all') {
			filtered = filtered.filter((v) => v.position === positionFilter);
		}

		// Apply state filter
		if (stateFilter !== 'all') {
			filtered = filtered.filter((v) => v.member.state === stateFilter);
		}

		// Apply search
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter((v) => v.member.name.toLowerCase().includes(query));
		}

		// Sort
		filtered.sort((a, b) => {
			let compareValue = 0;

			if (sortBy === 'name') {
				compareValue = a.member.name.localeCompare(b.member.name);
			} else if (sortBy === 'party') {
				compareValue = a.member.party.localeCompare(b.member.party);
			} else if (sortBy === 'state') {
				compareValue = a.member.state.localeCompare(b.member.state);
			}

			return sortDirection === 'asc' ? compareValue : -compareValue;
		});

		return filtered;
	});

	// Unique states for filter dropdown
	const uniqueStates = $derived.by(() => {
		const states = new Set(votes.map((v) => v.member.state));
		return Array.from(states).sort();
	});

	// Vote totals
	const totals = $derived.by(() => {
		const counts = { yea: 0, nay: 0, not_voting: 0, present: 0 };
		votes.forEach((v) => {
			counts[v.position]++;
		});
		return counts;
	});

	// Toggle sort
	function toggleSort(column: 'name' | 'party' | 'state') {
		if (sortBy === column) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortBy = column;
			sortDirection = 'asc';
		}
	}

	// Format date
	const formatDate = (date: Date): string => {
		return new Intl.DateTimeFormat('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		}).format(date);
	};

	// Party colors for visual coding
	const partyColors = {
		D: 'text-blue-700 bg-blue-50',
		R: 'text-red-700 bg-red-50',
		I: 'text-purple-700 bg-purple-50'
	};

	const resultClasses = {
		passed: 'text-emerald-700 bg-emerald-50',
		failed: 'text-red-700 bg-red-50'
	};
</script>

<div class="flex h-full flex-col">
	<!-- Header section - not scrollable -->
	<div class="border-b border-gray-200 bg-white p-6">
		<!-- Bill title and metadata -->
		<div class="mb-4">
			<div class="mb-2 flex items-start justify-between gap-4">
				<div class="min-w-0 flex-1">
					<div class="text-sm font-semibold uppercase tracking-wide text-gray-500">
						{billNumber}
					</div>
					<h2 class="mt-1 text-2xl font-bold text-gray-900">
						{billTitle}
					</h2>
				</div>
				<div class="flex flex-col items-end gap-2">
					<span
						class="rounded-full px-3 py-1 text-sm font-semibold {resultClasses[result]}"
						role="status"
					>
						{result.charAt(0).toUpperCase() + result.slice(1)}
					</span>
					{#if rollCallUrl}
						<a
							href={rollCallUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="text-sm text-congressional-600 hover:text-congressional-700 hover:underline focus:outline-none focus:ring-2 focus:ring-congressional-500 focus:ring-offset-2"
						>
							Official Record →
						</a>
					{/if}
				</div>
			</div>

			<time datetime={voteDate.toISOString()} class="text-sm text-gray-600">
				{formatDate(voteDate)}
			</time>
		</div>

		<!-- Context and summary -->
		<div class="mb-4 space-y-2">
			<p class="text-sm leading-relaxed text-gray-700">{context}</p>
			<p class="text-sm leading-relaxed text-gray-600">{summary}</p>
		</div>

		<!-- Vote totals -->
		<div class="mb-4 flex flex-wrap gap-4">
			<div class="flex items-center gap-2">
				<VoteIndicator position="yea" size="md" showLabel={false} />
				<span class="text-sm font-medium text-gray-900">{totals.yea} Yea</span>
			</div>
			<div class="flex items-center gap-2">
				<VoteIndicator position="nay" size="md" showLabel={false} />
				<span class="text-sm font-medium text-gray-900">{totals.nay} Nay</span>
			</div>
			<div class="flex items-center gap-2">
				<VoteIndicator position="present" size="md" showLabel={false} />
				<span class="text-sm font-medium text-gray-900">{totals.present} Present</span>
			</div>
			<div class="flex items-center gap-2">
				<VoteIndicator position="not_voting" size="md" showLabel={false} />
				<span class="text-sm font-medium text-gray-900">{totals.not_voting} Not Voting</span>
			</div>
		</div>

		<!-- Filters -->
		<div class="flex flex-wrap gap-3">
			<!-- Search -->
			<input
				type="text"
				placeholder="Search members..."
				bind:value={searchQuery}
				class="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-congressional-500 focus:outline-none focus:ring-2 focus:ring-congressional-500"
				aria-label="Search members by name"
			/>

			<!-- Party filter -->
			<select
				bind:value={partyFilter}
				class="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-congressional-500 focus:outline-none focus:ring-2 focus:ring-congressional-500"
				aria-label="Filter by party"
			>
				<option value="all">All Parties</option>
				<option value="D">Democratic</option>
				<option value="R">Republican</option>
				<option value="I">Independent</option>
			</select>

			<!-- Position filter -->
			<select
				bind:value={positionFilter}
				class="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-congressional-500 focus:outline-none focus:ring-2 focus:ring-congressional-500"
				aria-label="Filter by vote position"
			>
				<option value="all">All Votes</option>
				<option value="yea">Yea</option>
				<option value="nay">Nay</option>
				<option value="present">Present</option>
				<option value="not_voting">Not Voting</option>
			</select>

			<!-- State filter -->
			<select
				bind:value={stateFilter}
				class="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-congressional-500 focus:outline-none focus:ring-2 focus:ring-congressional-500"
				aria-label="Filter by state"
			>
				<option value="all">All States</option>
				{#each uniqueStates as state}
					<option value={state}>{state}</option>
				{/each}
			</select>
		</div>
	</div>

	<!-- Table - scrollable -->
	<div class="flex-1 overflow-auto">
		<table class="w-full" role="grid" aria-label="Roll call votes">
			<thead class="sticky top-0 z-10 bg-gray-50">
				<tr class="border-b border-gray-200">
					<th scope="col" class="px-6 py-3 text-left">
						<button
							type="button"
							onclick={() => toggleSort('name')}
							class="group inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-congressional-500"
							aria-label="Sort by name"
						>
							Member
							{#if sortBy === 'name'}
								<span aria-label={sortDirection === 'asc' ? 'ascending' : 'descending'}>
									{sortDirection === 'asc' ? '↑' : '↓'}
								</span>
							{/if}
						</button>
					</th>
					<th scope="col" class="px-6 py-3 text-left">
						<button
							type="button"
							onclick={() => toggleSort('party')}
							class="group inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-congressional-500"
							aria-label="Sort by party"
						>
							Party
							{#if sortBy === 'party'}
								<span aria-label={sortDirection === 'asc' ? 'ascending' : 'descending'}>
									{sortDirection === 'asc' ? '↑' : '↓'}
								</span>
							{/if}
						</button>
					</th>
					<th scope="col" class="px-6 py-3 text-left">
						<button
							type="button"
							onclick={() => toggleSort('state')}
							class="group inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-congressional-500"
							aria-label="Sort by state"
						>
							State
							{#if sortBy === 'state'}
								<span aria-label={sortDirection === 'asc' ? 'ascending' : 'descending'}>
									{sortDirection === 'asc' ? '↑' : '↓'}
								</span>
							{/if}
						</button>
					</th>
					<th scope="col" class="px-6 py-3 text-left">
						<span class="text-xs font-semibold uppercase tracking-wide text-gray-700">Vote</span>
					</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-gray-200 bg-white">
				{#each filteredVotes as { member, position }, index}
					<tr
						class="transition-colors hover:bg-gray-50 motion-reduce:transition-none {member.party === 'D' ? 'bg-blue-50/30' : member.party === 'R' ? 'bg-red-50/30' : 'bg-purple-50/30'}"
					>
						<td class="px-6 py-4 text-sm font-medium text-gray-900">
							{member.name}
							{#if member.district}
								<span class="text-gray-500">({member.state}-{member.district})</span>
							{/if}
						</td>
						<td class="px-6 py-4">
							<span
								class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {partyColors[
									member.party
								]}"
							>
								{member.party}
							</span>
						</td>
						<td class="px-6 py-4 text-sm text-gray-700">
							{member.state}
						</td>
						<td class="px-6 py-4">
							<VoteIndicator {position} size="md" showLabel={true} />
						</td>
					</tr>
				{:else}
					<tr>
						<td colspan="4" class="px-6 py-8 text-center text-sm text-gray-500">
							No votes match your filters.
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- Footer with result count -->
	<div class="border-t border-gray-200 bg-gray-50 px-6 py-3">
		<p class="text-sm text-gray-600">
			Showing {filteredVotes.length} of {votes.length}
			{votes.length === 1 ? 'vote' : 'votes'}
		</p>
	</div>
</div>
