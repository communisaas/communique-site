<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import UnifiedAddressModal from '$lib/components/modals/UnifiedAddressModal.svelte';
	import { modalActions } from '$lib/stores/modalSystem';
	import type { PageData } from './$types';
	
	let { data }: { data: PageData } = $props();
	
	let pendingTemplate: { slug: string; title: string } | null = $state(null);
	let finalReturnUrl = $state('/dashboard');
	
	onMount(() => {
		if (browser) {
			// Check if there's a pending template action
			const pendingAction = sessionStorage.getItem('pending_template_action');
			if (pendingAction) {
				try {
					const actionData = JSON.parse(pendingAction);
					pendingTemplate = actionData;
					finalReturnUrl = `/template-modal/${actionData.slug}`;
				} catch (error) {
				}
			}
			
			// Check for return URL from query params
			const returnTo = $page.url.searchParams.get('returnTo');
			if (returnTo) {
				finalReturnUrl = decodeURIComponent(returnTo);
			}
			
			// Open the address collection modal
			modalActions.open('address-modal', 'address', { 
				template: pendingTemplate || { 
					title: 'Congressional Message', 
					deliveryMethod: 'both' 
				}, 
				mode: 'collection',
				source: 'onboarding'
			});
		}
	});
	
</script>

<svelte:head>
	<title>Complete Your Profile - Communiqué</title>
	<meta name="description" content="Complete your profile to start sending messages to Congress" />
</svelte:head>

<div class="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
	<div class="max-w-md w-full text-center">
		<h1 class="text-2xl font-bold text-slate-900 mb-4">
			One more step...
		</h1>
		<p class="text-slate-600 mb-8">
			We need to verify your address to send your message to the right representatives.
		</p>
		
		<!-- Loading state while modal appears -->
		{#if !showAddressModal}
			<div class="animate-pulse">
				<div class="h-4 bg-slate-200 rounded w-3/4 mx-auto mb-2"></div>
				<div class="h-4 bg-slate-200 rounded w-1/2 mx-auto"></div>
			</div>
		{/if}
	</div>
</div>

<!-- Address collection modal managed by UnifiedAddressModal -->
<UnifiedAddressModal />