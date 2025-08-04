<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import PercolationDashboard from '$lib/components/analytics/PercolationDashboard.svelte';
	import CascadeAnalytics from '$lib/components/analytics/CascadeAnalytics.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	
	let selectedTemplateId = $state<string | null>(null);
	let templates = $state<any[]>([]);
	let loading = $state(true);
	let activeTab = $state<'network' | 'template'>('network');
	
	onMount(async () => {
		// Get template ID from URL params if provided
		const urlTemplateId = $page.url.searchParams.get('template');
		if (urlTemplateId) {
			selectedTemplateId = urlTemplateId;
			activeTab = 'template';
		}
		
		await loadTemplates();
		loading = false;
	});
	
	async function loadTemplates() {
		try {
			const response = await fetch('/api/templates');
			const data = await response.json();
			
			if (data.success) {
				templates = data.templates || [];
			}
		} catch (error) {
			console.error('Failed to load templates:', error);
		}
	}
	
	function selectTemplate(templateId: string) {
		selectedTemplateId = templateId;
		activeTab = 'template';
		
		// Update URL without navigation
		const url = new URL(window.location.href);
		url.searchParams.set('template', templateId);
		window.history.replaceState({}, '', url.toString());
	}
	
	function clearTemplateSelection() {
		selectedTemplateId = null;
		activeTab = 'network';
		
		// Remove template param from URL
		const url = new URL(window.location.href);
		url.searchParams.delete('template');
		window.history.replaceState({}, '', url.toString());
	}
</script>

<svelte:head>
	<title>Analytics Dashboard - Communiqué</title>
	<meta name="description" content="Advanced analytics dashboard with percolation analysis and cascade modeling for civic engagement campaigns." />
</svelte:head>

<div class="min-h-screen bg-gray-50">
	<!-- Header -->
	<div class="bg-white shadow-sm border-b border-gray-200">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="py-6">
				<div class="flex items-center justify-between">
					<div>
						<h1 class="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
						<p class="mt-2 text-gray-600">
							Advanced network analysis and campaign intelligence powered by mathematical modeling
						</p>
					</div>
					<div class="flex items-center space-x-4">
						<div class="flex bg-gray-100 rounded-lg p-1">
							<button
								onclick={() => { activeTab = 'network'; clearTemplateSelection(); }}
								class={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
									activeTab === 'network' 
									? 'bg-white text-blue-700 shadow-sm' 
									: 'text-gray-500 hover:text-gray-700'
								}`}
							>
								Network Analysis
							</button>
							<button
								onclick={() => activeTab = 'template'}
								class={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
									activeTab === 'template' 
									? 'bg-white text-blue-700 shadow-sm' 
									: 'text-gray-500 hover:text-gray-700'
								}`}
							>
								Template Analytics
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
	
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		{#if loading}
			<div class="flex items-center justify-center py-12">
				<LoadingSpinner />
				<span class="ml-3 text-gray-600">Loading analytics dashboard...</span>
			</div>
		{:else}
			<!-- Network Analysis Tab -->
			{#if activeTab === 'network'}
				<div class="space-y-8">
					<!-- Network Percolation Analysis -->
					<PercolationDashboard />
					
					<!-- Additional Network Insights -->
					<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
						<div class="bg-white rounded-xl shadow-lg p-6">
							<h3 class="text-lg font-semibold text-gray-900 mb-4">Network Intelligence</h3>
							<div class="space-y-3">
								<div class="flex items-center justify-between">
									<span class="text-gray-600">Algorithm</span>
									<span class="font-semibold text-blue-600">Ford-Fulkerson</span>
								</div>
								<div class="flex items-center justify-between">
									<span class="text-gray-600">Analysis Type</span>
									<span class="font-semibold text-blue-600">Bond Percolation</span>
								</div>
								<div class="flex items-center justify-between">
									<span class="text-gray-600">Complexity</span>
									<span class="font-semibold text-blue-600">O(E²V)</span>
								</div>
							</div>
						</div>
						
						<div class="bg-white rounded-xl shadow-lg p-6">
							<h3 class="text-lg font-semibold text-gray-900 mb-4">Real-Time Metrics</h3>
							<div class="space-y-3">
								<div class="text-sm text-gray-600">
									Network analysis runs continuously on live user activation data
								</div>
								<div class="flex items-center">
									<div class="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
									<span class="text-sm text-green-600">Live data stream active</span>
								</div>
							</div>
						</div>
						
						<div class="bg-white rounded-xl shadow-lg p-6">
							<h3 class="text-lg font-semibold text-gray-900 mb-4">Methodology</h3>
							<div class="text-sm text-gray-600 space-y-2">
								<p>Uses epidemiological cascade modeling with geographic weighting and temporal decay functions.</p>
								<p class="text-xs text-gray-500">Based on research in network theory and information propagation.</p>
							</div>
						</div>
					</div>
				</div>
			{/if}
			
			<!-- Template Analytics Tab -->
			{#if activeTab === 'template'}
				<div class="space-y-8">
					<!-- Template Selection -->
					{#if !selectedTemplateId}
						<div class="bg-white rounded-xl shadow-lg p-6">
							<h2 class="text-xl font-semibold text-gray-900 mb-4">Select Template for Analysis</h2>
							<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
								{#each templates as template}
									<button
										onclick={() => selectTemplate(template.id)}
										class="text-left p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
									>
										<h3 class="font-medium text-gray-900 mb-1">{template.title}</h3>
										<p class="text-sm text-gray-600 line-clamp-2">{template.description || 'No description'}</p>
										<div class="mt-2 flex items-center text-xs text-gray-500">
											<span class="mr-3">ID: {template.id.slice(0, 8)}...</span>
											{#if template.metrics?.sent}
												<span>{template.metrics.sent} sent</span>
											{/if}
										</div>
									</button>
								{/each}
								
								{#if templates.length === 0}
									<div class="col-span-full text-center py-8 text-gray-500">
										<svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
										</svg>
										<p>No templates found</p>
										<p class="text-sm mt-1">Create a template to see cascade analytics</p>
									</div>
								{/if}
							</div>
						</div>
					{:else}
						<!-- Selected Template Analytics -->
						<div class="flex items-center justify-between mb-6">
							<div>
								<h2 class="text-2xl font-semibold text-gray-900">Template Cascade Analysis</h2>
								<p class="text-gray-600">Analyzing template: {selectedTemplateId.slice(0, 8)}...</p>
							</div>
							<button
								onclick={clearTemplateSelection}
								class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
							>
								← Back to Templates
							</button>
						</div>
						
						<CascadeAnalytics {selectedTemplateId} />
					{/if}
				</div>
			{/if}
		{/if}
	</div>
</div>