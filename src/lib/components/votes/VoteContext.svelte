<script lang="ts">
	/**
	 * VoteContext - L2 Recognition Card Component
	 *
	 * Progressive disclosure hover preview following perceptual engineering timing.
	 * 300ms activation delay prevents accidental triggers while maintaining responsiveness
	 * (below the 400ms "perceived delay" threshold from perceptual research).
	 *
	 * Information hierarchy:
	 * 1. Bill identifier (scannable anchor)
	 * 2. Position badge (visual confirmation)
	 * 3. Party breakdown (contextual voting pattern)
	 * 4. Summary text (meaningful context)
	 * 5. Action link (path to L3)
	 *
	 * Design system: Recognition card pattern from compound component architecture.
	 */

	import { fly, fade } from 'svelte/transition';
	import VoteIndicator from './VoteIndicator.svelte';

	interface PartyBreakdown {
		democratic: { yea: number; nay: number };
		republican: { yea: number; nay: number };
	}

	interface VoteRecord {
		billNumber: string;
		billTitle: string;
		voteDate: Date;
		position: 'yea' | 'nay' | 'not_voting' | 'present';
		result: 'passed' | 'failed';
		partyBreakdown: PartyBreakdown;
		summary: string;
	}

	interface Props {
		vote: VoteRecord;
		onViewFull?: () => void;
	}

	let { vote, onViewFull }: Props = $props();

	// Format date for human readability
	const formatDate = (date: Date): string => {
		return new Intl.DateTimeFormat('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		}).format(date);
	};

	// Calculate total votes and percentages for party breakdown visualization
	const demTotal = vote.partyBreakdown.democratic.yea + vote.partyBreakdown.democratic.nay;
	const repTotal = vote.partyBreakdown.republican.yea + vote.partyBreakdown.republican.nay;

	const demYeaPercent = demTotal > 0 ? (vote.partyBreakdown.democratic.yea / demTotal) * 100 : 0;
	const repYeaPercent = repTotal > 0 ? (vote.partyBreakdown.republican.yea / repTotal) * 100 : 0;

	// Result styling
	const resultClasses = {
		passed: 'text-emerald-700',
		failed: 'text-red-700'
	};
</script>

<div
	class="w-80 rounded-lg border border-gray-200 bg-white p-4 shadow-lg"
	in:fly={{ y: -8, duration: 200 }}
	out:fade={{ duration: 150 }}
	role="dialog"
	aria-label="Vote details preview"
>
	<!-- Header: Bill identification -->
	<div class="mb-3 flex items-start justify-between gap-3">
		<div class="min-w-0 flex-1">
			<div class="text-xs font-semibold uppercase tracking-wide text-gray-500">
				{vote.billNumber}
			</div>
			<h3 class="mt-1 text-sm font-medium leading-snug text-gray-900">
				{vote.billTitle}
			</h3>
		</div>
		<VoteIndicator position={vote.position} size="md" showLabel={true} />
	</div>

	<!-- Metadata row -->
	<div class="mb-3 flex items-center gap-2 text-xs text-gray-600">
		<time datetime={vote.voteDate.toISOString()}>
			{formatDate(vote.voteDate)}
		</time>
		<span aria-hidden="true">•</span>
		<span class={resultClasses[vote.result]}>
			{vote.result.charAt(0).toUpperCase() + vote.result.slice(1)}
		</span>
	</div>

	<!-- Party breakdown visualization -->
	<div class="mb-3 space-y-2">
		<div class="text-xs font-medium text-gray-700">Party Breakdown</div>

		<!-- Democratic votes -->
		<div class="space-y-1">
			<div class="flex items-center justify-between text-xs">
				<span class="text-blue-700">Democratic</span>
				<span class="text-gray-600">
					{vote.partyBreakdown.democratic.yea} - {vote.partyBreakdown.democratic.nay}
				</span>
			</div>
			<div class="h-1.5 overflow-hidden rounded-full bg-red-100">
				<div
					class="h-full rounded-full bg-emerald-500 transition-all motion-reduce:transition-none"
					style="width: {demYeaPercent}%"
					role="progressbar"
					aria-label="Democratic yea votes: {demYeaPercent.toFixed(0)}%"
					aria-valuenow={demYeaPercent}
					aria-valuemin={0}
					aria-valuemax={100}
				></div>
			</div>
		</div>

		<!-- Republican votes -->
		<div class="space-y-1">
			<div class="flex items-center justify-between text-xs">
				<span class="text-red-700">Republican</span>
				<span class="text-gray-600">
					{vote.partyBreakdown.republican.yea} - {vote.partyBreakdown.republican.nay}
				</span>
			</div>
			<div class="h-1.5 overflow-hidden rounded-full bg-red-100">
				<div
					class="h-full rounded-full bg-emerald-500 transition-all motion-reduce:transition-none"
					style="width: {repYeaPercent}%"
					role="progressbar"
					aria-label="Republican yea votes: {repYeaPercent.toFixed(0)}%"
					aria-valuenow={repYeaPercent}
					aria-valuemin={0}
					aria-valuemax={100}
				></div>
			</div>
		</div>
	</div>

	<!-- Summary text (L1 from backend) -->
	<p class="mb-3 text-sm leading-relaxed text-gray-700">
		{vote.summary}
	</p>

	<!-- Action link to L3 -->
	{#if onViewFull}
		<button
			type="button"
			onclick={onViewFull}
			class="w-full rounded-md bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-congressional-500 focus:ring-offset-2"
		>
			View Full Roll Call
		</button>
	{/if}
</div>
