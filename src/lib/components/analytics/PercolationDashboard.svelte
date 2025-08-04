<script lang="ts">
	import { onMount } from 'svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	
	interface PercolationAnalysis {
		threshold_probability: number;
		critical_nodes: string[];
		bottleneck_edges: any[];
		max_flow_capacity: number;
		cascade_potential: 'subcritical' | 'critical' | 'supercritical';
	}
	
	interface NetworkHealth {
		cascade_status: string;
		network_health: string;
		critical_node_count: number;
		bottleneck_severity: string;
		recommendation: string;
	}
	
	let analysis: PercolationAnalysis | null = $state(null);
	let interpretation: NetworkHealth | null = $state(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let lastUpdated = $state<string>('');
	
	onMount(async () => {
		await loadAnalysis();
	});
	
	async function loadAnalysis() {
		loading = true;
		error = null;
		
		try {
			const response = await fetch('/api/analytics/percolation');
			const data = await response.json();
			
			if (data.success) {
				analysis = data.analysis;
				interpretation = data.interpretation;
				lastUpdated = new Date(data.timestamp).toLocaleString();
			} else {
				error = data.error || 'Failed to load analysis';
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
			
			const data = await response.json();
			
			if (data.success) {
				analysis = data.analysis;
				lastUpdated = new Date().toLocaleString();
			} else {
				error = data.error || 'Failed to refresh analysis';
			}
		} catch (err) {
			error = 'Network error refreshing analysis';
		} finally {
			loading = false;
		}
	}
	
	function getCascadeBadgeVariant(potential: string): 'success' | 'warning' | 'error' | 'info' {
		switch (potential) {
			case 'supercritical': return 'success';
			case 'critical': return 'warning';
			case 'subcritical': return 'error';
			default: return 'info';
		}
	}
	
	function getHealthBadgeVariant(health: string): 'success' | 'warning' | 'error' | 'info' {
		switch (health) {
			case 'strong': return 'success';
			case 'moderate': return 'warning';
			case 'weak': return 'error';
			default: return 'info';
		}
	}
</script>

<div class="bg-white rounded-xl shadow-lg p-6">
	<div class="flex items-center justify-between mb-6">
		<div>
			<h2 class="text-2xl font-bold text-gray-900">Network Percolation Analysis</h2>
			<p class="text-gray-600 mt-1">Information cascade modeling using Ford-Fulkerson max flow algorithm</p>
		</div>
		<button 
			onclick={refreshAnalysis}
			disabled={loading}
			class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
		>
			{loading ? 'Analyzing...' : 'Refresh Analysis'}
		</button>
	</div>
	
	{#if loading && !analysis}
		<div class="flex items-center justify-center py-12">
			<LoadingSpinner />
			<span class="ml-3 text-gray-600">Running network percolation analysis...</span>
		</div>
	{:else if error}
		<div class="bg-red-50 border border-red-200 rounded-lg p-4">
			<div class="flex items-center">
				<svg class="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
					<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
				</svg>
				<span class="text-red-800 font-medium">Analysis Failed</span>
			</div>
			<p class="text-red-700 mt-1">{error}</p>
		</div>
	{:else if analysis && interpretation}
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<!-- Network Status Overview -->
			<div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6">
				<h3 class="text-lg font-semibold text-gray-900 mb-4">Network Status</h3>
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Cascade Potential</span>
						<Badge variant={getCascadeBadgeVariant(analysis.cascade_potential)}>
							{analysis.cascade_potential.toUpperCase()}
						</Badge>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Network Health</span>
						<Badge variant={getHealthBadgeVariant(interpretation.network_health)}>
							{interpretation.network_health.toUpperCase()}
						</Badge>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Bottleneck Severity</span>
						<Badge variant={interpretation.bottleneck_severity === 'high' ? 'error' : 'warning'}>
							{interpretation.bottleneck_severity.toUpperCase()}
						</Badge>
					</div>
				</div>
			</div>
			
			<!-- Key Metrics -->
			<div class="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-6">
				<h3 class="text-lg font-semibold text-gray-900 mb-4">Key Metrics</h3>
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Percolation Threshold</span>
						<span class="font-mono text-lg font-semibold text-green-700">
							{(analysis.threshold_probability * 100).toFixed(1)}%
						</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Max Flow Capacity</span>
						<span class="font-mono text-lg font-semibold text-green-700">
							{analysis.max_flow_capacity.toFixed(2)}
						</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Critical Nodes</span>
						<span class="font-mono text-lg font-semibold text-green-700">
							{analysis.critical_nodes.length}
						</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Network Bottlenecks</span>
						<span class="font-mono text-lg font-semibold text-green-700">
							{analysis.bottleneck_edges.length}
						</span>
					</div>
				</div>
			</div>
		</div>
		
		<!-- Recommendation Panel -->
		<div class="mt-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6">
			<h3 class="text-lg font-semibold text-gray-900 mb-3">Strategic Recommendation</h3>
			<div class="flex items-start">
				<svg class="w-6 h-6 text-purple-500 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
				</svg>
				<p class="text-gray-700 leading-relaxed">{interpretation.recommendation}</p>
			</div>
		</div>
		
		<!-- Network Visualization Placeholder -->
		<div class="mt-6 bg-gray-50 rounded-lg p-8 text-center">
			<svg class="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
			</svg>
			<h4 class="text-lg font-medium text-gray-600 mb-2">Network Visualization</h4>
			<p class="text-gray-500">Interactive network graph coming soon</p>
			<p class="text-sm text-gray-400 mt-1">Will show critical nodes, bottlenecks, and information flow paths</p>
		</div>
		
		{#if lastUpdated}
			<div class="mt-4 text-center text-sm text-gray-500">
				Last updated: {lastUpdated}
			</div>
		{/if}
	{/if}
</div>