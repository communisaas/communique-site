<script lang="ts">
	import { Send, Landmark, Building2, MapPin, User, Users } from '@lucide/svelte';
	import Tooltip from '$lib/components/ui/Tooltip.svelte';
	import type { Template } from '$lib/types/template';

	interface Props {
		template: Template;
	}

	const { template }: Props = $props();

	// Format numbers with commas
	function formatNumber(num: number): string {
		return num.toLocaleString();
	}

	// Determine badge type based on delivery method
	const badgeType = $derived(
		template.deliveryMethod === 'both' ? 'certified' : ('direct' as 'certified' | 'direct')
	);

	// Calculate district coverage for congressional templates
	function getDistrictCoverage(template: Template): string {
		// Use the pre-calculated percentage if available
		if (template.metrics.district_coverage_percent !== undefined) {
			return `${template.metrics.district_coverage_percent}%`;
		}

		// Fallback: calculate from districts_covered and total_districts
		if (template.metrics.districts_covered && template.metrics.total_districts) {
			const percentage = Math.round(
				(template.metrics.districts_covered / template.metrics.total_districts) * 100
			);
			return `${percentage}%`;
		}

		// Legacy fallback: use old delivery rate calculation
		if (template.metrics.sent === 0) return '0%';
		return Math.round((template.metrics.responded / template.metrics.sent) * 100) + '%';
	}

	const typeMetrics = $derived({
		certified: {
			icon: Landmark,
			tooltip: 'Delivered through Congressional Web Communication system',
			value: `${formatNumber(template.metrics.sent)} sent`,
			secondaryIcon: MapPin,
			secondaryTooltip: 'Percentage of congressional districts covered by this campaign',
			secondaryValue: `${getDistrictCoverage(template)} districts covered`
		},
		direct: {
			icon: Building2,
			tooltip: 'Direct email outreach to decision makers',
			value: `${formatNumber(template.metrics.sent)} sent`,
			secondaryIcon: template.metrics.clicked > 1 ? Users : User,
			secondaryTooltip: 'Total recipient addresses targeted',
			secondaryValue: `${formatNumber(template.metrics.clicked)} recipients`
		}
	} as const);

	const currentMetric = $derived(typeMetrics[badgeType]);
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
