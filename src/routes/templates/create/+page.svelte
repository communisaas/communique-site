<script lang="ts">
	import { goto } from '$app/navigation';
	import TemplateCreator from '$lib/components/template/TemplateCreator.svelte';
	import QuickShareFlow from '$lib/components/template/QuickShareFlow.svelte';
	import type { TemplateCreationContext } from '$lib/types/template';
	import { apiClient, ApiClientError } from '$lib/services/apiClient';
	import { toast } from '$lib/stores/toast';
	import type { PageData } from './$types';
	
	let { data }: { data: PageData } = $props();
	
	// State
	let showShareModal = $state(false);
	let createdTemplateId = $state<string | null>(null);
	let createdTemplateSlug = $state<string | null>(null);
	let createdTemplateTitle = $state<string | null>(null);
	let isSubmitting = $state(false);
	let validationErrors = $state<Record<string, string>>({});
	
	// Template creation context
	const context: TemplateCreationContext = {
		channelId: 'congressional',
		channelTitle: 'Congressional Delivery',
		isCongressional: true
	};
	
	// Handle template save from TemplateCreator
	async function handleTemplateSave(template: any) {
		// Clear previous validation errors
		validationErrors = {};
		
		try {
			// Create template via API with loading state
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
			}, {
				onLoadingChange: (loading) => isSubmitting = loading,
				showToast: false // Handle toasts manually for better control
			});
			
			if (response.template) {
				createdTemplateId = response.template.id;
				createdTemplateSlug = response.template.slug;
				createdTemplateTitle = response.template.title;
				
				// Show success toast
				toast.success('Template created successfully!', {
					title: 'Success'
				});
				
				showShareModal = true;
			}
		} catch (error) {
			console.error('Failed to create template:', error);
			
			if (error instanceof ApiClientError) {
				if (error.error.type === 'validation') {
					// Handle validation errors
					if (error.errors && error.errors.length > 0) {
						// Map field errors for form display
						const fieldErrors: Record<string, string> = {};
						error.errors.forEach(err => {
							if (err.field) {
								fieldErrors[err.field] = err.message;
							}
						});
						validationErrors = fieldErrors;
						
						// Show general validation error
						toast.error('Please fix the validation errors and try again.', {
							title: 'Validation Error'
						});
					} else {
						// Single validation error
						if (error.error.field) {
							validationErrors = { [error.error.field]: error.error.message };
						}
						toast.error(error.error.message, {
							title: 'Validation Error'
						});
					}
				} else {
					// Other API errors (network, server, etc.) are handled by apiClient
					// But we can add additional handling here if needed
				}
			} else {
				// Unexpected errors
				toast.error('An unexpected error occurred while creating your template. Please try again.', {
					title: 'Error'
				});
			}
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
			{isSubmitting}
			{validationErrors}
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