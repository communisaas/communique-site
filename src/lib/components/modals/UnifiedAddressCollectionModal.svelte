<!--
UNIFIED ADDRESS COLLECTION MODAL - Replaces AddressCollectionModal.svelte
Uses UnifiedModal system for consistent behavior and z-index management.
-->
<script lang="ts">
	import UnifiedModal from '$lib/components/ui/UnifiedModal.svelte';
	import { AddressCollectionContent } from '$lib/components/auth/parts';
	import { createModalStore } from '$lib/stores/modalSystem.svelte';

	// Connect to modal system
	const modalStore = createModalStore('address-collection-modal', 'address');
	let modal: UnifiedModal;

	// Open/close functions for external use
	export function open(data: {
		template: {
			title: string;
			deliveryMethod: string;
		};
		onComplete?: (data: {
			address: string;
			verified: boolean;
			representatives?: Array<Record<string, unknown>>;
		}) => void;
	}) {
		modal.open(data);
	}

	export function close() {
		modal.close();
	}

	// Extract data from modal store
	const modalData = $derived(modalStore.data as {
		template: {
			title: string;
			deliveryMethod: string;
		};
		onComplete?: (data: {
			address: string;
			verified: boolean;
			representatives?: Array<Record<string, unknown>>;
		}) => void;
	} | null);

	function handleComplete(data: {
		address: string;
		verified: boolean;
		representatives?: Array<Record<string, unknown>>;
	}) {
		// Call completion callback if provided
		if (modalData?.onComplete) {
			modalData.onComplete(data);
		}

		// Close modal
		modal.close();
	}
</script>

<UnifiedModal
	bind:this={modal}
	id="address-collection-modal"
	type="address"
	size="md"
	showCloseButton={true}
	closeOnBackdrop={true}
	closeOnEscape={true}
>
	{#snippet children(data)}
		{#if data?.template}
			<AddressCollectionContent
				template={data.template}
				onclose={modal.close}
				oncomplete={handleComplete}
			/>
		{/if}
	{/snippet}
</UnifiedModal>
