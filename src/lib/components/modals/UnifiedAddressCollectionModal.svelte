<!--
UNIFIED ADDRESS COLLECTION MODAL - Replaces AddressCollectionModal.svelte
Uses UnifiedModal system for consistent behavior and z-index management.
NOW USES IDENTITY VERIFICATION FIRST FLOW (self.xyz NFC passport or Didit.me government ID)
-->
<script lang="ts">
	import UnifiedModal from '$lib/components/ui/UnifiedModal.svelte';
	import IdentityVerificationFlow from '$lib/components/auth/IdentityVerificationFlow.svelte';
	import { createModalStore } from '$lib/stores/modalSystem.svelte';

	// Connect to modal system
	const modalStore = createModalStore('address-collection-modal', 'address');
	let modal: UnifiedModal = $state();

	// Open/close functions for external use
	export function open(data: {
		template: {
			title: string;
			deliveryMethod: string;
		};
		onComplete?: (data: {
			street?: string;
			city?: string;
			state?: string;
			zip?: string;
			address: string;
			verified: boolean;
			congressional_district?: string;
			representatives?: Array<Record<string, unknown>>;
		}) => void;
	}) {
		modal.open(data);
	}

	export function close() {
		modal.close();
	}

	// Extract data from modal store
	const modalData = $derived(
		modalStore.data as {
			template: {
				title: string;
				deliveryMethod: string;
			};
			onComplete?: (data: {
				street?: string;
				city?: string;
				state?: string;
				zip?: string;
				address: string;
				verified: boolean;
				congressional_district?: string;
				representatives?: Array<Record<string, unknown>>;
			}) => void;
		} | null
	);

	function handleComplete(data: {
		street?: string;
		city?: string;
		state?: string;
		zip?: string;
		address: string;
		verified: boolean;
		congressional_district?: string;
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
	size="lg"
	showCloseButton={true}
	closeOnBackdrop={true}
	closeOnEscape={true}
>
	{#snippet children(data)}
		{#if data?.template}
			<IdentityVerificationFlow
				userId="temp-user-id"
				templateSlug={data.template.title}
				skipValueProp={false}
				on:complete={(event) => {
					// Identity verification complete - extract address from verified data
					handleComplete({
						address: '', // Address will be extracted from verification data
						verified: event.detail.verified,
						representatives: []
					});
				}}
				on:cancel={modal.close}
				on:back={modal.close}
			/>
		{/if}
	{/snippet}
</UnifiedModal>
