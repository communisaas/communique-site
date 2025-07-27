<script lang="ts">
	import { Megaphone, Shield, AtSign } from '@lucide/svelte';
	import type { Template } from '$lib/types/template';

	interface Props {
		templates: Template[];
		messageCount: number;
	}

	const { templates, messageCount }: Props = $props();

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
			{@const badgeType = template.deliveryMethod === 'both' ? 'certified' : 'direct'}
			{@const activity = activityTypes[badgeType]}
			<div
				class="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs sm:text-sm"
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
							{template.metrics.sent.toLocaleString()} sent
						</div>
					</div>
				</div>
			</div>
		{/each}
	</div>
</div>
