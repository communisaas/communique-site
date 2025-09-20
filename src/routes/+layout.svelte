<script lang="ts">
	import { templateStore } from '$lib/stores/templates.svelte';
	import { onMount } from 'svelte';
	import { User, LogOut } from '@lucide/svelte';
	import { page } from '$app/stores';
	import '../app.css';
	import Footer from '$lib/components/layout/Footer.svelte';
	import AppHeader from '$lib/components/layout/AppHeader.svelte';
	import ErrorBoundary from '$lib/components/error/ErrorBoundary.svelte';
	import ToastContainer from '$lib/components/ui/ToastContainer.svelte';
	import { modalActions } from '$lib/stores/modalSystem.svelte';
	import { analyzeEmailFlow, launchEmail } from '$lib/services/emailService';
	import { toEmailServiceUser } from '$lib/types/user';
	import type { Template } from '$lib/types/template';

	let { children, data } = $props();

	// Fetch templates from API
	onMount(() => {
		templateStore.fetchTemplates();
	});

	// Handle template use from header
	function handleTemplateUse(event: { template: Template; requiresAuth: boolean }) {
		const { template, requiresAuth } = event;

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

{#if $page.url.pathname.startsWith('/profile')}
	<!-- Profile pages: No AppHeader, no padding, full control -->
	<div class="min-h-screen bg-slate-50">
		<ErrorBoundary fallback="detailed" showRetry={true}>
			{@render children()}
		</ErrorBoundary>
		<Footer />
	</div>
{:else}
	<!-- Regular pages: AppHeader + padding -->
	<div class="min-h-screen bg-gradient-to-b from-slate-50 to-white">
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
