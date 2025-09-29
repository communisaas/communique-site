<script lang="ts">
	import { page } from '$app/stores';
	import { onMount as _onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import AddressCollectionForm from '$lib/components/onboarding/AddressCollectionForm.svelte';
	import type { PageData } from './$types';

	let { _data }: { data: PageData } = $props();

	let pendingTemplate: { slug: string; title: string } | null = $state(null);
	let finalReturnUrl = $state('/profile');

	_onMount(() => {
		if (browser) {
			// Check if there's a pending template action
			const pendingAction = sessionStorage.getItem('pending_template_action');
			if (pendingAction) {
				try {
					const actionData = JSON.parse(pendingAction);
					pendingTemplate = actionData;
					finalReturnUrl = `/template-modal/${actionData.slug}`;
				} catch (error) {
					console.error('Failed to parse pending template action');
				}
			}

			// Check for return URL from OAuth cookie (fallback to query params for compatibility)
			const oauthReturnCookie = document.cookie
				.split('; ')
				.find((row) => row.startsWith('oauth_return_to='));

			if (oauthReturnCookie) {
				finalReturnUrl = decodeURIComponent(oauthReturnCookie.split('=')[1]);
				// Clean up the cookie after use
				document.cookie = 'oauth_return_to=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
			} else {
				// Fallback to query params for backward compatibility
				const returnTo = $page.url.searchParams.get('returnTo');
				if (returnTo) {
					finalReturnUrl = decodeURIComponent(returnTo);
				}
			}
		}
	});

	async function handleAddressComplete(__event: CustomEvent) {
		const { address, verified, representatives, district, streetAddress, city, state, zipCode } =
			event.detail;

		let success = false;

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
			} else {
				success = true;
				toast.success('Address saved successfully!');
			}
		} catch (error) {
			console.error('Failed to save address to database');
			const { toast } = await import('$lib/stores/toast.svelte');
			toast.error('Failed to save address. Please try again.');
			return; // Don't redirect on error
		}

		// Only proceed if save was successful
		if (success) {
			// Save address completion to sessionStorage if needed
			if (browser) {
				sessionStorage.setItem(
					'address_completed',
					JSON.stringify({
						address,
						verified,
						representatives,
						district,
						completedAt: new Date().toISOString()
					})
				);

				// Clear pending template action since we're completing it
				sessionStorage.removeItem('pending_template_action');
			}

			// Redirect to final destination after successful save
			goto(finalReturnUrl);
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
			<h1 class="mb-2 text-2xl font-bold text-slate-900">Let's get your message delivered</h1>
			<p class="text-sm text-slate-600">Your address unlocks direct routes to decision makers</p>
		</div>

		<!-- Address Collection Card - Connected to header -->
		<div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
			<AddressCollectionForm
				template={pendingTemplate
					? {
							title: pendingTemplate.title,
							deliveryMethod: 'certified'
						}
					: {
							title: 'Congressional Message',
							deliveryMethod: 'certified'
						}}
				on:complete={handleAddressComplete}
			/>
		</div>
	</div>
</div>
