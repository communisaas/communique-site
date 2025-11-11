<script lang="ts">
	/**
	 * CoveragePreview Component
	 *
	 * Shows estimated reach and coverage breakdown for selected jurisdictions.
	 * Provides visual feedback on template applicability and suggests broadening scope if needed.
	 */

	import { Users, AlertTriangle, CheckCircle, TrendingUp } from '@lucide/svelte';
	import type { TemplateJurisdiction } from '@prisma/client';
	import type { CoverageData } from '$lib/types/jurisdiction';

	let {
		jurisdictions = []
	}: {
		jurisdictions: TemplateJurisdiction[];
	} = $props();

	// Calculate coverage data
	const coverageData = $derived<CoverageData>(() => {
		if (jurisdictions.length === 0) {
			return {
				totalPopulation: BigInt(0),
				jurisdictionBreakdown: [],
				congressionalDistricts: [],
				statesAffected: []
			};
		}

		let totalPopulation = BigInt(0);
		const typeBreakdown = new Map<string, { count: number; population: bigint }>();
		const districts = new Set<string>();
		const states = new Set<string>();

		for (const jurisdiction of jurisdictions) {
			// Accumulate population
			if (jurisdiction.estimated_population) {
				totalPopulation += BigInt(jurisdiction.estimated_population);
			}

			// Count by type
			const existing = typeBreakdown.get(jurisdiction.jurisdiction_type) || {
				count: 0,
				population: BigInt(0)
			};
			typeBreakdown.set(jurisdiction.jurisdiction_type, {
				count: existing.count + 1,
				population: existing.population + BigInt(jurisdiction.estimated_population || 0)
			});

			// Track congressional districts
			if (jurisdiction.congressional_district) {
				districts.add(jurisdiction.congressional_district);
			}

			// Track states
			if (jurisdiction.state_code) {
				states.add(jurisdiction.state_code);
			}
		}

		return {
			totalPopulation,
			jurisdictionBreakdown: Array.from(typeBreakdown.entries()).map(([type, data]) => ({
				type: type as 'federal' | 'state' | 'county' | 'city' | 'school_district',
				count: data.count,
				population: data.population
			})),
			congressionalDistricts: Array.from(districts),
			statesAffected: Array.from(states)
		};
	});

	// Check if scope is too narrow
	const isTooNarrow = $derived<boolean>(
		jurisdictions.length === 1 && jurisdictions[0]?.jurisdiction_type === 'city'
	);

	// Check if scope is appropriate
	const isAppropriate = $derived<boolean>(jurisdictions.length > 0 && !isTooNarrow);

	// Format large numbers
	function formatNumber(num: bigint): string {
		const n = Number(num);
		if (n >= 1_000_000_000) {
			return `${(n / 1_000_000_000).toFixed(1)}B`;
		} else if (n >= 1_000_000) {
			return `${(n / 1_000_000).toFixed(1)}M`;
		} else if (n >= 1_000) {
			return `${(n / 1_000).toFixed(1)}K`;
		}
		return n.toString();
	}

	// Get type display name
	function getTypeDisplayName(type: string): string {
		switch (type) {
			case 'federal':
				return 'Congressional Districts';
			case 'state':
				return 'States';
			case 'county':
				return 'Counties';
			case 'city':
				return 'Cities';
			case 'school_district':
				return 'School Districts';
			default:
				return 'Jurisdictions';
		}
	}

	// Get type color
	function getTypeColor(type: string): string {
		switch (type) {
			case 'federal':
				return 'text-blue-600 bg-blue-50';
			case 'state':
				return 'text-green-600 bg-green-50';
			case 'county':
				return 'text-purple-600 bg-purple-50';
			case 'city':
				return 'text-orange-600 bg-orange-50';
			case 'school_district':
				return 'text-pink-600 bg-pink-50';
			default:
				return 'text-gray-600 bg-gray-50';
		}
	}
</script>

{#if jurisdictions.length > 0}
	<div class="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
		<!-- Header -->
		<div class="flex items-center justify-between">
			<h3 class="flex items-center gap-2 text-sm font-semibold text-slate-900">
				<TrendingUp class="h-4 w-4" />
				Coverage Preview
			</h3>
			{#if isAppropriate}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs text-green-700"
				>
					<CheckCircle class="h-3 w-3" />
					Good reach
				</span>
			{:else if isTooNarrow}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-700"
				>
					<AlertTriangle class="h-3 w-3" />
					Limited reach
				</span>
			{/if}
		</div>

		<!-- Total reach -->
		<div class="rounded-lg border border-slate-200 bg-white p-4">
			<div class="flex items-center gap-3">
				<div class="rounded-lg bg-blue-100 p-2">
					<Users class="h-5 w-5 text-blue-600" />
				</div>
				<div>
					<div class="text-2xl font-bold text-slate-900">
						{formatNumber(coverageData.totalPopulation)}
					</div>
					<div class="text-sm text-slate-600">Estimated reach (population)</div>
				</div>
			</div>
		</div>

		<!-- Breakdown by type -->
		{#if coverageData.jurisdictionBreakdown.length > 0}
			<div class="space-y-2">
				<div class="text-xs font-medium text-slate-700">Coverage Breakdown</div>
				<div class="space-y-2">
					{#each coverageData.jurisdictionBreakdown as breakdown}
						<div
							class="flex items-center justify-between rounded p-2 {getTypeColor(breakdown.type)}"
						>
							<span class="text-sm font-medium">
								{getTypeDisplayName(breakdown.type)}
							</span>
							<div class="text-right">
								<div class="text-sm font-semibold">{breakdown.count}</div>
								{#if breakdown.population > 0}
									<div class="text-xs opacity-75">
										{formatNumber(breakdown.population)} people
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Geographic summary -->
		<div class="grid grid-cols-2 gap-3 text-sm">
			{#if coverageData.statesAffected.length > 0}
				<div class="rounded border border-slate-200 bg-white p-3">
					<div class="font-medium text-slate-900">{coverageData.statesAffected.length}</div>
					<div class="text-xs text-slate-600">
						State{coverageData.statesAffected.length !== 1 ? 's' : ''}
					</div>
				</div>
			{/if}
			{#if coverageData.congressionalDistricts.length > 0}
				<div class="rounded border border-slate-200 bg-white p-3">
					<div class="font-medium text-slate-900">{coverageData.congressionalDistricts.length}</div>
					<div class="text-xs text-slate-600">
						District{coverageData.congressionalDistricts.length !== 1 ? 's' : ''}
					</div>
				</div>
			{/if}
		</div>

		<!-- Warnings and suggestions -->
		{#if isTooNarrow}
			<div class="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
				<div class="flex items-start gap-2">
					<AlertTriangle class="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
					<div class="text-xs text-yellow-800">
						<div class="mb-1 font-medium">Limited reach detected</div>
						<div>
							Templates targeting a single city may have limited impact. Consider broadening your
							scope to include neighboring districts, the full county, or multiple cities to
							maximize effectiveness.
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Success message for good coverage -->
		{#if isAppropriate && coverageData.totalPopulation > 500000}
			<div class="rounded-lg border border-green-200 bg-green-50 p-3">
				<div class="flex items-start gap-2">
					<CheckCircle class="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
					<div class="text-xs text-green-800">
						<div class="font-medium">Strong reach potential</div>
						<div>
							Your template will reach a substantial audience. Make sure your message is relevant
							across all selected jurisdictions for maximum impact.
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
{:else}
	<!-- Empty state -->
	<div class="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center">
		<Users class="mx-auto mb-2 h-8 w-8 text-slate-400" />
		<div class="mb-1 text-sm font-medium text-slate-700">No jurisdictions selected</div>
		<div class="text-xs text-slate-500">
			Add jurisdictions above to see estimated reach and coverage breakdown
		</div>
	</div>
{/if}
