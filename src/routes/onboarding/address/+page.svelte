<script lang="ts">
	/**
	 * SIMPLIFIED ADDRESS ONBOARDING PAGE
	 *
	 * This page is now a FALLBACK for profile completion only.
	 * OAuth flow NO LONGER redirects here - address is collected inline within modals.
	 *
	 * Use cases:
	 * - User wants to complete their profile from /profile page
	 * - User wants to update their address manually
	 * - Standalone address collection (not part of template flow)
	 */
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import AddressCollectionForm from '$lib/components/onboarding/AddressCollectionForm.svelte';
	import type { PageData } from './$types';

	let { _data }: { data: PageData } = $props();

	// Simple return URL - default to profile
	const returnTo = $derived($page.url.searchParams.get('returnTo') || '/profile');

	async function handleAddressComplete(__event: CustomEvent) {
		const { verified, representatives, district, streetAddress, city, state, zipCode } =
			event.detail;

		// Save address to database
		try {
			const { api } = await import('$lib/core/api/client');
			const { toast } = await import('$lib/stores/toast.svelte');
			const { formatErrorMessage } = await import('$lib/utils/error-formatting');

			const result = await api.post('/user/address', {
				street: streetAddress,
				city,
				state,
				zip: zipCode,
				congressional_district: district,
				verified,
				representatives
			});

			if (!result.success) {
				console.error('Failed to save address:', result.error, result);
				toast.error(formatErrorMessage(result.error, 'Failed to save address. Please try again.'));
				// Reset the saving state in the child component
				const form = document.querySelector('form');
				if (form) {
					form.dispatchEvent(new CustomEvent('savingerror'));
				}
				return; // Don't redirect on error
			}

			toast.success('Address saved successfully!');

			// Redirect to profile or specified return URL
			goto(returnTo);
		} catch (error) {
			console.error('Failed to save address to database:', error);
			const { toast } = await import('$lib/stores/toast.svelte');
			toast.error('Failed to save address. Please try again.');
		}
	}
</script>

<svelte:head>
	<title>Complete Your Profile - Communiqué</title>
	<meta name="description" content="Complete your profile to start sending messages to Congress" />
</svelte:head>

<div class="bg-gradient-to-b from-slate-50 to-white py-8">
	<div class="mx-auto max-w-lg px-4">
		<!-- Engaging Header -->
		<div class="mb-4 text-center">
			<h1 class="mb-2 text-2xl font-bold text-slate-900">Complete Your Profile</h1>
			<p class="text-sm text-slate-600">
				Your address helps us route messages to the right representatives
			</p>
		</div>

		<!-- Address Collection Card - Connected to header -->
		<div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
			<AddressCollectionForm
				template={{
					title: 'Complete Your Profile',
					deliveryMethod: 'cwc'
				}}
				on:complete={handleAddressComplete}
			/>
		</div>
	</div>
</div>
