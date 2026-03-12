<script lang="ts">
	let { campaign }: {
		campaign: {
			raisedAmountCents: number;
			goalAmountCents: number | null;
			donorCount: number;
			donationCurrency: string;
		};
	} = $props();

	function formatCents(cents: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: campaign.donationCurrency
		}).format(cents / 100);
	}

	const goalPercent = $derived(
		campaign.goalAmountCents
			? Math.min(100, (campaign.raisedAmountCents / campaign.goalAmountCents) * 100)
			: null
	);

	const averageCents = $derived(
		campaign.donorCount > 0
			? Math.round(campaign.raisedAmountCents / campaign.donorCount)
			: 0
	);
</script>

<div class="grid grid-cols-3 gap-3">
	<!-- Amount Raised -->
	<div class="rounded-lg border border-zinc-800/60 p-4">
		<p class="text-xs font-medium text-zinc-500">Raised</p>
		<p class="mt-1 text-2xl font-bold text-zinc-100">
			{formatCents(campaign.raisedAmountCents)}
			{#if campaign.goalAmountCents}
				<span class="text-sm font-normal text-zinc-500">/ {formatCents(campaign.goalAmountCents)}</span>
			{/if}
		</p>
		{#if goalPercent !== null}
			<div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
				<div
					class="h-full rounded-full bg-zinc-400 transition-all"
					style="width: {goalPercent}%"
				></div>
			</div>
		{/if}
	</div>

	<!-- Donor Count -->
	<div class="rounded-lg border border-zinc-800/60 p-4">
		<p class="text-xs font-medium text-zinc-500">Donors</p>
		<p class="mt-1 text-2xl font-bold text-zinc-100">{campaign.donorCount}</p>
	</div>

	<!-- Average Donation -->
	<div class="rounded-lg border border-zinc-800/60 p-4">
		<p class="text-xs font-medium text-zinc-500">Average</p>
		<p class="mt-1 text-2xl font-bold text-green-400">{formatCents(averageCents)}</p>
	</div>
</div>
