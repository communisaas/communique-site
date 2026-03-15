<script lang="ts">
	import CountrySelector from '$lib/components/geographic/CountrySelector.svelte';
	import InternationalResolveForm from '$lib/components/geographic/InternationalResolveForm.svelte';
	import RepresentativeCard from '$lib/components/geographic/RepresentativeCard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let filterCountry = $state('');
	let filterQuery = $state('');
	let lookupCountry = $state('GB');

	const filtered = $derived(
		data.representatives.filter((r) => {
			if (filterCountry && r.countryCode !== filterCountry) return false;
			if (filterQuery) {
				const q = filterQuery.toLowerCase();
				return (
					r.name.toLowerCase().includes(q) ||
					r.constituencyName.toLowerCase().includes(q) ||
					(r.party?.toLowerCase().includes(q) ?? false)
				);
			}
			return true;
		})
	);

	const countries = $derived(
		[...new Set(data.representatives.map((r) => r.countryCode))].sort()
	);
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-xl font-semibold text-text-primary">Representatives</h1>
		<p class="text-sm text-text-tertiary mt-1">
			International representatives for your campaigns.
			{data.representatives.length} total.
		</p>
	</div>

	<!-- Filters -->
	<div class="flex flex-wrap items-center gap-3">
		<input
			type="text"
			placeholder="Search name, constituency, or party..."
			bind:value={filterQuery}
			class="flex-1 min-w-[200px] rounded-lg border border-surface-border-strong bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder-text-quaternary focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none transition-colors"
		/>
		<select
			class="rounded-lg border border-surface-border-strong bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none transition-colors"
			bind:value={filterCountry}
		>
			<option value="">All countries</option>
			{#each countries as cc}
				<option value={cc}>{cc}</option>
			{/each}
		</select>
	</div>

	<!-- Representative list -->
	{#if filtered.length > 0}
		<div class="space-y-2">
			{#each filtered as rep (rep.id)}
				<RepresentativeCard representative={rep} />
			{/each}
		</div>
	{:else if data.representatives.length === 0}
		<div class="rounded-xl border border-surface-border bg-surface-base p-8 text-center">
			<p class="text-sm text-text-tertiary">No representatives yet.</p>
			<p class="text-xs text-text-quaternary mt-1">Use the lookup below to find representatives by postcode.</p>
		</div>
	{:else}
		<div class="rounded-xl border border-surface-border bg-surface-base p-6 text-center">
			<p class="text-sm text-text-tertiary">No representatives match your filter.</p>
		</div>
	{/if}

	<!-- Lookup section -->
	<div class="rounded-xl border border-surface-border bg-surface-base p-6 space-y-4">
		<div>
			<p class="text-sm font-medium text-text-secondary">Lookup Representatives</p>
			<p class="text-xs text-text-tertiary mt-0.5">Enter a postcode to find representatives for a constituency.</p>
		</div>

		<div class="max-w-xs">
			<label for="lookupCountry" class="block text-sm font-medium text-text-secondary mb-1.5">Country</label>
			<CountrySelector value={lookupCountry} onchange={(c) => { lookupCountry = c; }} />
		</div>

		<InternationalResolveForm country={lookupCountry} />
	</div>
</div>
