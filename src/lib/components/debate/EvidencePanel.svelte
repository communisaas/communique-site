<script lang="ts">
	/**
	 * EvidencePanel — Container assembling MinerLens + EvidenceChain.
	 *
	 * Perceptual design: The panel is a distinct visual layer — slightly
	 * cooler and more recessive than the argument row above it. This creates
	 * a clear figure-ground hierarchy: the argument is foreground, the
	 * miner evidence is context.
	 *
	 * Both sections default to visible because the evidence is the primary
	 * reason for expanding an argument. Users who want less density can
	 * collapse individual sections. The collapse controls are low-contrast
	 * (secondary affordance) so they don't compete with the data.
	 */
	import MinerLens from './MinerLens.svelte';
	import EvidenceChain from './EvidenceChain.svelte';
	import type { MinerEvaluation, DimensionScores } from '$lib/stores/debateState.svelte';
	import { ChevronDown, ChevronUp, Microscope, Search } from '@lucide/svelte';

	interface Props {
		argumentIndex: number;
		minerEvaluations?: MinerEvaluation[];
		medianScores: DimensionScores;
	}

	let { argumentIndex, minerEvaluations, medianScores }: Props = $props();

	// Nothing to render if there are no miner evaluations
	const hasMinerData = $derived(
		minerEvaluations != null && minerEvaluations.length > 0
	);

	// Filter to only miners that actually evaluated this argument
	const relevantEvaluations = $derived.by((): MinerEvaluation[] => {
		if (!minerEvaluations) return [];
		return minerEvaluations.filter((m) =>
			m.argumentEvaluations.some((ae) => ae.argumentIndex === argumentIndex)
		);
	});

	const hasRelevantData = $derived(relevantEvaluations.length > 0);

	// Independent collapse state for each section
	let lensExpanded = $state(true);
	let chainExpanded = $state(true);
</script>

{#if hasMinerData && hasRelevantData}
	<div
		class="rounded-lg border border-slate-200/70 bg-slate-50/30 overflow-hidden"
		role="region"
		aria-label="Miner investigation evidence"
	>
		<!-- MinerLens section -->
		<div class="border-b border-slate-100/80">
			<!-- Section toggle header -->
			<button
				class="w-full flex items-center justify-between px-4 py-2.5
					hover:bg-slate-50/60 transition-colors text-left"
				onclick={() => (lensExpanded = !lensExpanded)}
				aria-expanded={lensExpanded}
				aria-controls="miner-lens-{argumentIndex}"
			>
				<div class="flex items-center gap-1.5">
					<Microscope class="h-3 w-3 text-slate-400" />
					<span class="text-xs font-medium text-slate-500">Score Breakdown by Miner</span>
				</div>
				<div class="text-slate-400">
					{#if lensExpanded}
						<ChevronUp class="h-3.5 w-3.5" />
					{:else}
						<ChevronDown class="h-3.5 w-3.5" />
					{/if}
				</div>
			</button>

			{#if lensExpanded}
				<div id="miner-lens-{argumentIndex}" class="px-4 pb-4 pt-1">
					<MinerLens
						{argumentIndex}
						minerEvaluations={relevantEvaluations}
						{medianScores}
					/>
				</div>
			{/if}
		</div>

		<!-- EvidenceChain section -->
		<div>
			<!-- Section toggle header -->
			<button
				class="w-full flex items-center justify-between px-4 py-2.5
					hover:bg-slate-50/60 transition-colors text-left"
				onclick={() => (chainExpanded = !chainExpanded)}
				aria-expanded={chainExpanded}
				aria-controls="evidence-chain-{argumentIndex}"
			>
				<div class="flex items-center gap-1.5">
					<Search class="h-3 w-3 text-slate-400" />
					<span class="text-xs font-medium text-slate-500">Claim Verdicts and Sources</span>
				</div>
				<div class="text-slate-400">
					{#if chainExpanded}
						<ChevronUp class="h-3.5 w-3.5" />
					{:else}
						<ChevronDown class="h-3.5 w-3.5" />
					{/if}
				</div>
			</button>

			{#if chainExpanded}
				<div id="evidence-chain-{argumentIndex}" class="px-4 pb-4 pt-1">
					<EvidenceChain
						{argumentIndex}
						minerEvaluations={relevantEvaluations}
					/>
				</div>
			{/if}
		</div>
	</div>
{/if}
