<script lang="ts">
	import { CheckCircle2, Send, AlertCircle, ExternalLink } from '@lucide/svelte';
	import { onMount, onDestroy } from 'svelte';

	let {
		submissionId,
		initialStatus = 'sending',
		onOverride
	}: {
		submissionId: string;
		initialStatus?: 'sending' | 'routing' | 'delivered' | 'recorded' | 'failed';
		onOverride?: () => void;
	} = $props();

	let status = $state(initialStatus);
	let details = $state<string | null>(null);
	let deliveryCount = $state<number | null>(null);
	let canOverride = $state(true);
	let websocket: WebSocket | null = null;

	// Connect to real-time status updates
	onMount(() => {
		if (typeof window !== 'undefined') {
			// Connect to WebSocket for real-time updates
			const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
			const wsUrl = `${protocol}//${window.location.host}/ws/submissions/${submissionId}`;

			try {
				websocket = new WebSocket(wsUrl);

				websocket.onmessage = (event) => {
					const update = JSON.parse(event.data);
					if (update.status) {
						status = update.status;
					}
					if (update.details) {
						details = update.details;
					}
					if (update.deliveryCount !== undefined) {
						deliveryCount = update.deliveryCount;
					}
					if (update.canOverride !== undefined) {
						canOverride = update.canOverride;
					}
				};

				websocket.onerror = () => {
					// Fallback to polling if WebSocket fails
					startPolling();
				};
			} catch (_error) {
				// WebSocket not supported, use polling
				startPolling();
			}
		}
	});

	onDestroy(() => {
		if (websocket) {
			websocket.close();
		}
	});

	// Fallback polling for status updates
	let pollInterval: number | null = null;

	function startPolling() {
		if (pollInterval) return;

		pollInterval = setInterval(async () => {
			try {
				const response = await fetch(`/api/submissions/${submissionId}/status`);
				const data = await response.json();

				if (data.status) {
					status = data.status;
				}
				if (data.details) {
					details = data.details;
				}
				if (data.deliveryCount !== undefined) {
					deliveryCount = data.deliveryCount;
				}
				if (data.canOverride !== undefined) {
					canOverride = data.canOverride;
				}

				// Stop polling once delivered
				if (status === 'recorded' || status === 'failed') {
					if (pollInterval) {
						clearInterval(pollInterval);
						pollInterval = null;
					}
				}
			} catch (_error) {
				console.error('Failed to poll submission status:', _error);
			}
		}, 2000);
	}

	// Status display configuration
	// Status display configuration - use derived for reactive updates
	const statusConfig = $derived({
		sending: {
			icon: Send,
			text: 'Message sent',
			description: 'Routing through delivery system',
			color: 'blue'
		},
		routing: {
			icon: Send,
			text: 'Routing to Congress',
			description: 'Finding your representatives',
			color: 'blue'
		},
		delivered: {
			icon: CheckCircle2,
			text: deliveryCount ? `Delivered to ${deliveryCount} offices` : 'Delivered to Congress',
			description: 'Message received by congressional offices',
			color: 'green'
		},
		recorded: {
			icon: CheckCircle2,
			text: 'On record',
			description: 'Participation tracked',
			color: 'green'
		},
		failed: {
			icon: AlertCircle,
			text: 'Delivery failed',
			description: details || 'Unable to deliver message',
			color: 'red'
		}
	});

	const config = $derived(statusConfig[status]);
</script>

<div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
	<div class="flex items-start justify-between">
		<div class="flex items-start gap-3">
			{#if config}
				{@const IconComponent = config.icon}
				<IconComponent
					class="mt-0.5 h-5 w-5 shrink-0 {config.color === 'blue'
						? 'text-participation-primary-600'
						: config.color === 'green'
							? 'text-green-600'
							: 'text-red-600'} {status === 'sending' || status === 'routing'
						? 'animate-pulse'
						: ''}"
				/>
			{/if}

			<div>
				<h4 class="text-base font-medium text-slate-900">
					{config?.text || 'Processing'}
				</h4>
				<p class="mt-1 text-sm text-slate-600">
					{config?.description || ''}
				</p>

				{#if status === 'delivered' && details}
					<p class="mt-2 text-xs text-slate-500">
						{details}
					</p>
				{/if}
			</div>
		</div>

		{#if canOverride && onOverride && (status === 'sending' || status === 'routing')}
			<button
				onclick={onOverride}
				class="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
			>
				Send anyway
				<ExternalLink class="h-3 w-3" />
			</button>
		{/if}
	</div>

	{#if status === 'failed'}
		<div class="mt-4 flex gap-3">
			<button
				onclick={() => {
					// Trigger retry - would need to be implemented
					status = 'sending';
				}}
				class="rounded bg-participation-primary-600 px-3 py-2 text-sm text-white hover:bg-participation-primary-700"
			>
				Fix and retry
			</button>

			{#if onOverride}
				<button
					onclick={onOverride}
					class="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
				>
					Send as-is
				</button>
			{/if}
		</div>
	{/if}
</div>
