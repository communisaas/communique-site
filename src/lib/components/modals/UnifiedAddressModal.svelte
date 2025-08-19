<script lang="ts">
	import { createModalStore } from '$lib/stores/modalSystem';
	import AddressRequirementModal from '$lib/components/auth/AddressRequirementModal.svelte';
	import { analyzeEmailFlow, launchEmail } from '$lib/services/emailService';
	
	const modalStore = createModalStore('address-modal', 'address');
	
	// Extract data from modal store
	$: modalData = $modalStore.data as {
		template: any;
		source: string;
		user?: any;
	} | null;
	
	function handleComplete(event: CustomEvent) {
		const { address, verified, enhancedCredibility } = event.detail;
		
		// Update user address if needed (for manual entry)
		if (!enhancedCredibility && modalData?.user) {
			// Call API to save address - simplified for demo
			fetch('/api/user/address', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ address })
			}).then(response => response.json())
			.then(result => {
				// Update local user data
				if (modalData?.user && result.user) {
					Object.assign(modalData.user, result.user);
				}
			});
		}
		
		// Close modal
		modalStore.close();
		
		// Proceed with email generation
		if (modalData?.template) {
			const flow = analyzeEmailFlow(modalData.template, modalData.user);
			if (flow.mailtoUrl) {
				launchEmail(flow.mailtoUrl, '/');
			}
		}
	}
</script>

{#if $modalStore.isOpen && modalData}
	<AddressRequirementModal 
		template={modalData.template}
		user={modalData.user}
		isOpen={$modalStore.isOpen}
		on:close={modalStore.close}
		on:complete={handleComplete}
	/>
{/if}