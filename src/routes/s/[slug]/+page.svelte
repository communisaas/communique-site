<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { funnelAnalytics } from '$lib/core/analytics/funnel';
	import { analyzeEmailFlow, launchEmail } from '$lib/services/emailService';
	import { modalActions } from '$lib/stores/modalSystem.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	
	const template = data.template;
	const user = data.user;

	onMount(async () => {
		// Track share link analytics
		funnelAnalytics.trackTemplateView(template.id, 'share');

		// Analyze what flow is needed for this template and user
		const flow = analyzeEmailFlow(template, user);

		// Execute the appropriate flow
		switch (flow.nextAction) {
			case 'auth':
				// User needs to authenticate first
				modalActions.openModal('onboarding-modal', 'onboarding', { 
					template, 
					source: 'share',
					autoSend: true 
				});
				break;
				
			case 'address':
				// User needs to provide address for congressional delivery
				modalActions.open('address-modal', 'address', { 
					template, 
					source: 'share',
					user,
					autoSend: true 
				});
				break;
				
			case 'email':
				// Ready to send - launch email immediately
				if (flow.mailtoUrl) {
					launchEmail(flow.mailtoUrl);
				}
				break;
		}

		// Navigate to the template page for the full experience
		// Use replace to avoid back button issues
		await goto(`/${template.slug}`, { replaceState: true });
	});
</script>

<!-- Loading state while processing -->
<div class="flex min-h-screen items-center justify-center">
	<div class="text-center">
		<div class="mb-4 inline-flex h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600"></div>
		<h2 class="text-lg font-medium text-slate-900">Opening {template.title}...</h2>
		<p class="mt-2 text-sm text-slate-600">Preparing your message</p>
	</div>
</div>