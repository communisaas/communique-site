<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	
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
	
	let { userId, realTime = true }: { 
		userId: string;
		realTime?: boolean;
	} = $props();
	
	let deliveries: DeliveryStatus[] = $state([]);
	let metrics: DeliveryMetrics | null = $state(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let refreshInterval: NodeJS.Timeout | null = null;
	let lastUpdate = $state<string>('');
	
	onMount(async () => {
		await loadDeliveryStatus();
		
		if (realTime) {
			// Poll for updates every 5 seconds
			refreshInterval = setInterval(loadDeliveryStatus, 5000);
		}
	});
	
	onDestroy(() => {
		if (refreshInterval) {
			clearInterval(refreshInterval);
		}
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
			case 'delivered': return 'text-green-600 bg-green-50';
			case 'processing': return 'text-blue-600 bg-blue-50';
			case 'pending': return 'text-yellow-600 bg-yellow-50';
			case 'failed': return 'text-red-600 bg-red-50';
			case 'bounced': return 'text-orange-600 bg-orange-50';
			default: return 'text-gray-600 bg-gray-50';
		}
	}
	
	function getStatusIcon(status: string): string {
		switch (status) {
			case 'delivered': return '✅';
			case 'processing': return '⏳';
			case 'pending': return '📤';
			case 'failed': return '❌';
			case 'bounced': return '🔄';
			default: return '📊';
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
			const response = await fetch(`/api/analytics/retry-delivery`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ campaign_id: campaignId })
			});
			
			if (response.ok) {
				await loadDeliveryStatus(); // Refresh status
			}
		} catch (err) {
			console.error('Retry failed:', err);
		}
	}
</script>

<div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
	<div class="flex items-center justify-between mb-6">
		<div>
			<h2 class="text-xl font-semibold text-gray-900">Delivery Status</h2>
			<p class="text-gray-600 mt-1">Real-time tracking of congressional message delivery</p>
		</div>
		<div class="flex items-center space-x-4">
			{#if realTime}
				<div class="flex items-center text-sm text-gray-500">
					<div class="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
					Live Updates
				</div>
			{/if}
			<button 
				onclick={loadDeliveryStatus}
				disabled={loading}
				class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 transition-colors"
			>
				{loading ? 'Refreshing...' : 'Refresh'}
			</button>
		</div>
	</div>
	
	{#if loading && deliveries.length === 0}
		<div class="flex items-center justify-center py-8">
			<LoadingSpinner />
			<span class="ml-3 text-gray-600">Loading delivery status...</span>
		</div>
	{:else if error}
		<div class="bg-red-50 border border-red-200 rounded-lg p-4">
			<div class="flex items-center">
				<svg class="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
					<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
				</svg>
				<span class="text-red-800 font-medium">Error Loading Status</span>
			</div>
			<p class="text-red-700 mt-1">{error}</p>
		</div>
	{:else}
		<!-- Metrics Overview -->
		{#if metrics}
			<div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
				<div class="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
					<div class="text-2xl font-bold text-green-700">{metrics.total_delivered}</div>
					<div class="text-sm text-green-600">Delivered</div>
				</div>
				<div class="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4">
					<div class="text-2xl font-bold text-yellow-700">{metrics.total_pending}</div>
					<div class="text-sm text-yellow-600">Pending</div>
				</div>
				<div class="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4">
					<div class="text-2xl font-bold text-red-700">{metrics.total_failed}</div>
					<div class="text-sm text-red-600">Failed</div>
				</div>
				<div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
					<div class="text-2xl font-bold text-blue-700">{(metrics.success_rate * 100).toFixed(1)}%</div>
					<div class="text-sm text-blue-600">Success Rate</div>
				</div>
			</div>
		{/if}
		
		<!-- Delivery Timeline -->
		<div class="space-y-3">
			{#if deliveries.length === 0}
				<div class="text-center py-8 text-gray-500">
					<svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
					</svg>
					<p>No deliveries to track</p>
					<p class="text-sm mt-1">Send a message to see delivery status here</p>
				</div>
			{:else}
				{#each deliveries.slice(0, 20) as delivery}
					<div class="bg-gray-50 rounded-lg p-4 border border-gray-200">
						<div class="flex items-start justify-between">
							<div class="flex-1">
								<div class="flex items-center space-x-2 mb-2">
									<span class="text-lg">{getStatusIcon(delivery.status)}</span>
									<h4 class="font-medium text-gray-900">{delivery.template_title}</h4>
									<div class={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(delivery.status)}`}>
										{delivery.status.toUpperCase()}
									</div>
								</div>
								
								{#if delivery.recipient_info}
									<div class="text-sm text-gray-600 mb-1">
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
										<span>Delivered: {formatDeliveryTime(delivery.tracking_data.delivery_time)}</span>
									{/if}
									{#if delivery.delivery_attempts > 1}
										<span>Attempts: {delivery.delivery_attempts}</span>
									{/if}
								</div>
								
								{#if delivery.error_message}
									<div class="mt-2 text-xs text-red-600 bg-red-50 rounded px-2 py-1">
										Error: {delivery.error_message}
									</div>
								{/if}
								
								{#if delivery.tracking_data?.response_received}
									<div class="mt-2 text-xs text-green-600 bg-green-50 rounded px-2 py-1">
										✅ Response received: {delivery.tracking_data.response_type || 'Acknowledged'}
									</div>
								{/if}
							</div>
							
							<div class="flex flex-col space-y-2 ml-4">
								{#if delivery.status === 'failed'}
									<button
										onclick={() => retryDelivery(delivery.campaign_id)}
										class="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
									>
										Retry
									</button>
								{/if}
								<button
									onclick={() => window.location.href = `/analytics/delivery/${delivery.campaign_id}`}
									class="text-xs px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
								>
									Details
								</button>
							</div>
						</div>
					</div>
				{/each}
				
				{#if deliveries.length > 20}
					<div class="text-center py-4">
						<button class="text-sm text-blue-600 hover:text-blue-700 font-medium">
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