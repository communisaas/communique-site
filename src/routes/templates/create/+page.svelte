<script lang="ts">
	import { goto } from '$app/navigation';
	import TemplateCreator from '$lib/components/template/TemplateCreator.svelte';
	import QuickShareFlow from '$lib/components/template/QuickShareFlow.svelte';
	import type { TemplateCreationContext } from '$lib/types/template';
	import { apiClient } from '$lib/services/apiClient';
	import type { PageData } from './$types';
	
	let { data }: { data: PageData } = $props();
	
	// State
	let showShareModal = $state(false);
	let createdTemplateId = $state<string | null>(null);
	let createdTemplateSlug = $state<string | null>(null);
	let createdTemplateTitle = $state<string | null>(null);
	
	// Template creation context
	const context: TemplateCreationContext = {
		channelId: 'congressional',
		channelTitle: 'Congressional Delivery',
		isCongressional: true
	};
	
	// Handle template save from TemplateCreator
	async function handleTemplateSave(template: any) {
		try {
			// Create template via API
			const response = await apiClient.post('/api/templates', {
				title: template.title,
				subject: template.subject,
				message_body: template.message_body,
				category: template.category,
				type: template.type,
				delivery_method: template.deliveryMethod,
				preview: template.preview,
				description: template.description,
				status: 'draft',
				is_public: false,
				delivery_config: template.delivery_config,
				cwc_config: template.cwc_config,
				recipient_config: template.recipient_config,
				metrics: template.metrics
			});
			
			if (response.template) {
				createdTemplateId = response.template.id;
				createdTemplateSlug = response.template.slug;
				createdTemplateTitle = response.template.title;
				showShareModal = true;
			}
		} catch (error) {
			console.error('Failed to create template:', error);
			// In production, show error toast
		}
	}
	
	// Handle share modal close
	function handleShareClose() {
		showShareModal = false;
		// Navigate to template list
		goto('/dashboard/templates');
	}
</script>

<svelte:head>
	<title>Create Template - Communique</title>
	<meta name="description" content="Create powerful message templates to drive civic engagement" />
</svelte:head>

<div class="h-screen flex flex-col bg-gray-50">
	<!-- Header -->
	<header class="bg-white border-b border-gray-200 px-6 py-4">
		<div class="flex items-center justify-between max-w-7xl mx-auto">
			<div class="flex items-center gap-4">
				<a href="/dashboard/templates" class="text-gray-600 hover:text-gray-900">
					← Back
				</a>
				<h1 class="text-xl font-semibold text-gray-900">Create New Template</h1>
			</div>
			<div class="flex items-center gap-2 text-sm text-gray-600">
				<span>Enhanced with AI</span>
				<div class="w-2 h-2 bg-blue-500 rounded-full"></div>
			</div>
		</div>
	</header>
	
	<!-- Main Content -->
	<div class="flex-1 overflow-hidden">
		<TemplateCreator
			{context}
			onsave={handleTemplateSave}
			onclose={() => goto('/dashboard/templates')}
		/>
	</div>
	
	<!-- Share Modal -->
	{#if showShareModal && createdTemplateId && createdTemplateSlug}
		<QuickShareFlow
			templateId={createdTemplateId}
			title={createdTemplateTitle || ''}
			slug={createdTemplateSlug}
			onClose={handleShareClose}
		/>
	{/if}
	
</div>

<style>
	@keyframes spin {
		to { transform: rotate(360deg); }
	}
	
	.animate-spin {
		animation: spin 1s linear infinite;
	}
</style>