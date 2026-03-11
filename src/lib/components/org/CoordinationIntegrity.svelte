<script lang="ts">
	interface Packet {
		gds: number | null;
		ald: number | null;
		temporalEntropy: number | null;
		burstVelocity: number | null;
		cai: number | null;
	}

	let { packet }: { packet: Packet } = $props();

	interface ScoreEntry {
		key: string;
		label: string;
		description: string;
		value: number | null;
		/** Normalized 0-1 for bar display */
		normalized: number;
		color: string;
		invertedWarning: boolean;
	}

	const scores = $derived.by((): ScoreEntry[] => {
		const gdsNorm = packet.gds ?? 0;
		const aldNorm = packet.ald ?? 0;
		// Temporal entropy: normalize to log2(24) ~ 4.58 (max hourly bins in a day)
		const teNorm = packet.temporalEntropy !== null
			? Math.min(packet.temporalEntropy / 4.58, 1)
			: 0;
		// Burst velocity: invert — lower is better, cap at 10
		const bvNorm = packet.burstVelocity !== null
			? Math.max(1 - packet.burstVelocity / 10, 0)
			: 0;
		const caiNorm = packet.cai !== null ? Math.min(packet.cai, 1) : 0;

		return [
			{
				key: 'gds', label: 'Geo Spread', value: packet.gds,
				description: 'Geographic diversity of actions. Higher = spread across more districts.',
				normalized: gdsNorm,
				color: qualityColor(packet.gds),
				invertedWarning: false
			},
			{
				key: 'ald', label: 'Msg Unique', value: packet.ald,
				description: 'Message uniqueness. Higher = more original content.',
				normalized: aldNorm,
				color: qualityColor(packet.ald),
				invertedWarning: false
			},
			{
				key: 'te', label: 'Time Spread', value: packet.temporalEntropy,
				description: 'Temporal spread of actions. Higher = more organic timing.',
				normalized: teNorm,
				color: qualityColor(teNorm > 0 ? teNorm : null),
				invertedWarning: false
			},
			{
				key: 'bv', label: 'Burst', value: packet.burstVelocity,
				description: 'Peak vs average action rate. Lower = more organic.',
				normalized: bvNorm,
				color: packet.burstVelocity !== null && packet.burstVelocity > 5 ? '#fbbf24' : qualityColor(bvNorm > 0 ? bvNorm : null),
				invertedWarning: packet.burstVelocity !== null && packet.burstVelocity > 5
			},
			{
				key: 'cai', label: 'Depth', value: packet.cai,
				description: 'Long-term engagement graduation. Higher = deeper engagement.',
				normalized: caiNorm,
				color: qualityColor(packet.cai),
				invertedWarning: false
			}
		];
	});

	function qualityColor(val: number | null): string {
		if (val === null) return '#52525b';
		if (val >= 0.8) return '#34d399';
		if (val >= 0.5) return '#2dd4bf';
		return '#a1a1aa';
	}

	function fmtScore(val: number | null): string {
		if (val === null) return '\u2014';
		return val.toFixed(2);
	}

	const allNull = $derived(
		packet.gds === null &&
		packet.ald === null &&
		packet.temporalEntropy === null &&
		packet.burstVelocity === null &&
		packet.cai === null
	);
</script>

<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-6 space-y-4">
	<p class="text-[10px] font-mono uppercase tracking-wider text-zinc-600">Coordination Integrity</p>

	{#if allNull}
		<div class="py-4 text-center">
			<p class="text-sm text-zinc-600">Insufficient data for integrity analysis</p>
			<p class="text-[10px] text-zinc-700 mt-1">Scores appear after enough verified actions accumulate.</p>
		</div>
	{:else}
		<div class="space-y-3">
			{#each scores as score}
				<div class="group" title={score.description}>
					<div class="flex items-center justify-between mb-1">
						<span class="text-[10px] font-mono text-zinc-500">{score.label}</span>
						<span
							class="font-mono tabular-nums text-sm font-semibold"
							style="color: {score.color}"
						>
							{fmtScore(score.value)}
							{#if score.invertedWarning}
								<span class="text-[10px] text-amber-500 ml-1">high</span>
							{/if}
						</span>
					</div>
					<div class="h-2 rounded-full bg-zinc-800/60 overflow-hidden">
						{#if score.value !== null}
							<div
								class="h-full rounded-full transition-all duration-700 ease-out"
								style="width: {Math.max(score.normalized * 100, 2)}%; background-color: {score.color}"
							></div>
						{/if}
					</div>
				</div>
			{/each}
		</div>

		<p class="text-[9px] text-zinc-700 pt-2">
			Higher scores indicate more organic, geographically diverse participation. Burst velocity is inverted: lower is better.
		</p>
	{/if}
</div>
