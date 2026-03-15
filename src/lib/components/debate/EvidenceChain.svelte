<script lang="ts">
	/**
	 * EvidenceChain — Claim verdicts and source citations from miner grounding.
	 *
	 * Perceptual design: The investigation chain works like a legal brief.
	 * Claims are sorted by severity (most contested first) so the reader's
	 * eye lands on the highest-stakes findings immediately. Sources are
	 * ordered by reliability — the most credible evidence anchors the list.
	 *
	 * Progressive disclosure: Miner-level disagreement is collapsed by
	 * default. Consensus is surfaced; divergence is one click away.
	 *
	 * Grounding distance maps to a spatial metaphor: "Direct" evidence is
	 * close to the claim, "Distal" is further removed. This helps users
	 * understand source relevance without reading raw cosine distances.
	 */
	import type {
		MinerEvaluation,
		ClaimVerdict,
		SourceVerdict
	} from '$lib/stores/debateState.svelte';
	import { Check, X, AlertTriangle, HelpCircle, Shield, ChevronDown, ChevronUp, Search } from '@lucide/svelte';

	interface Props {
		argumentIndex: number;
		minerEvaluations: MinerEvaluation[];
	}

	let { argumentIndex, minerEvaluations }: Props = $props();

	// ── Types ──────────────────────────────────────────────────────────────

	type VerdictType = 'CONFIRMED' | 'CONTRADICTED' | 'PARTIALLY_CONFIRMED' | 'UNVERIFIED';

	interface AggregatedClaim {
		claim: string;
		/** Consensus verdict — plurality across miners that have an opinion */
		consensusVerdict: VerdictType;
		/** Per-miner breakdown: inference label, verdict, reasoning, source indices */
		minerBreakdown: Array<{
			minerUid: number;
			inference: string;
			verdict: VerdictType;
			reasoning: string;
			sourceIndices: number[];
		}>;
		agreementCount: number; // miners matching consensus
		totalMiners: number;
	}

	// ── Derived aggregations ───────────────────────────────────────────────

	/**
	 * Collect all grounding objects for this argument across miners.
	 * Each entry also carries miner identity for attribution.
	 */
	const groundingsByMiner = $derived.by(() => {
		return minerEvaluations
			.map((miner) => {
				const argEval = miner.argumentEvaluations.find(
					(ae) => ae.argumentIndex === argumentIndex
				);
				return argEval?.grounding
					? { miner, grounding: argEval.grounding }
					: null;
			})
			.filter((x): x is NonNullable<typeof x> => x !== null);
	});

	const hasGrounding = $derived(groundingsByMiner.length > 0);

	/**
	 * Aggregate claim verdicts across miners.
	 * Claims are matched by exact claim text. Where multiple miners evaluated
	 * the same claim, we compute a consensus (plurality verdict).
	 */
	const aggregatedClaims = $derived.by((): AggregatedClaim[] => {
		if (!hasGrounding) return [];

		// Map from claim text → per-miner verdicts
		const claimMap = new Map<
			string,
			Array<{
				minerUid: number;
				inference: string;
				verdict: VerdictType;
				reasoning: string;
				sourceIndices: number[];
			}>
		>();

		for (const { miner, grounding } of groundingsByMiner) {
			for (const cv of grounding.claimVerdicts) {
				const entries = claimMap.get(cv.claim) ?? [];
				entries.push({
					minerUid: miner.minerUid,
					inference: miner.inference,
					verdict: cv.verdict,
					reasoning: cv.reasoning,
					sourceIndices: cv.sourceIndices
				});
				claimMap.set(cv.claim, entries);
			}
		}

		const VERDICT_SEVERITY: Record<VerdictType, number> = {
			CONTRADICTED: 3,
			PARTIALLY_CONFIRMED: 2,
			UNVERIFIED: 1,
			CONFIRMED: 0
		};

		return [...claimMap.entries()]
			.map(([claim, entries]): AggregatedClaim => {
				// Plurality verdict
				const counts: Record<string, number> = {};
				for (const e of entries) {
					counts[e.verdict] = (counts[e.verdict] ?? 0) + 1;
				}
				const consensusVerdict = (
					Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
				) as VerdictType;
				const agreementCount = counts[consensusVerdict];

				return {
					claim,
					consensusVerdict,
					minerBreakdown: entries,
					agreementCount,
					totalMiners: entries.length
				};
			})
			.sort(
				(a, b) =>
					VERDICT_SEVERITY[b.consensusVerdict] - VERDICT_SEVERITY[a.consensusVerdict]
			);
	});

	/**
	 * Merge all source verdicts from all miners for this argument.
	 * De-duplicate by URL; keep highest reliability entry if duplicated.
	 * Sort by reliability descending.
	 */
	const aggregatedSources = $derived.by((): SourceVerdict[] => {
		if (!hasGrounding) return [];

		const sourceMap = new Map<string, SourceVerdict>();
		for (const { grounding } of groundingsByMiner) {
			for (const sv of grounding.sourceVerdicts) {
				const existing = sourceMap.get(sv.url);
				if (!existing || sv.reliability > existing.reliability) {
					sourceMap.set(sv.url, sv);
				}
			}
		}

		return [...sourceMap.values()].sort((a, b) => b.reliability - a.reliability);
	});

	// ── Stats ──────────────────────────────────────────────────────────────

	const totalClaims = $derived(aggregatedClaims.length);
	const totalSources = $derived(aggregatedSources.length);

	// ── Expansion state ────────────────────────────────────────────────────

	/** Which claim indices have their miner detail expanded */
	let expandedClaims = $state<Set<number>>(new Set());

	function toggleClaim(idx: number) {
		const next = new Set(expandedClaims);
		if (next.has(idx)) {
			next.delete(idx);
		} else {
			next.add(idx);
		}
		expandedClaims = next;
	}

	// ── Helpers ────────────────────────────────────────────────────────────

	function formatBp(bp: number): string {
		return (bp / 100).toFixed(1) + '%';
	}

	/** Extract hostname from a URL string without throwing */
	function urlDomain(url: string): string {
		try {
			return new URL(url).hostname.replace(/^www\./, '');
		} catch {
			return url.slice(0, 40);
		}
	}

	/** Grounding distance → human label */
	function groundingDistanceLabel(distance: number): string {
		if (distance <= 0) return 'Direct';
		if (distance === 1) return 'Secondary';
		if (distance === 2) return 'Tertiary';
		return 'Distal';
	}

	function groundingDistanceStyle(distance: number): string {
		if (distance <= 0) return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
		if (distance === 1) return 'bg-blue-50 text-blue-700 ring-blue-200';
		if (distance === 2) return 'bg-amber-50 text-amber-700 ring-amber-200';
		return 'bg-slate-50 text-slate-600 ring-slate-200';
	}

	/** Reliability score dot color */
	function reliabilityDotColor(reliability: number): string {
		if (reliability >= 7000) return 'bg-emerald-400';
		if (reliability >= 4000) return 'bg-amber-400';
		return 'bg-red-400';
	}

	const ENGINE_COLORS: Record<string, string> = {
		groq: 'bg-orange-50 text-orange-700 ring-orange-200',
		gemini: 'bg-blue-50 text-blue-700 ring-blue-200',
		ollama: 'bg-teal-50 text-teal-700 ring-teal-200'
	};

	function engineBadge(inference: string): string {
		return ENGINE_COLORS[inference.toLowerCase()] ?? 'bg-slate-50 text-slate-700 ring-slate-200';
	}

	function engineLabel(inference: string): string {
		const key = inference.toLowerCase();
		if (key === 'groq') return 'Groq';
		if (key === 'gemini') return 'Gemini';
		if (key === 'ollama') return 'Ollama';
		return inference;
	}
</script>

<div class="space-y-3">
	<!-- Section header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-1.5">
			<Search class="h-3.5 w-3.5 text-slate-400" />
			<span class="text-xs font-semibold text-slate-600 uppercase tracking-wider">Evidence Investigation</span>
		</div>
		{#if hasGrounding}
			<span class="text-xs text-slate-400 tabular-nums">
				{totalClaims} claim{totalClaims !== 1 ? 's' : ''} examined
				{#if totalSources > 0}
					· {totalSources} source{totalSources !== 1 ? 's' : ''} cited
				{/if}
			</span>
		{/if}
	</div>

	<!-- No grounding fallback -->
	{#if !hasGrounding}
		<div class="flex items-center gap-2 py-2 px-3 rounded-lg bg-slate-50 border border-slate-100">
			<div class="h-3.5 w-3.5 rounded-full border-2 border-slate-300 shrink-0"></div>
			<span class="text-xs text-slate-500 italic">
				Ungrounded — scored from model training data only
			</span>
		</div>
	{:else}
		<!-- Claim verdicts -->
		{#if aggregatedClaims.length > 0}
			<div class="space-y-2">
				{#each aggregatedClaims as agg, idx}
					{@const isExpanded = expandedClaims.has(idx)}
					{@const allAgree = agg.agreementCount === agg.totalMiners}

					<div class="rounded-lg border border-slate-100 overflow-hidden">
						<!-- Claim header -->
						<button
							class="w-full text-left px-3 py-2.5 hover:bg-slate-50/80 transition-colors"
							onclick={() => toggleClaim(idx)}
							aria-expanded={isExpanded}
						>
							<div class="flex items-start gap-2">
								<!-- Verdict badge -->
								<div class="shrink-0 mt-0.5">
									{#if agg.consensusVerdict === 'CONFIRMED'}
										<span class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200">
											<Check class="h-2.5 w-2.5" />
											Confirmed
										</span>
									{:else if agg.consensusVerdict === 'CONTRADICTED'}
										<span class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-red-50 text-red-700 ring-1 ring-inset ring-red-200">
											<X class="h-2.5 w-2.5" />
											Contradicted
										</span>
									{:else if agg.consensusVerdict === 'PARTIALLY_CONFIRMED'}
										<span class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200">
											<AlertTriangle class="h-2.5 w-2.5" />
											Partial
										</span>
									{:else}
										<span class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200">
											<HelpCircle class="h-2.5 w-2.5" />
											Unverified
										</span>
									{/if}
								</div>

								<!-- Claim text -->
								<p class="flex-1 text-xs text-slate-700 italic leading-relaxed text-left">
									"{agg.claim}"
								</p>

								<!-- Agreement indicator + expand toggle -->
								<div class="flex items-center gap-1.5 shrink-0">
									{#if !allAgree && agg.totalMiners > 1}
										<span class="text-[10px] text-amber-600 font-medium tabular-nums">
											{agg.agreementCount}/{agg.totalMiners}
										</span>
									{:else if agg.totalMiners > 1}
										<span class="text-[10px] text-slate-400 tabular-nums">
											{agg.totalMiners}/{agg.totalMiners}
										</span>
									{/if}
									<div class="text-slate-400">
										{#if isExpanded}
											<ChevronUp class="h-3.5 w-3.5" />
										{:else}
											<ChevronDown class="h-3.5 w-3.5" />
										{/if}
									</div>
								</div>
							</div>
						</button>

						<!-- Expanded miner breakdown -->
						{#if isExpanded}
							<div class="border-t border-slate-100 divide-y divide-slate-50">
								{#each agg.minerBreakdown as entry}
									<div class="px-3 py-2 bg-slate-50/40">
										<div class="flex items-start gap-2">
											<!-- Miner badge -->
											<span
												class="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium
													ring-1 ring-inset shrink-0 {engineBadge(entry.inference)}">
												{engineLabel(entry.inference)} #{entry.minerUid}
											</span>

											<!-- Verdict + reasoning -->
											<div class="flex-1 min-w-0">
												<div class="flex items-center gap-1.5 mb-0.5">
													{#if entry.verdict === 'CONFIRMED'}
														<span class="text-[10px] font-semibold text-emerald-600">Confirmed</span>
													{:else if entry.verdict === 'CONTRADICTED'}
														<span class="text-[10px] font-semibold text-red-600">Contradicted</span>
													{:else if entry.verdict === 'PARTIALLY_CONFIRMED'}
														<span class="text-[10px] font-semibold text-amber-600">Partial</span>
													{:else}
														<span class="text-[10px] font-semibold text-slate-500">Unverified</span>
													{/if}

													<!-- Source pills -->
													{#if entry.sourceIndices.length > 0}
														<div class="flex items-center gap-1 flex-wrap">
															{#each entry.sourceIndices as si}
																{@const src = aggregatedSources.find((s) => s.sourceIndex === si)}
																{#if src}
																	<span
																		class="inline-flex items-center rounded px-1.5 py-0 text-[10px]
																			font-mono bg-slate-100 text-slate-600 ring-1 ring-slate-200 ring-inset"
																		title="{src.title} — {formatBp(src.reliability)} reliability">
																		{urlDomain(src.url)}
																	</span>
																{:else}
																	<span class="text-[10px] text-slate-400 font-mono">src:{si}</span>
																{/if}
															{/each}
														</div>
													{/if}
												</div>
												<p class="text-[10px] text-slate-500 leading-relaxed">
													{entry.reasoning}
												</p>
											</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		<!-- Sources section -->
		{#if aggregatedSources.length > 0}
			<div class="space-y-1.5">
				<div class="flex items-center gap-1.5">
					<Shield class="h-3 w-3 text-slate-400" />
					<span class="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
						Sources Retrieved
					</span>
					<span class="text-[10px] text-slate-400">({aggregatedSources.length})</span>
				</div>

				<div class="space-y-1">
					{#each aggregatedSources as src}
						{@const distLabel = groundingDistanceLabel(src.groundingDistance)}
						{@const distStyle = groundingDistanceStyle(src.groundingDistance)}
						{@const relDot = reliabilityDotColor(src.reliability)}
						<div class="flex items-center gap-2 py-1.5 px-2.5 rounded-md bg-slate-50/60 hover:bg-slate-50 transition-colors border border-slate-100/80">
							<!-- Reliability dot -->
							<span class="h-2 w-2 rounded-full shrink-0 {relDot}" title="Reliability: {formatBp(src.reliability)}"></span>

							<!-- Title + domain -->
							<div class="flex-1 min-w-0">
								<p class="text-xs text-slate-700 truncate leading-tight" title={src.title}>
									{src.title}
								</p>
								<p class="font-mono text-[10px] text-slate-400 truncate">
									{urlDomain(src.url)}
								</p>
							</div>

							<!-- Reliability % -->
							<span class="font-mono tabular-nums text-[10px] text-slate-500 shrink-0">
								{formatBp(src.reliability)}
							</span>

							<!-- Grounding distance badge -->
							<span
								class="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium
									ring-1 ring-inset shrink-0 {distStyle}">
								{distLabel}
							</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>
