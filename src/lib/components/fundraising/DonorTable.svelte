<script lang="ts">
	let { donors, currency }: {
		donors: Array<{
			id: string;
			name: string;
			email: string;
			amountCents: number;
			recurring: boolean;
			engagementTier: number;
			districtHash: string | null;
			completedAt: string | null;
		}>;
		currency: string;
	} = $props();

	function formatCents(cents: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency
		}).format(cents / 100);
	}

	function formatDate(iso: string): string {
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		}).format(new Date(iso));
	}
</script>

{#if donors.length === 0}
	<p class="py-8 text-center text-sm text-zinc-500">No donations yet</p>
{:else}
	<div class="overflow-x-auto rounded-lg border border-zinc-800/60">
		<table class="w-full text-left text-sm">
			<thead>
				<tr class="border-b border-zinc-800/60 text-xs text-zinc-500">
					<th class="px-4 py-3 font-medium">Name</th>
					<th class="px-4 py-3 font-medium">Email</th>
					<th class="px-4 py-3 font-medium">Amount</th>
					<th class="px-4 py-3 font-medium">Recurring</th>
					<th class="px-4 py-3 font-medium">Tier</th>
					<th class="px-4 py-3 font-medium">Date</th>
				</tr>
			</thead>
			<tbody>
				{#each donors as donor (donor.id)}
					<tr class="border-b border-zinc-800/40 last:border-0">
						<td class="px-4 py-3 text-zinc-200">{donor.name}</td>
						<td class="px-4 py-3 text-zinc-400">{donor.email}</td>
						<td class="px-4 py-3 font-medium text-zinc-200">{formatCents(donor.amountCents)}</td>
						<td class="px-4 py-3">
							{#if donor.recurring}
								<span class="inline-flex rounded-full bg-blue-900/50 px-2 py-0.5 text-xs font-medium text-blue-400">
									Monthly
								</span>
							{:else}
								<span class="text-zinc-600">-</span>
							{/if}
						</td>
						<td class="px-4 py-3 text-zinc-400">{donor.engagementTier}</td>
						<td class="px-4 py-3 text-zinc-500">
							{donor.completedAt ? formatDate(donor.completedAt) : '-'}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
