<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import TemplateModal from '$lib/components/template/TemplateModal.svelte';
	import type { PageData } from './$types';
	
	export let data: PageData;
	
	let showModal = true;
	
	onMount(() => {
		// Check for pending template action from OAuth flow
		const pendingAction = sessionStorage.getItem('pending_template_action');
		if (pendingAction) {
			sessionStorage.removeItem('pending_template_action');
			// User just completed OAuth, show success state briefly
			console.log('User completed OAuth flow for template action');
		}
	});
	
	function handleModalClose() {
		showModal = false;
		// Navigate to template page instead of closing modal
		goto(`/${data.template.slug}`);
	}
	
	function handleTemplateUsed(event: CustomEvent) {
		// Track successful conversion
		console.log('Template used successfully:', event.detail);
		
		// Optionally redirect to dashboard or success page
		setTimeout(() => {
			goto('/dashboard?success=template_sent');
		}, 2000);
	}
</script>

<svelte:head>
	<title>{data.template.title} - Take Action - Communiqué</title>
	<meta name="description" content={data.template.description} />
	
	<!-- Prevent indexing of modal pages -->
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if showModal}
	<TemplateModal 
		template={data.template}
		user={data.user}
		on:close={handleModalClose}
		on:used={handleTemplateUsed}
	/>
{/if}

<!-- Fallback content (shouldn't be visible) -->
<div class="min-h-screen bg-slate-100 flex items-center justify-center">
	<div class="text-center">
		<h1 class="text-2xl font-bold text-slate-900 mb-4">{data.template.title}</h1>
		<p class="text-slate-600 mb-6">Loading your campaign action...</p>
		<a 
			href="/{data.template.slug}" 
			class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
		>
			View full campaign
		</a>
	</div>
</div>