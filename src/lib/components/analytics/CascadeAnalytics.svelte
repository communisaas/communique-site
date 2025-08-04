<script lang="ts">
	import { onMount } from 'svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	
	interface CascadeMetrics {
		r0: number;
		generation_depth: number;
		activation_velocity: number;
		geographic_jump_rate: number;
		temporal_decay: number;
	}
	
	interface CascadeSummary {
		total_activations: number;
		viral_coefficient: number;
		geographic_spread: number;
		average_time_to_activation_hours: number;
		viral_status: string;
		geographic_reach: string;
	}
	
	interface ActivationEvent {
		user_id: string;
		activated_at: string;
		generation: number;
		time_to_activation: number;
		geographic_distance: number;
	}
	
	let { templateId }: { templateId: string } = $props();
	
	let metrics: CascadeMetrics | null = $state(null);
	let summary: CascadeSummary | null = $state(null);
	let timeline: ActivationEvent[] = $state([]);
	let recommendations: string[] = $state([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	
	onMount(async () => {
		await loadCascadeAnalysis();
	});
	
	async function loadCascadeAnalysis() {
		if (!templateId) return;
		
		loading = true;
		error = null;
		
		try {
			const response = await fetch(`/api/analytics/cascade/${templateId}`);
			const data = await response.json();
			
			if (data.success) {
				metrics = data.cascade_metrics;
				summary = data.summary;
				timeline = data.activation_timeline || [];
				recommendations = data.recommendations || [];
			} else {
				error = data.error || 'Failed to load cascade analysis';
			}
		} catch (err) {
			error = 'Network error loading cascade analysis';
			console.error('Cascade analysis error:', err);
		} finally {
			loading = false;
		}
	}
	
	function getViralStatusBadge(status: string): 'success' | 'warning' | 'error' | 'info' {
		switch (status) {
			case 'highly_viral': return 'success';
			case 'viral': return 'success';
			case 'spreading': return 'warning';
			case 'slow_growth': return 'warning';
			case 'stagnant': return 'error';
			default: return 'info';
		}
	}
	
	function getGeographicReachBadge(reach: string): 'success' | 'warning' | 'error' | 'info' {
		switch (reach) {
			case 'national': return 'success';
			case 'regional': return 'success';
			case 'statewide': return 'warning';
			case 'local': return 'error';
			default: return 'info';
		}
	}
	
	function formatDuration(hours: number): string {
		if (hours < 1) return `${Math.round(hours * 60)}m`;
		if (hours < 24) return `${hours.toFixed(1)}h`;
		return `${Math.round(hours / 24)}d`;
	}
</script>

<div class="bg-white rounded-xl shadow-lg p-6">
	<div class="flex items-center justify-between mb-6">
		<div>
			<h2 class="text-2xl font-bold text-gray-900">Cascade Analytics</h2>
			<p class="text-gray-600 mt-1">Epidemiological spread analysis with R0 calculations</p>
		</div>
		<button 
			onclick={loadCascadeAnalysis}
			disabled={loading}
			class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
		>
			{loading ? 'Loading...' : 'Refresh'}
		</button>
	</div>
	
	{#if loading}
		<div class="flex items-center justify-center py-12">
			<LoadingSpinner />
			<span class="ml-3 text-gray-600">Analyzing cascade patterns...</span>
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
	{:else if metrics && summary}
		<!-- Key Performance Indicators -->
		<div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
			<div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
				<div class="text-2xl font-bold text-blue-700">{metrics.r0.toFixed(2)}</div>
				<div class="text-sm text-blue-600 font-medium">R₀ (Reproduction Rate)</div>
				<div class="text-xs text-blue-500 mt-1">
					{metrics.r0 > 1 ? 'Exponential growth' : 'Declining spread'}
				</div>
			</div>
			
			<div class="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
				<div class="text-2xl font-bold text-green-700">{summary.viral_coefficient.toFixed(2)}</div>
				<div class="text-sm text-green-600 font-medium">Viral Coefficient</div>
				<div class="text-xs text-green-500 mt-1">
					{summary.viral_coefficient > 1 ? 'Self-sustaining' : 'Needs push'}
				</div>
			</div>
			
			<div class="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
				<div class="text-2xl font-bold text-purple-700">{metrics.activation_velocity.toFixed(1)}</div>
				<div class="text-sm text-purple-600 font-medium">Peak Velocity</div>
				<div class="text-xs text-purple-500 mt-1">users/hour</div>
			</div>
			
			<div class="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4">
				<div class="text-2xl font-bold text-orange-700">{metrics.generation_depth}</div>
				<div class="text-sm text-orange-600 font-medium">Generation Depth</div>
				<div class="text-xs text-orange-500 mt-1">degrees of separation</div>
			</div>
		</div>
		
		<!-- Status and Reach -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
			<div class="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-6">
				<h3 class="text-lg font-semibold text-gray-900 mb-4">Viral Status</h3>
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Current Status</span>
						<Badge variant={getViralStatusBadge(summary.viral_status)}>
							{summary.viral_status.replace('_', ' ').toUpperCase()}
						</Badge>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Geographic Reach</span>
						<Badge variant={getGeographicReachBadge(summary.geographic_reach)}>
							{summary.geographic_reach.toUpperCase()}
						</Badge>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Total Activations</span>
						<span class="font-semibold text-gray-900">{summary.total_activations}</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Avg. Time to Action</span>
						<span class="font-semibold text-gray-900">
							{formatDuration(summary.average_time_to_activation_hours)}
						</span>
					</div>
				</div>
			</div>
			
			<div class="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-6">
				<h3 class="text-lg font-semibold text-gray-900 mb-4">Network Metrics</h3>
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Geographic Jump Rate</span>
						<span class="font-semibold text-gray-900">
							{(metrics.geographic_jump_rate * 100).toFixed(1)}%
						</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Temporal Decay</span>
						<span class="font-semibold text-gray-900">
							{(metrics.temporal_decay * 100).toFixed(1)}%
						</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Districts Reached</span>
						<span class="font-semibold text-gray-900">{summary.geographic_spread}</span>
					</div>
				</div>
			</div>
		</div>
		
		<!-- Recommendations -->
		{#if recommendations.length > 0}
			<div class="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg p-6 mb-8">
				<h3 class="text-lg font-semibold text-gray-900 mb-4">Optimization Recommendations</h3>
				<div class="space-y-2">
					{#each recommendations as recommendation}
						<div class="flex items-start">
							<svg class="w-5 h-5 text-amber-500 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
							</svg>
							<span class="text-amber-800">{recommendation}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
		
		<!-- Activation Timeline -->
		{#if timeline.length > 0}
			<div class="bg-gray-50 rounded-lg p-6">
				<h3 class="text-lg font-semibold text-gray-900 mb-4">
					Activation Timeline 
					<span class="text-sm font-normal text-gray-500">({timeline.length} events)</span>
				</h3>
				<div class="max-h-64 overflow-y-auto">
					<div class="space-y-2">
						{#each timeline.slice(0, 20) as event}
							<div class="flex items-center justify-between bg-white rounded p-3 text-sm">
								<div class="flex items-center">
									<div class="w-2 h-2 bg-blue-400 rounded-full mr-3"></div>
									<span class="font-mono text-gray-600">Gen {event.generation}</span>
								</div>
								<div class="flex items-center space-x-4 text-gray-500">
									<span>{formatDuration(event.time_to_activation)}</span>
									<span>{new Date(event.activated_at).toLocaleDateString()}</span>
								</div>
							</div>
						{/each}
						{#if timeline.length > 20}
							<div class="text-center text-gray-500 text-sm py-2">
								... and {timeline.length - 20} more activations
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>