<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { X, Shield, MapPin, ArrowRight } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import type { Template } from '$lib/types/template';
	import { createModalStore } from '$lib/stores/modalSystem';

	let { 
		handleAddressSubmit,
		isUpdatingAddress = false
	}: {
		handleAddressSubmit: (address: string) => Promise<void>;
		isUpdatingAddress?: boolean;
	} = $props();

	// Connect to modal system
	const modal = createModalStore('address-modal', 'address');
	
	// Get modal data which includes template and source
	const modalData = $derived($modal.data as { template: Template; source?: 'social-link' | 'direct-link' | 'share' } | null);
	const template = $derived(modalData?.template);

	let address = $state('');

	async function handleSubmit() {
		if (!address.trim() || isUpdatingAddress) return;
		
		await handleAddressSubmit(address.trim());
	}

	function handleClose() {
		modal.close();
	}
</script>

{#if $modal.isOpen && template}
<!-- Modal Backdrop -->
<div 
	class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
	onclick={handleClose}
	in:fade={{ duration: 200 }}
	out:fade={{ duration: 200 }}
	role="button"
	tabindex="-1"
>
	<!-- Modal Container -->
	<div 
		class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
		onclick={(e) => e.stopPropagation()}
		in:scale={{ duration: 300, start: 0.9, easing: quintOut }}
		out:scale={{ duration: 200, start: 1, easing: quintOut }}
		role="button"
		tabindex="-1"
	>
		<!-- Header -->
		<div class="text-center p-6 pb-4">
			<div class="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
				<Shield class="h-6 w-6 text-green-600" />
			</div>
			<h2 class="text-xl font-semibold text-slate-900 mb-2">
				Almost there
			</h2>
			<p class="text-slate-600">
				We need your address to contact your specific representatives
			</p>
		</div>

		<!-- Content -->
		<div class="px-6 pb-6">
			<!-- Address Input -->
			<div class="mb-4">
				<label for="address" class="block text-sm font-medium text-slate-700 mb-2">
					Your address
				</label>
				<div class="relative">
					<MapPin class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
					<input
						id="address"
						type="text"
						bind:value={address}
						placeholder="123 Main St, City, State 12345"
						class="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
						disabled={isUpdatingAddress}
						onkeydown={(e) => e.key === 'Enter' && handleSubmit()}
					/>
				</div>
			</div>

			<!-- Action Button -->
			<Button
				onclick={handleSubmit}
				classNames="w-full bg-green-600 hover:bg-green-700 text-white"
				disabled={!address.trim() || isUpdatingAddress}
			>
				{#if isUpdatingAddress}
					<div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
					Finding representatives...
				{:else}
					<Shield class="h-4 w-4" />
					Find my representatives
				{/if}
			</Button>

			<!-- Progress indicator -->
			<div class="mt-4 p-3 bg-slate-50 rounded-lg">
				<div class="flex items-center gap-2 text-sm text-slate-600">
					<ArrowRight class="h-3 w-3" />
					<span>Step 2 of 2 • Next: Send to Congress</span>
				</div>
			</div>

			<!-- Close button -->
			<button
				onclick={handleClose}
				class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
			>
				<X class="h-5 w-5" />
			</button>
		</div>
	</div>
</div>
{/if}