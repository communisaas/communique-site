<script lang="ts">
	import { Send, Users, MapPin, ChevronRight } from '@lucide/svelte';
	import type { Template } from '$lib/types/template';
	import Badge from '$lib/components/ui/Badge.svelte';
	import SimpleTooltip from '$lib/components/ui/SimpleTooltip.svelte';

	interface Props {
		template: Template;
		variant?: 'grid' | 'list';
		onSelect?: () => void;
	}

	const { template, variant = 'grid', onSelect }: Props = $props();

	// Normalize metrics data - handle both object and JSON string formats
	function normalizeMetrics(rawMetrics: unknown): {
		sent?: number;
		districts_covered?: number;
		total_districts?: number;
		district_coverage_percent?: number;
	} {
		if (!rawMetrics) return {};

		// If it's already an object, return it
		if (typeof rawMetrics === 'object') return rawMetrics as Record<string, number>;

		// If it's a JSON string, parse it
		try {
			return JSON.parse(rawMetrics as string) as Record<string, number>;
		} catch {
			return {};
		}
	}

	const metrics = $derived(normalizeMetrics(template.metrics));
	const isCongressional = $derived(template.deliveryMethod === 'cwc');

	// Format numbers with commas
	function formatNumber(num: number | undefined | null): string {
		if (num === undefined || num === null || isNaN(num)) {
			return '0';
		}
		return num.toLocaleString();
	}

	// Calculate district coverage percentage
	function getDistrictCoverage(): string {
		// Use pre-calculated percentage if available
		if (metrics.district_coverage_percent !== undefined) {
			return `${metrics.district_coverage_percent}%`;
		}

		// Fallback: calculate from districts_covered and total_districts
		if (metrics.districts_covered && metrics.total_districts) {
			const percentage = Math.round((metrics.districts_covered / metrics.total_districts) * 100);
			return `${percentage}%`;
		}

		return '0%';
	}

	// Tooltip state
	let hoveredMetric = $state<'sent' | 'districts' | null>(null);

	// For use with verified_sends aggregate metric (Phase 1: mock data)
	const verifiedSends = $derived(template.send_count || metrics.sent || 0);
	const uniqueDistricts = $derived(metrics.districts_covered || 0);
</script>

<button
	type="button"
	class="group relative flex w-full flex-col overflow-hidden rounded-lg border-2 border-l-4 bg-white text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
	class:border-congressional-400={isCongressional}
	class:border-direct-400={!isCongressional}
	class:border-l-congressional-500={isCongressional}
	class:border-l-direct-500={!isCongressional}
	class:border-slate-200={!isCongressional && !isCongressional}
	class:hover:border-slate-300={true}
	style="will-change: transform; backface-visibility: hidden;"
	onclick={onSelect}
	data-testid="template-card-{template.id}"
>
	<!-- Header Section -->
	<div class="flex flex-col gap-3 p-4">
		<!-- Badges -->
		<div class="flex flex-wrap items-center gap-2">
			<Badge variant={isCongressional ? 'congressional' : 'direct'} size="sm">
				{isCongressional ? 'Congressional' : 'Direct'}
			</Badge>
			<span class="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 md:text-sm">
				{template.category}
			</span>
		</div>

		<!-- Title -->
		<h3
			class="line-clamp-2 text-lg font-semibold text-gray-900 group-hover:text-gray-700 md:text-xl"
		>
			{template.title}
		</h3>

		<!-- Description -->
		<p class="line-clamp-3 text-sm text-gray-600 md:text-base">
			{template.description}
		</p>
	</div>

	<!-- Metrics Section -->
	<div class="mt-auto border-t border-gray-100 bg-gray-50/50 p-4">
		<div class="flex items-center justify-between gap-4">
			<!-- Verified Sends Metric -->
			<div class="flex items-center gap-2 text-sm text-slate-600">
				<Send class="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
				<span class="font-medium">{formatNumber(verifiedSends)}</span>
				<span class="text-slate-500">sent</span>
			</div>

			{#if isCongressional && uniqueDistricts > 0}
				<!-- Congressional: Districts Covered Metric -->
				<div class="relative flex items-center gap-2 text-sm text-slate-600">
					<MapPin class="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
					<span class="font-medium">{formatNumber(uniqueDistricts)}</span>
					<span class="text-slate-500">districts</span>
					<!-- Info icon - changed from button to span to avoid nested button hydration issue -->
					<span
						class="cursor-help text-slate-400 hover:text-slate-600"
						onmouseenter={() => (hoveredMetric = 'districts')}
						onmouseleave={() => (hoveredMetric = null)}
						role="tooltip"
						aria-label="District coverage information"
					>
						<svg
							class="h-4 w-4"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							></path>
						</svg>
					</span>

					<SimpleTooltip
						content="{getDistrictCoverage()} of congressional districts reached"
						placement="top"
						show={hoveredMetric === 'districts'}
					/>
				</div>
			{:else}
				<!-- Direct Email: Recipients Count (mock for now) -->
				<div class="flex items-center gap-2 text-sm text-slate-600">
					<Users class="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
					<span class="font-medium">{formatNumber(verifiedSends)}</span>
					<span class="text-slate-500">voices</span>
				</div>
			{/if}

			<!-- Action Arrow -->
			<ChevronRight
				class="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-slate-600"
				aria-hidden="true"
			/>
		</div>
	</div>
</button>
