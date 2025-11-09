<script lang="ts">
	import { CheckCircle2, Home } from '@lucide/svelte';

	interface Representative {
		name: string;
		office: string;
		state?: string;
		district?: string;
		chamber?: string;
		email?: string;
		phone?: string;
	}

	interface VerificationResult {
		representatives?: Representative[];
		district?: string;
		correctedAddress?: string;
		[key: string]: unknown;
	}

	let {
		selectedAddress,
		verificationResult,
		onEditAddress,
		onAcceptAddress
	}: {
		selectedAddress: string;
		verificationResult: VerificationResult | null;
		onEditAddress: () => void;
		onAcceptAddress: () => void;
	} = $props();
</script>

<div class="mb-6 text-center">
	<div class="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
		<CheckCircle2 class="h-6 w-6 text-green-600" />
	</div>
	<h2 class="mb-2 text-2xl font-bold text-slate-900">Ready to send</h2>
</div>

<!-- Representatives Found -->
{#if verificationResult?.representatives}
	<div class="mb-6 space-y-3">
		{#each verificationResult.representatives as rep}
			<div class="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3">
				<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100">
					<CheckCircle2 class="h-5 w-5 text-blue-600" />
				</div>
				<div>
					<p class="font-medium text-slate-900">{rep.name}</p>
					<p class="text-xs text-slate-600">{rep.office}</p>
				</div>
			</div>
		{/each}
	</div>
{/if}

<!-- Verified Address -->
<div class="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-3">
	<div class="flex items-start gap-3">
		<Home class="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
		<div class="flex-1">
			<p class="text-xs font-medium text-slate-500">Verified Address</p>
			<p class="mt-0.5 text-sm text-slate-700">{selectedAddress}</p>
		</div>
	</div>
</div>

<!-- Privacy promise -->
<div class="mb-4 flex items-center justify-center gap-2 text-xs text-slate-500">
	<svg class="h-3 w-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
		<circle cx="10" cy="10" r="8"/>
	</svg>
	Address deleted after delivery
</div>

<div class="flex gap-3">
	<button
		type="button"
		class="flex-1 rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50"
		onclick={onEditAddress}
	>
		Edit Address
	</button>
	<button
		type="button"
		class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-all hover:bg-blue-700"
		onclick={onAcceptAddress}
	>
		<CheckCircle2 class="h-4 w-4" />
		Send My Message
	</button>
</div>
