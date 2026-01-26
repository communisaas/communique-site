<script lang="ts">
	import { page } from '$app/stores';
	import { onMount as _onMount } from 'svelte';
	import { browser } from '$app/environment';
	import DirectOutreachCompact from '$lib/components/auth/DirectOutreachCompact.svelte';
	import type { PageData } from './$types';
	import { z } from 'zod';

	let { _data }: { data: PageData } = $props();

	let showDirectModal = $state(true);
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

	_onMount(() => {
		if (browser) {
			// Check if there's a pending template action
			const pendingAction = sessionStorage.getItem('pending_template_action');
			if (pendingAction) {
				try {
					// Validate pending action data
					const PendingActionSchema = z.object({
						slug: z.string(),
						title: z.string(),
						deliveryMethod: z.string().optional(),
						category: z.string().optional()
					});

					const parsed = JSON.parse(pendingAction);
					const result = PendingActionSchema.safeParse(parsed);

					if (result.success) {
						pendingTemplate = result.data;
						finalReturnUrl = `/template-modal/${result.data.slug}`;
					} else {
						console.warn('[Profile Page] Invalid pending action data:', result.error.flatten());
						sessionStorage.removeItem('pending_template_action');
					}
				} catch (error) {
					console.warn('[Profile Page] Failed to parse pending action data:', error);
					sessionStorage.removeItem('pending_template_action');
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

	async function handleProfileComplete(__event: CustomEvent) {
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

				// Set OAuth completion info in cookie for client-side detection
				document.cookie = `oauth_completion=${JSON.stringify({
					provider: 'unknown',
					completed: true,
					timestamp: Date.now()
				})}; path=/; max-age=300; SameSite=lax`; // 5 minutes

				// Clean redirect without query parameters
				window.location.href = finalReturnUrl;
			} else {
				// Set OAuth completion info even on error for clean redirect
				document.cookie = `oauth_completion=${JSON.stringify({
					provider: 'unknown',
					completed: true,
					timestamp: Date.now()
				})}; path=/; max-age=300; SameSite=lax`; // 5 minutes

				// Clean redirect without query parameters
				window.location.href = finalReturnUrl;
			}
		} catch {
			// Set OAuth completion info even on error for clean redirect
			document.cookie = `oauth_completion=${JSON.stringify({
				provider: 'unknown',
				completed: true,
				timestamp: Date.now()
			})}; path=/; max-age=300; SameSite=lax`; // 5 minutes

			// Clean redirect without query parameters
			window.location.href = finalReturnUrl;
		}
	}

	function handleProfileSkip() {
		// User chose to skip profile completion
		if (browser) {
			sessionStorage.removeItem('pending_template_action');
		}

		// Set OAuth completion info in cookie for client-side detection
		document.cookie = `oauth_completion=${JSON.stringify({
			provider: 'unknown',
			completed: true,
			timestamp: Date.now()
		})}; path=/; max-age=300; SameSite=lax`; // 5 minutes

		// Clean redirect without query parameters
		window.location.href = finalReturnUrl;
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
	<DirectOutreachCompact
		template={flowTemplate}
		on:complete={handleProfileComplete}
		on:close={handleProfileSkip}
	/>
{/if}
