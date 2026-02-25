<script lang="ts">
	import { Shield, Activity, Layers, Clock, Heart } from '@lucide/svelte';

	interface TierBoundary {
		tier: number;
		label: string;
		minScore: number;
	}

	interface Props {
		currentTier: number;
		compositeScore?: number;
		metrics?: {
			actionCount: number;
			diversityScore: number;
			shannonH: number;
			tenureMonths: number;
			adoptionCount: number;
		};
		factors?: {
			action: number;
			diversity: number;
			tenure: number;
			adoption: number;
		};
		tierBoundaries?: TierBoundary[];
		mode?: 'badge' | 'tooltip';
	}

	let {
		currentTier,
		compositeScore,
		metrics,
		factors,
		tierBoundaries,
		mode = 'badge'
	}: Props = $props();

	const DEFAULT_BOUNDARIES: TierBoundary[] = [
		{ tier: 0, label: 'New', minScore: 0 },
		{ tier: 1, label: 'Active', minScore: 0.001 },
		{ tier: 2, label: 'Established', minScore: 5.0 },
		{ tier: 3, label: 'Veteran', minScore: 12.0 },
		{ tier: 4, label: 'Pillar', minScore: 25.0 }
	];

	const boundaries = $derived(tierBoundaries ?? DEFAULT_BOUNDARIES);
	const currentBoundary = $derived(boundaries.find((b) => b.tier === currentTier));
	const nextBoundary = $derived(boundaries.find((b) => b.tier === currentTier + 1));

	const tierColors: Record<number, { bg: string; text: string; border: string; ring: string }> = {
		0: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', ring: 'bg-slate-300' },
		1: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', ring: 'bg-sky-400' },
		2: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', ring: 'bg-indigo-500' },
		3: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', ring: 'bg-violet-500' },
		4: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', ring: 'bg-amber-500' }
	};

	const colors = $derived(tierColors[currentTier] ?? tierColors[0]);

	const weightMultiplier = $derived(currentTier === 0 ? 0 : Math.pow(2, currentTier));

	let showTooltip = $state(false);
	const hasBreakdown = $derived(!!metrics && !!factors);

	// Progress toward next tier (0-100)
	const progress = $derived(() => {
		if (!compositeScore || !nextBoundary) return 100;
		const currentMin = currentBoundary?.minScore ?? 0;
		const nextMin = nextBoundary.minScore;
		const range = nextMin - currentMin;
		if (range <= 0) return 100;
		return Math.min(100, Math.round(((compositeScore - currentMin) / range) * 100));
	});
</script>

{#if mode === 'badge'}
	<div
		class="relative inline-flex"
		role="button"
		tabindex="0"
		onmouseenter={() => hasBreakdown && (showTooltip = true)}
		onmouseleave={() => (showTooltip = false)}
		onfocus={() => hasBreakdown && (showTooltip = true)}
		onblur={() => (showTooltip = false)}
	>
		<!-- Tier badge -->
		<div
			class="flex items-center gap-1 text-xs rounded-full px-2 py-0.5 border transition-colors
				{colors.bg} {colors.text} {colors.border}
				{hasBreakdown ? 'cursor-help' : ''}"
		>
			<Shield class="h-3 w-3" />
			<span class="font-medium">{currentBoundary?.label ?? `Tier ${currentTier}`}</span>
			{#if weightMultiplier > 1}
				<span class="opacity-60">{weightMultiplier}x</span>
			{/if}
		</div>

		<!-- Tooltip popover -->
		{#if showTooltip && hasBreakdown}
			<div
				class="absolute z-50 left-0 top-full mt-2 w-72
					bg-white rounded-lg shadow-lg border border-slate-200 p-4
					animate-in fade-in-0 zoom-in-95"
			>
				<!-- Header -->
				<div class="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
					<div class="flex items-center justify-center h-7 w-7 rounded-full {colors.bg}">
						<Shield class="h-4 w-4 {colors.text}" />
					</div>
					<div>
						<div class="text-sm font-semibold text-slate-900">
							{currentBoundary?.label ?? `Tier ${currentTier}`}
						</div>
						{#if compositeScore !== undefined}
							<div class="text-xs text-slate-500">
								Score: {compositeScore.toFixed(1)}
								{#if nextBoundary}
									<span class="text-slate-400">/ {nextBoundary.minScore} for {nextBoundary.label}</span>
								{/if}
							</div>
						{/if}
					</div>
				</div>

				<!-- Progress bar -->
				{#if nextBoundary && compositeScore !== undefined}
					<div class="mb-3">
						<div class="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
							<div
								class="h-full rounded-full transition-all duration-500 {colors.ring}"
								style="width: {progress()}%"
							></div>
						</div>
						<div class="flex justify-between mt-0.5 text-[10px] text-slate-400">
							<span>{currentBoundary?.label}</span>
							<span>{nextBoundary.label}</span>
						</div>
					</div>
				{/if}

				<!-- Metric breakdown -->
				{#if metrics && factors}
					<div class="space-y-2">
						<div class="flex items-center justify-between text-xs">
							<div class="flex items-center gap-1.5 text-slate-600">
								<Activity class="h-3 w-3 text-sky-500" />
								<span>Actions</span>
							</div>
							<span class="font-mono text-slate-800">{metrics.actionCount}</span>
						</div>
						<div class="flex items-center justify-between text-xs">
							<div class="flex items-center gap-1.5 text-slate-600">
								<Layers class="h-3 w-3 text-indigo-500" />
								<span>Diversity</span>
							</div>
							<span class="font-mono text-slate-800">{metrics.shannonH.toFixed(2)} H</span>
						</div>
						<div class="flex items-center justify-between text-xs">
							<div class="flex items-center gap-1.5 text-slate-600">
								<Clock class="h-3 w-3 text-violet-500" />
								<span>Tenure</span>
							</div>
							<span class="font-mono text-slate-800">{metrics.tenureMonths} mo</span>
						</div>
						{#if metrics.adoptionCount > 0}
							<div class="flex items-center justify-between text-xs">
								<div class="flex items-center gap-1.5 text-slate-600">
									<Heart class="h-3 w-3 text-rose-500" />
									<span>Adoptions</span>
								</div>
								<span class="font-mono text-slate-800">{metrics.adoptionCount}</span>
							</div>
						{/if}
					</div>
				{/if}

				<!-- Weight impact -->
				<div class="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
					{#if weightMultiplier > 0}
						Tier {currentTier} gives {weightMultiplier}x argument weight
					{:else}
						Tier 0 cannot participate in debates
					{/if}
				</div>

				<!-- Tier ladder -->
				<div class="mt-2 flex items-center gap-0.5">
					{#each boundaries as boundary}
						<div
							class="h-1 flex-1 rounded-full transition-colors
								{boundary.tier <= currentTier ? colors.ring : 'bg-slate-200'}"
							title="{boundary.label}: score >= {boundary.minScore}"
						></div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
{/if}
