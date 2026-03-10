<script lang="ts">
	import PropositionDisplay from './PropositionDisplay.svelte';
	import ArgumentCard from './ArgumentCard.svelte';
	import MarketPriceBar from './MarketPriceBar.svelte';
	import EpochPhaseIndicator from './EpochPhaseIndicator.svelte';
	import TradePanel from './TradePanel.svelte';
	import ResolutionPanel from './ResolutionPanel.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { ShieldCheck } from '@lucide/svelte';
	import type { DebateData } from '$lib/stores/debateState.svelte';
	import { debateState } from '$lib/stores/debateState.svelte';
	import { computeStanceCounts } from '$lib/utils/debate-stats';

	// Fetch actual engagement tier from Shadow Atlas (voter-protocol reputation).
	// Trust tier (identity verification, 0-5) != engagement tier (civic participation, 0-4).
	let userEngagementTier = $state(0);
	let engagementTierLoaded = $state(false);

	async function fetchEngagementTier() {
		try {
			const res = await fetch('/api/shadow-atlas/engagement', { method: 'POST' });
			if (res.ok) {
				const data = await res.json();
				userEngagementTier = data.engagementTier ?? 0;
			}
		} catch {
			// Graceful degradation: tier-0 default (same as Shadow Atlas endpoint)
		} finally {
			engagementTierLoaded = true;
		}
	}

	$effect(() => {
		if (!engagementTierLoaded) {
			fetchEngagementTier();
		}
	});

	interface Props {
		debate: DebateData;
		userTrustTier?: number;
		onParticipate?: () => void;
		onCoSign?: (argumentIndex: number) => void;
		onCommit?: (trade: {
			argumentIndex: number;
			direction: 'BUY' | 'SELL';
			stakeAmount: number;
			weightedAmount: string;
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

	// Stance filter (driven by stance bar labels)
	type StanceFilter = 'all' | 'SUPPORT' | 'OPPOSE' | 'AMEND';
	let stanceFilter = $state<StanceFilter>('all');

	let preselectedTradeArgument = $state<number | null>(null);

	const filteredArguments = $derived(
		stanceFilter === 'all'
			? debate.arguments
			: debate.arguments.filter((a) => a.stance === stanceFilter)
	);

	// Stance distribution for the visual bar
	const _counts = $derived(computeStanceCounts(debate.arguments));

	type Stance = 'SUPPORT' | 'OPPOSE' | 'AMEND';
	const STANCE_ORDER: Stance[] = ['SUPPORT', 'OPPOSE', 'AMEND'];

	const stanceBarConfig: Record<Stance, { color: string; dotColor: string; label: string }> = {
		SUPPORT: { color: 'bg-indigo-500', dotColor: 'bg-indigo-500', label: 'Support' },
		OPPOSE: { color: 'bg-red-500', dotColor: 'bg-red-500', label: 'Oppose' },
		AMEND: { color: 'bg-amber-500', dotColor: 'bg-amber-500', label: 'Amend' }
	};

	const visibleStances = $derived.by(() => {
		const countMap: Record<Stance, number> = {
			SUPPORT: _counts.support,
			OPPOSE: _counts.oppose,
			AMEND: _counts.amend
		};
		const total = debate.arguments.length;
		if (total === 0) return [];

		return STANCE_ORDER
			.filter((s) => countMap[s] > 0)
			.map((s) => ({
				stance: s,
				...stanceBarConfig[s],
				pct: Math.round((countMap[s] / total) * 100),
				count: countMap[s]
			}));
	});

	// Normalized weight for argument bars
	const maxWeight = $derived(
		Math.max(...debate.arguments.map((a) => Number(BigInt(a.weightedScore))), 1)
	);

	const canParticipate = $derived(userTrustTier >= 3 && debate.status === 'active');

	// Inlined metrics
	const formattedStake = $derived.by(() => {
		const amount = Number(BigInt(debate.totalStake)) / 1e6;
		if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
		return `$${amount.toFixed(2)}`;
	});

	const timeRemaining = $derived.by(() => {
		if (debate.status !== 'active') return debate.status === 'resolved' ? 'Resolved' : 'Deadline passed';
		const now = Date.now();
		const end = new Date(debate.deadline).getTime();
		const diff = end - now;
		if (diff <= 0) return 'Ended';
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));
		const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
		if (days > 0) return `${days}d ${hours}h left`;
		const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
		if (hours > 0) return `${hours}h ${minutes}m left`;
		return `${minutes}m left`;
	});
</script>

<div class="space-y-4">
	<!-- Resolution panel -->
	{#if debate.status !== 'active' && debate.aiResolution}
		<ResolutionPanel {debate} {onAppeal} {onEscalate} />
	{:else if debate.status === 'resolved' && debate.winningStance}
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
	/>

	<!-- Stance bar + interactive labels + metrics -->
	{#if visibleStances.length > 0}
		<div class="space-y-1.5">
			<!-- Visual bar -->
			<div class="flex w-full h-1.5 rounded-full overflow-hidden" role="img" aria-label="Stance distribution">
				{#each visibleStances as s}
					<div class="{s.color}" style="width: {s.pct}%"></div>
				{/each}
			</div>
			<!-- Labels (filter toggles) + metrics in one row -->
			<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
				{#each visibleStances as s}
					<button
						class="font-medium transition-opacity cursor-pointer text-slate-600
							{stanceFilter !== 'all' && stanceFilter !== s.stance ? 'opacity-40' : 'opacity-100'}"
						onclick={() => (stanceFilter = stanceFilter === s.stance ? 'all' : s.stance)}
					>
						{s.label} <span class="font-mono text-slate-400">{s.pct}%</span>
					</button>
				{/each}
				<span class="text-slate-300">&middot;</span>
				<span class="text-slate-400">
					{debate.uniqueParticipants} voice{debate.uniqueParticipants === 1 ? '' : 's'}
					&middot; {formattedStake}
					&middot; <span
						class:text-amber-600={debate.status === 'active'}
						class:text-slate-400={debate.status !== 'active'}
					>{timeRemaining}</span>
				</span>
			</div>
		</div>
	{/if}

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

	<!-- Argument stack (collapsed handles) -->
	<div class="divide-y divide-slate-100">
		{#each filteredArguments as argument, i (argument.id)}
			<ArgumentCard
				{argument}
				normalizedWeight={Math.round((Number(BigInt(argument.weightedScore)) / maxWeight) * 100)}
				isWinner={debate.status === 'resolved' &&
					argument.argumentIndex === debate.winningArgumentIndex}
				rank={i + 1}
				canCoSign={canParticipate}
				{onCoSign}
				canTrade={hasMarket && canParticipate && debateState.epochPhase === 'commit'}
				onTradeOn={(argIdx) => {
					preselectedTradeArgument = argIdx;
					const tradePanel = document.querySelector('[data-trade-panel]');
					if (tradePanel) {
						tradePanel.scrollIntoView({ behavior: 'smooth' });
					}
				}}
			/>
		{/each}

		{#if filteredArguments.length === 0 && debate.arguments.length > 0}
			<p class="text-sm text-slate-500 py-4">
				No {stanceFilter.toLowerCase()} arguments yet.
			</p>
		{:else if debate.arguments.length === 0}
			<p class="text-sm text-slate-500 py-4">
				No arguments submitted yet. Be the first to weigh in.
			</p>
		{/if}
	</div>

	<!-- Trade panel -->
	{#if hasMarket && debate.status === 'active' && userTrustTier >= 3}
		<div data-trade-panel>
			<TradePanel
				{debate}
				prices={debateState.lmsrPrices}
				epochPhase={debateState.epochPhase}
				engagementTier={userEngagementTier}
				{onCommit}
				preselectedArgument={preselectedTradeArgument}
			/>
		</div>
	{/if}

	<!-- Participate CTA -->
	{#if canParticipate}
		<div class="pt-2">
			<Button variant="community" onclick={onParticipate}>
				Add your argument
			</Button>
		</div>
	{:else if debate.status === 'active' && userTrustTier < 3}
		<div class="pt-2 space-y-2">
			<p class="text-sm text-slate-500">
				Verified participants can add arguments and stake their credibility.
			</p>
			{#if onVerifyIdentity}
				<button
					class="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500
						hover:text-slate-700 transition-colors"
					onclick={onVerifyIdentity}
				>
					<ShieldCheck class="h-3.5 w-3.5" />
					Verify your identity to join
				</button>
			{/if}
		</div>
	{/if}
</div>
