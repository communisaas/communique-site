<script lang="ts">
	import FundraiserCard from '$lib/components/fundraising/FundraiserCard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Fundraising | {data.org.name}</title>
</svelte:head>

<div class="min-h-screen bg-zinc-950 text-zinc-100">
	<div class="mx-auto max-w-4xl px-4 py-8">
		<!-- Header -->
		<div class="mb-8 flex items-center justify-between">
			<h1 class="text-2xl font-bold text-zinc-100">Fundraising</h1>
			<a
				href="/org/{data.org.slug}/fundraising/new"
				class="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-200"
			>
				Create Fundraiser
			</a>
		</div>

		<!-- Campaign List -->
		{#if data.campaigns.length === 0}
			<div class="rounded-lg border border-zinc-800/60 py-16 text-center">
				<p class="text-lg text-zinc-400">No fundraisers yet.</p>
				<p class="mt-1 text-sm text-zinc-500">Create your first fundraiser to get started.</p>
				<a
					href="/org/{data.org.slug}/fundraising/new"
					class="mt-4 inline-block rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-200"
				>
					Create Fundraiser
				</a>
			</div>
		{:else}
			<div class="space-y-3">
				{#each data.campaigns as campaign (campaign.id)}
					<a href="/org/{data.org.slug}/fundraising/{campaign.id}" class="block">
						<FundraiserCard {campaign} />
					</a>
				{/each}
			</div>
		{/if}
	</div>
</div>
