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

<div class="text-center mb-6">
	<div class="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4">
		{#if isLocalGovernment}
			<Home class="h-6 w-6 text-green-600" />
		{:else if isCorporate}
			<Building2 class="h-6 w-6 text-green-600" />
		{:else}
			<Users class="h-6 w-6 text-green-600" />
		{/if}
	</div>
	<h2 class="text-xl font-bold text-slate-900 mb-2">
		Your connection
	</h2>
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

<div class="space-y-4 mb-6">
	<div>
		<label class="block text-sm font-medium text-slate-700 mb-3">
			Select your connection:
		</label>
		<div class="space-y-2">
			{#each connectionOptions as connection}
				<button
					type="button"
					onclick={() => selectedConnection = connection.toLowerCase().replace(/\s+/g, '-')}
					class="w-full text-left p-3 border rounded-lg text-sm transition-all hover:border-blue-300 {
						selectedConnection === connection.toLowerCase().replace(/\s+/g, '-') 
							? 'border-blue-500 bg-blue-50 text-blue-900' 
							: 'border-slate-300 text-slate-700'
					}"
				>
					{connection}
				</button>
			{/each}
			<button
				type="button"
				onclick={() => selectedConnection = 'other'}
				class="w-full text-left p-3 border rounded-lg text-sm transition-all hover:border-blue-300 {
					selectedConnection === 'other' 
						? 'border-blue-500 bg-blue-50 text-blue-900' 
						: 'border-slate-300 text-slate-700'
				}"
			>
				Other
			</button>
		</div>
		
		{#if selectedConnection === 'other'}
			<input
				type="text"
				bind:value={connectionDetails}
				placeholder="Describe your connection"
				class="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
			/>
		{/if}
	</div>
	
	{#if isLocalGovernment}
		<div>
			<label for="location" class="block text-sm font-medium text-slate-700 mb-2">
				Location (optional)
			</label>
			<input
				id="location"
				type="text"
				bind:value={location}
				placeholder="City, State"
				class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
			/>
			<p class="mt-1 text-xs text-slate-500">
				Helps verify you're in the jurisdiction
			</p>
		</div>
	{/if}
	
	{#if connectionError}
		<p class="text-sm text-red-600">{connectionError}</p>
	{/if}
</div>

<div class="flex gap-3">
	<button
		type="button"
		class="flex-1 bg-white text-blue-600 border border-blue-200 hover:border-blue-300 rounded-lg px-6 py-3 text-sm font-medium transition-all disabled:opacity-50"
		onclick={onPrev}
		disabled={isTransitioning}
	>
		Back
	</button>
	<button
		type="button"
		class="flex-1 bg-blue-600 text-white hover:bg-blue-700 rounded-lg px-6 py-3 text-sm font-medium transition-all disabled:opacity-50"
		onclick={onNext}
		disabled={isTransitioning}
	>
		Continue
	</button>
</div>