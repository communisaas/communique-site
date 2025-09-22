<script lang="ts">
	/// <reference types="node" />
	import { onMount, onDestroy } from 'svelte';
	import SkeletonStat from '$lib/components/ui/SkeletonStat.svelte';
	import SkeletonList from '$lib/components/ui/SkeletonList.svelte';
	import type { AnalyticsSession } from '$lib/types/analytics.ts';
	import type { AnalyticsProperties } from '$lib/types/any-replacements.js';

	interface DeliveryStatus {
		campaign_id: string;
		template_id: string;
		template_title: string;
		status: 'pending' | 'processing' | 'delivered' | 'failed' | 'bounced';
		created_at: string;
		updated_at: string;
		delivery_attempts: number;
		error_message?: string;
		recipient_info?: {
			representative_name: string;
			office_type: 'house' | 'senate';
			district?: string;
			state: string;
		};
		tracking_data?: {
			delivery_time?: string;
			response_received?: boolean;
			response_type?: string;
		};
	}

	interface DeliveryMetrics {
		total_pending: number;
		total_delivered: number;
		total_failed: number;
		success_rate: number;
		avg_delivery_time: number;
	}

	let {
		userId,
		realTime = true
	}: {
		userId: string;
		realTime?: boolean;
	} = $props();

	let deliveries: DeliveryStatus[] = $state([]);
	let metrics: DeliveryMetrics | null = $state(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let refreshInterval: number | null = null;
	let lastUpdate = $state<string>('');
	let _sessionData: AnalyticsSession | null = $state(null);
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
					properties: {
						user_id: userId,
						component: 'delivery_tracker',
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
		await loadDeliveryStatus();

		// Track delivery tracker view
		await trackAnalyticsEvent('delivery_tracker_view', {
			real_time_enabled: realTime
		});

		if (realTime) {
			// Poll for updates every 5 seconds
			refreshInterval = setInterval(loadDeliveryStatus, 5000);
		}
	});

	onDestroy(async () => {
		if (refreshInterval) {
			clearInterval(refreshInterval);
		}

		// Track session duration
		const sessionDuration = Date.now() - viewStartTime;
		await trackAnalyticsEvent('delivery_tracker_session_end', {
			session_duration_ms: sessionDuration,
			deliveries_viewed: deliveries.length
		});
	});

	async function loadDeliveryStatus() {
		try {
			const response = await fetch(`/api/analytics/delivery-status?userId=${userId}`);
			const data = await response.json();

			if (data.success) {
				deliveries = data.deliveries || [];
				metrics = data.metrics;
				lastUpdate = new Date().toLocaleTimeString();
				error = null;
			} else {
				error = data.error || 'Failed to load delivery status';
			}
		} catch (err) {
			error = 'Network error loading delivery status';
			console.error('Delivery status error:', err);
		} finally {
			loading = false;
		}
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'delivered':
				return 'text-green-600 bg-green-50';
			case 'processing':
				return 'text-participation-primary-600 bg-participation-primary-50';
			case 'pending':
				return 'text-yellow-600 bg-yellow-50';
			case 'failed':
				return 'text-red-600 bg-red-50';
			case 'bounced':
				return 'text-orange-600 bg-orange-50';
			default:
				return 'text-gray-600 bg-gray-50';
		}
	}

	function getStatusIcon(status: string): string {
		switch (status) {
			case 'delivered':
				return '✅';
			case 'processing':
				return '⏳';
			case 'pending':
				return '📤';
			case 'failed':
				return '❌';
			case 'bounced':
				return '🔄';
			default:
				return '📊';
		}
	}

	function formatDeliveryTime(timestamp: string): string {
		const now = Date.now();
		const time = new Date(timestamp).getTime();
		const diff = now - time;

		const minutes = Math.floor(diff / (1000 * 60));
		const hours = Math.floor(diff / (1000 * 60 * 60));
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));

		if (days > 0) return `${days}d ago`;
		if (hours > 0) return `${hours}h ago`;
		if (minutes > 0) return `${minutes}m ago`;
		return 'Just now';
	}

	async function retryDelivery(campaignId: string) {
		try {
			// Track retry attempt using new analytics schema
			await trackAnalyticsEvent('delivery_retry_attempt', {
				campaign_id: campaignId,
				retry_source: 'dashboard'
			});

			const response = await fetch(`/api/analytics/retry-delivery`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ campaign_id: campaignId })
			});

			if (response.ok) {
				await loadDeliveryStatus(); // Refresh status

				// Track successful retry initiation
				await trackAnalyticsEvent('delivery_retry_initiated', {
					campaign_id: campaignId,
					retry_source: 'dashboard'
				});
			} else {
				// Track retry failure
				await trackAnalyticsEvent('delivery_retry_failed', {
					campaign_id: campaignId,
					retry_source: 'dashboard',
					error: 'API request failed'
				});
			}
		} catch (_error) {
			console.error("Error occurred:", _error);

			// Track retry error
			await trackAnalyticsEvent('delivery_retryerror', {
				campaign_id: campaignId,
				retry_source: 'dashboard',
				error: _error instanceof Error ? _error.message : 'Unknown error'
			});
		}
	}
</script>

<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h2 class="text-xl font-semibold text-gray-900">Delivery Status</h2>
			<p class="mt-1 text-gray-600">Real-time tracking of congressional message delivery</p>
		</div>
		<div class="flex items-center space-x-4">
			{#if realTime}
				<div class="flex items-center text-sm text-gray-500">
					<div class="mr-2 h-2 w-2 animate-pulse rounded-full bg-green-400"></div>
					Live Updates
				</div>
			{/if}
			<button
				onclick={async () => {
					await trackAnalyticsEvent('delivery_tracker_refresh', {
						manual_refresh: true,
						current_deliveries_count: deliveries.length
					});
					await loadDeliveryStatus();
				}}
				disabled={loading}
				class="rounded bg-gray-100 px-3 py-1 text-sm text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50"
			>
				{loading ? 'Refreshing...' : 'Refresh'}
			</button>
		</div>
	</div>

	{#if loading && deliveries.length === 0}
		<!-- Metrics Skeleton -->
		<div class="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
			<SkeletonStat />
			<SkeletonStat />
			<SkeletonStat />
			<SkeletonStat />
		</div>
		<!-- Delivery List Skeleton -->
		<SkeletonList items={3} showActions={true} />
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
				<span class="font-medium text-red-800">Error Loading Status</span>
			</div>
			<p class="mt-1 text-red-700">{error}</p>
		</div>
	{:else}
		<!-- Metrics Overview -->
		{#if metrics}
			<div class="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
				<div class="rounded-lg bg-gradient-to-br from-green-50 to-green-100 p-4">
					<div class="text-2xl font-bold text-green-700">{metrics.total_delivered}</div>
					<div class="text-sm text-green-600">Delivered</div>
				</div>
				<div class="rounded-lg bg-gradient-to-br from-yellow-50 to-yellow-100 p-4">
					<div class="text-2xl font-bold text-yellow-700">{metrics.total_pending}</div>
					<div class="text-sm text-yellow-600">Pending</div>
				</div>
				<div class="rounded-lg bg-gradient-to-br from-red-50 to-red-100 p-4">
					<div class="text-2xl font-bold text-red-700">{metrics.total_failed}</div>
					<div class="text-sm text-red-600">Failed</div>
				</div>
				<div
					class="rounded-lg bg-gradient-to-br from-participation-primary-50 to-participation-primary-100 p-4"
				>
					<div class="text-2xl font-bold text-participation-primary-700">
						{(metrics.success_rate * 100).toFixed(1)}%
					</div>
					<div class="text-sm text-participation-primary-600">Success Rate</div>
				</div>
			</div>
		{/if}

		<!-- Delivery Timeline -->
		<div class="space-y-3">
			{#if deliveries.length === 0}
				<div class="py-8 text-center text-gray-500">
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
							d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
						></path>
					</svg>
					<p>No deliveries to track</p>
					<p class="mt-1 text-sm">Send a message to see delivery status here</p>
				</div>
			{:else}
				{#each deliveries.slice(0, 20) as delivery}
					<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
						<div class="flex items-start justify-between">
							<div class="flex-1">
								<div class="mb-2 flex items-center space-x-2">
									<span class="text-lg">{getStatusIcon(delivery.status)}</span>
									<h4 class="font-medium text-gray-900">{delivery.template_title}</h4>
									<div
										class={`rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(delivery.status)}`}
									>
										{delivery.status.toUpperCase()}
									</div>
								</div>

								{#if delivery.recipient_info}
									<div class="mb-1 text-sm text-gray-600">
										To: {delivery.recipient_info.representative_name}
										({delivery.recipient_info.office_type === 'house' ? 'House' : 'Senate'})
										{#if delivery.recipient_info.district}
											- District {delivery.recipient_info.district}
										{/if}
									</div>
								{/if}

								<div class="flex items-center space-x-4 text-xs text-gray-500">
									<span>Created: {formatDeliveryTime(delivery.created_at)}</span>
									{#if delivery.status === 'delivered' && delivery.tracking_data?.delivery_time}
										<span
											>Delivered: {formatDeliveryTime(delivery.tracking_data.delivery_time)}</span
										>
									{/if}
									{#if delivery.delivery_attempts > 1}
										<span>Attempts: {delivery.delivery_attempts}</span>
									{/if}
								</div>

								{#if delivery.error_message}
									<div class="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-600">
										Error: {delivery.error_message}
									</div>
								{/if}

								{#if delivery.tracking_data?.response_received}
									<div class="mt-2 rounded bg-green-50 px-2 py-1 text-xs text-green-600">
										✅ Response received: {delivery.tracking_data.response_type || 'Acknowledged'}
									</div>
								{/if}
							</div>

							<div class="ml-4 flex flex-col space-y-2">
								{#if delivery.status === 'failed'}
									<button
										onclick={() => retryDelivery(delivery.campaign_id)}
										class="rounded bg-participation-primary-600 px-2 py-1 text-xs text-white transition-colors hover:bg-participation-primary-700"
									>
										Retry
									</button>
								{/if}
								<button
									onclick={async () => {
										await trackAnalyticsEvent('delivery_details_view', {
											campaign_id: delivery.campaign_id,
											template_id: delivery.template_id,
											delivery_status: delivery.status
										});
										window.location.href = `/analytics/delivery/${delivery.campaign_id}`;
									}}
									class="rounded bg-gray-600 px-2 py-1 text-xs text-white transition-colors hover:bg-gray-700"
								>
									Details
								</button>
							</div>
						</div>
					</div>
				{/each}

				{#if deliveries.length > 20}
					<div class="py-4 text-center">
						<button
							class="text-sm font-medium text-participation-primary-600 hover:text-participation-primary-700"
						>
							Show All {deliveries.length} Deliveries
						</button>
					</div>
				{/if}
			{/if}
		</div>

		{#if lastUpdate}
			<div class="mt-4 text-center text-xs text-gray-400">
				Last updated: {lastUpdate}
			</div>
		{/if}
	{/if}
</div>
