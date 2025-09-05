<script lang="ts">
	import { createModalStore } from '$lib/stores/modalSystem.svelte';
	import AddressRequirementModal from '$lib/components/auth/AddressRequirementModal.svelte';
	import UnifiedAddressCollectionWrapper from '$lib/components/modals/UnifiedAddressCollectionWrapper.svelte';
	import { analyzeEmailFlow, launchEmail } from '$lib/services/emailService';
	
	const modalStore = createModalStore('address-modal', 'address');
	
	// Extract data from modal store
	$: modalData = modalStore.data as {
		template: any;
		source: string;
		user?: any;
		mode?: 'requirement' | 'collection';
	} | null;
	
	function handleComplete(event: CustomEvent) {
		const { address, verified, enhancedCredibility, representatives } = event.detail;
		
		// Save address to backend
		const saveAddress = async () => {
			if (modalData?.mode === 'collection' || (!enhancedCredibility && modalData?.user)) {
				await fetch('/api/user/address', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ address, verified, representatives })
				}).then(response => response.json())
				.then(result => {
					// Update local user data
					if (modalData?.user && result.user) {
						Object.assign(modalData.user, result.user);
					}
				});
			}
		};
		
		// Close modal
		modalStore.close();
		
		// Handle different completion flows
		if (modalData?.source === 'onboarding') {
			// For onboarding flow - save address and redirect
			saveAddress().then(() => {
				// Clear any pending template action
				sessionStorage.removeItem('pending_template_action');
				// Redirect to return URL with completion signal
				const finalReturnUrl = new URLSearchParams(window.location.search).get('returnTo') || '/profile';
				const separator = finalReturnUrl.includes('?') ? '&' : '?';
				window.location.href = `${finalReturnUrl}${separator}action=complete`;
			});
		} else {
			// For regular template flow - save address and launch email
			saveAddress();
			if (modalData?.template) {
				const flow = analyzeEmailFlow(modalData.template, modalData.user);
				if (flow.mailtoUrl) {
					launchEmail(flow.mailtoUrl);
				}
			}
		}
	}
</script>

{#if modalStore.isOpen && modalData}
	{#if modalData.mode === 'collection'}
		<UnifiedAddressCollectionWrapper 
			template={modalData.template}
			on:close={modalStore.close}
			on:complete={handleComplete}
		/>
	{:else}
		<AddressRequirementModal 
			template={modalData.template}
			user={modalData.user}
			isOpen={modalStore.isOpen}
			on:close={modalStore.close}
			on:complete={handleComplete}
		/>
	{/if}
{/if}