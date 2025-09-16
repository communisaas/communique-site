<!--
UNIFIED PROGRESSIVE FORM MODAL - Replaces ProgressiveFormModal.svelte
Uses UnifiedModal system for consistent behavior and z-index management.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import UnifiedModal from '$lib/components/ui/UnifiedModal.svelte';
	import { ProgressiveFormContent } from '$lib/components/template/parts';

	let {
		template,
		user = null
	}: {
		template: {
			id: string;
			title: string;
			description: string;
			slug: string;
			deliveryMethod: string;
			preview?: string;
		};
		user?: { id: string; name: string; address?: string } | null;
	} = $props();

	const dispatch = createEventDispatcher<{
		close: void;
		send: { name: string; address?: string; email?: string };
	}>();

	let modal: UnifiedModal;
	let isOpen = $state(true);

	// Auto-open when component is created
	$effect(() => {
		if (modal && isOpen) {
			modal.open({ template, user });
		}
	});

	function handleClose() {
		dispatch('close');
	}

	function handleSend(data: { name: string; address?: string; email?: string }) {
		dispatch('send', data);
	}
</script>

<UnifiedModal
	bind:this={modal}
	id="progressive-form-modal"
	type="template_modal"
	size="md"
	showCloseButton={true}
	closeOnBackdrop={true}
	closeOnEscape={true}
>
	{#snippet children(data)}
		{#if data?.template}
			<ProgressiveFormContent
				template={data.template}
				user={data.user}
				onclose={handleClose}
				onsend={handleSend}
			/>
		{/if}
	{/snippet}
</UnifiedModal>
