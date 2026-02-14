<script lang="ts">
	import { templateStore } from '$lib/stores/templates.svelte';
	import { onMount as _onMount } from 'svelte';
	import { page } from '$app/stores';
	// Note: `browser` import removed - was causing CLS by gating route detection
	import '../app.css';
	import Footer from '$lib/components/layout/Footer.svelte';
	import HeaderSystem from '$lib/components/layout/HeaderSystem.svelte';
	import ErrorBoundary from '$lib/components/error/ErrorBoundary.svelte';
	import ToastContainer from '$lib/components/ui/ToastContainer.svelte';
	import ModalRegistry from '$lib/components/modals/ModalRegistry.svelte';
	import { modalActions } from '$lib/stores/modalSystem.svelte';
	import { analyzeEmailFlow, launchEmail } from '$lib/services/emailService';
	import { toEmailServiceUser } from '$lib/types/user';
	import { syncOAuthLocation } from '$lib/core/location/oauth-location-sync';
	import type { Template as _Template } from '$lib/types/template';
	import type { LayoutData } from './$types';
	import type { Snippet } from 'svelte';

	/*
	 * CLS FIX: Remove `browser &&` guard from route detection.
	 *
	 * PROBLEM: `browser` is false during SSR, so ALL derived values were false.
	 * SSR always rendered the {:else} branch with pt-[48px] padding.
	 * On hydration, `browser` becomes true, correct branch renders, 48px disappears = CLS.
	 *
	 * SOLUTION: `$page` IS available during SSR via SvelteKit's load functions.
	 * Use it directly - no browser guard needed for route detection.
	 */
	const isProfilePage = $derived($page.url?.pathname?.startsWith('/profile') ?? false);
	const isHomepage = $derived($page.url?.pathname === '/');
	const isTemplatePage = $derived($page.route?.id === '/s/[slug]');

	let {
		children,
		data
	}: {
		children: Snippet;
		data: LayoutData;
	} = $props();

	// Initialize app: fetch templates + sync OAuth location + pre-warm ZK prover
	_onMount(async () => {
		templateStore.fetchTemplates();

		// Sync OAuth location if cookie exists (from OAuth callback)
		syncOAuthLocation().catch((error) => {
			console.warn('[App] Failed to sync OAuth location:', error);
		});

		// Pre-warm the ZK Prover (starts 12-14s keygen in background worker)
		// This ensures "The Hum" is fast when the user actually needs it.
		try {
			const { proverOrchestrator } = await import('$lib/core/proof/prover-orchestrator');
			console.log('[App] Pre-warming ZK Prover...');
			proverOrchestrator.init().catch((err) => {
				console.warn('[App] ZK Prover pre-warming failed (non-fatal):', err);
			});
		} catch (err) {
			console.warn('[App] Failed to load ZK Prover for pre-warming:', err);
		}
	});

	// Handle template use from header/bottom bar
	function handleTemplateUse(__event: { template: _Template; requiresAuth: boolean }): void {
		const { template } = __event;

		const flow = analyzeEmailFlow(template as any, toEmailServiceUser(data.user as Record<string, unknown> | null));

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

<!-- HeaderSystem handles context-aware header rendering -->
<HeaderSystem user={data.user as any} template={data.template as any} onTemplateUse={handleTemplateUse as any} />

{#if data.user?.id === 'user-demo-1'}
	<div class="pointer-events-none fixed top-0 left-0 right-0 z-[9999] bg-amber-500/10 text-amber-200 text-center text-xs py-1 font-mono tracking-wide">
		DEMO MODE — communique.app
	</div>
{/if}

{#if isProfilePage}
	<!-- Profile pages: No header padding, full control -->
	<div class="relative min-h-screen">
		<ErrorBoundary fallback="detailed" showRetry={true}>
			{@render children()}
		</ErrorBoundary>
		<Footer />
	</div>
{:else if isHomepage}
	<!-- Homepage: No wrapper padding - page manages its own spacing for sticky behavior -->
	<div class="relative min-h-screen">
		<ErrorBoundary fallback="detailed" showRetry={true}>
			{@render children()}
		</ErrorBoundary>
	</div>
{:else}
	<!-- Other pages: Header padding for fixed IdentityStrip -->
	<div class="relative min-h-screen pt-[48px]">
		<div class="p-6 md:p-10" class:pb-24={isTemplatePage} class:sm:pb-10={isTemplatePage}>
			<ErrorBoundary fallback="detailed" showRetry={true}>
				{@render children()}
			</ErrorBoundary>
		</div>
		<Footer />
	</div>
{/if}

<!-- Global UI components (always present) -->
<ToastContainer />
<ModalRegistry />
