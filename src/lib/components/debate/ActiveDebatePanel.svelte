<script lang="ts">
	import PropositionDisplay from './PropositionDisplay.svelte';
	import ArgumentCard from './ArgumentCard.svelte';
	import DebateMetrics from './DebateMetrics.svelte';
	import MarketPriceBar from './MarketPriceBar.svelte';
	import EpochPhaseIndicator from './EpochPhaseIndicator.svelte';
	import TradePanel from './TradePanel.svelte';
	import ResolutionPanel from './ResolutionPanel.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { ShieldCheck } from '@lucide/svelte';
	import type { DebateData } from '$lib/stores/debateState.svelte';
	import { debateState } from '$lib/stores/debateState.svelte';

	interface Props {
		debate: DebateData;
		userTrustTier?: number;
		onParticipate?: () => void;
		onCoSign?: (argumentIndex: number) => void;
		onCommit?: (trade: {
			argumentIndex: number;
			direction: 'BUY' | 'SELL';
			stakeAmount: number;
			weightedAmount: number;
			noteCommitment: string;
			proof?: Uint8Array;
		}) => void;
		onAppeal?: () => void;
		onEscalate?: () => void;
		onVerifyIdentity?: () => void;
	}

	let { debate, userTrustTier = 0, onParticipate, onCoSign, onCommit, onAppeal, onEscalate, onVerifyIdentity }: Props = $props();

	const hasMarket = $derived(
		debate.marketStatus === 'active' && Object.keys(debateState.lmsrPrices).length > 0
	);

	// Filter state
	type StanceFilter = 'all' | 'SUPPORT' | 'OPPOSE' | 'AMEND';
	let stanceFilter = $state<StanceFilter>('all');

	const filteredArguments = $derived(
		stanceFilter === 'all'
			? debate.arguments
			: debate.arguments.filter((a) => a.stance === stanceFilter)
	);

	const stanceCounts = $derived({
		all: debate.arguments.length,
		SUPPORT: debate.arguments.filter((a) => a.stance === 'SUPPORT').length,
		OPPOSE: debate.arguments.filter((a) => a.stance === 'OPPOSE').length,
		AMEND: debate.arguments.filter((a) => a.stance === 'AMEND').length
	});

	const canParticipate = $derived(userTrustTier >= 3 && debate.status === 'active');

	const filterButtons: { label: string; value: StanceFilter; color: string }[] = [
		{ label: 'All', value: 'all', color: 'text-slate-700' },
		{ label: 'Support', value: 'SUPPORT', color: 'text-indigo-700' },
		{ label: 'Oppose', value: 'OPPOSE', color: 'text-red-700' },
		{ label: 'Amend', value: 'AMEND', color: 'text-amber-700' }
	];
</script>

<div class="space-y-4">
	<!-- Resolution panel (replaces simple banner when AI resolution data exists) -->
	{#if debate.status !== 'active' && debate.aiResolution}
		<ResolutionPanel {debate} {onAppeal} {onEscalate} />
	{:else if debate.status === 'resolved' && debate.winningStance}
		<!-- Fallback: community-only resolution (no AI data) -->
		{@const stanceColors: Record<string, string> = {
			SUPPORT: 'bg-indigo-50 border-indigo-200 text-indigo-800',
			OPPOSE: 'bg-red-50 border-red-200 text-red-800',
			AMEND: 'bg-amber-50 border-amber-200 text-amber-800'
		}}
		<div class="rounded-lg border p-3 {stanceColors[debate.winningStance] ?? 'bg-slate-50 border-slate-200 text-slate-800'}">
			<p class="text-sm font-medium">
				Resolved — winning stance: <span class="font-semibold">{debate.winningStance}</span>
			</p>
			{#if debate.resolvedAt}
				<p class="text-xs mt-0.5 opacity-70">
					{new Date(debate.resolvedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
				</p>
			{/if}
		</div>
	{/if}

	<!-- Proposition -->
	<PropositionDisplay
		propositionText={debate.propositionText}
		propositionHash={debate.propositionHash}
		status={debate.status}
	/>

	<!-- Metrics -->
	<DebateMetrics
		argumentCount={debate.argumentCount}
		uniqueParticipants={debate.uniqueParticipants}
		totalStake={debate.totalStake}
		deadline={debate.deadline}
		jurisdictionSize={debate.jurisdictionSize}
		status={debate.status}
	/>

	<!-- LMSR Market -->
	{#if hasMarket}
		<div class="space-y-3">
			<div class="flex items-center justify-between">
				<MarketPriceBar
					prices={debateState.lmsrPrices}
					arguments={debate.arguments}
				/>
			</div>
			<EpochPhaseIndicator
				phase={debateState.epochPhase}
				secondsRemaining={debateState.epochSecondsRemaining}
				epoch={debate.currentEpoch ?? 0}
			/>
		</div>
	{/if}

	<!-- Stance filter tabs -->
	{#if debate.arguments.length > 0}
		<div class="flex items-center gap-1 border-b border-slate-200 pb-1">
			{#each filterButtons as btn}
				{@const count = stanceCounts[btn.value]}
				{#if btn.value === 'all' || count > 0}
					<button
						class="px-3 py-1.5 text-sm font-medium rounded-t transition-colors
							{stanceFilter === btn.value
							? `${btn.color} bg-white border border-b-white border-slate-200 -mb-px`
							: 'text-slate-500 hover:text-slate-700'}"
						onclick={() => (stanceFilter = btn.value)}
					>
						{btn.label}
						{#if count > 0}
							<span class="ml-1 text-xs text-slate-400">({count})</span>
						{/if}
					</button>
				{/if}
			{/each}
		</div>
	{/if}

	<!-- Arguments stack -->
	<div class="space-y-3">
		{#each filteredArguments as argument, i (argument.id)}
			<ArgumentCard
				{argument}
				isWinner={debate.status === 'resolved' &&
					argument.argumentIndex === debate.winningArgumentIndex}
				rank={i + 1}
			/>
		{/each}

		{#if filteredArguments.length === 0 && debate.arguments.length > 0}
			<p class="text-sm text-slate-500 py-4 text-center">
				No {stanceFilter.toLowerCase()} arguments yet.
			</p>
		{:else if debate.arguments.length === 0}
			<div class="text-center py-8">
				<p class="text-slate-500 text-sm">No arguments submitted yet. Be the first to weigh in.</p>
			</div>
		{/if}
	</div>

	<!-- Trade panel -->
	{#if hasMarket && debate.status === 'active' && userTrustTier >= 3}
		<TradePanel
			{debate}
			prices={debateState.lmsrPrices}
			epochPhase={debateState.epochPhase}
			engagementTier={userTrustTier}
			{onCommit}
		/>
	{/if}

	<!-- Participate CTA -->
	{#if canParticipate}
		<div class="pt-2">
			<Button variant="community" onclick={onParticipate}>
				Add your argument
			</Button>
		</div>
	{:else if debate.status === 'active' && userTrustTier < 3}
		<div class="pt-3 mt-1 border-t border-amber-200/30">
			<p class="text-sm text-slate-600">
				Verified participants can add arguments and stake their credibility.
			</p>
			{#if onVerifyIdentity}
				<button
					class="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-amber-700
						hover:text-amber-800 transition-colors"
					onclick={onVerifyIdentity}
				>
					<ShieldCheck class="h-4 w-4" />
					Verify your identity to join this deliberation
				</button>
			{/if}
		</div>
	{/if}
</div>
