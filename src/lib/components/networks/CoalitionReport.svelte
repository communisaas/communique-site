<script lang="ts">
	type NetworkStats = {
		orgCount: number;
		totalVerifiedActions: number;
		uniqueDistricts: number;
		verifiedSupporters: number;
		tierDistribution: { tier: number; count: number }[];
		stateDistribution: { state: string; count: number }[];
	};

	let { stats, loading }: {
		stats: NetworkStats | null;
		loading: boolean;
	} = $props();

	const tierLabels: Record<number, string> = {
		0: 'Guest',
		1: 'Authenticated',
		2: 'District Verified',
		3: 'Identity Verified',
		4: 'Passport Verified',
		5: 'Government Verified'
	};

	const maxTierCount = $derived(
		stats?.tierDistribution
			? Math.max(...stats.tierDistribution.map((t) => t.count), 1)
			: 1
	);
</script>

{#if loading}
	<!-- Loading skeleton -->
	<div class="space-y-3">
		<div class="grid grid-cols-2 gap-3 md:grid-cols-4">
			{#each Array(4) as _}
				<div class="animate-pulse rounded-lg bg-zinc-800/40 p-4">
					<div class="mb-2 h-3 w-16 rounded bg-zinc-700/50"></div>
					<div class="h-7 w-12 rounded bg-zinc-700/50"></div>
				</div>
			{/each}
		</div>
		<div class="animate-pulse rounded-lg bg-zinc-800/40 p-4">
			<div class="mb-3 h-3 w-24 rounded bg-zinc-700/50"></div>
			{#each Array(4) as _}
				<div class="mb-2 h-4 w-full rounded bg-zinc-700/50"></div>
			{/each}
		</div>
	</div>
{:else if stats}
	<!-- Stats grid -->
	<div class="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
		<div class="rounded-lg bg-zinc-900/50 p-3">
			<p class="text-xs font-medium text-zinc-500">Member Orgs</p>
			<p class="mt-1 text-xl font-bold text-zinc-100">{stats.orgCount}</p>
		</div>
		<div class="rounded-lg bg-zinc-900/50 p-3">
			<p class="text-xs font-medium text-zinc-500">Verified Actions</p>
			<p class="mt-1 text-xl font-bold text-zinc-100">{stats.totalVerifiedActions.toLocaleString()}</p>
		</div>
		<div class="rounded-lg bg-zinc-900/50 p-3">
			<p class="text-xs font-medium text-zinc-500">Unique Districts</p>
			<p class="mt-1 text-xl font-bold text-teal-400">{stats.uniqueDistricts.toLocaleString()}</p>
		</div>
		<div class="rounded-lg bg-zinc-900/50 p-3">
			<p class="text-xs font-medium text-zinc-500">Verified Supporters</p>
			<p class="mt-1 text-xl font-bold text-green-400">{stats.verifiedSupporters.toLocaleString()}</p>
		</div>
	</div>

	<!-- Tier distribution -->
	{#if stats.tierDistribution.length > 0}
		<div class="mb-4">
			<h4 class="mb-2 text-xs font-medium text-zinc-500">Tier Distribution</h4>
			<div class="space-y-1.5">
				{#each stats.tierDistribution as tier (tier.tier)}
					<div class="flex items-center gap-2">
						<span class="w-28 shrink-0 text-xs text-zinc-400">{tierLabels[tier.tier] ?? `Tier ${tier.tier}`}</span>
						<div class="flex-1 overflow-hidden rounded-full bg-zinc-800 h-2">
							<div
								class="h-full rounded-full bg-teal-500 transition-all"
								style="width: {(tier.count / maxTierCount) * 100}%"
							></div>
						</div>
						<span class="w-10 shrink-0 text-right text-xs text-zinc-500">{tier.count.toLocaleString()}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- State distribution -->
	{#if stats.stateDistribution.length > 0}
		<div>
			<h4 class="mb-2 text-xs font-medium text-zinc-500">State Distribution</h4>
			<div class="grid grid-cols-2 gap-x-4 gap-y-1 md:grid-cols-3">
				{#each stats.stateDistribution as item (item.state)}
					<div class="flex items-center justify-between text-xs">
						<span class="text-zinc-400">{item.state}</span>
						<span class="text-zinc-500">{item.count.toLocaleString()}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
{:else}
	<p class="py-4 text-center text-sm text-zinc-500">
		Generate a coalition report to see aggregated verification data.
	</p>
{/if}
