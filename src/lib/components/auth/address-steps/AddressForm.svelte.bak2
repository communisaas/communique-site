<script lang="ts">
	import { Info, AlertCircle, Search } from '@lucide/svelte';

	let {
		template,
		streetAddress = $bindable(),
		city = $bindable(),
		stateCode = $bindable(),
		zipCode = $bindable(),
		addressError = $bindable(),
		isVerifying,
		onVerifyAddress,
		onKeydown
	}: {
		template: { title: string };
		streetAddress: string;
		city: string;
		stateCode: string;
		zipCode: string;
		addressError: string;
		isVerifying: boolean;
		onVerifyAddress: () => void;
		onKeydown: (__event: KeyboardEvent) => void;
	} = $props();
</script>

<div class="mb-6 text-center">
	<h2 class="mb-2 text-xl font-bold text-slate-900">Enter Your Address</h2>
	<p class="text-sm text-slate-600">
		Congressional messages need your address to route to the correct representatives
	</p>
</div>

<!-- Template Context -->
<div class="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-3">
	<div class="flex items-center gap-2">
		<Info class="h-4 w-4 text-slate-500" />
		<span class="text-sm text-slate-700">You're sending: <strong>{template.title}</strong></span>
	</div>
</div>

<div class="mb-6 space-y-4">
	<div>
		<label for="street" class="mb-2 block text-sm font-medium text-slate-700">
			Street Address
		</label>
		<input
			id="street"
			type="text"
			bind:value={streetAddress}
			placeholder="123 Main Street"
			class="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
			onkeydown={onKeydown}
		/>
	</div>

	<div class="grid grid-cols-2 gap-3">
		<div>
			<label for="city" class="mb-2 block text-sm font-medium text-slate-700"> City </label>
			<input
				id="city"
				type="text"
				bind:value={city}
				placeholder="City"
				class="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
				onkeydown={onKeydown}
			/>
		</div>
		<div>
			<label for="state" class="mb-2 block text-sm font-medium text-slate-700"> State </label>
			<input
				id="state"
				type="text"
				bind:value={stateCode}
				placeholder="CA"
				maxlength="2"
				class="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
				onkeydown={onKeydown}
			/>
		</div>
	</div>

	<div>
		<label for="zip" class="mb-2 block text-sm font-medium text-slate-700"> ZIP Code </label>
		<input
			id="zip"
			type="text"
			bind:value={zipCode}
			placeholder="12345"
			maxlength="10"
			class="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
			onkeydown={onKeydown}
		/>
	</div>

	{#if addressError}
		<div class="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
			<AlertCircle class="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
			<p class="text-sm text-red-700">{addressError}</p>
		</div>
	{/if}
</div>

<div class="space-y-3">
	<button
		type="button"
		class="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-all hover:bg-blue-700 disabled:opacity-50"
		onclick={onVerifyAddress}
		disabled={isVerifying ||
			!streetAddress.trim() ||
			!city.trim() ||
			!stateCode.trim() ||
			!zipCode.trim()}
	>
		{#if isVerifying}
			<Search class="h-4 w-4 animate-spin" />
			Verifying address...
		{:else}
			<Search class="h-4 w-4" />
			Verify & Find Representatives
		{/if}
	</button>
</div>
