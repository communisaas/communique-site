<script lang="ts">
	import { templateStore } from '$lib/stores/templates.svelte';
	import { onMount as _onMount } from 'svelte';
	import { User as _User, LogOut as _LogOut } from '@lucide/svelte';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import '../app.css';
	import Footer from '$lib/components/layout/Footer.svelte';
	import AppHeader from '$lib/components/layout/AppHeader.svelte';
	import ErrorBoundary from '$lib/components/error/ErrorBoundary.svelte';
	import ToastContainer from '$lib/components/ui/ToastContainer.svelte';
	import AtmosphericBackground from '$lib/components/ui/AtmosphericBackground.svelte';
	import { modalActions } from '$lib/stores/modalSystem.svelte';
	import { analyzeEmailFlow, launchEmail } from '$lib/services/emailService';
	import { toEmailServiceUser } from '$lib/types/user';
	import { syncOAuthLocation } from '$lib/core/location/oauth-location-sync';
	import type { Template as _Template } from '$lib/types/template';
	import type { LayoutData } from './$types';
	import type { Snippet } from 'svelte';

	// Derived state for checking if we're on profile page (browser-safe)
	const isProfilePage = $derived(browser && $page.url?.pathname?.startsWith('/profile'));

	let {
		children,
		data
	}: {
		children: Snippet;
		data: LayoutData;
	} = $props();

	// Initialize app: fetch templates + sync OAuth location
	_onMount(() => {
		templateStore.fetchTemplates();

		// Sync OAuth location if cookie exists (from OAuth callback)
		syncOAuthLocation().catch((error) => {
			console.warn('[App] Failed to sync OAuth location:', error);
		});
	});

	// Handle template use from header
	function handleTemplateUse(__event: { template: _Template; requiresAuth: boolean }) {
		const { template, requiresAuth: _requiresAuth } = __event;

		const flow = analyzeEmailFlow(template, toEmailServiceUser(data.user));

		if (flow.nextAction === 'auth') {
			// Navigate to auth or show modal
			window.location.href = `/auth/google?returnTo=${encodeURIComponent($page.url.pathname)}`;
		} else if (flow.nextAction === 'address') {
			// Handle address requirement
			// For now, redirect to auth flow which will handle address collection
			window.location.href = `/auth/google?returnTo=${encodeURIComponent($page.url.pathname)}`;
		} else if (flow.nextAction === 'email' && flow.mailtoUrl) {
			if (data.user) {
				// Show template modal for authenticated users
				modalActions.openModal('template-modal', 'template_modal', { template, user: data.user });
			} else {
				// Direct mailto launch for guests
				launchEmail(flow.mailtoUrl);
			}
		}
	}
</script>

<!-- Atmospheric background layer (Phase 3: Cypherpunk Newsroom) -->
<AtmosphericBackground variant="subtle" />

{#if isProfilePage}
	<!-- Profile pages: No AppHeader, no padding, full control -->
	<div class="relative min-h-screen">
		<ErrorBoundary fallback="detailed" showRetry={true}>
			{@render children()}
		</ErrorBoundary>
		<Footer />
	</div>
{:else}
	<!-- Regular pages: AppHeader + padding -->
	<div class="relative min-h-screen">
		<AppHeader user={data.user} template={data.template} onTemplateUse={handleTemplateUse} />
		<div class="p-6 md:p-10">
			<ErrorBoundary fallback="detailed" showRetry={true}>
				{@render children()}
			</ErrorBoundary>
		</div>
		<Footer />
	</div>
{/if}

<!-- Global UI components (always present) -->
<ToastContainer />
