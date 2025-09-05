<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import DirectOutreachModal from '$lib/components/auth/DirectOutreachModal.svelte';
	import DirectOutreachCompact from '$lib/components/auth/DirectOutreachCompact.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let showDirectModal = $state(true);
	let useCompact = $state(false);
	let pendingTemplate: {
		slug: string;
		title: string;
		deliveryMethod?: string;
		category?: string;
	} | null = $state(null);
	const defaultTemplate = {
		title: 'Direct Outreach Message',
		deliveryMethod: 'email',
		category: 'advocacy'
	} as const;
	type FlowTemplate = { title: string; deliveryMethod: string; category: string };
	function computeFlowTemplate(): FlowTemplate {
		const pt = pendingTemplate;
		if (pt) {
			return {
				title: pt.title,
				deliveryMethod: pt.deliveryMethod ?? 'email',
				category: pt.category ?? 'advocacy'
			};
		}
		return defaultTemplate;
	}
	const flowTemplate: FlowTemplate = $derived(computeFlowTemplate());
	let finalReturnUrl = $state('/profile');

	onMount(() => {
		if (browser) {
			// Check if there's a pending template action
			const pendingAction = sessionStorage.getItem('pending_template_action');
			if (pendingAction) {
				try {
					const actionData = JSON.parse(pendingAction);
					pendingTemplate = actionData;
					finalReturnUrl = `/template-modal/${actionData.slug}`;
				} catch (error) {}
			}

			// Check for return URL from query params
			const returnTo = $page.url.searchParams.get('returnTo');
			if (returnTo) {
				finalReturnUrl = decodeURIComponent(returnTo);
			}

			// Feature flag: compact direct outreach
			useCompact = $page.url.searchParams.get('compact') === '1';
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

				// Redirect to final destination with action=complete
				const separator = finalReturnUrl.includes('?') ? '&' : '?';
				window.location.href = `${finalReturnUrl}${separator}action=complete`;
			} else {
				// Still redirect with action=complete
				const separator = finalReturnUrl.includes('?') ? '&' : '?';
				window.location.href = `${finalReturnUrl}${separator}action=complete`;
			}
		} catch (error) {
			// Still redirect to avoid getting stuck with action=complete
			const separator = finalReturnUrl.includes('?') ? '&' : '?';
			window.location.href = `${finalReturnUrl}${separator}action=complete`;
		}
	}

	function handleProfileSkip() {
		// User chose to skip profile completion
		if (browser) {
			sessionStorage.removeItem('pending_template_action');
		}
		// Add action=complete to signal completion
		const separator = finalReturnUrl.includes('?') ? '&' : '?';
		window.location.href = `${finalReturnUrl}${separator}action=complete`;
	}
</script>

<svelte:head>
	<title>Complete Your Profile - Communiqué</title>
	<meta name="description" content="Complete your profile to strengthen your advocacy messages" />
</svelte:head>

<div
	class="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-white p-4"
>
	<div class="w-full max-w-md text-center">
		<h1 class="mb-4 text-2xl font-bold text-slate-900">Make your voice stronger</h1>
		<p class="mb-8 text-slate-600">
			Adding your role and connection to this issue increases your message's impact with
			decision-makers.
		</p>

		<!-- Loading state while modal appears -->
		{#if !showDirectModal}
			<div class="animate-pulse">
				<div class="mx-auto mb-2 h-4 w-3/4 rounded bg-slate-200"></div>
				<div class="mx-auto h-4 w-1/2 rounded bg-slate-200"></div>
			</div>
		{/if}
	</div>
</div>

{#if showDirectModal}
	{#if useCompact}
		<DirectOutreachCompact
			template={flowTemplate}
			on:complete={handleProfileComplete}
			on:close={handleProfileSkip}
		/>
	{:else}
		<DirectOutreachModal
			template={flowTemplate}
			on:complete={handleProfileComplete}
			on:close={handleProfileSkip}
		/>
	{/if}
{/if}
