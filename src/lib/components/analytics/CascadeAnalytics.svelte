<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import LoadingCard from '$lib/components/ui/LoadingCard.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import type { AnalyticsProperties } from '$lib/types/any-replacements.js';

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
	let viewStartTime = Date.now();

	// Analytics tracking function using new consolidated schema
	async function trackAnalyticsEvent(_eventName: string, properties: AnalyticsProperties) {
		try {
			await fetch('/api/analytics/events', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: _eventName,
					event_type: 'interaction',
					template_id: templateId,
					properties: {
						template_id: templateId,
						component: 'cascade_analytics',
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
		await loadCascadeAnalysis();

		// Track cascade analytics view
		await trackAnalyticsEvent('cascade_analytics_view', {
			analysis_type: 'epidemiological_cascade'
		});
	});

	onDestroy(async () => {
		// Track session duration
		const sessionDuration = Date.now() - viewStartTime;
		await trackAnalyticsEvent('cascade_analytics_session_end', {
			session_duration_ms: sessionDuration,
			final_metrics: summary
				? {
						r0: metrics?.r0,
						viral_coefficient: summary.viral_coefficient,
						total_activations: summary.total_activations,
						viral_status: summary.viral_status
					}
				: null
		});
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

	function getViralStatusBadge(status: string): 'success' | 'warning' | 'error' | 'neutral' {
		switch (status) {
			case 'highly_viral':
				return 'success';
			case 'viral':
				return 'success';
			case 'spreading':
				return 'warning';
			case 'slow_growth':
				return 'warning';
			case 'stagnant':
				return 'error';
			default:
				return 'neutral';
		}
	}

	function getGeographicReachBadge(reach: string): 'success' | 'warning' | 'error' | 'neutral' {
		switch (reach) {
			case 'national':
				return 'success';
			case 'regional':
				return 'success';
			case 'statewide':
				return 'warning';
			case 'local':
				return 'error';
			default:
				return 'neutral';
		}
	}

	function formatDuration(hours: number): string {
		if (hours < 1) return `${Math.round(hours * 60)}m`;
		if (hours < 24) return `${hours.toFixed(1)}h`;
		return `${Math.round(hours / 24)}d`;
	}
</script>

<div class="rounded-xl bg-white p-6 shadow-lg">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h2 class="text-2xl font-bold text-gray-900">Cascade Analytics</h2>
			<p class="mt-1 text-gray-600">Epidemiological spread analysis with R0 calculations</p>
		</div>
		<button
			onclick={async () => {
				await trackAnalyticsEvent('cascade_analytics_refresh', {
					refresh_trigger: 'manual_button',
					current_viral_status: summary?.viral_status,
					current_r0: metrics?.r0
				});
				await loadCascadeAnalysis();
			}}
			disabled={loading}
			class="rounded-lg bg-participation-primary-600 px-4 py-2 text-white transition-colors hover:bg-participation-primary-700 disabled:opacity-50"
		>
			{loading ? 'Loading...' : 'Refresh'}
		</button>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<LoadingCard variant="spinner" />
			<span class="ml-3 text-gray-600">Analyzing cascade patterns...</span>
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
	{:else if metrics && summary}
		<!-- Key Performance Indicators -->
		<div class="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
			<div
				class="rounded-lg bg-gradient-to-br from-participation-primary-50 to-participation-primary-100 p-4"
			>
				<div class="text-2xl font-bold text-participation-primary-700">{metrics.r0.toFixed(2)}</div>
				<div class="text-sm font-medium text-participation-primary-600">R₀ (Reproduction Rate)</div>
				<div class="mt-1 text-xs text-participation-primary-500">
					{metrics.r0 > 1 ? 'Exponential growth' : 'Declining spread'}
				</div>
			</div>

			<div class="rounded-lg bg-gradient-to-br from-green-50 to-green-100 p-4">
				<div class="text-2xl font-bold text-green-700">{summary.viral_coefficient.toFixed(2)}</div>
				<div class="text-sm font-medium text-green-600">Viral Coefficient</div>
				<div class="mt-1 text-xs text-green-500">
					{summary.viral_coefficient > 1 ? 'Self-sustaining' : 'Needs push'}
				</div>
			</div>

			<div class="rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 p-4">
				<div class="text-2xl font-bold text-purple-700">
					{metrics.activation_velocity.toFixed(1)}
				</div>
				<div class="text-sm font-medium text-purple-600">Peak Velocity</div>
				<div class="mt-1 text-xs text-purple-500">users/hour</div>
			</div>

			<div class="rounded-lg bg-gradient-to-br from-orange-50 to-orange-100 p-4">
				<div class="text-2xl font-bold text-orange-700">{metrics.generation_depth}</div>
				<div class="text-sm font-medium text-orange-600">Generation Depth</div>
				<div class="mt-1 text-xs text-orange-500">degrees of separation</div>
			</div>
		</div>

		<!-- Status and Reach -->
		<div class="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
			<div class="rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 p-6">
				<h3 class="mb-4 text-lg font-semibold text-gray-900">Viral Status</h3>
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

			<div class="rounded-lg bg-gradient-to-br from-indigo-50 to-indigo-100 p-6">
				<h3 class="mb-4 text-lg font-semibold text-gray-900">Network Metrics</h3>
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
			<div class="mb-8 rounded-lg bg-gradient-to-r from-yellow-50 to-amber-50 p-6">
				<h3 class="mb-4 text-lg font-semibold text-gray-900">Optimization Recommendations</h3>
				<div class="space-y-2">
					{#each recommendations as recommendation}
						<div class="flex items-start">
							<svg
								class="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500"
								fill="currentColor"
								viewBox="0 0 20 20"
							>
								<path
									fill-rule="evenodd"
									d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
									clip-rule="evenodd"
								></path>
							</svg>
							<span class="text-amber-800">{recommendation}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Activation Timeline -->
		{#if timeline.length > 0}
			<div class="rounded-lg bg-gray-50 p-6">
				<h3 class="mb-4 text-lg font-semibold text-gray-900">
					Activation Timeline
					<span class="text-sm font-normal text-gray-500">({timeline.length} events)</span>
				</h3>
				<div class="max-h-64 overflow-y-auto">
					<div class="space-y-2">
						{#each timeline.slice(0, 20) as event}
							<div class="flex items-center justify-between rounded bg-white p-3 text-sm">
								<div class="flex items-center">
									<div class="mr-3 h-2 w-2 rounded-full bg-participation-primary-400"></div>
									<span class="font-mono text-gray-600">Gen {event.generation}</span>
								</div>
								<div class="flex items-center space-x-4 text-gray-500">
									<span>{formatDuration(event.time_to_activation)}</span>
									<span>{new Date(event.activated_at).toLocaleDateString()}</span>
								</div>
							</div>
						{/each}
						{#if timeline.length > 20}
							<div class="py-2 text-center text-sm text-gray-500">
								... and {timeline.length - 20} more activations
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>
