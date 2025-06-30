<script lang="ts">
	import { Send, MapPin, Building2, Eye } from 'lucide-svelte';
	import Tooltip from '../../ui/Tooltip.svelte';
	import type { Template } from '$lib/types/template';

	export let template: Template;

	// Format numbers with commas
	function formatNumber(num: number): string {
		return num.toLocaleString();
	}

	// Calculate open rate percentage
	function getOpenRate(): string {
		if (template.metrics.sent === 0) return '0%';
		return Math.round((template.metrics.opened / template.metrics.sent) * 100) + '%';
	}

	// Determine badge type based on delivery method
	const badgeType = template.deliveryMethod === 'both' ? 'certified' : 'direct';

	const typeMetrics = {
		certified: {
			icon: MapPin,
			tooltip: 'Delivered through Congressional Web Communication system',
			value: `${formatNumber(template.metrics.sent)} sent`
		},
		direct: {
			icon: Building2,
			tooltip: 'Direct email outreach to decision makers',
			value: `${formatNumber(template.metrics.sent)} sent`
		}
	};

	const currentMetric = typeMetrics[badgeType];
</script>

<div class="min-w-0 max-w-full space-y-2 text-sm">
	<div class="flex max-w-fit items-center gap-2 text-slate-500">
		<Send class="h-4 w-4 shrink-0" />
		<Tooltip content="Total messages sent in this campaign" containerClass="min-w-0 flex-1">
			{formatNumber(template.metrics.sent)} sent
		</Tooltip>
	</div>

	<div class="flex max-w-fit items-center gap-2 text-slate-500">
		<Eye class="h-4 w-4 shrink-0" />
		<Tooltip content="Percentage of messages opened by recipients" containerClass="min-w-0 flex-1">
			{getOpenRate()} opened
		</Tooltip>
	</div>
</div>
