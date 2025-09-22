<script lang="ts">
	import { onMount as _onMount } from 'svelte';
	import { page } from '$app/stores';
	import PercolationDashboard from '$lib/components/analytics/PercolationDashboard.svelte';
	import CascadeAnalytics from '$lib/components/analytics/CascadeAnalytics.svelte';
	import LoadingCard from '$lib/components/ui/LoadingCard.svelte';
	import type { Template as _Template } from '$lib/types/template';

	let selectedTemplateId = $state<string | null>(null);
	let templates = $state<Template[]>([]);
	let loading = $state(true);
	let activeTab = $state<'network' | 'template'>('network');

	_onMount(async () => {
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
		} catch {
			// Failed to load templates - templates will remain empty array
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
	<meta
		name="description"
		content="Advanced analytics dashboard with percolation analysis and cascade modeling for civic engagement campaigns."
	/>
</svelte:head>

<div class="min-h-screen bg-gray-50">
	<!-- Header -->
	<div class="border-b border-gray-200 bg-white shadow-sm">
		<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
			<div class="py-6">
				<div class="flex items-center justify-between">
					<div>
						<h1 class="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
						<p class="mt-2 text-gray-600">
							Advanced network analysis and campaign intelligence powered by mathematical modeling
						</p>
					</div>
					<div class="flex items-center space-x-4">
						<div class="flex rounded-lg bg-gray-100 p-1">
							<button
								onclick={() => {
									activeTab = 'network';
									clearTemplateSelection();
								}}
								class={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
									activeTab === 'network'
										? 'bg-white text-participation-primary-700 shadow-sm'
										: 'text-gray-500 hover:text-gray-700'
								}`}
							>
								Network Analysis
							</button>
							<button
								onclick={() => (activeTab = 'template')}
								class={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
									activeTab === 'template'
										? 'bg-white text-participation-primary-700 shadow-sm'
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

	<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
		{#if loading}
			<div class="flex items-center justify-center py-12">
				<LoadingCard variant="spinner" />
				<span class="ml-3 text-gray-600">Loading analytics dashboard...</span>
			</div>
		{:else}
			<!-- Network Analysis Tab -->
			{#if activeTab === 'network'}
				<div class="space-y-8">
					<!-- Network Percolation Analysis -->
					<PercolationDashboard />

					<!-- Additional Network Insights -->
					<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
						<div class="rounded-xl bg-white p-6 shadow-lg">
							<h3 class="mb-4 text-lg font-semibold text-gray-900">Network Intelligence</h3>
							<div class="space-y-3">
								<div class="flex items-center justify-between">
									<span class="text-gray-600">Algorithm</span>
									<span class="font-semibold text-participation-primary-600"
										>Edmonds–Karp (Ford–Fulkerson BFS)</span
									>
								</div>
								<div class="flex items-center justify-between">
									<span class="text-gray-600">Analysis Type</span>
									<span class="font-semibold text-participation-primary-600"
										>Percolation-style connectivity (heuristic)</span
									>
								</div>
								<div class="flex items-center justify-between">
									<span class="text-gray-600">Complexity</span>
									<span class="font-semibold text-participation-primary-600">O(E²V)</span>
								</div>
							</div>
						</div>

						<div class="rounded-xl bg-white p-6 shadow-lg">
							<h3 class="mb-4 text-lg font-semibold text-gray-900">Real-Time Metrics</h3>
							<div class="space-y-3">
								<div class="text-sm text-gray-600">
									Network analysis runs continuously on live user activation data
								</div>
								<div class="flex items-center">
									<div class="mr-2 h-2 w-2 animate-pulse rounded-full bg-green-400"></div>
									<span class="text-sm text-green-600">Live data stream active</span>
								</div>
							</div>
						</div>

						<div class="rounded-xl bg-white p-6 shadow-lg">
							<h3 class="mb-4 text-lg font-semibold text-gray-900">Methodology</h3>
							<div class="space-y-2 text-sm text-gray-600">
								<p>
									Uses epidemiological cascade modeling with geographic weighting and temporal decay
									functions.
								</p>
								<p class="text-xs text-gray-500">
									Based on research in network theory and information propagation.
								</p>
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
						<div class="rounded-xl bg-white p-6 shadow-lg">
							<h2 class="mb-4 text-xl font-semibold text-gray-900">Select Template for Analysis</h2>
							<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
								{#each templates as template}
									<button
										onclick={() => selectTemplate(template.id)}
										class="rounded-lg border border-gray-200 bg-gray-50 p-4 text-left transition-colors hover:border-participation-primary-300 hover:bg-gray-100"
									>
										<h3 class="mb-1 font-medium text-gray-900">{template.title}</h3>
										<p class="line-clamp-2 text-sm text-gray-600">
											{template.description || 'No description'}
										</p>
										<div class="mt-2 flex items-center text-xs text-gray-500">
											<span class="mr-3">ID: {template.id.slice(0, 8)}...</span>
											{#if template.metrics?.sent}
												<span>{template.metrics.sent} sent</span>
											{/if}
										</div>
									</button>
								{/each}

								{#if templates.length === 0}
									<div class="col-span-full py-8 text-center text-gray-500">
										<svg
											class="mx-auto mb-4 h-12 w-12 text-gray-300"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
											></path>
										</svg>
										<p>No templates found</p>
										<p class="mt-1 text-sm">Create a template to see cascade analytics</p>
									</div>
								{/if}
							</div>
						</div>
					{:else}
						<!-- Selected Template Analytics -->
						<div class="mb-6 flex items-center justify-between">
							<div>
								<h2 class="text-2xl font-semibold text-gray-900">Template Cascade Analysis</h2>
								<p class="text-gray-600">Analyzing template: {selectedTemplateId.slice(0, 8)}...</p>
							</div>
							<button
								onclick={clearTemplateSelection}
								class="rounded-lg bg-gray-600 px-4 py-2 text-white transition-colors hover:bg-gray-700"
							>
								← Back to Templates
							</button>
						</div>

						<CascadeAnalytics templateId={selectedTemplateId} />
					{/if}
				</div>
			{/if}
		{/if}
	</div>
</div>
