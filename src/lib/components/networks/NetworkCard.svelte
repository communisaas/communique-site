<script lang="ts">
	let { network, orgSlug }: {
		network: {
			id: string;
			name: string;
			slug: string;
			description: string | null;
			memberCount: number;
			role: string;
			isOwner: boolean;
			ownerOrg: { id: string; name: string; slug: string };
		};
		orgSlug: string;
	} = $props();

	const roleColors: Record<string, string> = {
		admin: 'bg-teal-900/50 text-teal-400',
		member: 'bg-zinc-700 text-zinc-300'
	};
</script>

<div class="rounded-lg border border-zinc-800/60 p-4 transition-colors hover:border-zinc-700">
	<div class="flex items-start justify-between gap-3">
		<div class="min-w-0 flex-1">
			<div class="mb-1 flex items-center gap-2">
				<h3 class="truncate text-base font-semibold text-zinc-100">{network.name}</h3>
				<span class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium {roleColors[network.role] ?? 'bg-zinc-700 text-zinc-300'}">
					{network.role}
				</span>
			</div>

			{#if network.description}
				<p class="line-clamp-2 text-sm text-zinc-400">{network.description}</p>
			{/if}

			{#if !network.isOwner}
				<p class="mt-1 text-xs text-zinc-500">Owned by {network.ownerOrg.name}</p>
			{/if}
		</div>

		<div class="shrink-0 text-right">
			<p class="text-lg font-bold text-zinc-200">{network.memberCount}</p>
			<p class="text-xs text-zinc-500">
				member{network.memberCount !== 1 ? 's' : ''}
			</p>
		</div>
	</div>
</div>

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
