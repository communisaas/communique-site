<script lang="ts">
	import { onMount } from 'svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import LoadingCard from '$lib/components/ui/LoadingCard.svelte';
	
	interface TemplatePerformance {
		template_id: string;
		title: string;
		metrics: {
			total_activations: number;
			viral_coefficient: number;
			r0: number;
			activation_velocity: number;
			geographic_spread: number;
			viral_status: string;
			geographic_reach: string;
		};
		trends: {
			activations_trend: 'up' | 'down' | 'stable';
			velocity_trend: 'up' | 'down' | 'stable';
			trend_percentage: number;
		};
		last_updated: string;
	}
	
	let { templateId, title, compact = false }: { 
		templateId: string; 
		title?: string;
		compact?: boolean;
	} = $props();
	
	let performance: TemplatePerformance | null = $state(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	
	onMount(async () => {
		await loadPerformance();
	});
	
	async function loadPerformance() {
		loading = true;
		error = null;
		
		try {
			const response = await fetch(`/api/analytics/cascade/${templateId}`);
			const data = await response.json();
			
			if (data.success) {
				performance = {
					template_id: templateId,
					title: title || `Template ${templateId.slice(0, 8)}`,
					metrics: data.summary,
					trends: {
						// Mock trends - in real implementation, compare with historical data
						activations_trend: data.summary.total_activations > 10 ? 'up' : 'stable',
						velocity_trend: data.cascade_metrics.activation_velocity > 1 ? 'up' : 'down',
						trend_percentage: Math.random() * 30 + 5 // Mock percentage
					},
					last_updated: new Date().toISOString()
				};
			} else {
				error = data.error || 'Failed to load performance metrics';
			}
		} catch (err) {
			error = 'Network error loading performance data';
		} finally {
			loading = false;
		}
	}
	
	function getViralStatusColor(status: string): string {
		switch (status) {
			case 'highly_viral': return 'text-green-600 bg-green-50';
			case 'viral': return 'text-green-500 bg-green-50';
			case 'spreading': return 'text-yellow-600 bg-yellow-50';
			case 'slow_growth': return 'text-orange-500 bg-orange-50';
			case 'stagnant': return 'text-red-500 bg-red-50';
			default: return 'text-gray-500 bg-gray-50';
		}
	}
	
	function getTrendIcon(trend: string): string {
		switch (trend) {
			case 'up': return '↗️';
			case 'down': return '↘️';
			case 'stable': return '→';
			default: return '→';
		}
	}
	
	function getTrendColor(trend: string): string {
		switch (trend) {
			case 'up': return 'text-green-600';
			case 'down': return 'text-red-500';
			case 'stable': return 'text-gray-500';
			default: return 'text-gray-500';
		}
	}
</script>

<div class={`bg-white rounded-lg shadow-sm border border-gray-200 ${compact ? 'p-4' : 'p-6'}`}>
	{#if loading}
		<div class="flex items-center justify-center py-8">
			<LoadingCard variant="spinner" size="sm" />
			<span class="ml-2 text-gray-500 text-sm">Loading metrics...</span>
		</div>
	{:else if error}
		<div class="text-center py-6">
			<svg class="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
			</svg>
			<p class="text-sm text-gray-500">{error}</p>
		</div>
	{:else if performance}
		<!-- Header -->
		<div class="flex items-center justify-between mb-4">
			<div>
				<h3 class={`font-semibold text-gray-900 ${compact ? 'text-sm' : 'text-lg'}`}>
					{performance.title}
				</h3>
				{#if !compact}
					<p class="text-xs text-gray-500 mt-1">ID: {performance.template_id.slice(0, 12)}...</p>
				{/if}
			</div>
			<div class={`px-2 py-1 rounded-full text-xs font-medium ${getViralStatusColor(performance.metrics.viral_status)}`}>
				{performance.metrics.viral_status.replace('_', ' ').toUpperCase()}
			</div>
		</div>
		
		<!-- Key Metrics Grid -->
		<div class={`grid ${compact ? 'grid-cols-2 gap-3' : 'grid-cols-2 lg:grid-cols-4 gap-4'} mb-4`}>
			<div class="text-center">
				<div class={`font-bold text-participation-primary-700 ${compact ? 'text-lg' : 'text-2xl'}`}>
					{performance.metrics.total_activations}
				</div>
				<div class={`text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>Activations</div>
				<div class={`text-xs flex items-center justify-center mt-1 ${getTrendColor(performance.trends.activations_trend)}`}>
					<span class="mr-1">{getTrendIcon(performance.trends.activations_trend)}</span>
					{performance.trends.trend_percentage.toFixed(1)}%
				</div>
			</div>
			
			<div class="text-center">
				<div class={`font-bold text-green-700 ${compact ? 'text-lg' : 'text-2xl'}`}>
					{performance.metrics.viral_coefficient.toFixed(2)}
				</div>
				<div class={`text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>Viral Coeff</div>
				<div class={`text-xs ${performance.metrics.viral_coefficient > 1 ? 'text-green-600' : 'text-red-500'} mt-1`}>
					{performance.metrics.viral_coefficient > 1 ? 'Self-sustaining' : 'Needs push'}
				</div>
			</div>
			
			{#if !compact}
				<div class="text-center">
					<div class="text-2xl font-bold text-purple-700">
						{performance.metrics.r0.toFixed(1)}
					</div>
					<div class="text-sm text-gray-600">R₀ Rate</div>
					<div class={`text-xs mt-1 ${performance.metrics.r0 > 1 ? 'text-green-600' : 'text-orange-500'}`}>
						{performance.metrics.r0 > 1 ? 'Growing' : 'Declining'}
					</div>
				</div>
				
				<div class="text-center">
					<div class="text-2xl font-bold text-orange-700">
						{performance.metrics.activation_velocity.toFixed(1)}
					</div>
					<div class="text-sm text-gray-600">Velocity</div>
					<div class="text-xs text-gray-500 mt-1">users/hour</div>
				</div>
			{/if}
		</div>
		
		<!-- Geographic Reach -->
		{#if !compact}
			<div class="flex items-center justify-between text-sm mb-4">
				<span class="text-gray-600">Geographic Reach:</span>
				<div class="flex items-center">
					<Badge variant={performance.metrics.geographic_reach === 'national' ? 'success' : 'info'}>
						{performance.metrics.geographic_reach.toUpperCase()}
					</Badge>
					<span class="ml-2 text-gray-500">{performance.metrics.geographic_spread} districts</span>
				</div>
			</div>
		{/if}
		
		<!-- Quick Actions -->
		<div class={`flex ${compact ? 'space-x-2' : 'space-x-3'} pt-3 border-t border-gray-100`}>
			<button 
				onclick={() => window.location.href = `/analytics?template=${performance.template_id}`}
				class={`flex-1 text-center ${compact ? 'py-1 px-2 text-xs' : 'py-2 px-3 text-sm'} bg-participation-primary-50 text-participation-primary-700 rounded hover:bg-participation-primary-100 transition-colors`}
			>
				Full Analysis
			</button>
			<button 
				onclick={loadPerformance}
				class={`${compact ? 'py-1 px-2 text-xs' : 'py-2 px-3 text-sm'} text-gray-600 border border-gray-200 rounded hover:bg-gray-50 transition-colors`}
			>
				Refresh
			</button>
		</div>
		
		{#if !compact}
			<div class="mt-3 text-xs text-gray-400 text-center">
				Updated: {new Date(performance.last_updated).toLocaleString()}
			</div>
		{/if}
	{/if}
</div>