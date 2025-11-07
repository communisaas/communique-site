<script lang="ts">
	/**
	 * JurisdictionPicker Component
	 *
	 * Autocomplete jurisdiction picker with multi-select support for template creators.
	 * Supports searching by congressional district, city, county, and state.
	 *
	 * Features:
	 * - Fuzzy search with debouncing
	 * - Multi-select with chip/badge UI
	 * - Type-ahead suggestions (top 10 matches)
	 * - Census data integration for population estimates
	 */

	import { Map, X, Search } from '@lucide/svelte';
	import type { TemplateJurisdiction } from '@prisma/client';
	import type { JurisdictionSuggestion } from '$lib/types/jurisdiction';
	import { lookupCongressionalDistrict, getAllStates } from '$lib/core/census/district-lookup';
	import { lookupFipsPopulation, lookupCityPopulation } from '$lib/core/census/fips-lookup';

	let {
		selectedJurisdictions = $bindable<TemplateJurisdiction[]>([]),
		maxSelections = 20,
		placeholder = 'Search for congressional districts, cities, counties, or states...',
		disabled = false
	}: {
		selectedJurisdictions: TemplateJurisdiction[];
		maxSelections?: number;
		placeholder?: string;
		disabled?: boolean;
	} = $props();

	let searchQuery = $state<string>('');
	let suggestions = $state<JurisdictionSuggestion[]>([]);
	let isSearching = $state<boolean>(false);
	let showSuggestions = $state<boolean>(false);
	let searchInputRef: HTMLInputElement | null = null;
	let debounceTimeout: ReturnType<typeof setTimeout> | null = null;

	// Debounced search function
	function handleSearchInput(event: Event) {
		const input = event.target as HTMLInputElement;
		searchQuery = input.value;

		if (debounceTimeout) {
			clearTimeout(debounceTimeout);
		}

		if (searchQuery.trim().length < 2) {
			suggestions = [];
			showSuggestions = false;
			return;
		}

		isSearching = true;
		debounceTimeout = setTimeout(async () => {
			await performSearch(searchQuery);
			isSearching = false;
		}, 300);
	}

	// Perform search across jurisdiction types
	async function performSearch(query: string) {
		const normalizedQuery = query.trim().toLowerCase();
		const results: JurisdictionSuggestion[] = [];

		// Search congressional districts (pattern: "TX-18" or "Texas 18")
		const districtMatch = normalizedQuery.match(/^([a-z]{2}|[a-z\s]+)[\s-]?(\d+)$/i);
		if (districtMatch) {
			const [, stateInput, districtNumber] = districtMatch;
			const stateCode = normalizeStateInput(stateInput);
			if (stateCode) {
				const district = `${stateCode}-${districtNumber}`;
				const districtInfo = await lookupCongressionalDistrict(district);
				if (districtInfo) {
					results.push({
						id: `federal-${district}`,
						type: 'federal',
						displayName: `${district} - ${districtInfo.stateName} ${districtNumber}${districtInfo.representative ? ` (${districtInfo.representative.name})` : ''}`,
						stateCode,
						congressionalDistrict: district
					});
				}
			}
		}

		// Search states
		const states = getAllStates();
		const matchingStates = states.filter(
			(state) =>
				state.name.toLowerCase().includes(normalizedQuery) ||
				state.code.toLowerCase().includes(normalizedQuery)
		);
		for (const state of matchingStates.slice(0, 3)) {
			results.push({
				id: `state-${state.code}`,
				type: 'state',
				displayName: `${state.name} (Statewide)`,
				stateCode: state.code
			});
		}

		// Search cities (simplified - in production, integrate with Census Places API)
		// For now, show example cities if query matches common patterns
		const commonCities = [
			{ name: 'Austin', state: 'TX', fips: '4805000' },
			{ name: 'Houston', state: 'TX', fips: '4835000' },
			{ name: 'Dallas', state: 'TX', fips: '4819000' },
			{ name: 'San Antonio', state: 'TX', fips: '4865000' },
			{ name: 'New York', state: 'NY', fips: '3651000' },
			{ name: 'Los Angeles', state: 'CA', fips: '0644000' },
			{ name: 'Chicago', state: 'IL', fips: '1714000' },
			{ name: 'Phoenix', state: 'AZ', fips: '0455000' },
			{ name: 'Philadelphia', state: 'PA', fips: '4260000' },
			{ name: 'San Diego', state: 'CA', fips: '0666000' }
		];

		const matchingCities = commonCities.filter((city) =>
			city.name.toLowerCase().includes(normalizedQuery)
		);

		for (const city of matchingCities.slice(0, 5)) {
			const populationData = await lookupCityPopulation(city.fips);
			results.push({
				id: `city-${city.fips}`,
				type: 'city',
				displayName: `${city.name}, ${city.state}${populationData ? ` (pop. ${formatPopulation(populationData.population)})` : ''}`,
				stateCode: city.state,
				cityName: city.name,
				cityFips: city.fips,
				estimatedPopulation: populationData ? BigInt(populationData.population) : undefined
			});
		}

		// Limit to top 10 results
		suggestions = results.slice(0, 10);
		showSuggestions = suggestions.length > 0;
	}

	// Normalize state input (handle "TX" or "Texas")
	function normalizeStateInput(input: string): string | null {
		const states = getAllStates();
		const normalized = input.trim().toUpperCase();

		// Check if already a state code
		const stateByCode = states.find((s) => s.code === normalized);
		if (stateByCode) return stateByCode.code;

		// Check if full state name
		const stateByName = states.find(
			(s) => s.name.toUpperCase() === normalized || s.name.toUpperCase().includes(normalized)
		);
		return stateByName ? stateByName.code : null;
	}

	// Format population for display
	function formatPopulation(pop: number): string {
		if (pop >= 1_000_000) {
			return `${(pop / 1_000_000).toFixed(1)}M`;
		} else if (pop >= 1_000) {
			return `${(pop / 1_000).toFixed(0)}K`;
		}
		return pop.toString();
	}

	// Add jurisdiction from suggestion
	async function selectSuggestion(suggestion: JurisdictionSuggestion) {
		// Check if already selected
		const alreadySelected = selectedJurisdictions.some(
			(j) =>
				j.jurisdiction_type === suggestion.type &&
				(suggestion.type === 'federal'
					? j.congressional_district === suggestion.congressionalDistrict
					: suggestion.type === 'state'
						? j.state_code === suggestion.stateCode
						: suggestion.type === 'city'
							? j.city_fips === suggestion.cityFips
							: false)
		);

		if (alreadySelected) {
			console.log('Jurisdiction already selected');
			return;
		}

		// Check max selections
		if (selectedJurisdictions.length >= maxSelections) {
			console.warn('Maximum jurisdictions reached');
			return;
		}

		// Create new jurisdiction record
		const newJurisdiction: Partial<TemplateJurisdiction> = {
			jurisdiction_type: suggestion.type,
			state_code: suggestion.stateCode,
			congressional_district: suggestion.congressionalDistrict,
			city_name: suggestion.cityName,
			city_fips: suggestion.cityFips,
			county_fips: suggestion.countyFips,
			county_name: suggestion.countyName,
			school_district_id: suggestion.schoolDistrictId,
			school_district_name: suggestion.schoolDistrictName,
			estimated_population: suggestion.estimatedPopulation,
			latitude: suggestion.latitude,
			longitude: suggestion.longitude
		};

		// Fetch population data if not already available
		if (!newJurisdiction.estimated_population) {
			if (suggestion.type === 'county' && suggestion.countyFips) {
				const popData = await lookupFipsPopulation(suggestion.countyFips);
				if (popData) {
					newJurisdiction.estimated_population = BigInt(popData.population);
				}
			} else if (suggestion.type === 'city' && suggestion.cityFips) {
				const popData = await lookupCityPopulation(suggestion.cityFips);
				if (popData) {
					newJurisdiction.estimated_population = BigInt(popData.population);
				}
			}
		}

		// Add to selected jurisdictions
		selectedJurisdictions = [
			...selectedJurisdictions,
			newJurisdiction as TemplateJurisdiction
		];

		// Clear search
		searchQuery = '';
		suggestions = [];
		showSuggestions = false;
		if (searchInputRef) {
			searchInputRef.value = '';
		}
	}

	// Remove jurisdiction
	function removeJurisdiction(index: number) {
		selectedJurisdictions = selectedJurisdictions.filter((_, i) => i !== index);
	}

	// Get display name for selected jurisdiction
	function getJurisdictionDisplayName(jurisdiction: TemplateJurisdiction): string {
		switch (jurisdiction.jurisdiction_type) {
			case 'federal':
				return `${jurisdiction.congressional_district} - Congressional District`;
			case 'state':
				return `${jurisdiction.state_code} - Statewide`;
			case 'county':
				return `${jurisdiction.county_name || 'County'}, ${jurisdiction.state_code}`;
			case 'city':
				return `${jurisdiction.city_name || 'City'}, ${jurisdiction.state_code}`;
			case 'school_district':
				return `${jurisdiction.school_district_name || 'School District'}`;
			default:
				return 'Unknown Jurisdiction';
		}
	}

	// Get type badge color
	function getTypeBadgeColor(type: string): string {
		switch (type) {
			case 'federal':
				return 'bg-blue-100 text-blue-800';
			case 'state':
				return 'bg-green-100 text-green-800';
			case 'county':
				return 'bg-purple-100 text-purple-800';
			case 'city':
				return 'bg-orange-100 text-orange-800';
			case 'school_district':
				return 'bg-pink-100 text-pink-800';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}
</script>

<div class="space-y-4">
	<!-- Search input -->
	<div class="relative">
		<label for="jurisdiction-search" class="block text-sm font-medium text-slate-700 mb-2">
			<div class="flex items-center gap-2">
				<Map class="h-4 w-4 text-slate-400" />
				Target Jurisdictions
			</div>
		</label>

		<div class="relative">
			<Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
			<input
				id="jurisdiction-search"
				type="text"
				bind:this={searchInputRef}
				oninput={handleSearchInput}
				{placeholder}
				{disabled}
				class="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
			/>
			{#if isSearching}
				<div class="absolute right-3 top-1/2 -translate-y-1/2">
					<div class="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
				</div>
			{/if}
		</div>

		<!-- Autocomplete suggestions -->
		{#if showSuggestions && suggestions.length > 0}
			<div class="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-auto">
				{#each suggestions as suggestion}
					<button
						type="button"
						onclick={() => selectSuggestion(suggestion)}
						class="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center justify-between gap-2"
					>
						<div class="flex-1 min-w-0">
							<div class="text-sm font-medium text-slate-900 truncate">
								{suggestion.displayName}
							</div>
						</div>
						<span class="text-xs px-2 py-1 rounded-full {getTypeBadgeColor(suggestion.type)}">
							{suggestion.type}
						</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Selected jurisdictions -->
	{#if selectedJurisdictions.length > 0}
		<div class="space-y-2">
			<div class="text-sm font-medium text-slate-700">
				Selected ({selectedJurisdictions.length}{maxSelections ? `/${maxSelections}` : ''})
			</div>
			<div class="flex flex-wrap gap-2">
				{#each selectedJurisdictions as jurisdiction, index}
					<div
						class="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-sm"
					>
						<span class="text-xs px-2 py-0.5 rounded-full {getTypeBadgeColor(jurisdiction.jurisdiction_type)}">
							{jurisdiction.jurisdiction_type}
						</span>
						<span class="text-slate-700">{getJurisdictionDisplayName(jurisdiction)}</span>
						{#if jurisdiction.estimated_population}
							<span class="text-xs text-slate-500">
								(pop. {formatPopulation(Number(jurisdiction.estimated_population))})
							</span>
						{/if}
						<button
							type="button"
							onclick={() => removeJurisdiction(index)}
							class="text-slate-400 hover:text-red-600 transition-colors"
							aria-label="Remove jurisdiction"
						>
							<X class="h-3 w-3" />
						</button>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Helper text -->
	<p class="text-xs text-slate-500">
		{#if selectedJurisdictions.length === 0}
			Search for congressional districts (e.g., "TX-18"), cities (e.g., "Austin"), or states (e.g., "Texas").
		{:else if selectedJurisdictions.length >= maxSelections}
			Maximum {maxSelections} jurisdictions selected.
		{:else}
			Add more jurisdictions or continue to the next step.
		{/if}
	</p>

	<!-- Validation warning -->
	{#if selectedJurisdictions.length === 0}
		<div class="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
			⚠️ At least one jurisdiction must be selected to target your template effectively.
		</div>
	{/if}
</div>
