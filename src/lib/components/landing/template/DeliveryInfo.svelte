<script lang="ts">
	import { Shield, AtSign, MapPin, Building2 } from 'lucide-svelte';
	import type { Template } from '$lib/types/template';

	export let template: Template;

	// Determine badge type based on delivery method
	const badgeType = template.deliveryMethod === 'both' ? 'certified' : 'direct';

	const deliveryTypes = {
		certified: {
			icon: Shield,
			iconClass: 'text-green-600',
			textClass: 'text-green-700',
			label: 'Certified Congressional Delivery',
			MetricIcon: MapPin,
			metricValue: `${template.metrics.sent.toLocaleString()} sent`
		},
		direct: {
			icon: AtSign,
			iconClass: 'text-blue-600',
			textClass: 'text-blue-700',
			label: 'Direct Email Campaign',
			MetricIcon: Building2,
			metricValue: `${template.metrics.sent.toLocaleString()} sent`
		}
	};

	const delivery = deliveryTypes[badgeType];
</script>

<div class="mb-4 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 md:mb-6 md:p-4">
	<div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
		<div class="flex items-center gap-2">
			<svelte:component this={delivery.icon} class="h-4 w-4 {delivery.iconClass}" />
			<span class="text-xs md:text-sm {delivery.textClass}">
				{delivery.label}
			</span>
		</div>
		<div class="flex items-center gap-2">
			<svelte:component this={delivery.MetricIcon} class="h-4 w-4 text-slate-500" />
			<span class="text-xs text-slate-600 md:text-sm">
				{delivery.metricValue}
			</span>
		</div>
	</div>
</div>
