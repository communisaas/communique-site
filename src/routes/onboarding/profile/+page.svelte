<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import DirectOutreachModal from '$lib/components/auth/DirectOutreachModal.svelte';
	import type { PageData } from './$types';
	
	let { data }: { data: PageData } = $props();
	
	let showDirectModal = $state(true);
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
		}
	});
	
	async function handleProfileComplete(event: CustomEvent) {
		const { role, organization, location, connection, connectionDetails } = event.detail;
		
		try {
			// Save profile information to user
			const response = await fetch('/api/user/profile', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					role,
					organization,
					location,
					connection,
					connectionDetails
				})
			});
			
			if (response.ok) {
				// Clear any pending template action
				if (browser) {
					sessionStorage.removeItem('pending_template_action');
				}
				
				// Redirect to final destination
				window.location.href = finalReturnUrl;
			} else {
				// Still redirect, but user might need to re-enter info later
				window.location.href = finalReturnUrl;
			}
		} catch (error) {
			// Still redirect to avoid getting stuck
			window.location.href = finalReturnUrl;
		}
	}
	
	function handleProfileSkip() {
		// User chose to skip profile completion
		if (browser) {
			sessionStorage.removeItem('pending_template_action');
		}
		window.location.href = finalReturnUrl;
	}
</script>

<svelte:head>
	<title>Complete Your Profile - Communiqué</title>
	<meta name="description" content="Complete your profile to strengthen your advocacy messages" />
</svelte:head>

<div class="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
	<div class="max-w-md w-full text-center">
		<h1 class="text-2xl font-bold text-slate-900 mb-4">
			Make your voice stronger
		</h1>
		<p class="text-slate-600 mb-8">
			Adding your role and connection to this issue increases your message's impact with decision-makers.
		</p>
		
		<!-- Loading state while modal appears -->
		{#if !showDirectModal}
			<div class="animate-pulse">
				<div class="h-4 bg-slate-200 rounded w-3/4 mx-auto mb-2"></div>
				<div class="h-4 bg-slate-200 rounded w-1/2 mx-auto"></div>
			</div>
		{/if}
	</div>
</div>

{#if showDirectModal}
	<DirectOutreachModal 
		template={pendingTemplate || { 
			title: 'Direct Outreach Message', 
			deliveryMethod: 'email',
			category: 'advocacy'
		}}
		on:complete={handleProfileComplete}
		on:close={handleProfileSkip}
	/>
{/if}