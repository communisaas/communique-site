<script lang="ts">
	import { onMount } from 'svelte';
	import LoadingCard from '$lib/components/ui/LoadingCard.svelte';
	import type { PercolationData, AnalyticsSession } from '$lib/types/analytics.ts';
	import type { AnalyticsProperties } from '$lib/types/any-replacements.js';
	// Note: using inline badges here to avoid dependency on specific Badge props

	let percolationData: PercolationData | null = $state(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let lastUpdated = $state<string>('');
	let _sessionData: AnalyticsSession | null = $state(null);

	// Analytics tracking function using new consolidated schema
	async function trackAnalyticsEvent(_eventName: string, properties: AnalyticsProperties) {
		try {
			await fetch('/api/analytics/events', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: _eventName,
					event_type: 'interaction',
					properties: {
						dashboard_type: 'percolation',
						timestamp: new Date().toISOString(),
						...properties
					}
				})
			});
		} catch (trackingError) {
			console.warn('Analytics tracking failed:', trackingError);
		}
	}

	onMount(async () => {
		await loadAnalysis();
	});

	async function loadAnalysis() {
		loading = true;
		error = null;

		try {
			const response = await fetch('/api/analytics/percolation');
			const data: PercolationData = await response.json();

			if (data.success) {
				percolationData = data;
				lastUpdated = new Date().toLocaleString();

				// Track percolation dashboard view event using new analytics schema
				await trackAnalyticsEvent('percolation_dashboard_view', {
					cascade_status: data.data.interpretation.cascade_status,
					confidence: data.data.interpretation.confidence,
					processing_time_ms: data.processing_time_ms
				});
			} else {
				error = 'Failed to load percolation analysis';
			}
		} catch (err) {
			error = 'Network error loading analysis';
			console.error('Percolation analysis error:', err);
		} finally {
			loading = false;
		}
	}

	async function refreshAnalysis() {
		loading = true;

		try {
			const response = await fetch('/api/analytics/percolation', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'refresh' })
			});

			const data: PercolationData = await response.json();

			if (data.success) {
				percolationData = data;
				lastUpdated = new Date().toLocaleString();

				// Track refresh event using new analytics schema
				await trackAnalyticsEvent('percolation_dashboard_refresh', {
					cascade_status: data.data.interpretation.cascade_status,
					confidence: data.data.interpretation.confidence,
					processing_time_ms: data.processing_time_ms,
					refresh_trigger: 'manual'
				});
			} else {
				error = 'Failed to refresh percolation analysis';
			}
		} catch {
			error = 'Network error refreshing analysis';
		} finally {
			loading = false;
		}
	}

	function getCascadeBadgeVariant(potential: string): 'success' | 'warning' | 'error' | 'info' {
		switch (potential) {
			case 'supercritical':
				return 'success';
			case 'critical':
				return 'warning';
			case 'subcritical':
				return 'error';
			default:
				return 'info';
		}
	}

	function getBadgeClass(variant: 'success' | 'warning' | 'error' | 'info'): string {
		switch (variant) {
			case 'success':
				return 'bg-green-100 text-green-700';
			case 'warning':
				return 'bg-yellow-100 text-yellow-700';
			case 'error':
				return 'bg-red-100 text-red-700';
			default:
				return 'bg-participation-primary-100 text-participation-primary-700';
		}
	}
</script>

<div class="rounded-xl bg-white p-6 shadow-lg">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h2 class="text-2xl font-bold text-gray-900">Network Percolation Analysis</h2>
			<p class="mt-1 text-gray-600">
				Information cascade modeling using Edmonds–Karp max flow/min‑cut and a percolation‑style
				connectivity heuristic
			</p>
		</div>
		<button
			onclick={refreshAnalysis}
			disabled={loading}
			class="rounded-lg bg-participation-primary-600 px-4 py-2 text-white transition-colors hover:bg-participation-primary-700 disabled:opacity-50"
		>
			{loading ? 'Analyzing...' : 'Refresh Analysis'}
		</button>
	</div>

	{#if loading && !percolationData}
		<div class="flex items-center justify-center py-12">
			<LoadingCard variant="spinner" />
			<span class="ml-3 text-gray-600">Running network percolation analysis...</span>
		</div>
	{:else if error}
		<div class="rounded-lg border border-red-200 bg-red-50 p-4">
			<div class="flex items-center">
				<svg class="mr-2 h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
					<path
						fill-rule="evenodd"
						d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
						clip-rule="evenodd"
					></path>
				</svg>
				<span class="font-medium text-red-800">Analysis Failed</span>
			</div>
			<p class="mt-1 text-red-700">{error}</p>
		</div>
	{:else if percolationData}
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			<!-- Network Status Overview -->
			<div class="rounded-lg bg-gradient-to-br from-participation-primary-50 to-indigo-50 p-6">
				<h3 class="mb-4 text-lg font-semibold text-gray-900">Network Status</h3>
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Cascade Status</span>
						<span
							class={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs md:text-sm ${getBadgeClass(getCascadeBadgeVariant(percolationData.data.interpretation.cascade_status))}`}
						>
							{percolationData.data.interpretation.cascade_status.toUpperCase()}
						</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Confidence Level</span>
						<span class="font-mono text-lg font-semibold text-participation-primary-700">
							{(percolationData.data.interpretation.confidence * 100).toFixed(1)}%
						</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Threshold Distance</span>
						<span
							class={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs md:text-sm ${getBadgeClass(percolationData.data.interpretation.threshold_distance > 0.1 ? 'warning' : 'success')}`}
						>
							{percolationData.data.interpretation.threshold_distance.toFixed(3)}
						</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Processing Time</span>
						<span class="font-mono text-sm text-gray-600">
							{percolationData.processing_time_ms}ms
						</span>
					</div>
				</div>
			</div>

			<!-- Key Metrics -->
			<div class="rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 p-6">
				<h3 class="mb-4 text-lg font-semibold text-gray-900">Key Metrics</h3>
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Percolation Threshold</span>
						<span class="font-mono text-lg font-semibold text-green-700">
							{(percolationData.data.percolation_threshold * 100).toFixed(1)}%
						</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Largest Component</span>
						<span class="font-mono text-lg font-semibold text-green-700">
							{percolationData.data.largest_component_size}
						</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Total Components</span>
						<span class="font-mono text-lg font-semibold text-green-700">
							{percolationData.data.total_components}
						</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Activation Probability</span>
						<span class="font-mono text-lg font-semibold text-green-700">
							{(percolationData.data.activation_probability * 100).toFixed(1)}%
						</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Analysis Insights -->
		<div class="mt-6 rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 p-6">
			<h3 class="mb-3 text-lg font-semibold text-gray-900">Analysis Insights</h3>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div class="flex items-start">
					<svg
						class="mr-3 mt-0.5 h-6 w-6 flex-shrink-0 text-purple-500"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M13 10V3L4 14h7v7l9-11h-7z"
						></path>
					</svg>
					<div>
						<h4 class="font-medium text-gray-900">Cascade Status</h4>
						<p class="mt-1 text-sm text-gray-600">
							Network is in {percolationData.data.interpretation.cascade_status} state with {(
								percolationData.data.interpretation.confidence * 100
							).toFixed(0)}% confidence
						</p>
					</div>
				</div>
				<div class="flex items-start">
					<svg
						class="mr-3 mt-0.5 h-6 w-6 flex-shrink-0 text-purple-500"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
						></path>
					</svg>
					<div>
						<h4 class="font-medium text-gray-900">Network Structure</h4>
						<p class="mt-1 text-sm text-gray-600">
							{percolationData.data.total_components} components with largest at {percolationData
								.data.largest_component_size} nodes
						</p>
					</div>
				</div>
			</div>
		</div>

		<!-- Network Visualization Placeholder -->
		<div class="mt-6 rounded-lg bg-gray-50 p-8 text-center">
			<svg
				class="mx-auto mb-4 h-16 w-16 text-gray-400"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
				></path>
			</svg>
			<h4 class="mb-2 text-lg font-medium text-gray-600">Network Visualization</h4>
			<p class="text-gray-500">Interactive network graph coming soon</p>
			<p class="mt-1 text-sm text-gray-400">
				Will show critical nodes, bottlenecks, and information flow paths
			</p>
		</div>

		{#if lastUpdated}
			<div class="mt-4 text-center text-sm text-gray-500">
				Last updated: {lastUpdated}
			</div>
		{/if}
	{/if}
</div>
