<!--
WRAPPER FOR UNIFIED ADDRESS COLLECTION MODAL
Bridges the old event dispatcher pattern with the new unified modal system.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import UnifiedModal from '$lib/components/ui/UnifiedModal.svelte';
	import AddressCollectionForm from '$lib/components/onboarding/AddressCollectionForm.svelte';
	// import { AddressCollectionContent } from '$lib/components/auth/parts';

	let {
		template
	}: {
		template: {
			title: string;
			deliveryMethod: string;
		};
	} = $props();

	const dispatch = createEventDispatcher<{
		close: void;
		complete: {
			street?: string;
			city?: string;
			state?: string;
			zip?: string;
			address: string;
			verified: boolean;
			congressional_district?: string;
			representatives?: Array<Record<string, unknown>>;
		};
	}>();

	let modal: UnifiedModal;
	let isOpen = $state(true);

	// Auto-open when component is created
	$effect(() => {
		if (modal && isOpen) {
			modal.open({ template });
		}
	});

	function handleClose() {
		dispatch('close');
	}

	function handleComplete(
		event: CustomEvent<{
			street?: string;
			city?: string;
			state?: string;
			zip?: string;
			address: string;
			verified: boolean;
			congressional_district?: string;
			representatives?: Array<Record<string, unknown>>;
		}>
	) {
		dispatch('complete', event.detail);
	}
</script>

<UnifiedModal
	bind:this={modal}
	id="address-collection-wrapper"
	type="address"
	size="md"
	showCloseButton={true}
	closeOnBackdrop={true}
	closeOnEscape={true}
>
	{#snippet children(data)}
		{#if data?.template}
			<AddressCollectionForm _template={{ title: '', deliveryMethod: '', ...data.template } as any} oncomplete={(result: any) => dispatch('complete', result)} />
		{/if}
	{/snippet}
</UnifiedModal>
