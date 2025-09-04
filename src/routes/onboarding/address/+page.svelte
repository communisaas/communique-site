<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import AddressCollectionForm from '$lib/components/onboarding/AddressCollectionForm.svelte';
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
					console.error('Failed to parse pending action:', error);
				}
			}
			
			// Check for return URL from query params
			const returnTo = $page.url.searchParams.get('returnTo');
			if (returnTo) {
				finalReturnUrl = decodeURIComponent(returnTo);
			}
		}
	});
	
	async function handleAddressComplete(event: CustomEvent) {
		const { address, verified, representatives, district, streetAddress, city, state, zipCode } = event.detail;
		
		// Save address to database
		try {
			const { api } = await import('$lib/core/api/client');
			const result = await api.post('/api/user/address', {
				street: streetAddress,
				city,
				state,
				zip: zipCode,
				congressional_district: district,
				verified,
				representatives
			});
			
			if (!result.success) {
				console.error('Failed to save address:', result.error);
			}
		} catch (error) {
			console.error('Error saving address:', error);
		}
		
		// Save address completion to sessionStorage if needed
		if (browser) {
			sessionStorage.setItem('address_completed', JSON.stringify({
				address,
				verified,
				representatives,
				district,
				completedAt: new Date().toISOString()
			}));
			
			// Clear pending template action since we're completing it
			sessionStorage.removeItem('pending_template_action');
		}
		
		// Redirect to final destination
		goto(finalReturnUrl);
	}
	
</script>

<svelte:head>
	<title>Complete Your Profile - Communiqué</title>
	<meta name="description" content="Complete your profile to start sending messages to Congress" />
</svelte:head>

<div class="bg-gradient-to-b from-slate-50 to-white py-8">
	<div class="max-w-lg mx-auto px-4">
		<!-- Engaging Header -->
		<div class="text-center mb-4">
			<h1 class="text-2xl font-bold text-slate-900 mb-2">
				Let's get your message delivered
			</h1>
			<p class="text-sm text-slate-600">
				Your address unlocks direct routes to decision makers
			</p>
		</div>

		<!-- Address Collection Card - Connected to header -->
		<div class="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
			<AddressCollectionForm
				template={pendingTemplate || { title: 'Congressional Message', deliveryMethod: 'both' }}
				on:complete={handleAddressComplete}
			/>
		</div>
	</div>
</div>