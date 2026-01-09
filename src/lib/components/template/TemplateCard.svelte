<script lang="ts">
	import { Send, Users, MapPin, ChevronRight, Building2, Landmark, Mail } from '@lucide/svelte';
	import type { Template } from '$lib/types/template';
	import { deriveTargetPresentation } from '$lib/utils/deriveTargetPresentation';
	import SimpleTooltip from '$lib/components/ui/SimpleTooltip.svelte';

	interface Props {
		template: Template;
		variant?: 'grid' | 'list';
		onSelect?: () => void;
	}

	const { template, variant = 'grid', onSelect }: Props = $props();

	// Derive perceptual representation
	const targetInfo = $derived(deriveTargetPresentation(template));

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
	const isCongressional = $derived(targetInfo.type === 'district-based');

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

	// Pre-launch: Hide engagement metrics when zero (no negative social proof)
	// Post-launch: Remove this check to reveal real engagement data
	const hasEngagement = $derived(verifiedSends > 0 || uniqueDistricts > 0);

	// High-activity threshold for atmospheric effects
	const isHighActivity = $derived(verifiedSends > 100);

	// === PERCEPTUAL ENCODING: Visual weight based on coordination magnitude ===
	// Subtle scale transformation: 1.0 (baseline) to 1.15 (high coordination)
	// Logarithmic encoding makes peripheral detection possible before reading text
	const cardScale = $derived(1.0 + template.coordinationScale * 0.15);
</script>

<button
	type="button"
	class="group relative flex w-full flex-col overflow-hidden rounded-xl border-l-4 bg-white/80 text-left shadow-atmospheric-card backdrop-blur-sm transition-all duration-300 hover:shadow-atmospheric-card-hover {isCongressional
		? 'border-congressional-200/50 border-l-congressional-500 hover:border-congressional-200/80'
		: 'border-direct-200/50 border-l-direct-500 hover:border-direct-200/80'}"
	style="transform: scale({cardScale}); transform-origin: center; will-change: transform; backface-visibility: hidden; border-width: 1px; border-left-width: 4px;"
	onclick={onSelect}
	data-testid="template-card-{template.id}"
>
	<!-- New Badge: Temporal signal (top-right corner) -->
	{#if template.isNew}
		<span
			class="absolute right-3 top-3 z-10 rounded bg-cyan-500 px-2 py-1 font-brand text-[0.6875rem] font-bold uppercase tracking-wide text-white shadow-sm"
		>
			New
		</span>
	{/if}

	<!-- Header Section -->
	<div class="flex flex-col gap-3 p-4">
		<!-- Power Topology: Decision-maker names (recognition > categorization) -->
		<div
			class="flex items-center gap-2 text-sm"
			class:text-blue-600={targetInfo.emphasis === 'federal'}
			class:text-green-600={targetInfo.emphasis === 'local'}
			class:text-slate-600={targetInfo.emphasis === 'neutral'}
		>
			{#if targetInfo.icon === 'Capitol'}
				<Landmark class="h-4 w-4 shrink-0 opacity-70" />
			{:else if targetInfo.icon === 'Building'}
				<Building2 class="h-4 w-4 shrink-0 opacity-70" />
			{:else if targetInfo.icon === 'Mail'}
				<Mail class="h-4 w-4 shrink-0 opacity-70" />
			{:else}
				<Users class="h-4 w-4 shrink-0 opacity-70" />
			{/if}
			<span class="font-brand font-medium">{targetInfo.primary}</span>
			{#if targetInfo.secondary}
				<span class="font-brand text-xs opacity-70">{targetInfo.secondary}</span>
			{/if}
		</div>

		<!-- Title: Satoshi Bold for distinctive brand voice -->
		<h3
			class="line-clamp-2 font-brand text-lg font-bold text-gray-900 group-hover:text-gray-700 md:text-xl"
		>
			{template.title}
		</h3>

		<!-- Description: Satoshi Regular for readable body text -->
		<p class="line-clamp-3 font-brand text-sm text-gray-600 md:text-base">
			{template.description}
		</p>
	</div>

	<!-- Footer Section: Action arrow always visible, metrics only when meaningful -->
	<div
		class="mt-auto border-t border-slate-100/50 bg-gradient-to-br from-slate-50/30 to-violet-50/10 p-4"
	>
		<div class="flex items-center justify-between gap-4">
			{#if hasEngagement}
				<!-- Metrics Section: Only show when there's real engagement (post-launch) -->
				<!-- Verified Sends Metric: JetBrains Mono with gradient for high activity -->
				<div class="relative flex items-center gap-2 text-sm text-slate-600">
					<Users
						class="h-4 w-4 shrink-0 {isHighActivity ? 'text-violet-500' : 'text-slate-500'}"
						aria-hidden="true"
					/>
					<span
						class="font-mono font-medium tabular-nums"
						class:bg-gradient-to-br={isHighActivity}
						class:from-violet-600={isHighActivity}
						class:to-purple-600={isHighActivity}
						class:bg-clip-text={isHighActivity}
						class:text-transparent={isHighActivity}
					>
						{formatNumber(verifiedSends)}
					</span>
					<span class="font-brand text-slate-500">sent</span>
					{#if targetInfo.coordinationContext}
						<span class="font-brand text-xs text-slate-400"
							>in {targetInfo.coordinationContext}</span
						>
					{/if}
				</div>

				{#if isCongressional && uniqueDistricts > 0}
					<!-- Congressional: Districts Covered Metric -->
					<div class="relative flex items-center gap-2 text-sm text-slate-600">
						<MapPin class="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
						<span class="font-mono font-medium tabular-nums">{formatNumber(uniqueDistricts)}</span>
						<span class="font-brand text-slate-500">districts</span>
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
				{:else if hasEngagement}
					<!-- Direct Email: Voices count -->
					<div class="flex items-center gap-2 text-sm text-slate-600">
						<Users class="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
						<span class="font-mono font-medium tabular-nums">{formatNumber(verifiedSends)}</span>
						<span class="font-brand text-slate-500">voices</span>
					</div>
				{/if}
			{:else}
				<!-- Pre-launch: Spacer to maintain layout balance with action arrow -->
				<div class="flex-1"></div>
			{/if}

			<!-- Action Arrow: Always visible -->
			<ChevronRight
				class="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-slate-600"
				aria-hidden="true"
			/>
		</div>
	</div>
</button>
