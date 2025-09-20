<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Megaphone, Shield, AtSign } from '@lucide/svelte';
	import type { Template } from '$lib/types/template';
	import type { AnalyticsEvent } from '$lib/types/analytics.ts';

	interface Props {
		templates: Template[];
		messageCount: number;
	}

	const { templates, messageCount }: Props = $props();
	let viewStartTime = Date.now();

	// Analytics tracking function using new consolidated schema
	async function trackAnalyticsEvent(eventName: string, properties: Record<string, any>) {
		try {
			await fetch('/api/analytics/events', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: eventName,
					event_type: 'interaction',
					properties: {
						component: 'activity_feed',
						timestamp: new Date().toISOString(),
						...properties
					}
				})
			});
		} catch (error) {
			console.warn('Analytics tracking failed:', error);
		}
	}

	const activityTypes = {
		certified: {
			icon: Shield,
			iconClass: 'text-green-500',
			textClass: 'text-green-600 sm:text-base text-sm',
			label: 'Certified Delivery'
		},
		direct: {
			icon: AtSign,
			iconClass: 'text-blue-500',
			textClass: 'text-blue-600 sm:text-base text-sm',
			label: 'Direct Outreach'
		}
	};

	let itemsToShow = 2;

	onMount(async () => {
		// Track activity feed view
		await trackAnalyticsEvent('activity_feed_view', {
			templates_count: templates.length,
			message_count: messageCount,
			items_to_show: itemsToShow
		});
	});

	onDestroy(async () => {
		// Track session duration
		const sessionDuration = Date.now() - viewStartTime;
		await trackAnalyticsEvent('activity_feed_session_end', {
			session_duration_ms: sessionDuration,
			templates_viewed: itemsToShow,
			total_templates_available: templates.length
		});
	});
</script>

<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
	<div class="mb-6 flex items-center justify-between">
		<div class="flex items-center gap-3">
			<Megaphone class="h-5 w-5 text-slate-600" />
			<h3 class="text-sm font-medium text-slate-900 sm:text-base">Recent Messages</h3>
		</div>
		<span class="text-xs text-slate-500 sm:text-sm">Latest Activity</span>
	</div>

	<div class="space-y-4">
		{#each templates.slice(0, itemsToShow) as template (template.id)}
			{@const badgeType = template.deliveryMethod === 'cwc' ? 'certified' : 'direct'}
			{@const activity = activityTypes[badgeType]}
			<button
				onclick={async () => {
					await trackAnalyticsEvent('activity_feed_template_click', {
						template_id: template.id,
						template_title: template.title,
						delivery_method: template.deliveryMethod,
						messages_sent: template.metrics?.sent ?? 0
					});
					// TODO: Add navigation or template details functionality
				}}
				class="w-full text-left"
			>
				<div
					class="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs transition-colors hover:bg-slate-100 sm:text-sm"
				>
					<div class="flex items-center gap-3">
						<activity.icon class="h-4 w-4 {activity.iconClass}" />
						<div>
							<div class="text-xs font-medium sm:text-sm">
								<span class={activity.textClass}>
									{activity.label}
								</span>
							</div>
							<div class="text-slate-900">{template.title}</div>
							<div class="text-xs text-slate-500 sm:text-sm">
								{(template.metrics?.sent ?? 0).toLocaleString()} sent
								{#if template.metrics?.delivered && template.metrics?.sent}
									• {((template.metrics.delivered / template.metrics.sent) * 100).toFixed(1)}% delivered
								{/if}
							</div>
						</div>
					</div>
					<div class="text-xs text-slate-400">
						View →
					</div>
				</div>
			</button>
		{/each}
	</div>
</div>
