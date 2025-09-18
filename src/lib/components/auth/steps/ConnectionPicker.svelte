<script lang="ts">
	import { Home, Building2, Users } from '@lucide/svelte';

	let {
		templateContext,
		isLocalGovernment,
		isCorporate,
		selectedConnection = $bindable(),
		connectionDetails = $bindable(),
		location = $bindable(),
		connectionError = $bindable(),
		isTransitioning,
		onNext,
		onPrev
	}: {
		templateContext: string;
		isLocalGovernment: boolean;
		isCorporate: boolean;
		selectedConnection: string;
		connectionDetails: string;
		location: string;
		connectionError: string;
		isTransitioning: boolean;
		onNext: () => void;
		onPrev: () => void;
	} = $props();

	const connectionOptions = $derived(getConnectionOptions(templateContext));

	function getConnectionOptions(context: string) {
		if (context === 'corporate') {
			return [
				'Customer/Client',
				'Employee',
				'Shareholder/Investor',
				'Business Partner',
				'Community Member Affected',
				'Industry Stakeholder'
			];
		}

		if (context === 'local-government') {
			return [
				'Local Resident',
				'Voter in District',
				'Taxpayer',
				'Business in Area',
				'Family Affected',
				'Community Organization'
			];
		}

		return [
			'Directly Affected',
			'Community Member',
			'Concerned Citizen',
			'Professional Stakeholder',
			'Advocate/Supporter'
		];
	}
</script>

<div class="mb-6 text-center">
	<div class="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
		{#if isLocalGovernment}
			<Home class="h-6 w-6 text-green-600" />
		{:else if isCorporate}
			<Building2 class="h-6 w-6 text-green-600" />
		{:else}
			<Users class="h-6 w-6 text-green-600" />
		{/if}
	</div>
	<h2 class="mb-2 text-xl font-bold text-slate-900">Your connection</h2>
	<p class="text-slate-600">
		{#if isLocalGovernment}
			How are you connected to this local issue?
		{:else if isCorporate}
			What's your relationship to this organization?
		{:else}
			How does this issue affect you?
		{/if}
	</p>
</div>

<div class="mb-6 space-y-4">
	<fieldset>
		<legend class="mb-3 block text-sm font-medium text-slate-700">Select your connection:</legend>
		<div class="space-y-2">
			{#each connectionOptions as connection}
				<button
					type="button"
					onclick={() => (selectedConnection = connection.toLowerCase().replace(/\s+/g, '-'))}
					class="w-full rounded-lg border p-3 text-left text-sm transition-all hover:border-blue-300 {selectedConnection ===
					connection.toLowerCase().replace(/\s+/g, '-')
						? 'border-blue-500 bg-blue-50 text-blue-900'
						: 'border-slate-300 text-slate-700'}"
				>
					{connection}
				</button>
			{/each}
			<button
				type="button"
				onclick={() => (selectedConnection = 'other')}
				class="w-full rounded-lg border p-3 text-left text-sm transition-all hover:border-blue-300 {selectedConnection ===
				'other'
					? 'border-blue-500 bg-blue-50 text-blue-900'
					: 'border-slate-300 text-slate-700'}"
			>
				Other
			</button>
		</div>

		{#if selectedConnection === 'other'}
			<input
				type="text"
				bind:value={connectionDetails}
				placeholder="Describe your connection"
				class="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
			/>
		{/if}
	</fieldset>

	{#if isLocalGovernment}
		<div>
			<label for="location" class="mb-2 block text-sm font-medium text-slate-700">
				Location (optional)
			</label>
			<input
				id="location"
				type="text"
				bind:value={location}
				placeholder="City, State"
				class="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
			/>
			<p class="mt-1 text-xs text-slate-500">Helps verify you're in the jurisdiction</p>
		</div>
	{/if}

	{#if connectionError}
		<p class="text-sm text-red-600">{connectionError}</p>
	{/if}
</div>

<div class="flex gap-3">
	<button
		type="button"
		class="flex-1 rounded-lg border border-blue-200 bg-white px-6 py-3 text-sm font-medium text-blue-600 transition-all hover:border-blue-300 disabled:opacity-50"
		onclick={onPrev}
		disabled={isTransitioning}
	>
		Back
	</button>
	<button
		type="button"
		class="flex-1 rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-all hover:bg-blue-700 disabled:opacity-50"
		onclick={onNext}
		disabled={isTransitioning}
	>
		Continue
	</button>
</div>
