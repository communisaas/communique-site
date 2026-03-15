<script lang="ts">
	/**
	 * MinerLens — Per-miner score comparison heatmap.
	 *
	 * Perceptual design: Disagreement is signal, not noise. Where miners
	 * diverge from the median is the most interesting data — it reveals
	 * which dimensions of an argument were genuinely ambiguous to independent
	 * evaluators. Divergence is encoded via color (green/amber/red) while
	 * score magnitude is encoded by bar width. The two channels are separable
	 * by the perceptual system, so users get both simultaneously.
	 *
	 * The "Divergence summary" at the bottom surfaces the single most
	 * contested dimension — making the analytical headline immediately
	 * legible without requiring the user to scan across all cells.
	 */
	import type {
		MinerEvaluation,
		MinerArgumentEvaluation,
		DimensionScores
	} from '$lib/stores/debateState.svelte';
	import { Microscope } from '@lucide/svelte';

	interface Props {
		argumentIndex: number;
		minerEvaluations: MinerEvaluation[];
		medianScores: DimensionScores;
	}

	let { argumentIndex, minerEvaluations, medianScores }: Props = $props();

	const DIMENSIONS = [
		{ key: 'reasoning' as keyof DimensionScores, label: 'Reasoning', short: 'RSN' },
		{ key: 'accuracy' as keyof DimensionScores, label: 'Accuracy', short: 'ACC' },
		{ key: 'evidence' as keyof DimensionScores, label: 'Evidence', short: 'EVD' },
		{ key: 'constructiveness' as keyof DimensionScores, label: 'Constructive', short: 'CON' },
		{ key: 'feasibility' as keyof DimensionScores, label: 'Feasibility', short: 'FEA' }
	] as const;

	/** Engine badge colors — visually distinct, subtle */
	const ENGINE_COLORS: Record<string, { dot: string; badge: string; label: string }> = {
		groq: { dot: 'bg-orange-400', badge: 'bg-orange-50 text-orange-700 ring-orange-200', label: 'Groq' },
		gemini: { dot: 'bg-blue-400', badge: 'bg-blue-50 text-blue-700 ring-blue-200', label: 'Gemini' },
		ollama: { dot: 'bg-teal-400', badge: 'bg-teal-50 text-teal-700 ring-teal-200', label: 'Ollama' }
	};

	function engineStyle(inference: string) {
		const key = inference.toLowerCase();
		return ENGINE_COLORS[key] ?? {
			dot: 'bg-slate-400',
			badge: 'bg-slate-50 text-slate-700 ring-slate-200',
			label: inference
		};
	}

	/** Evaluations for this argument, one entry per miner (null if miner didn't evaluate it) */
	const minerArgEvals = $derived.by((): Array<{ miner: MinerEvaluation; eval: MinerArgumentEvaluation }> => {
		const result: Array<{ miner: MinerEvaluation; eval: MinerArgumentEvaluation }> = [];
		for (const miner of minerEvaluations) {
			const argEval = miner.argumentEvaluations.find(
				(ae) => ae.argumentIndex === argumentIndex
			);
			if (argEval) {
				result.push({ miner, eval: argEval });
			}
		}
		return result;
	});

	/** Weighted total for a given DimensionScores (matches AIScoreBreakdown weights) */
	const WEIGHTS: Record<keyof DimensionScores, number> = {
		reasoning: 3000,
		accuracy: 2500,
		evidence: 2000,
		constructiveness: 1500,
		feasibility: 1000
	};

	function weightedTotal(scores: DimensionScores): number {
		return Math.floor(
			(scores.reasoning * 3000 +
				scores.accuracy * 2500 +
				scores.evidence * 2000 +
				scores.constructiveness * 1500 +
				scores.feasibility * 1000) /
				10000
		);
	}

	const medianTotal = $derived(weightedTotal(medianScores));

	/**
	 * Divergence from median in basis points (absolute).
	 * Used to drive the cell color channel.
	 */
	function divergenceBp(score: number, medianScore: number): number {
		return Math.abs(score - medianScore);
	}

	/**
	 * Map divergence to a color class triplet.
	 * ±10% of full scale (1000 bp) → neutral
	 * 10–25% → amber
	 * >25% → red
	 */
	function divergenceBarColor(divBp: number): string {
		if (divBp <= 1000) return 'bg-emerald-400';
		if (divBp <= 2500) return 'bg-amber-400';
		return 'bg-red-400';
	}

	function divergenceTextColor(divBp: number): string {
		if (divBp <= 1000) return 'text-emerald-700';
		if (divBp <= 2500) return 'text-amber-700';
		return 'text-red-600';
	}

	/** Identify the most contested dimension across all miners */
	const divergenceSummary = $derived.by(() => {
		if (minerArgEvals.length === 0) return null;

		let maxDimKey: keyof DimensionScores = 'accuracy';
		let maxDivBp = 0;

		for (const dim of DIMENSIONS) {
			// Mean absolute deviation from median across miners
			const totalDev = minerArgEvals.reduce((sum, { eval: e }) => {
				return sum + Math.abs(e.scores[dim.key] - medianScores[dim.key]);
			}, 0);
			const meanDev = totalDev / minerArgEvals.length;
			if (meanDev > maxDivBp) {
				maxDivBp = meanDev;
				maxDimKey = dim.key;
			}
		}

		const dimLabel = DIMENSIONS.find((d) => d.key === maxDimKey)?.label ?? maxDimKey;
		return { label: dimLabel, bp: Math.round(maxDivBp) };
	});

	function formatBp(bp: number): string {
		return (bp / 100).toFixed(1) + '%';
	}
</script>

<div class="space-y-2">
	<!-- Section header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-1.5">
			<Microscope class="h-3.5 w-3.5 text-slate-400" />
			<span class="text-xs font-semibold text-slate-600 uppercase tracking-wider">Miner Analysis</span>
		</div>
		<span class="text-xs text-slate-400 tabular-nums">
			{minerArgEvals.length} independent evaluation{minerArgEvals.length !== 1 ? 's' : ''}
		</span>
	</div>

	{#if minerArgEvals.length === 0}
		<p class="text-xs text-slate-400 italic py-1">No per-miner evaluations available.</p>
	{:else}
		<!-- Score grid -->
		<div class="overflow-x-auto">
			<table class="w-full text-xs border-collapse" role="grid" aria-label="Miner score comparison">
				<thead>
					<tr class="border-b border-slate-100">
						<th class="text-left py-1.5 pr-3 font-medium text-slate-500 w-24 min-w-[6rem]">Miner</th>
						{#each DIMENSIONS as dim}
							<th class="text-center py-1.5 px-1 font-medium text-slate-500 w-16 min-w-[4rem]"
								title={dim.label}>
								<span class="hidden sm:inline">{dim.short}</span>
								<span class="sm:hidden">{dim.short.slice(0, 1)}</span>
							</th>
						{/each}
						<th class="text-right py-1.5 pl-2 font-medium text-slate-500 w-14 min-w-[3.5rem]">Total</th>
					</tr>
				</thead>
				<tbody>
					{#each minerArgEvals as { miner, eval: argEval }, i}
						{@const style = engineStyle(miner.inference)}
						{@const total = weightedTotal(argEval.scores)}
						{@const totalDivBp = divergenceBp(total, medianTotal)}
						<tr class="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
							<!-- Miner identity -->
							<td class="py-2 pr-3">
								<div class="flex items-center gap-1.5">
									<span class="h-2 w-2 rounded-full shrink-0 {style.dot}"></span>
									<span
										class="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium
											ring-1 ring-inset {style.badge}">
										{style.label}
									</span>
									<span class="text-slate-400 font-mono text-xs">#{miner.minerUid}</span>
								</div>
							</td>

							<!-- Per-dimension score bars -->
							{#each DIMENSIONS as dim}
								{@const score = argEval.scores[dim.key]}
								{@const divBp = divergenceBp(score, medianScores[dim.key])}
								{@const barWidth = (score / 10000) * 100}
								{@const barColor = divergenceBarColor(divBp)}
								{@const textColor = divergenceTextColor(divBp)}
								<td class="py-2 px-1" title="{dim.label}: {formatBp(score)} (±{formatBp(divBp)} from median)">
									<div class="flex flex-col gap-0.5 items-center">
										<!-- Score bar -->
										<div class="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
											<div
												class="{barColor} h-full rounded-full"
												style="width: {barWidth.toFixed(1)}%;"
											></div>
										</div>
										<!-- Numeric value -->
										<span class="font-mono tabular-nums {textColor} text-[10px]">
											{formatBp(score)}
										</span>
									</div>
								</td>
							{/each}

							<!-- Weighted total -->
							<td class="py-2 pl-2 text-right">
								<span class="font-mono tabular-nums text-xs font-semibold {divergenceTextColor(totalDivBp)}">
									{formatBp(total)}
								</span>
							</td>
						</tr>
					{/each}

					<!-- Median row -->
					<tr class="border-t border-slate-200 bg-slate-50/80">
						<td class="py-2 pr-3">
							<span class="text-xs font-semibold text-slate-600">Median</span>
						</td>
						{#each DIMENSIONS as dim}
							{@const score = medianScores[dim.key]}
							{@const barWidth = (score / 10000) * 100}
							<td class="py-2 px-1">
								<div class="flex flex-col gap-0.5 items-center">
									<div class="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
										<div
											class="bg-slate-500 h-full rounded-full"
											style="width: {barWidth.toFixed(1)}%;"
										></div>
									</div>
									<span class="font-mono tabular-nums text-slate-700 text-[10px] font-semibold">
										{formatBp(score)}
									</span>
								</div>
							</td>
						{/each}
						<td class="py-2 pl-2 text-right">
							<span class="font-mono tabular-nums text-xs font-bold text-slate-700">
								{formatBp(medianTotal)}
							</span>
						</td>
					</tr>
				</tbody>
			</table>
		</div>

		<!-- Divergence summary line -->
		{#if divergenceSummary && divergenceSummary.bp > 0}
			<div class="flex items-center gap-1.5 pt-0.5">
				<span class="text-xs text-slate-400">Highest divergence:</span>
				<span class="text-xs font-medium text-slate-600">{divergenceSummary.label}</span>
				<span class="font-mono tabular-nums text-xs {divergenceTextColor(divergenceSummary.bp)}">
					±{divergenceSummary.bp.toLocaleString()} bp
				</span>
				<span class="text-xs text-slate-400">
					({formatBp(divergenceSummary.bp)} spread)
				</span>
			</div>
		{/if}
	{/if}
</div>
