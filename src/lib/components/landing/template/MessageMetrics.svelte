<script lang="ts">
	import { Send, Landmark, Building2, CheckCircle, User, Users } from 'lucide-svelte';
	import Tooltip from '../../ui/Tooltip.svelte';
	import type { Template } from '$lib/types/template';

	export let template: Template;

	// Format numbers with commas
	function formatNumber(num: number): string {
		return num.toLocaleString();
	}

	// Determine badge type based on delivery method
	$: badgeType =
		template.deliveryMethod === 'both' ? 'certified' : ('direct' as 'certified' | 'direct');

	// Calculate delivery confirmation rate for congressional templates
	function getDeliveryRate(template: Template): string {
		if (template.metrics.sent === 0) return '0%';
		// For congressional templates, "responded" represents delivery confirmations
		return Math.round((template.metrics.responded / template.metrics.sent) * 100) + '%';
	}

	$: typeMetrics = {
		certified: {
			icon: Landmark,
			tooltip: 'Delivered through Congressional Web Communication system',
			value: `${formatNumber(template.metrics.sent)} sent`,
			secondaryIcon: CheckCircle,
			secondaryTooltip: 'Percentage confirmed delivered to congressional offices',
			secondaryValue: `${getDeliveryRate(template)} delivered`
		},
		direct: {
			icon: Building2,
			tooltip: 'Direct email outreach to decision makers',
			value: `${formatNumber(template.metrics.sent)} sent`,
			secondaryIcon: template.metrics.clicked > 1 ? Users : User,
			secondaryTooltip: 'Total recipient addresses targeted',
			secondaryValue: `${formatNumber(template.metrics.clicked)} recipients`
		}
	} as const;

	$: currentMetric = typeMetrics[badgeType];
</script>

<div class="min-w-0 max-w-full space-y-2 text-sm">
	<div class="flex max-w-fit items-center gap-2 text-slate-500">
		<Send class="h-4 w-4 shrink-0" />
		<Tooltip content="Total messages sent in this campaign" containerClass="min-w-0 flex-1">
			{formatNumber(template.metrics.sent)} sent
		</Tooltip>
	</div>

	<div class="flex max-w-fit items-center gap-2 text-slate-500">
		<svelte:component this={currentMetric.secondaryIcon} class="h-4 w-4 shrink-0" />
		<Tooltip content={currentMetric.secondaryTooltip} containerClass="min-w-0 flex-1">
			{currentMetric.secondaryValue}
		</Tooltip>
	</div>
</div>
