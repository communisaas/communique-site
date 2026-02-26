<script lang="ts">
	import { ShieldCheck, AlertTriangle, PenLine, Loader2 } from '@lucide/svelte';
	import type { DebateData } from '$lib/stores/debateState.svelte';
	import { computeStanceCounts, computeStancePercentages, formatTimeRemaining } from '$lib/utils/debate-stats';

	interface Props {
		debate: DebateData | null;
		variant?: 'inline' | 'compact';
	}

	let { debate, variant = 'inline' }: Props = $props();

	// ── Status flags ──────────────────────────────────────────────────────────

	const isActive = $derived(debate?.status === 'active');
	const isResolving = $derived(
		debate?.status === 'resolving' ||
			debate?.status === 'awaiting_governance' ||
			debate?.status === 'under_appeal'
	);
	const isResolved = $derived(debate?.status === 'resolved');

	// ── Stance distribution ───────────────────────────────────────────────────

	const stanceCounts = $derived(computeStanceCounts(debate?.arguments));
	const totalArgs = $derived(stanceCounts.support + stanceCounts.oppose + stanceCounts.amend);
	const pcts = $derived(computeStancePercentages(stanceCounts));
	const supportPct = $derived(pcts.supportPct);
	const opposePct = $derived(pcts.opposePct);
	const amendPct = $derived(pcts.amendPct);

	// ── Time remaining ────────────────────────────────────────────────────────

	const timeRemaining = $derived(formatTimeRemaining(debate?.deadline));

	// ── Participant threshold for showing the stance bar ─────────────────────

	const isGrowing = $derived(isActive && (debate?.uniqueParticipants ?? 0) >= 5);
	const uniqueParticipants = $derived(debate?.uniqueParticipants ?? 0);
</script>

{#if debate !== null}
	{#if isResolved}
		<!--
			Resolved states: pill badges that signal the deliberation outcome.
			The color system maps directly to the stance that won:
			  emerald  → SUPPORT (community tested and validated)
			  red      → OPPOSE  (framing contested, proceed with caution)
			  amber    → AMEND   (amendment proposed, modified framing available)
		-->
		{#if debate.winningStance === 'SUPPORT'}
			<div
				class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/60 bg-emerald-50 px-2.5 py-1 text-sm"
			>
				<ShieldCheck class="h-3.5 w-3.5 text-emerald-600" />
				<span class="font-medium text-emerald-700">Community-tested</span>
				{#if variant === 'inline'}
					<span class="text-emerald-600/70">· {uniqueParticipants} deliberated</span>
				{/if}
			</div>
		{:else if debate.winningStance === 'OPPOSE'}
			<div
				class="inline-flex items-center gap-1.5 rounded-full border border-red-200/60 bg-red-50 px-2.5 py-1 text-sm"
			>
				<AlertTriangle class="h-3.5 w-3.5 text-red-600" />
				<span class="font-medium text-red-700">Framing contested</span>
				{#if variant === 'inline'}
					<span class="text-red-600/70">· see deliberation</span>
				{/if}
			</div>
		{:else if debate.winningStance === 'AMEND'}
			<div
				class="inline-flex items-center gap-1.5 rounded-full border border-amber-200/60 bg-amber-50 px-2.5 py-1 text-sm"
			>
				<PenLine class="h-3.5 w-3.5 text-amber-600" />
				<span class="font-medium text-amber-700">Amendment proposed</span>
				{#if variant === 'inline'}
					<span class="text-amber-600/70">· see deliberation</span>
				{/if}
			</div>
		{/if}
	{:else if isResolving}
		<!--
			In-between state: debate concluded but outcome not yet committed.
			Covers 'resolving', 'awaiting_governance', and 'under_appeal'.
			A neutral spinner avoids premature stance signaling.
		-->
		<div class="flex items-center gap-1.5 text-sm text-slate-500">
			<Loader2 class="h-3.5 w-3.5 animate-spin" />
			<span>Deliberation resolving...</span>
		</div>
	{:else if isActive}
		{#if isGrowing}
			<!--
				Active + growing (5+ participants): show the stance distribution bar.
				The three-segment bar gives the user a quick read on which direction
				the deliberation is leaning without requiring them to open the full
				debate surface. Widths use inline styles because Tailwind cannot
				generate arbitrary percentage widths from runtime values.
			-->
			<div class="flex items-center gap-2.5 text-sm">
				<span
					class="debate-dot h-2 w-2 shrink-0 rounded-full bg-amber-500"
				></span>
				<div
					class="flex h-1.5 w-16 overflow-hidden rounded-full"
					role="img"
					aria-label="Stance distribution: {stanceCounts.support} support, {stanceCounts.oppose} oppose, {stanceCounts.amend} amend"
				>
					{#if stanceCounts.support > 0}
						<div class="bg-indigo-500" style="width: {supportPct}%"></div>
					{/if}
					{#if stanceCounts.oppose > 0}
						<div class="bg-red-500" style="width: {opposePct}%"></div>
					{/if}
					{#if stanceCounts.amend > 0}
						<div class="bg-amber-500" style="width: {amendPct}%"></div>
					{/if}
				</div>
				<span class="text-slate-600">{uniqueParticipants} debating</span>
				<span class="text-slate-400">· {timeRemaining}</span>
			</div>
		{:else}
			<!--
				Active + nascent (<5 participants): stance bar would be misleading
				with so few data points. Show a simpler ambient signal instead.
			-->
			<div class="flex items-center gap-2 text-sm">
				<span
					class="debate-dot h-2 w-2 shrink-0 rounded-full bg-amber-500"
				></span>
				<span class="font-medium text-amber-700">Deliberation open</span>
				<span class="text-slate-500">· {uniqueParticipants} arguing</span>
			</div>
		{/if}
	{/if}
{/if}

<style>
	.debate-dot {
		animation: debate-signal-pulse 1.4s ease-in-out infinite;
	}

	@keyframes debate-signal-pulse {
		0%,
		100% {
			opacity: 0.5;
		}
		50% {
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.debate-dot {
			animation: none;
			opacity: 1;
		}
	}
</style>
