<!--
UNIFIED ONBOARDING MODAL - Replaces OnboardingModal.svelte
Uses UnifiedModal system for consistent behavior and z-index management.
-->
<script lang="ts">
	import UnifiedModal from '$lib/components/ui/UnifiedModal.svelte';
	import { OnboardingContent } from '$lib/components/auth/parts';
	import { createModalStore } from '$lib/stores/modalSystem.svelte';
	
	// Connect to modal system
	const modalStore = createModalStore('onboarding-modal', 'onboarding');
	let modal: UnifiedModal = $state();
	
	// Open/close functions for external use
	export function open(data: {
		template: {
			title: string;
			description: string;
			slug: string;
			deliveryMethod?: string;
			metrics: { sent: number; views?: number };
		};
		source?: 'social-link' | 'direct-link' | 'share';
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
			description: string;
			slug: string;
			deliveryMethod?: string;
			metrics: { sent: number; views?: number };
		};
		source?: 'social-link' | 'direct-link' | 'share';
	} | null);

	function handleAuth(provider: string) {
		// Redirect to OAuth provider
		window.location.href = `/auth/${provider}`;
	}
</script>

<UnifiedModal
	bind:this={modal}
	id="onboarding-modal"
	type="onboarding"
	size="md"
	showCloseButton={true}
	closeOnBackdrop={true}
	closeOnEscape={true}
>
	{#snippet children(data)}
		{#if data?.template}
			<OnboardingContent
				template={data.template}
				source={data.source || 'direct-link'}
				onauth={handleAuth}
				onclose={modal.close}
			/>
		{/if}
	{/snippet}
</UnifiedModal>