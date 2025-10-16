<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	let metrics = $state<any>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let autoRefresh = $state(true);
	let refreshInterval: number | null = null;

	async function fetchMetrics() {
		try {
			const response = await fetch('/api/blockchain/rpc/metrics');
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
			metrics = await response.json();
			error = null;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to fetch metrics';
			console.error('[RPC Monitor] Fetch error:', err);
		} finally {
			loading = false;
		}
	}

	async function resetHealth() {
		if (!confirm('Reset all provider health and circuit breakers?')) {
			return;
		}

		try {
			const response = await fetch('/api/blockchain/rpc/metrics', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'reset_health' })
			});

			if (!response.ok) {
				throw new Error('Failed to reset health');
			}

			await fetchMetrics();
			alert('Provider health reset successfully');
		} catch (err) {
			alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
		}
	}

	async function toggleProvider(providerName: string, currentlyEnabled: boolean) {
		const action = currentlyEnabled ? 'disable_provider' : 'enable_provider';
		const actionText = currentlyEnabled ? 'disable' : 'enable';

		if (!confirm(`${actionText.toUpperCase()} provider ${providerName}?`)) {
			return;
		}

		try {
			const response = await fetch('/api/blockchain/rpc/metrics', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action, providerName })
			});

			if (!response.ok) {
				throw new Error(`Failed to ${actionText} provider`);
			}

			await fetchMetrics();
		} catch (err) {
			alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
		}
	}

	function startAutoRefresh() {
		if (refreshInterval) {
			clearInterval(refreshInterval);
		}
		refreshInterval = window.setInterval(() => {
			if (autoRefresh) {
				fetchMetrics();
			}
		}, 5000); // Refresh every 5 seconds
	}

	onMount(() => {
		fetchMetrics();
		startAutoRefresh();
	});

	onDestroy(() => {
		if (refreshInterval) {
			clearInterval(refreshInterval);
		}
	});

	function getHealthStatusColor(status: string): string {
		switch (status) {
			case 'healthy':
				return 'bg-green-100 text-green-800';
			case 'degraded':
				return 'bg-yellow-100 text-yellow-800';
			case 'unhealthy':
				return 'bg-orange-100 text-orange-800';
			case 'circuit-open':
				return 'bg-red-100 text-red-800';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}

	function getOverallHealthColor(status: string): string {
		switch (status) {
			case 'healthy':
				return 'text-green-600';
			case 'degraded':
				return 'text-yellow-600';
			case 'critical':
				return 'text-red-600';
			default:
				return 'text-gray-600';
		}
	}
</script>

<div class="min-h-screen bg-gray-50 p-6">
	<div class="max-w-7xl mx-auto">
		<!-- Header -->
		<div class="mb-8 flex justify-between items-center">
			<div>
				<h1 class="text-3xl font-bold text-gray-900">RPC Monitor</h1>
				<p class="text-gray-600 mt-1">Real-time NEAR RPC provider health and performance</p>
			</div>

			<div class="flex gap-3">
				<label class="flex items-center gap-2 text-sm">
					<input type="checkbox" bind:checked={autoRefresh} class="rounded" />
					<span class="text-gray-700">Auto-refresh (5s)</span>
				</label>

				<button
					onclick={() => fetchMetrics()}
					class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
				>
					Refresh Now
				</button>

				<button
					onclick={resetHealth}
					class="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium"
				>
					Reset Health
				</button>
			</div>
		</div>

		{#if loading}
			<div class="text-center py-12">
				<div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
				<p class="mt-4 text-gray-600">Loading metrics...</p>
			</div>
		{:else if error}
			<div class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
				<p class="text-red-800 font-medium">Error loading metrics</p>
				<p class="text-red-600 text-sm mt-2">{error}</p>
				<button
					onclick={() => fetchMetrics()}
					class="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
				>
					Retry
				</button>
			</div>
		{:else if metrics}
			<!-- Overall Health Status -->
			<div class="bg-white rounded-lg shadow-sm p-6 mb-6">
				<div class="flex items-center justify-between">
					<div>
						<h2 class="text-lg font-semibold text-gray-900">Overall Health</h2>
						<p class="text-sm text-gray-600 mt-1">{metrics.health.message}</p>
					</div>
					<div class={`text-4xl font-bold ${getOverallHealthColor(metrics.health.status)}`}>
						{metrics.health.status.toUpperCase()}
					</div>
				</div>
			</div>

			<!-- Summary Cards -->
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
				<div class="bg-white rounded-lg shadow-sm p-6">
					<p class="text-sm text-gray-600">Total Calls</p>
					<p class="text-3xl font-bold text-gray-900 mt-2">{metrics.summary.totalCalls}</p>
				</div>

				<div class="bg-white rounded-lg shadow-sm p-6">
					<p class="text-sm text-gray-600">Success Rate</p>
					<p class="text-3xl font-bold text-green-600 mt-2">{metrics.summary.uptimePercentage}%</p>
				</div>

				<div class="bg-white rounded-lg shadow-sm p-6">
					<p class="text-sm text-gray-600">Avg Latency</p>
					<p class="text-3xl font-bold text-blue-600 mt-2">{metrics.summary.averageLatency}ms</p>
				</div>

				<div class="bg-white rounded-lg shadow-sm p-6">
					<p class="text-sm text-gray-600">Primary Provider</p>
					<p class="text-2xl font-bold text-gray-900 mt-2">{metrics.summary.primaryProvider}</p>
				</div>
			</div>

			<!-- Provider Status -->
			<div class="bg-white rounded-lg shadow-sm p-6 mb-6">
				<h2 class="text-lg font-semibold text-gray-900 mb-4">Provider Status</h2>

				<div class="space-y-4">
					{#each metrics.providers as provider}
						<div class="border border-gray-200 rounded-lg p-4">
							<div class="flex justify-between items-start">
								<div class="flex-1">
									<div class="flex items-center gap-3 mb-2">
										<h3 class="font-semibold text-gray-900">{provider.name}</h3>
										<span class="text-sm text-gray-500">Priority: {provider.priority}</span>
										<button
											onclick={() => toggleProvider(provider.name, provider.enabled)}
											class={`px-3 py-1 text-xs rounded-full font-medium ${
												provider.enabled
													? 'bg-green-100 text-green-800 hover:bg-green-200'
													: 'bg-gray-100 text-gray-800 hover:bg-gray-200'
											}`}
										>
											{provider.enabled ? 'Enabled' : 'Disabled'}
										</button>
									</div>

									<div class="grid grid-cols-2 gap-4">
										<!-- Mainnet Health -->
										{#if provider.mainnet.health}
											<div>
												<p class="text-xs text-gray-500 mb-1">Mainnet</p>
												<div
													class={`inline-block px-2 py-1 rounded text-xs font-medium ${getHealthStatusColor(
														provider.mainnet.health.status
													)}`}
												>
													{provider.mainnet.health.status}
												</div>
												<div class="mt-2 text-sm text-gray-700">
													<p>Requests: {provider.mainnet.health.totalRequests}</p>
													<p>Success: {provider.mainnet.health.successRate.toFixed(1)}%</p>
													<p>Latency: {provider.mainnet.health.averageLatency.toFixed(0)}ms (P95: {provider.mainnet.health.p95Latency.toFixed(0)}ms)</p>
													<p>Circuit: {provider.mainnet.health.circuitBreakerState}</p>
												</div>
											</div>
										{/if}

										<!-- Testnet Health -->
										{#if provider.testnet.health}
											<div>
												<p class="text-xs text-gray-500 mb-1">Testnet</p>
												<div
													class={`inline-block px-2 py-1 rounded text-xs font-medium ${getHealthStatusColor(
														provider.testnet.health.status
													)}`}
												>
													{provider.testnet.health.status}
												</div>
												<div class="mt-2 text-sm text-gray-700">
													<p>Requests: {provider.testnet.health.totalRequests}</p>
													<p>Success: {provider.testnet.health.successRate.toFixed(1)}%</p>
													<p>Latency: {provider.testnet.health.averageLatency.toFixed(0)}ms (P95: {provider.testnet.health.p95Latency.toFixed(0)}ms)</p>
													<p>Circuit: {provider.testnet.health.circuitBreakerState}</p>
												</div>
											</div>
										{/if}
									</div>

									{#if provider.limits}
										<div class="mt-2 text-xs text-gray-500">
											Limits:
											{#if provider.limits.requestsPerSecond}
												{provider.limits.requestsPerSecond} req/sec
											{/if}
											{#if provider.limits.monthlyQuota}
												· {(provider.limits.monthlyQuota / 1_000_000).toFixed(0)}M/month
											{/if}
										</div>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Recent Traces -->
			<div class="bg-white rounded-lg shadow-sm p-6">
				<h2 class="text-lg font-semibold text-gray-900 mb-4">Recent Requests</h2>

				{#if metrics.recentTraces.length === 0}
					<p class="text-gray-500 text-center py-8">No requests yet</p>
				{:else}
					<div class="overflow-x-auto">
						<table class="min-w-full divide-y divide-gray-200">
							<thead class="bg-gray-50">
								<tr>
									<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
									<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
									<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Network</th>
									<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
									<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
									<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Attempts</th>
									<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
								</tr>
							</thead>
							<tbody class="bg-white divide-y divide-gray-200">
								{#each metrics.recentTraces as trace}
									<tr class="hover:bg-gray-50">
										<td class="px-4 py-3 text-sm text-gray-900">
											{new Date(trace.startTime).toLocaleTimeString()}
										</td>
										<td class="px-4 py-3 text-sm font-mono text-gray-900">{trace.method}</td>
										<td class="px-4 py-3 text-sm text-gray-600">{trace.network}</td>
										<td class="px-4 py-3 text-sm text-gray-900">{trace.provider || 'N/A'}</td>
										<td class="px-4 py-3 text-sm text-gray-600">{trace.duration}ms</td>
										<td class="px-4 py-3 text-sm text-gray-600">{trace.attempts}</td>
										<td class="px-4 py-3 text-sm">
											{#if trace.success}
												<span class="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">Success</span>
											{:else}
												<span class="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium" title={trace.error}>Failed</span>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="mt-6 text-center text-sm text-gray-500">
				Last updated: {new Date(metrics.timestamp).toLocaleString()}
			</div>
		{/if}
	</div>
</div>
