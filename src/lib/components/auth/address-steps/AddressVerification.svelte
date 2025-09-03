<script lang="ts">
	import { CheckCircle2, Home } from '@lucide/svelte';
	
	let {
		selectedAddress,
		verificationResult,
		onEditAddress,
		onAcceptAddress
	}: {
		selectedAddress: string;
		verificationResult: Record<string, unknown> | null;
		onEditAddress: () => void;
		onAcceptAddress: () => void;
	} = $props();
</script>

<div class="mb-6 text-center">
	<div
		class="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100"
	>
		<CheckCircle2 class="h-6 w-6 text-green-600" />
	</div>
	<h2 class="mb-2 text-xl font-bold text-slate-900">Confirm your address</h2>
	<p class="text-slate-600">
		We've verified your address and found your representatives
	</p>
</div>

<!-- Verified Address -->
<div class="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
	<div class="flex items-start gap-3">
		<Home class="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
		<div>
			<p class="font-medium text-slate-900">Verified Address:</p>
			<p class="mt-1 text-sm text-slate-600">{selectedAddress}</p>
		</div>
	</div>
</div>

<!-- Representatives Found -->
{#if verificationResult?.representatives}
	<div class="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
		<p class="mb-2 font-medium text-slate-900">Your Representatives:</p>
		<div class="space-y-2">
			{#each verificationResult.representatives as rep}
				<div class="flex items-center gap-2 text-sm">
					<div class="h-2 w-2 rounded-full bg-blue-500"></div>
					<span class="text-slate-700">{rep.name} ({rep.office})</span>
				</div>
			{/each}
		</div>
	</div>
{/if}

<div class="flex gap-3">
	<button
		type="button"
		class="flex-1 bg-white text-blue-600 border border-blue-200 hover:border-blue-300 rounded-lg px-6 py-3 text-sm font-medium transition-all"
		onclick={onEditAddress}
	>
		Edit Address
	</button>
	<button
		type="button"
		class="flex items-center justify-center gap-1 flex-1 bg-blue-600 text-white hover:bg-blue-700 rounded-lg px-6 py-3 text-sm font-medium transition-all"
		onclick={onAcceptAddress}
	>
		<CheckCircle2 class="h-4 w-4" />
		Looks Good
	</button>
</div>