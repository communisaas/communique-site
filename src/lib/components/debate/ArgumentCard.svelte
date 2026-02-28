<script lang="ts">
	import { UserPlus, TrendingUp } from '@lucide/svelte';
	import type { ArgumentData } from '$lib/stores/debateState.svelte';
	import TierExplanation from './TierExplanation.svelte';

	interface Props {
		argument: ArgumentData;
		normalizedWeight?: number; // 0-100, proportional to max in debate
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
		canCoSign?: boolean;
		onCoSign?: (argumentIndex: number) => void;
		canTrade?: boolean;
		onTradeOn?: (argumentIndex: number) => void;
	}

	let {
		argument,
		normalizedWeight = 50,
		isWinner = false,
		rank,
		tierBreakdown,
		canCoSign = false,
		onCoSign,
		canTrade = false,
		onTradeOn
	}: Props = $props();

	const stanceBarColor: Record<string, string> = {
		SUPPORT: 'bg-indigo-400',
		OPPOSE: 'bg-red-400',
		AMEND: 'bg-amber-400'
	};

	const stanceText: Record<string, string> = {
		SUPPORT: 'text-indigo-600',
		OPPOSE: 'text-red-600',
		AMEND: 'text-amber-600'
	};

	const stanceLabel: Record<string, string> = {
		SUPPORT: 'Supports',
		OPPOSE: 'Opposes',
		AMEND: 'Amends'
	};

	const formattedStake = $derived.by(() => {
		const amount = Number(BigInt(argument.stakeAmount)) / 1e6;
		return `$${amount.toFixed(2)}`;
	});

	let expanded = $state(false);
</script>

<div class="py-2.5 {isWinner && expanded ? 'bg-amber-50/40 -mx-1 px-1 rounded' : ''}">
	<!-- Collapsed handle: weight bar + text fragment -->
	<button
		class="w-full text-left group cursor-pointer"
		onclick={() => (expanded = !expanded)}
		aria-expanded={expanded}
	>
		<!-- Weight bar -->
		<div
			class="h-1 rounded-full mb-1.5 transition-all {stanceBarColor[argument.stance] ?? 'bg-slate-300'}"
			style="width: {Math.max(normalizedWeight, 8)}%"
		></div>
		<!-- Text fragment + co-sign count -->
		<div class="flex items-baseline gap-2">
			<p class="flex-1 text-sm text-slate-600 group-hover:text-slate-800 transition-colors {expanded ? '' : 'line-clamp-1'}">
				{#if !expanded}{argument.body}{/if}
			</p>
			{#if !expanded && argument.coSignCount > 0}
				<span class="text-xs text-slate-400 tabular-nums shrink-0">&times;{argument.coSignCount}</span>
			{/if}
			{#if !expanded && isWinner}
				<span class="text-xs font-medium text-amber-600 shrink-0">Winner</span>
			{/if}
		</div>
	</button>

	<!-- Expanded: full argument content -->
	{#if expanded}
		<div class="mt-2 space-y-2.5">
			<!-- Full body -->
			<p class="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{argument.body}</p>

			<!-- Amendment -->
			{#if argument.stance === 'AMEND' && argument.amendmentText}
				<div class="pl-3 border-l-2 border-amber-200">
					<p class="text-xs text-amber-700 mb-0.5">Amendment</p>
					<p class="text-sm text-slate-700 leading-relaxed">{argument.amendmentText}</p>
				</div>
			{/if}

			<!-- Metadata: stance + tier + stake + weight -->
			<div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
				<span class="font-medium {stanceText[argument.stance] ?? 'text-slate-600'}">
					{stanceLabel[argument.stance] ?? argument.stance}
				</span>

				<TierExplanation
					currentTier={argument.engagementTier}
					compositeScore={tierBreakdown?.compositeScore}
					metrics={tierBreakdown?.metrics}
					factors={tierBreakdown?.factors}
					tierBoundaries={tierBreakdown?.tierBoundaries}
				/>

				<span>{formattedStake} staked</span>
				{#if argument.coSignCount > 0}
					<span>{argument.coSignCount} co-sign{argument.coSignCount === 1 ? '' : 's'}</span>
				{/if}
				{#if isWinner}
					<span class="font-medium text-amber-600">Winner</span>
				{/if}
				{#if rank !== undefined}
					<span class="text-slate-300">#{rank}</span>
				{/if}
			</div>

			<!-- AI scores (if resolved) -->
			{#if argument.finalScore !== undefined}
				<div class="flex items-center gap-1.5">
					<span class="font-mono text-xs font-semibold text-violet-600">
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

			<!-- Actions -->
			{#if canCoSign || canTrade}
				<div class="flex items-center gap-3">
					{#if canCoSign && onCoSign}
						<button
							class="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors min-h-[44px] sm:min-h-0"
							onclick={() => onCoSign(argument.argumentIndex)}
						>
							<UserPlus class="h-3 w-3" />
							Co-sign
						</button>
					{/if}
					{#if canTrade && onTradeOn}
						<button
							class="flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-600 transition-colors min-h-[44px] sm:min-h-0"
							onclick={() => onTradeOn(argument.argumentIndex)}
						>
							<TrendingUp class="h-3 w-3" />
							Stake on this
						</button>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>
