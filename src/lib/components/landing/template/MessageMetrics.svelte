<script lang="ts">
	import { Send, Landmark, Building2, MapPin, User, Users, Info } from '@lucide/svelte';
	import type { Template } from '$lib/types/template';
	import { extractRecipientEmails } from '$lib/types/templateConfig';
	import SimpleTooltip from '$lib/components/ui/SimpleTooltip.svelte';

	interface Props {
		template: Template;
	}

	const { template }: Props = $props();

	// Normalize metrics data - handle both object and JSON string formats
	function normalizeMetrics(rawMetrics: unknown): {
		sent?: number;
		delivered?: number;
		opened?: number;
		clicked?: number;
		responded?: number;
		responses?: number;
		views?: number;
		districts_covered?: number;
		total_districts?: number;
		district_coverage_percent?: number;
	} {
		if (!rawMetrics) return {};

		// If it's already an object, return it
		if (typeof rawMetrics === 'object') return rawMetrics;

		// If it's a JSON string, parse it
		try {
			return JSON.parse(rawMetrics);
		} catch {
			console.warn('Failed to parse metrics JSON:', rawMetrics);
			return {};
		}
	}

	// Get normalized metrics
	const metrics = $derived(normalizeMetrics(template.metrics));

	// Calculate recipient count for direct email templates
	const recipientCount = $derived(
		// Use pre-computed recipientEmails from API if available
		template.recipientEmails && Array.isArray(template.recipientEmails)
			? template.recipientEmails.length
			: // Fallback to parsing recipient_config
				extractRecipientEmails(
					typeof template.recipient_config === 'string'
						? JSON.parse(template.recipient_config)
						: template.recipient_config
				).length
	);

	// Format numbers with commas, handle undefined/null values
	function formatNumber(num: number | undefined | null): string {
		if (num === undefined || num === null || isNaN(num)) {
			return '0';
		}
		return num.toLocaleString();
	}

	// Determine badge type based on delivery method
	const badgeType = $derived(
		template.deliveryMethod === 'cwc' ? 'certified' : ('direct' as 'certified' | 'direct')
	);

	// For templates with recipients, always show recipient count regardless of delivery method
	const shouldShowRecipients = $derived(recipientCount > 0);

	// Calculate district coverage for congressional templates
	function getDistrictCoverage(normalizedMetrics: ReturnType<typeof normalizeMetrics>): string {
		// Use the pre-calculated percentage if available
		if (normalizedMetrics.district_coverage_percent !== undefined) {
			return `${normalizedMetrics.district_coverage_percent}%`;
		}

		// Fallback: calculate from districts_covered and total_districts
		if (normalizedMetrics.districts_covered && normalizedMetrics.total_districts) {
			const percentage = Math.round(
				(normalizedMetrics.districts_covered / normalizedMetrics.total_districts) * 100
			);
			return `${percentage}%`;
		}

		// Legacy fallback: use old delivery rate calculation
		const sent = normalizedMetrics.sent || 0;
		const responded = normalizedMetrics.responded || normalizedMetrics.responses || 0;
		if (sent === 0) return '0%';
		return Math.round((responded / sent) * 100) + '%';
	}

	const typeMetrics = $derived({
		certified: {
			icon: Landmark,
			tooltip: 'Delivered through Congressional Web Communication system',
			value: `${formatNumber(metrics.sent)} sent`,
			secondaryIcon: shouldShowRecipients ? (recipientCount > 1 ? Users : User) : MapPin,
			secondaryTooltip: shouldShowRecipients
				? 'Total recipient addresses targeted'
				: 'Percentage of congressional districts covered',
			secondaryValue: shouldShowRecipients
				? `${formatNumber(recipientCount)} recipients`
				: `${getDistrictCoverage(metrics)} districts covered`
		},
		direct: {
			icon: Building2,
			tooltip: 'Direct email outreach to decision makers',
			value: `${formatNumber(metrics.sent)} sent`,
			secondaryIcon: recipientCount > 1 ? Users : User,
			secondaryTooltip: 'Total recipient addresses targeted',
			secondaryValue: `${formatNumber(recipientCount)} recipients`
		}
	} as const);

	const currentMetric = $derived(typeMetrics[badgeType]);

	// Simple tooltip state
	let hoveredTooltip = $state<'sent' | 'recipients' | null>(null);
</script>

<div class="min-w-0 max-w-full space-y-2 text-sm">
	<div class="flex max-w-fit items-center gap-2 text-slate-500">
		<Send class="h-4 w-4 shrink-0" />
		<span class="min-w-0 flex-1">
			{formatNumber(metrics.sent)} sent
		</span>
		<div class="relative z-50">
			<Info
				class="h-4 w-4 shrink-0 cursor-help text-slate-400"
				onmouseenter={() => (hoveredTooltip = 'sent')}
				onmouseleave={() => (hoveredTooltip = null)}
			/>

			<SimpleTooltip
				content="Total messages sent using this template"
				placement="right"
				show={hoveredTooltip === 'sent'}
			/>
		</div>
	</div>

	<div class="flex max-w-fit items-center gap-2 text-slate-500">
		{#snippet secondaryIconSnippet()}
			{@const SecondaryIconComponent = currentMetric.secondaryIcon}
			<SecondaryIconComponent class="h-4 w-4 shrink-0" />
		{/snippet}
		{@render secondaryIconSnippet()}
		<span class="min-w-0 flex-1">
			{currentMetric.secondaryValue}
		</span>
		<div class="relative z-50">
			<Info
				class="h-4 w-4 shrink-0 cursor-help text-slate-400"
				onmouseenter={() => (hoveredTooltip = 'recipients')}
				onmouseleave={() => (hoveredTooltip = null)}
			/>

			<SimpleTooltip
				content={currentMetric.secondaryTooltip}
				placement="right"
				show={hoveredTooltip === 'recipients'}
			/>
		</div>
	</div>
</div>
