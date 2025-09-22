<!--
UNIFIED TEMPLATE MODAL - Replaces legacy TemplateModal pattern
Uses UnifiedModal system for consistent behavior and proper reactivity.
-->
<script lang="ts">
	import UnifiedModal from '$lib/components/ui/UnifiedModal.svelte';
	import TemplateModal from '$lib/components/template/TemplateModal.svelte';
	import { createModalStore } from '$lib/stores/modalSystem.svelte';
	import type { Template } from '$lib/types/template';
	import { toComponentUser, type ComponentTemplate } from '$lib/types/component-props';
	import type { HeaderUser } from '$lib/types/any-replacements.js';

	// Connect to modal system with reactive getters
	const modalStore = createModalStore('template-modal', 'template_modal');
	let modal: UnifiedModal | undefined = $state();

	// Make getters reactive using $derived
	const isOpen = $derived(modalStore.isOpen);
	const modalData = $derived(
		modalStore.data as {
			template: Template;
			user: HeaderUser;
		} | null
	);

	// Convert Template to ComponentTemplate
	function toComponentTemplate(template: Template): ComponentTemplate {
		// Extract metrics separately and spread the rest
		const { metrics, ...otherProps } = template;
		return {
			...otherProps,
			recipientEmails: template.recipientEmails,
			metrics: {
				sent: metrics?.sent,
				delivered: metrics?.delivered,
				views: metrics?.views
			}
		} as ComponentTemplate;
	}

	// Derived states for template and user
	const template = $derived(modalData?.template ? toComponentTemplate(modalData.template) : null);
	const user = $derived(modalData?.user ? toComponentUser(modalData.user) : null);

	// Open/close functions for external use
	export function open(template: Template, user: HeaderUser) {
		// Use modalStore directly - don't wait for modal component to exist
		modalStore.open({ template, user });
	}

	export function close() {
		// Use modalStore directly
		modalStore.close();
	}

	// Handle modal events from TemplateModal
	function handleClose() {
		close();
	}

	function handleUsed(__event: CustomEvent) {
		// Dispatch or handle template used event
		// Don't close modal - let it persist for post-send flow
	}
</script>

<!-- Only render when modal is open and we have data -->
{#if isOpen && template}
	<UnifiedModal
		bind:this={modal}
		id="template-modal"
		type="template_modal"
		size="lg"
		showCloseButton={false}
		closeOnBackdrop={false}
		closeOnEscape={true}
	>
		<TemplateModal {template} {user} on:close={handleClose} on:used={handleUsed} />
	</UnifiedModal>
{/if}
