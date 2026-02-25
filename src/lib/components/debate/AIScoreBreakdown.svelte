<script lang="ts">
	/**
	 * Dimension score breakdown for a single argument's AI evaluation.
	 *
	 * Perceptual design: Each dimension is a horizontal bar whose length
	 * encodes the score at peripheral bandwidth (~2 bits/sec = "low/high").
	 * Exact numbers available on hover (focal bandwidth).
	 *
	 * The weighted contribution of each dimension is encoded by bar opacity:
	 * reasoning (30%) is most saturated, feasibility (10%) most transparent.
	 * This lets the eye immediately grasp *which dimensions mattered*.
	 */
	import { spring } from 'svelte/motion';
	import type { DimensionScores } from '$lib/stores/debateState.svelte';

	interface Props {
		scores: DimensionScores;
		compact?: boolean;
		animated?: boolean;
	}

	let { scores, compact = false, animated = true }: Props = $props();

	const DIMENSIONS: { key: keyof DimensionScores; label: string; weight: number; color: string }[] = [
		{ key: 'reasoning', label: 'Reasoning', weight: 3000, color: 'bg-violet-500' },
		{ key: 'accuracy', label: 'Accuracy', weight: 2500, color: 'bg-blue-500' },
		{ key: 'evidence', label: 'Evidence', weight: 2000, color: 'bg-cyan-500' },
		{ key: 'constructiveness', label: 'Constructive', weight: 1500, color: 'bg-teal-500' },
		{ key: 'feasibility', label: 'Feasibility', weight: 1000, color: 'bg-slate-400' }
	];

	// Individual springs — Svelte's $ prefix requires named stores, not array indices
	const reasoningWidth = spring(0, { stiffness: 0.3, damping: 0.85 });
	const accuracyWidth = spring(0, { stiffness: 0.3, damping: 0.85 });
	const evidenceWidth = spring(0, { stiffness: 0.3, damping: 0.85 });
	const constructivenessWidth = spring(0, { stiffness: 0.3, damping: 0.85 });
	const feasibilityWidth = spring(0, { stiffness: 0.3, damping: 0.85 });

	const springMap: Record<keyof DimensionScores, typeof reasoningWidth> = {
		reasoning: reasoningWidth,
		accuracy: accuracyWidth,
		evidence: evidenceWidth,
		constructiveness: constructivenessWidth,
		feasibility: feasibilityWidth
	};

	$effect(() => {
		for (const dim of DIMENSIONS) {
			const pct = (scores[dim.key] / 10000) * 100;
			if (animated) {
				springMap[dim.key].set(pct);
			} else {
				springMap[dim.key].set(pct, { hard: true });
			}
		}
	});

	// Weighted score computed locally for the summary
	const weightedScore = $derived(
		Math.floor(
			DIMENSIONS.reduce((sum, dim) => sum + scores[dim.key] * dim.weight, 0) / 10000
		)
	);

	function formatBp(bp: number): string {
		return (bp / 100).toFixed(1) + '%';
	}

	function getWidth(key: keyof DimensionScores): number {
		switch (key) {
			case 'reasoning': return $reasoningWidth;
			case 'accuracy': return $accuracyWidth;
			case 'evidence': return $evidenceWidth;
			case 'constructiveness': return $constructivenessWidth;
			case 'feasibility': return $feasibilityWidth;
		}
	}
</script>

<div class="space-y-{compact ? '1' : '1.5'}">
	{#each DIMENSIONS as dim}
		{@const value = scores[dim.key]}
		{@const opacity = 0.4 + (dim.weight / 3000) * 0.6}
		{@const w = getWidth(dim.key)}
		<div class="group flex items-center gap-2" title="{dim.label}: {formatBp(value)} (weight: {dim.weight / 100}%)">
			{#if !compact}
				<span class="w-24 text-xs text-slate-500 text-right tabular-nums shrink-0">
					{dim.label}
				</span>
			{/if}
			<div class="flex-1 h-{compact ? '1' : '1.5'} rounded-full bg-slate-100 overflow-hidden">
				<div
					class="{dim.color} h-full rounded-full transition-none"
					style="width: {w.toFixed(1)}%; opacity: {opacity};"
				></div>
			</div>
			<span class="w-10 text-xs font-mono text-slate-600 tabular-nums text-right shrink-0
				{compact ? 'hidden group-hover:inline' : ''}">
				{formatBp(value)}
			</span>
		</div>
	{/each}

	<!-- Weighted total -->
	{#if !compact}
		<div class="flex items-center gap-2 pt-1 border-t border-slate-100">
			<span class="w-24 text-xs font-medium text-slate-700 text-right shrink-0">Weighted</span>
			<div class="flex-1"></div>
			<span class="w-10 text-xs font-mono font-semibold text-slate-800 tabular-nums text-right shrink-0">
				{formatBp(weightedScore)}
			</span>
		</div>
	{/if}
</div>
