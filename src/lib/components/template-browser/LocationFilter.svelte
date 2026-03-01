<script lang="ts">
	/**
	 * LocationFilter: Privacy-preserving location inference with consumer-friendly UX
	 *
	 * DESIGN PHILOSOPHY:
	 * - Trust through subtlety, not aggression
	 * - Progressive disclosure of technical details
	 * - Familiar patterns from Google Maps, Airbnb, Stripe
	 * - Confidence scoring feels like quality indicators
	 *
	 * FUNCTIONALITY:
	 * - Client-side location inference using 5 signals (IP, browser, OAuth, behavioral, verified)
	 * - All data stored in browser IndexedDB (never sent to server)
	 * - Filters templates by geographic relevance
	 * - VPN-resistant through multi-signal consensus
	 *
	 * PRIVACY ARCHITECTURE:
	 * - Zero server-side location tracking
	 * - All computation happens in browser
	 * - Progressive disclosure: simple → intermediate → advanced
	 */

	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type {
		InferredLocation,
		TemplateWithJurisdictions,
		LocationSignal
	} from '$lib/core/location/types';
	import {
		scoreTemplatesByRelevance,
		boostByUserBehavior,
		type GeographicScope
	} from '$lib/core/location/template-filter';
	import {
		getUserLocation,
		addBrowserGeolocationSignal
	} from '$lib/core/location/inference-engine';
	import { getTemplateViewCounts } from '$lib/core/location/behavioral-tracker';
	import { locationStorage } from '$lib/core/location/storage';
	import type { Template, TemplateGroup } from '$lib/types/template';
	import PrivacyIndicator from './PrivacyBadge.svelte';
	import LocationAutocomplete from './LocationAutocomplete.svelte';
	import type { LocationHierarchy } from '$lib/core/location/location-search';
	import { locationInferenceEngine } from '$lib/core/location/inference-engine';
	import { getStateName } from '$lib/core/location/state-codes';

	interface LocationFilterProps {
		templates: Template[];
		onFilterChange: (groups: TemplateGroup[]) => void;
	}

	let {
		templates = [],
		onFilterChange = () => {}
	}: LocationFilterProps = $props();

	// Helper: Convert ALL CAPS city/county names to Title Case
	function toTitleCase(str: string): string {
		return str
			.toLowerCase()
			.split(' ')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	// State
	let inferredLocation = $state<InferredLocation | null>(null);
	let locationSignals = $state<LocationSignal[]>([]);
	let isLoadingLocation = $state(true);
	let locationError = $state<string | null>(null);
	let isDetectingLocation = $state(false);

	// Geographic scope filter (null = show all, or specific level to filter to)
	// Type is imported from template-filter.ts
	let selectedScope = $state<GeographicScope>(null); // null = show all scopes

	// Computed - ANY location data counts (country, state, county, or district)
	const hasLocation = $derived(
		inferredLocation &&
			(inferredLocation.country_code ||
				inferredLocation.state_code ||
				inferredLocation.city_name ||
				inferredLocation.congressional_district)
	);

	// Breadcrumb components for drill-down navigation
	const breadcrumbCountry = $derived.by(() => {
		const countryNames: Record<string, string> = {
			US: 'United States',
			CA: 'Canada',
			GB: 'United Kingdom',
			AU: 'Australia',
			NZ: 'New Zealand',
			IE: 'Ireland'
		};

		// Strategy 1: Explicit country code (highest confidence - from signal metadata)
		if (inferredLocation?.country_code) {
			return countryNames[inferredLocation.country_code] || inferredLocation.country_code;
		}

		// Strategy 2: Inferred country from state code (deterministic for unambiguous codes)
		// Note: 'NT' is ambiguous (CA Northwest Territories vs AU Northern Territory)
		// — excluded from inference; requires explicit country_code.
		if (inferredLocation?.state_code) {
			const stateCode = inferredLocation.state_code;

			const usStates = new Set([
				'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL',
				'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME',
				'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
				'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI',
				'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI',
				'WY', 'PR', 'GU', 'VI', 'AS', 'MP'
			]);
			if (usStates.has(stateCode)) {
				return 'United States';
			}

			// Canadian provinces (NT excluded — ambiguous with Australia)
			const caProvinces = new Set([
				'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'
			]);
			if (caProvinces.has(stateCode)) {
				return 'Canada';
			}

			// Australian states (NT excluded — ambiguous with Canada)
			const auStates = new Set(['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'ACT']);
			if (auStates.has(stateCode)) {
				return 'Australia';
			}
		}

		// No country determinable (no explicit country_code, no inferrable state)
		return null;
	});

	const breadcrumbState = $derived.by(() => {
		if (!inferredLocation?.state_code) return null;
		return getStateName(inferredLocation.state_code);
	});

	const breadcrumbCity = $derived.by(() => {
		if (!inferredLocation?.city_name) return null;
		return toTitleCase(inferredLocation.city_name);
	});

	const breadcrumbCounty = $derived.by(() => {
		const countyName = inferredLocation?.county_name;
		const cityName = inferredLocation?.city_name;

		// Product decision: City is the civic action target, not county
		// County is geographic metadata - only show if no city available
		if (cityName) {
			return null; // Hide county when we have a city
		}

		// Fallback: Show county if no city (rural areas, etc.)
		return countyName ? toTitleCase(countyName) : null;
	});

	const locationLabel = $derived.by(() => {
		if (!inferredLocation) return null;

		const cityName = inferredLocation.city_name;

		// Strategy 1: City name (primary)
		if (cityName) {
			return toTitleCase(cityName);
		}

		// Strategy 2: County only (if no city)
		const countyName = inferredLocation?.county_name;
		if (countyName) {
			return toTitleCase(countyName);
		}

		// Strategy 3: State full name (expand abbreviation as fallback)
		if (inferredLocation.state_code) {
			return getStateName(inferredLocation.state_code);
		}

		return null;
	});

	// Load inferred location using the inference engine
	onMount(async () => {
		try {
			// PRIVACY: Clear non-verified signals once per session, not every mount.
			// First mount in session: wipe stale signals from previous session.
			// Subsequent mounts: skip wipe, use current-session signals from IDB.
			// (sessionStorage is session-scoped — dies when tab closes, preserving privacy)
			if (browser) {
				const SESSION_CLEARED_KEY = 'location_signals_cleared';
				if (!sessionStorage.getItem(SESSION_CLEARED_KEY)) {
					const deletedCount = await locationStorage.clearNonVerifiedSignals();
					if (deletedCount > 0) {
						await locationStorage.clearInferredLocation();
					}
					sessionStorage.setItem(SESSION_CLEARED_KEY, '1');
				}
			}

			// Get user location from inference engine (uses cached if available)
			let location = await getUserLocation();

			if (location && location.confidence > 0) {
				inferredLocation = location;

				// Load signals for transparency display
				if (browser) {
					const signals = await locationStorage.getSignals();
					locationSignals = signals;
				}
			}

			isLoadingLocation = false;
		} catch (error) {
			console.error('[LocationFilter] Error loading location:', error);

			// CRITICAL: Detect corrupted database (DataError indicates schema mismatch)
			const errorMessage = error instanceof Error ? error.message : String(error);
			if (
				errorMessage.includes('DataError') ||
				errorMessage.includes('out-of-line keys') ||
				errorMessage.includes('key parameter was not provided')
			) {
				try {
					// Nuclear option: Delete and recreate database
					await locationStorage.nukeDatabase();

					// Force page reload to recreate database with correct schema
					window.location.reload();
					return; // Don't continue execution
				} catch (nukeError) {
					console.error('[LocationFilter] Database recovery failed:', nukeError);
					locationError = 'Database recovery failed - try clearing browser data';
				}
			} else {
				locationError = 'Unable to load location preferences';
			}

			isLoadingLocation = false;
		}
	});

	/**
	 * Create template groups by geographic precision tier
	 *
	 * Implements progressive section-based grouping (Netflix/YouTube pattern):
	 * - District: Templates matching user's congressional district (score >= 0.95)
	 * - City: Templates matching city/county (score 0.65-0.94)
	 * - State: Templates matching state (score 0.45-0.64)
	 * - Nationwide: Federal templates relevant to all (score 0.25-0.44)
	 *
	 * Within each group, templates sorted by momentum (send_count)
	 *
	 * @param scopeFilter - If set, only show groups at this geographic level
	 */
	function createTemplateGroups(
		scoredTemplates: Array<{ template: Template; score: number }>,
		location: InferredLocation | null,
		scopeFilter: GeographicScope = null
	): TemplateGroup[] {
		const groups: TemplateGroup[] = [];

		// Determine user's current precision level (what sections to show)
		const hasDistrict = location?.congressional_district;
		const hasCity = location?.city_name || location?.county_name;
		const hasState = location?.state_code;

		// Score thresholds for each tier (based on template-filter.ts scoring)
		const THRESHOLDS = {
			district: 0.95, // District match (1.0 score with confidence multiplier)
			city: 0.65, // City/county match (0.7-0.8 base score)
			state: 0.45, // State match (0.5 base score)
			nationwide: 0.25 // Federal baseline (0.3 base score)
		};

		// Group 1: District-level templates (only show if user has district)
		if (hasDistrict && (scopeFilter === null || scopeFilter === 'district')) {
			const districtTemplates = scoredTemplates
				.filter((s) => s.score >= THRESHOLDS.district)
				.sort((a, b) => (b.template.send_count || 0) - (a.template.send_count || 0))
				.map((s) => s.template);

			if (districtTemplates.length > 0) {
				const coordinationCount = districtTemplates.reduce(
					(sum, t) => sum + (t.send_count || 0),
					0
				);

				groups.push({
					title: 'In Your District',
					templates: districtTemplates,
					minScore: THRESHOLDS.district,
					level: 'district',
					coordinationCount
				});
			}
		}

		// Group 2: City-level templates (only show if user has city/county)
		if (hasCity && (scopeFilter === null || scopeFilter === 'city')) {
			const cityTemplates = scoredTemplates
				.filter((s) => s.score >= THRESHOLDS.city && s.score < THRESHOLDS.district)
				.sort((a, b) => (b.template.send_count || 0) - (a.template.send_count || 0))
				.map((s) => s.template);

			if (cityTemplates.length > 0) {
				const coordinationCount = cityTemplates.reduce((sum, t) => sum + (t.send_count || 0), 0);

				// Use city name if available, otherwise "In Your Area"
				const cityName = location?.city_name ? toTitleCase(location.city_name) : null;
				const title = cityName ? `In ${cityName}` : 'In Your Area';

				groups.push({
					title,
					templates: cityTemplates,
					minScore: THRESHOLDS.city,
					level: 'city',
					coordinationCount
				});
			}
		}

		// Group 3: State-level templates (show if user has state)
		if (hasState && (scopeFilter === null || scopeFilter === 'state')) {
			const stateTemplates = scoredTemplates
				.filter((s) => s.score >= THRESHOLDS.state && s.score < THRESHOLDS.city)
				.sort((a, b) => (b.template.send_count || 0) - (a.template.send_count || 0))
				.map((s) => s.template);

			if (stateTemplates.length > 0) {
				const coordinationCount = stateTemplates.reduce((sum, t) => sum + (t.send_count || 0), 0);

				// Get full state name from breadcrumb computation
				const stateName = breadcrumbState || location?.state_code;
				const title = stateName ? `In ${stateName}` : 'Statewide';

				groups.push({
					title,
					templates: stateTemplates,
					minScore: THRESHOLDS.state,
					level: 'state',
					coordinationCount
				});
			}
		}

		// Group 4: Nationwide templates (always show - federal issues affect everyone)
		if (scopeFilter === null || scopeFilter === 'nationwide') {
			const nationwideTemplates = scoredTemplates
				.filter((s) => s.score >= THRESHOLDS.nationwide && s.score < THRESHOLDS.state)
				.sort((a, b) => (b.template.send_count || 0) - (a.template.send_count || 0))
				.map((s) => s.template);

			if (nationwideTemplates.length > 0) {
				const coordinationCount = nationwideTemplates.reduce(
					(sum, t) => sum + (t.send_count || 0),
					0
				);

				groups.push({
					title: 'Nationwide',
					templates: nationwideTemplates,
					minScore: THRESHOLDS.nationwide,
					level: 'nationwide',
					coordinationCount
				});
			}
		}

		return groups;
	}

	// Apply progressive section-based grouping
	$effect(() => {
		// Explicitly track selectedScope for reactivity
		const currentScope = selectedScope;

		if (!inferredLocation) {
			// No location: show all templates in single nationwide group
			const allTemplates = templates.sort((a, b) => (b.send_count || 0) - (a.send_count || 0));

			onFilterChange([
				{
					title: 'Nationwide',
					templates: allTemplates,
					minScore: 0,
					level: 'nationwide',
					coordinationCount: allTemplates.reduce((sum, t) => sum + (t.send_count || 0), 0)
				}
			]);
			return;
		}

		// Country boundary enforcement (for legislative adapter separation)
		const userCountry = inferredLocation?.country_code;
		const countryFiltered = templates.filter((template) => {
			if (!userCountry) return true; // No location → show everything

			// Check applicable_countries array (explicit country targeting)
			if (template.applicable_countries && template.applicable_countries.length > 0) {
				return template.applicable_countries.includes(userCountry);
			}

			// Check scope.country_code from TemplateScope table
			const scope = (template as unknown as Record<string, unknown>).scope as { country_code?: string } | null;
			if (scope?.country_code) {
				return scope.country_code === userCountry;
			}

			// Check jurisdiction state_code prefixes for country inference
			// ISO 3166-2 format: "CA-ON" (Canada), "US-UT" (US), "GB-ENG" (UK)
			const jurisdictions = (template as unknown as Record<string, unknown>).jurisdictions as Array<{ state_code?: string | null }> | undefined;
			if (jurisdictions && jurisdictions.length > 0) {
				const hasCountryPrefix = jurisdictions.some((j) => {
					if (!j.state_code) return false;
					const dashIdx = j.state_code.indexOf('-');
					if (dashIdx < 0) return true; // No prefix → ambiguous, allow
					return j.state_code.slice(0, dashIdx) === userCountry;
				});
				// If ALL jurisdictions have a country prefix and NONE match, exclude
				const allPrefixed = jurisdictions.every((j) => j.state_code && j.state_code.includes('-'));
				if (allPrefixed && !hasCountryPrefix) return false;
			}

			// No country signal → show (international/untagged)
			return true;
		});

		// Filter templates to only those with jurisdictions (for scoring)
		// Note: TemplateWithJurisdictions is a structural subset of Template, so we cast
		// after runtime narrowing to satisfy the scoring function signatures.
		const templatesWithJurisdictions = countryFiltered.filter(
			(t) => 'jurisdictions' in t && Array.isArray((t as Record<string, unknown>).jurisdictions)
		) as unknown as TemplateWithJurisdictions[];

		// Score templates by location relevance (0.0 = no match, 1.0 = district match)
		// Pass currentScope to boost templates matching the selected breadcrumb level
		const scored = scoreTemplatesByRelevance(
			templatesWithJurisdictions,
			inferredLocation,
			currentScope
		);

		// Apply behavioral boosting asynchronously, then create groups
		getTemplateViewCounts()
			.then((viewCounts) => {
				const boosted = boostByUserBehavior(scored, viewCounts);
				// ScoredTemplate.template is TemplateWithJurisdictions (subset of Template) — structural mismatch
				const groups = createTemplateGroups(boosted as unknown as Array<{ template: Template; score: number }>, inferredLocation, currentScope);

				onFilterChange(groups);
			})
			.catch(() => {
				// Fallback to location-only scoring
				const groups = createTemplateGroups(scored as unknown as Array<{ template: Template; score: number }>, inferredLocation, currentScope);

				onFilterChange(groups);
			});
	});

	
	async function handleUpdateLocation() {
		if (isDetectingLocation) return; // Prevent multiple simultaneous requests

		isDetectingLocation = true;
		locationError = null;

		try {
			// Request browser geolocation and add signal to inference engine
			const signal = await addBrowserGeolocationSignal();

			if (signal) {
				// Re-fetch inferred location (inference engine will recalculate)
				const location = await getUserLocation(true); // Force refresh

				if (location && location.confidence > 0) {
					inferredLocation = location;

					// Reload signals to show updated data (including city_name from Nominatim)
					if (browser) {
						const signals = await locationStorage.getSignals();
						locationSignals = signals;
					}
				}
			} else {
				// User denied permission or geolocation unavailable
				locationError = 'Location permission denied or unavailable';
			}
		} catch (error) {
			console.error('[LocationFilter] Error updating location:', error);
			locationError = 'Failed to detect location';
		} finally {
			isDetectingLocation = false;
		}
	}

	
	/**
	 * Safely extract country_code from LocationHierarchy result
	 * Handles all possible Nominatim response patterns
	 */
	function extractCountryCode(result: LocationHierarchy): string | null {
		// Try country.code first (check exists and is non-empty)
		if (result.country && result.country.code && result.country.code !== '') {
			return result.country.code;
		}

		// Fallback to state's country_code
		if (result.state?.country_code && result.state.country_code !== '') {
			return result.state.country_code;
		}

		// Fallback to city's country_code
		if (result.city?.country_code && result.city.country_code !== '') {
			return result.city.country_code;
		}

		// No country determinable
		return null;
	}

	/**
	 * Handle location change from autocomplete breadcrumb
	 * Creates a user-selected signal (confidence 0.9, not 1.0 since not verified)
	 */
	async function handleLocationSelect(result: LocationHierarchy) {
		try {

			// Validate that result has meaningful location data
			const hasCountryData = result.country?.code && result.country.code !== '';
			const hasStateData = result.state?.code && result.state.code !== '';
			const hasCityData = result.city?.name && result.city.name !== '';

			// Accept if ANY location level is present (country, state, or city)
			if (!hasCountryData && !hasStateData && !hasCityData) {
				locationError = 'Invalid location selection';
				return;
			}

			// Serialize previous location (avoid Svelte proxy cloning issues)
			const previousLocationData = inferredLocation
				? {
						country_code: inferredLocation.country_code,
						state_code: inferredLocation.state_code,
						city_name: inferredLocation.city_name,
						congressional_district: inferredLocation.congressional_district
					}
				: null;

			// Safely extract country code (handles all Nominatim response patterns)
			const countryCode = extractCountryCode(result);

			// Create user-selected signal
			const signal: LocationSignal = {
				signal_type: 'user_selected',
				confidence: 0.9, // High but not verified (1.0)
				congressional_district: null, // Will lookup if needed
				state_code: result.state?.code || null,
				city_name: result.city?.name || null,
				country_code: countryCode,
				county_fips: null,
				latitude: result.city?.lat ?? null,
				longitude: result.city?.lon ?? null,
				source: 'user.breadcrumb_selection',
				timestamp: new Date().toISOString(),
				metadata: {
					display_name: result.display_name,
					previous_location: previousLocationData
				}
			};

			// Store signal
			await locationInferenceEngine.addSignal(signal);

			// Re-infer location
			const location = await getUserLocation(true);
			inferredLocation = location;

			// Reset scope filter so all groups (state, nationwide, etc.) render
			selectedScope = null;

			// Reload signals for display
			if (browser) {
				const signals = await locationStorage.getSignals();
				locationSignals = signals;
			}
		} catch (error) {
			console.error('[LocationFilter] Error updating location from breadcrumb:', error);
			locationError = 'Failed to update location';
		}
	}

	/**
	 * Handle filter toggle (click breadcrumb without editing)
	 */
	function handleScopeFilter(scope: GeographicScope) {
		selectedScope = selectedScope === scope ? null : scope;
	}

</script>

<!--
  PERCEPTUAL ENGINEERING: Single-column breadcrumb-focused layout
  The breadcrumb IS the funnel. No separate CTA needed.
  Extension point at terminal position invites location refinement.
-->
<div class="location-filter-container">
	{#if isLoadingLocation}
		<!-- Loading skeleton (single-column, breadcrumb-focused) -->
		<div class="mb-6 rounded-xl bg-white px-4 pb-4 pt-5 shadow-sm ring-1 ring-slate-900/5 sm:px-6">
			<div class="animate-pulse">
				<!-- Breadcrumb skeleton -->
				<div class="flex flex-wrap items-center gap-2">
					<div class="h-8 w-28 rounded-full bg-slate-100"></div>
					<div class="h-4 w-4 rounded bg-slate-50"></div>
					<div class="h-8 w-24 rounded-full bg-slate-100"></div>
					<div class="h-4 w-4 rounded bg-slate-50"></div>
					<div class="h-8 w-20 rounded-full bg-slate-100"></div>
					<div class="h-4 w-4 rounded bg-slate-50"></div>
					<div class="h-8 w-32 rounded-full border-2 border-dashed border-slate-200 bg-transparent"></div>
				</div>

				<!-- Privacy indicator skeleton -->
				<div class="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
					<div class="h-3 w-3 rounded bg-slate-100"></div>
					<div class="h-3 w-36 rounded bg-slate-50"></div>
				</div>
			</div>
		</div>
	{:else if locationError}
		<!-- Error state - gracefully degrade to showing all templates -->
		<div class="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
			<div class="flex items-center gap-2 text-sm text-slate-600">
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<span>Showing all templates</span>
			</div>
		</div>
	{:else if hasLocation}
		<!-- PERCEPTUAL ENGINEERING: Single-column breadcrumb-focused header -->
		<!-- The breadcrumb IS the funnel. Extension point at terminal invites refinement. -->
		<div class="mb-6 rounded-xl bg-white px-4 pb-4 pt-5 shadow-sm ring-1 ring-slate-900/5 sm:px-6">
			<!-- Geographic breadcrumb navigation (primary interaction) -->
			<nav
				class="flex flex-wrap items-center gap-2"
				aria-label="Geographic scope navigation"
			>
				{#if breadcrumbCountry}
					<LocationAutocomplete
						label={breadcrumbCountry}
						level="country"
						isSelected={selectedScope === 'nationwide'}
						onselect={handleLocationSelect}
						onfilter={() => handleScopeFilter('nationwide')}
					/>
				{/if}

				{#if breadcrumbState && breadcrumbCountry}
					<svg
						class="h-4 w-4 flex-shrink-0 text-slate-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 5l7 7-7 7"
						/>
					</svg>
				{/if}

				{#if breadcrumbState}
					<LocationAutocomplete
						label={breadcrumbState}
						level="state"
						currentCountry={inferredLocation?.country_code ?? undefined}
						isSelected={selectedScope === 'state'}
						onselect={handleLocationSelect}
						onfilter={() => handleScopeFilter('state')}
					/>
				{/if}

				{#if breadcrumbCounty}
					<svg
						class="h-4 w-4 flex-shrink-0 text-slate-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 5l7 7-7 7"
						/>
					</svg>
					<LocationAutocomplete
						label={breadcrumbCounty}
						level="city"
						currentCountry={inferredLocation?.country_code ?? undefined}
						currentState={inferredLocation?.state_code ?? undefined}
						isSelected={selectedScope === 'county'}
						onselect={handleLocationSelect}
						onfilter={() => handleScopeFilter('county')}
					/>
				{/if}

				{#if breadcrumbCity}
					<svg
						class="h-4 w-4 flex-shrink-0 text-slate-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 5l7 7-7 7"
						/>
					</svg>
					<LocationAutocomplete
						label={breadcrumbCity}
						level="city"
						currentCountry={inferredLocation?.country_code ?? undefined}
						currentState={inferredLocation?.state_code ?? undefined}
						isSelected={selectedScope === 'city'}
						onselect={handleLocationSelect}
						onfilter={() => handleScopeFilter('city')}
					/>
				{/if}

			</nav>

			<!-- Privacy indicator + technical details (progressive disclosure) -->
			<div class="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
				<PrivacyIndicator />

				{#if locationSignals.length > 0}
					<details class="group">
						<summary
							class="cursor-pointer list-none text-xs font-medium text-slate-500 hover:text-slate-700 [&::-webkit-details-marker]:hidden"
						>
							<span class="inline-flex items-center gap-1.5">
								<svg
									class="h-3 w-3 transition-transform group-open:rotate-180"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M19 9l-7 7-7-7"
									/>
								</svg>
								Details
							</span>
						</summary>
						<div class="absolute right-4 z-10 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-3 shadow-lg sm:right-6">
							<div class="text-xs text-slate-600">
								{#if locationSignals.some((s) => s.signal_type === 'verified')}
									From verified address
								{:else if locationSignals.some((s) => s.source === 'browser.geolocation')}
									From GPS (browser location)
								{:else if locationSignals.some((s) => s.source === 'ip.geolocation')}
									From IP address
								{:else if locationSignals.some((s) => s.source.includes('oauth'))}
									From OAuth profile
								{:else}
									From browser timezone and language
								{/if}
							</div>
							<div class="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-500">
								Your location data stays in your browser.
							</div>
						</div>
					</details>
				{/if}
			</div>
		</div>
	{:else}
		<!-- No location detected - minimal breadcrumb with country selector as entry point -->
		<div class="mb-6 rounded-xl bg-white px-4 pb-4 pt-5 shadow-sm ring-1 ring-slate-900/5 sm:px-6">
			<nav
				class="flex flex-wrap items-center gap-2"
				aria-label="Set your location"
			>
				<!-- Entry point: Country selector or "Set Location" affordance -->
				<LocationAutocomplete
					label="Set your location"
					level="country"
					mode="omnibar"
					isSelected={false}
					onselect={handleLocationSelect}
					onfilter={() => {}}
				/>

				<!-- Hint text -->
				<span class="text-xs text-slate-500">
					Select a location to see relevant coordination opportunities
				</span>
			</nav>

			<!-- Privacy indicator -->
			<div class="mt-3 border-t border-slate-100 pt-3">
				<PrivacyIndicator />
			</div>
		</div>
	{/if}
</div>

<style>
	/*
	 * PERCEPTUAL ENGINEERING: CLS Prevention
	 *
	 * Single-column breadcrumb layout is more compact than previous two-column.
	 * Reserve space for breadcrumb + privacy indicator + potential inline resolver.
	 *
	 * Base state: ~80px (breadcrumb + privacy)
	 * With inline resolver: ~140px (breadcrumb expands inline)
	 */
	.location-filter-container {
		min-height: 80px;
		position: relative; /* For details dropdown positioning */
	}

	/* When inline resolver is active, allow more space */
	.location-filter-container:has(:global(.inline-resolver)) {
		min-height: 140px;
	}

	/* Mobile: stack breadcrumbs and inline resolver */
	@media (max-width: 640px) {
		.location-filter-container {
			min-height: 100px;
		}

		.location-filter-container:has(:global(.inline-resolver)) {
			min-height: 220px;
		}
	}
</style>
