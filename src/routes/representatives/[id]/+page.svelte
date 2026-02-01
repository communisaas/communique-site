<script lang="ts">
	/**
	 * Representative Profile Page
	 *
	 * Demonstrates progressive disclosure pattern with Vote components:
	 * - L1 (Peripheral): VoteIndicator badges in vote list
	 * - L2 (Recognition): VoteContext appears on hover (300ms delay)
	 * - L3 (Focal): RollCall opens in modal on click
	 *
	 * User flow:
	 * 1. Scan vote indicators peripherally
	 * 2. Hover over interesting votes for context
	 * 3. Click to view full roll call details
	 *
	 * Perceptual engineering:
	 * - 300ms hover delay prevents accidental activation
	 * - Color-coded party affiliation for quick recognition
	 * - Consistent timing across all hover states
	 * - Keyboard navigation supported throughout
	 */

	import type { PageData } from './$types';
	import VoteIndicator from '$lib/components/votes/VoteIndicator.svelte';
	import VoteContext from '$lib/components/votes/VoteContext.svelte';
	import RollCall from '$lib/components/votes/RollCall.svelte';
	import SimpleModal from '$lib/components/modals/SimpleModal.svelte';
	import { User, MapPin, Phone, Globe, Calendar, TrendingUp } from '@lucide/svelte';
	import { L2_HOVER_DELAY } from '$lib/core/perceptual';

	let { data }: { data: PageData } = $props();

	// Hover state management for progressive disclosure
	let hoveredVoteIndex = $state<number | null>(null);
	let hoverTimeout: ReturnType<typeof setTimeout> | null = null;

	// Modal state for L3 disclosure
	let selectedVoteIndex = $state<number | null>(null);

	/**
	 * Handle mouse enter with deliberate delay
	 * Prevents accidental hover triggers while maintaining responsiveness
	 */
	function handleVoteHoverStart(index: number) {
		// Clear any existing timeout
		if (hoverTimeout) {
			clearTimeout(hoverTimeout);
		}

		// Set new timeout for hover activation
		hoverTimeout = setTimeout(() => {
			hoveredVoteIndex = index;
		}, L2_HOVER_DELAY);
	}

	/**
	 * Handle mouse leave - immediate dismissal
	 */
	function handleVoteHoverEnd() {
		if (hoverTimeout) {
			clearTimeout(hoverTimeout);
			hoverTimeout = null;
		}
		hoveredVoteIndex = null;
	}

	/**
	 * Handle vote click - open L3 modal
	 */
	function handleVoteClick(index: number) {
		selectedVoteIndex = index;
	}

	/**
	 * Close modal and reset selected vote
	 */
	function closeModal() {
		selectedVoteIndex = null;
	}

	/**
	 * Format party affiliation with full name and styling
	 */
	const partyInfo = $derived.by(() => {
		const party = data.member.party;
		const partyMap: Record<string, { name: string; color: string; bg: string }> = {
			D: { name: 'Democratic', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
			R: { name: 'Republican', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
			I: { name: 'Independent', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' }
		};
		return partyMap[party] || { name: party, color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' };
	});

	/**
	 * Format district display
	 */
	const districtDisplay = $derived.by(() => {
		if (data.member.chamber === 'senate') {
			return `U.S. Senator from ${data.member.state}`;
		}
		return `${data.member.state}${data.member.district ? `-${data.member.district}` : ''} Congressional District`;
	});

	/**
	 * Transform vote history for VoteContext component
	 * Maps our API format to component's expected format
	 */
	function transformVoteForContext(vote: (typeof data.voteHistory)['votes'][0]) {
		// Parse party breakdown from vote data (placeholder - would need real data)
		// In production, this would come from the full roll call data
		const partyBreakdown = {
			democratic: { yea: 0, nay: 0 },
			republican: { yea: 0, nay: 0 }
		};

		return {
			billNumber: vote.billId,
			billTitle: vote.billTitle,
			voteDate: new Date(vote.date),
			position: vote.vote,
			result: vote.result,
			partyBreakdown,
			summary: vote.l2Summary || vote.l1Summary
		};
	}

	/**
	 * Transform vote for RollCall component
	 * Note: Full roll call data would typically be fetched on-demand
	 */
	function transformVoteForRollCall(vote: (typeof data.voteHistory)['votes'][0]) {
		return {
			billNumber: vote.billId,
			billTitle: vote.billTitle,
			voteDate: new Date(vote.date),
			result: vote.result,
			votes: [], // In production, fetch full roll call data here
			rollCallUrl: vote.l3RollCallUrl,
			summary: vote.l2Summary || vote.l1Summary,
			context: vote.description || ''
		};
	}
</script>

<svelte:head>
	<title>{data.member.name} - Representative Profile | Communique</title>
	<meta name="description" content="View voting history and contact information for {data.member.name}, representing {districtDisplay}" />
</svelte:head>

<div class="min-h-screen bg-gray-50">
	<div class="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
		<!-- Representative Header -->
		<div class="mb-8 overflow-hidden rounded-lg bg-white shadow">
			<div class="p-6 sm:p-8">
				<div class="flex flex-col gap-6 sm:flex-row sm:items-start">
					<!-- Photo -->
					<div class="flex-shrink-0">
						{#if data.member.photoUrl}
							<img
								src={data.member.photoUrl}
								alt={data.member.name}
								class="h-32 w-32 rounded-full border-4 border-gray-100 object-cover shadow-sm"
							/>
						{:else}
							<div
								class="flex h-32 w-32 items-center justify-center rounded-full border-4 border-gray-100 bg-gray-200 shadow-sm"
							>
								<User class="h-16 w-16 text-gray-400" />
							</div>
						{/if}
					</div>

					<!-- Info -->
					<div class="flex-1 min-w-0">
						<h1 class="text-3xl font-bold text-gray-900 mb-2">
							{data.member.name}
						</h1>

						<!-- Party and District -->
						<div class="flex flex-wrap gap-2 mb-4">
							<span
								class="inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium {partyInfo.bg} {partyInfo.color}"
							>
								{partyInfo.name}
							</span>
							<span
								class="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm text-gray-700"
							>
								<MapPin class="mr-1.5 h-4 w-4" />
								{districtDisplay}
							</span>
						</div>

						<!-- Contact Info Grid -->
						<div class="grid gap-3 sm:grid-cols-2">
							{#if data.member.phone}
								<a
									href="tel:{data.member.phone}"
									class="inline-flex items-center text-sm text-gray-600 hover:text-congressional-600 transition-colors"
								>
									<Phone class="mr-2 h-4 w-4" />
									{data.member.phone}
								</a>
							{/if}

							{#if data.member.website}
								<a
									href={data.member.website}
									target="_blank"
									rel="noopener noreferrer"
									class="inline-flex items-center text-sm text-gray-600 hover:text-congressional-600 transition-colors"
								>
									<Globe class="mr-2 h-4 w-4" />
									Official Website
								</a>
							{/if}

							{#if data.member.officeAddress}
								<div class="inline-flex items-start text-sm text-gray-600 sm:col-span-2">
									<MapPin class="mr-2 mt-0.5 h-4 w-4 flex-shrink-0" />
									<span>{data.member.officeAddress}</span>
								</div>
							{/if}
						</div>
					</div>
				</div>
			</div>

			<!-- Vote Statistics Bar -->
			{#if data.voteHistory}
				<div class="border-t border-gray-200 bg-gray-50 px-6 py-4 sm:px-8">
					<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
						<div class="text-center">
							<div class="text-2xl font-bold text-gray-900">
								{data.voteHistory.voteStats.totalVotes}
							</div>
							<div class="text-xs text-gray-600">Total Votes</div>
						</div>
						<div class="text-center">
							<div class="text-2xl font-bold text-emerald-600">
								{data.voteHistory.voteStats.yeas}
							</div>
							<div class="text-xs text-gray-600">Yea Votes</div>
						</div>
						<div class="text-center">
							<div class="text-2xl font-bold text-red-600">
								{data.voteHistory.voteStats.nays}
							</div>
							<div class="text-xs text-gray-600">Nay Votes</div>
						</div>
						<div class="text-center">
							<div class="text-2xl font-bold text-congressional-600">
								{data.voteHistory.voteStats.participationRate}%
							</div>
							<div class="text-xs text-gray-600">Participation</div>
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Recent Votes Section -->
		<div class="rounded-lg bg-white shadow">
			<div class="border-b border-gray-200 px-6 py-4 sm:px-8">
				<h2 class="flex items-center text-xl font-semibold text-gray-900">
					<TrendingUp class="mr-2 h-5 w-5" />
					Recent Votes
				</h2>
				<p class="mt-1 text-sm text-gray-600">
					Hover over votes for context, click for full roll call details
				</p>
			</div>

			{#if data.voteHistory && data.voteHistory.votes.length > 0}
				<div class="divide-y divide-gray-100">
					{#each data.voteHistory.votes as vote, index}
						<div
							class="relative px-6 py-4 transition-colors hover:bg-gray-50 focus-within:bg-gray-50 sm:px-8"
							role="button"
							tabindex="0"
							onmouseenter={() => handleVoteHoverStart(index)}
							onmouseleave={() => handleVoteHoverEnd()}
							onclick={() => handleVoteClick(index)}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									handleVoteClick(index);
								}
							}}
						>
							<div class="flex items-start gap-4">
								<!-- L1: Vote Indicator (Peripheral Awareness) -->
								<div class="flex-shrink-0 pt-1">
									<VoteIndicator position={vote.vote} size="md" showLabel={true} />
								</div>

								<!-- Vote Info -->
								<div class="flex-1 min-w-0">
									<div class="mb-1 flex items-start justify-between gap-4">
										<div class="min-w-0 flex-1">
											<h3 class="font-medium text-gray-900 line-clamp-2">
												{vote.billTitle}
											</h3>
											<p class="mt-1 text-sm text-gray-600">
												{vote.billId}
											</p>
										</div>
										<div class="flex-shrink-0 text-right">
											<time
												datetime={new Date(vote.date).toISOString()}
												class="inline-flex items-center text-xs text-gray-500"
											>
												<Calendar class="mr-1 h-3 w-3" />
												{new Date(vote.date).toLocaleDateString('en-US', {
													month: 'short',
													day: 'numeric',
													year: 'numeric'
												})}
											</time>
										</div>
									</div>

									<!-- Result Badge -->
									<div class="mt-2">
										<span
											class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium
												{vote.result === 'passed'
												? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
												: 'bg-red-50 text-red-700 border border-red-200'}"
										>
											{vote.result === 'passed' ? 'Passed' : 'Failed'}
										</span>
									</div>
								</div>
							</div>

							<!-- L2: Vote Context (Recognition - Hover State) -->
							{#if hoveredVoteIndex === index}
								<div
									class="absolute left-full top-0 z-20 ml-4 mt-0"
									style="pointer-events: none;"
								>
									<VoteContext
										vote={transformVoteForContext(vote)}
										onViewFull={() => handleVoteClick(index)}
									/>
								</div>
							{/if}
						</div>
					{/each}
				</div>

				<!-- Pagination/Load More (Future Enhancement) -->
				<div class="border-t border-gray-200 px-6 py-4 text-center sm:px-8">
					<p class="text-sm text-gray-600">
						Showing {data.voteHistory.votes.length} recent votes
					</p>
				</div>
			{:else}
				<div class="px-6 py-12 text-center sm:px-8">
					<div class="mx-auto max-w-sm">
						<TrendingUp class="mx-auto h-12 w-12 text-gray-400" />
						<h3 class="mt-4 text-sm font-medium text-gray-900">No votes available</h3>
						<p class="mt-2 text-sm text-gray-600">
							Vote history is not available for this representative.
						</p>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- L3: Roll Call Modal (Focal Immersion) -->
{#if selectedVoteIndex !== null && data.voteHistory}
	{@const selectedVote = data.voteHistory.votes[selectedVoteIndex]}
	<SimpleModal
		title="Full Roll Call"
		maxWidth="max-w-4xl"
		onclose={closeModal}
	>
		<RollCall {...transformVoteForRollCall(selectedVote)} />
	</SimpleModal>
{/if}

<style>
	/* Ensure hover context doesn't get cut off */
	:global(body) {
		overflow-x: hidden;
	}

	/* Smooth transitions respecting motion preferences */
	@media (prefers-reduced-motion: no-preference) {
		.transition-colors {
			transition-property: background-color, border-color, color;
			transition-duration: 150ms;
			transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
		}
	}

	/* Focus visible for keyboard navigation */
	[role='button']:focus-visible {
		outline: 2px solid theme('colors.congressional.500');
		outline-offset: 2px;
	}
</style>
