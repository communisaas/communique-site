<script lang="ts">
	interface DistrictBucket {
		districtHash: string;
		count: number;
	}

	let {
		topDistricts,
		districtCount
	}: {
		topDistricts: DistrictBucket[];
		districtCount: number;
	} = $props();

	const isEmpty = $derived(topDistricts.length === 0 && districtCount === 0);

	// Compute bar widths relative to the largest district
	const maxCount = $derived(
		topDistricts.length > 0 ? Math.max(...topDistricts.map((d) => d.count)) : 1
	);
</script>

<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-6 space-y-4">
	<p class="text-[10px] font-mono uppercase tracking-wider text-zinc-600">Geographic Spread</p>

	{#if isEmpty}
		<div class="py-4 text-center">
			<p class="text-sm text-zinc-600">Insufficient geographic data</p>
			<p class="text-[10px] text-zinc-700 mt-1">District data appears as verified actions accumulate.</p>
		</div>
	{:else}
		<!-- Total districts -->
		<div class="flex items-center justify-between rounded-lg border border-zinc-800/40 bg-zinc-950/30 px-4 py-3">
			<div class="flex items-center gap-2">
				<svg class="w-4 h-4 text-teal-500/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
					<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
				</svg>
				<span class="text-xs text-zinc-500">districts reached</span>
			</div>
			<span class="font-mono tabular-nums text-lg font-semibold text-teal-400">
				{districtCount}
			</span>
		</div>

		<!-- Top districts bar chart -->
		{#if topDistricts.length > 0}
			<div class="space-y-1.5">
				<p class="text-[10px] font-mono text-zinc-700 mb-2">Top districts by action count</p>
				{#each topDistricts as district, i}
					<div class="flex items-center gap-3">
						<span class="w-20 text-[10px] font-mono text-zinc-500 text-right">
							District {i + 1}
						</span>
						<div class="flex-1 h-4 rounded bg-zinc-800/60 overflow-hidden">
							<div
								class="h-full rounded bg-teal-500/50 transition-all duration-700 ease-out"
								style="width: {Math.max((district.count / maxCount) * 100, 4)}%"
							></div>
						</div>
						<span class="w-10 text-xs font-mono tabular-nums text-zinc-500 text-right">
							{district.count}
						</span>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>
