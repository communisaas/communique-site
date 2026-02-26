<script lang="ts">
	import { Users, TrendingUp, UserPlus } from '@lucide/svelte';
	import type { ArgumentData } from '$lib/stores/debateState.svelte';
	import TierExplanation from './TierExplanation.svelte';

	interface Props {
		argument: ArgumentData;
		isWinner?: boolean;
		rank?: number;
		tierBreakdown?: {
			compositeScore: number;
			metrics: {
				actionCount: number;
				diversityScore: number;
				shannonH: number;
				tenureMonths: number;
				adoptionCount: number;
			};
			factors: {
				action: number;
				diversity: number;
				tenure: number;
				adoption: number;
			};
			tierBoundaries: Array<{ tier: number; label: string; minScore: number }>;
		};
		// Interaction affordances (Wave 4: co-sign + trade bridge)
		canCoSign?: boolean;
		onCoSign?: (argumentIndex: number) => void;
		canTrade?: boolean;
		onTradeOn?: (argumentIndex: number) => void;
	}

	let { argument, isWinner = false, rank, tierBreakdown, canCoSign = false, onCoSign, canTrade = false, onTradeOn }: Props = $props();

	const stanceBorder: Record<string, string> = {
		SUPPORT: 'border-l-indigo-500',
		OPPOSE: 'border-l-red-500',
		AMEND: 'border-l-amber-500'
	};

	const stanceLabel: Record<string, string> = {
		SUPPORT: 'Supports',
		OPPOSE: 'Opposes',
		AMEND: 'Amends'
	};

	const stanceBadge: Record<string, string> = {
		SUPPORT: 'bg-indigo-50 text-indigo-700 border-indigo-200',
		OPPOSE: 'bg-red-50 text-red-700 border-red-200',
		AMEND: 'bg-amber-50 text-amber-700 border-amber-200'
	};

	// Format stake for display (6-decimal token → human readable)
	const formattedStake = $derived.by(() => {
		const amount = Number(BigInt(argument.stakeAmount)) / 1e6;
		return amount >= 1000 ? `$${(amount / 1000).toFixed(1)}k` : `$${amount.toFixed(2)}`;
	});

	const formattedWeight = $derived.by(() => {
		const weight = Number(BigInt(argument.weightedScore));
		return weight >= 1000 ? `${(weight / 1000).toFixed(1)}k` : weight.toString();
	});

	let expanded = $state(false);
	const shouldTruncate = $derived(argument.body.length > 280);
	const displayBody = $derived(
		shouldTruncate && !expanded ? argument.body.slice(0, 280) + '...' : argument.body
	);
</script>

<article
	class="border-l-4 rounded-r-lg bg-white p-4 transition-shadow
		{stanceBorder[argument.stance] ?? 'border-l-slate-300'}
		{isWinner ? 'ring-2 ring-amber-300 shadow-md' : 'shadow-sm hover:shadow-md'}"
>
	<!-- Header: stance + tier + rank -->
	<div class="flex items-center gap-2 mb-2">
		<span
			class="inline-flex items-center text-xs font-medium rounded-full px-2 py-0.5 border
				{stanceBadge[argument.stance] ?? 'bg-slate-50 text-slate-700 border-slate-200'}"
		>
			{stanceLabel[argument.stance] ?? argument.stance}
		</span>

		<TierExplanation
			currentTier={argument.engagementTier}
			compositeScore={tierBreakdown?.compositeScore}
			metrics={tierBreakdown?.metrics}
			factors={tierBreakdown?.factors}
			tierBoundaries={tierBreakdown?.tierBoundaries}
		/>

		{#if isWinner}
			<span class="ml-auto text-xs font-semibold text-amber-700 bg-amber-50 rounded-full px-2 py-0.5 border border-amber-200">
				Winner
			</span>
		{:else if rank !== undefined}
			<span class="ml-auto text-xs text-slate-400">#{rank}</span>
		{/if}
	</div>

	<!-- Body -->
	<p class="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{displayBody}</p>
	{#if shouldTruncate}
		<button
			class="mt-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
			onclick={() => (expanded = !expanded)}
		>
			{expanded ? 'Show less' : 'Read more'}
		</button>
	{/if}

	{#if argument.stance === 'AMEND' && argument.amendmentText}
		<div class="mt-3 rounded bg-amber-50/50 border border-amber-100 p-3">
			<p class="text-xs font-medium text-amber-800 mb-1">Proposed amendment</p>
			<p class="text-sm text-amber-900 leading-relaxed">{argument.amendmentText}</p>
		</div>
	{/if}

	<!-- Footer: metrics -->
	<div class="mt-3 flex items-center gap-4 text-xs text-slate-500">
		<div class="flex items-center gap-1" title="Staked amount">
			<TrendingUp class="h-3 w-3" />
			<span>{formattedStake}</span>
		</div>
		<div class="flex items-center gap-1" title="Weighted score: sqrt(stake) x 2^tier">
			<span class="font-medium text-slate-700">Weight: {formattedWeight}</span>
		</div>
		{#if argument.coSignCount > 0}
			<div class="flex items-center gap-1" title="Co-signers">
				<Users class="h-3 w-3" />
				<span>{argument.coSignCount} co-sign{argument.coSignCount === 1 ? '' : 's'}</span>
			</div>
		{/if}
		{#if argument.finalScore !== undefined}
			<div class="ml-auto flex items-center gap-1.5" title="AI-blended final score">
				<span class="font-mono font-semibold text-violet-600">
					{(argument.finalScore / 100).toFixed(1)}%
				</span>
				{#if argument.modelAgreement !== undefined}
					<div class="flex items-center gap-0.5" title="{Math.round(argument.modelAgreement * 100)}% model agreement">
						{#each Array(5) as _, i}
							<div class="rounded-full h-1 w-1
								{i < Math.round(argument.modelAgreement * 5)
									? 'bg-emerald-400'
									: 'bg-slate-200'}">
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>

	{#if canCoSign || canTrade}
		<div class="mt-2 flex items-center gap-2 border-t border-slate-100 pt-2">
			{#if canCoSign && onCoSign}
				<button
					class="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium
						   text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
					onclick={() => onCoSign(argument.argumentIndex)}
				>
					<UserPlus class="h-3 w-3" />
					Co-sign
				</button>
			{/if}
			{#if canTrade && onTradeOn}
				<button
					class="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium
						   text-indigo-500 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
					onclick={() => onTradeOn(argument.argumentIndex)}
				>
					<TrendingUp class="h-3 w-3" />
					Stake on this
				</button>
			{/if}
		</div>
	{/if}
</article>
