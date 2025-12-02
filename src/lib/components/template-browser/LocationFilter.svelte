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
	import AddressConfirmationModal from './AddressConfirmationModal.svelte';
	import PrivacyIndicator from './PrivacyBadge.svelte';
	import LocationAutocomplete from './LocationAutocomplete.svelte';
	import type { LocationHierarchy } from '$lib/core/location/geocoding-api';
	import { locationInferenceEngine } from '$lib/core/location/inference-engine';

	interface LocationFilterProps {
		templates: Template[];
		onFilterChange: (groups: TemplateGroup[]) => void;
		onNextUnlockChange?: (nextUnlock: { level: 'city' | 'district'; count: number } | null) => void;
		onAddressModalOpen?: (handler: () => void) => void;
	}

	let {
		templates = [],
		onFilterChange = () => {},
		onNextUnlockChange = () => {},
		onAddressModalOpen = () => {}
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
	let showAddressModal = $state(false);

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

		// Strategy 2: Inferred country from state code (deterministic - state codes are unambiguous)
		// Design Pattern: "Inferrable Defaults with Explicit Overrides"
		// State codes have 1:1 country mapping, so we can deterministically infer country
		if (inferredLocation?.state_code) {
			const stateCode = inferredLocation.state_code;

			// US states and territories (unambiguous mapping)
			const usStates = [
				'AL',
				'AK',
				'AZ',
				'AR',
				'CA',
				'CO',
				'CT',
				'DE',
				'DC',
				'FL',
				'GA',
				'HI',
				'ID',
				'IL',
				'IN',
				'IA',
				'KS',
				'KY',
				'LA',
				'ME',
				'MD',
				'MA',
				'MI',
				'MN',
				'MS',
				'MO',
				'MT',
				'NE',
				'NV',
				'NH',
				'NJ',
				'NM',
				'NY',
				'NC',
				'ND',
				'OH',
				'OK',
				'OR',
				'PA',
				'RI',
				'SC',
				'SD',
				'TN',
				'TX',
				'UT',
				'VT',
				'VA',
				'WA',
				'WV',
				'WI',
				'WY',
				'PR',
				'GU',
				'VI',
				'AS',
				'MP'
			];
			if (usStates.includes(stateCode)) {
				return 'United States';
			}

			// Canadian provinces and territories (unambiguous mapping)
			const caProvinces = [
				'AB',
				'BC',
				'MB',
				'NB',
				'NL',
				'NT',
				'NS',
				'NU',
				'ON',
				'PE',
				'QC',
				'SK',
				'YT'
			];
			if (caProvinces.includes(stateCode)) {
				return 'Canada';
			}

			// Australian states and territories (unambiguous mapping)
			const auStates = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];
			if (auStates.includes(stateCode)) {
				return 'Australia';
			}
		}

		// No country determinable (no explicit country_code, no inferrable state)
		return null;
	});

	const breadcrumbState = $derived.by(() => {
		if (!inferredLocation?.state_code) return null;

		const stateNames: Record<string, string> = {
			AL: 'Alabama',
			AK: 'Alaska',
			AZ: 'Arizona',
			AR: 'Arkansas',
			CA: 'California',
			CO: 'Colorado',
			CT: 'Connecticut',
			DE: 'Delaware',
			DC: 'Washington DC',
			FL: 'Florida',
			GA: 'Georgia',
			HI: 'Hawaii',
			ID: 'Idaho',
			IL: 'Illinois',
			IN: 'Indiana',
			IA: 'Iowa',
			KS: 'Kansas',
			KY: 'Kentucky',
			LA: 'Louisiana',
			ME: 'Maine',
			MD: 'Maryland',
			MA: 'Massachusetts',
			MI: 'Michigan',
			MN: 'Minnesota',
			MS: 'Mississippi',
			MO: 'Missouri',
			MT: 'Montana',
			NE: 'Nebraska',
			NV: 'Nevada',
			NH: 'New Hampshire',
			NJ: 'New Jersey',
			NM: 'New Mexico',
			NY: 'New York',
			NC: 'North Carolina',
			ND: 'North Dakota',
			OH: 'Ohio',
			OK: 'Oklahoma',
			OR: 'Oregon',
			PA: 'Pennsylvania',
			RI: 'Rhode Island',
			SC: 'South Carolina',
			SD: 'South Dakota',
			TN: 'Tennessee',
			TX: 'Texas',
			UT: 'Utah',
			VT: 'Vermont',
			VA: 'Virginia',
			WA: 'Washington',
			WV: 'West Virginia',
			WI: 'Wisconsin',
			WY: 'Wyoming',
			PR: 'Puerto Rico',
			GU: 'Guam',
			VI: 'US Virgin Islands',
			AS: 'American Samoa',
			MP: 'Northern Mariana Islands'
		};

		return stateNames[inferredLocation.state_code] || inferredLocation.state_code;
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

	const breadcrumbDistrict = $derived.by(() => {
		if (!inferredLocation?.congressional_district) return null;

		// Parse district code (e.g., "CA-16" → "CA-16")
		return inferredLocation.congressional_district;
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
			const stateNames: Record<string, string> = {
				AL: 'Alabama',
				AK: 'Alaska',
				AZ: 'Arizona',
				AR: 'Arkansas',
				CA: 'California',
				CO: 'Colorado',
				CT: 'Connecticut',
				DE: 'Delaware',
				DC: 'Washington DC',
				FL: 'Florida',
				GA: 'Georgia',
				HI: 'Hawaii',
				ID: 'Idaho',
				IL: 'Illinois',
				IN: 'Indiana',
				IA: 'Iowa',
				KS: 'Kansas',
				KY: 'Kentucky',
				LA: 'Louisiana',
				ME: 'Maine',
				MD: 'Maryland',
				MA: 'Massachusetts',
				MI: 'Michigan',
				MN: 'Minnesota',
				MS: 'Mississippi',
				MO: 'Missouri',
				MT: 'Montana',
				NE: 'Nebraska',
				NV: 'Nevada',
				NH: 'New Hampshire',
				NJ: 'New Jersey',
				NM: 'New Mexico',
				NY: 'New York',
				NC: 'North Carolina',
				ND: 'North Dakota',
				OH: 'Ohio',
				OK: 'Oklahoma',
				OR: 'Oregon',
				PA: 'Pennsylvania',
				RI: 'Rhode Island',
				SC: 'South Carolina',
				SD: 'South Dakota',
				TN: 'Tennessee',
				TX: 'Texas',
				UT: 'Utah',
				VT: 'Vermont',
				VA: 'Virginia',
				WA: 'Washington',
				WV: 'West Virginia',
				WI: 'Wisconsin',
				WY: 'Wyoming',
				PR: 'Puerto Rico',
				GU: 'Guam',
				VI: 'US Virgin Islands',
				AS: 'American Samoa',
				MP: 'Northern Mariana Islands'
			};
			return stateNames[inferredLocation.state_code] || inferredLocation.state_code;
		}

		return null;
	});

	const districtLabel = $derived.by(() => {
		if (!inferredLocation?.congressional_district) return null;

		// Expand state code to full name
		const stateNames: Record<string, string> = {
			AL: 'Alabama',
			AK: 'Alaska',
			AZ: 'Arizona',
			AR: 'Arkansas',
			CA: 'California',
			CO: 'Colorado',
			CT: 'Connecticut',
			DE: 'Delaware',
			DC: 'Washington DC',
			FL: 'Florida',
			GA: 'Georgia',
			HI: 'Hawaii',
			ID: 'Idaho',
			IL: 'Illinois',
			IN: 'Indiana',
			IA: 'Iowa',
			KS: 'Kansas',
			KY: 'Kentucky',
			LA: 'Louisiana',
			ME: 'Maine',
			MD: 'Maryland',
			MA: 'Massachusetts',
			MI: 'Michigan',
			MN: 'Minnesota',
			MS: 'Mississippi',
			MO: 'Missouri',
			MT: 'Montana',
			NE: 'Nebraska',
			NV: 'Nevada',
			NH: 'New Hampshire',
			NJ: 'New Jersey',
			NM: 'New Mexico',
			NY: 'New York',
			NC: 'North Carolina',
			ND: 'North Dakota',
			OH: 'Ohio',
			OK: 'Oklahoma',
			OR: 'Oregon',
			PA: 'Pennsylvania',
			RI: 'Rhode Island',
			SC: 'South Carolina',
			SD: 'South Dakota',
			TN: 'Tennessee',
			TX: 'Texas',
			UT: 'Utah',
			VT: 'Vermont',
			VA: 'Virginia',
			WA: 'Washington',
			WV: 'West Virginia',
			WI: 'Wisconsin',
			WY: 'Wyoming',
			PR: 'Puerto Rico',
			GU: 'Guam',
			VI: 'US Virgin Islands',
			AS: 'American Samoa',
			MP: 'Northern Mariana Islands'
		};

		// Parse district code (e.g., "CA-16" → "California's 16th Congressional District")
		const match = inferredLocation.congressional_district.match(/^([A-Z]{2})-(\d+)$/);
		if (match) {
			const [, stateCode, districtNum] = match;
			const stateName = stateNames[stateCode] || stateCode;

			// Ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
			const num = parseInt(districtNum);
			let suffix = 'th';
			if (num % 10 === 1 && num !== 11) suffix = 'st';
			else if (num % 10 === 2 && num !== 12) suffix = 'nd';
			else if (num % 10 === 3 && num !== 13) suffix = 'rd';

			return `${stateName}'s ${num}${suffix} Congressional District`;
		}

		// Fallback if format doesn't match
		return inferredLocation.congressional_district;
	});

	const localTemplateCount = $derived.by(() => {
		if (!inferredLocation) return 0;

		// Filter templates to only those with jurisdictions
		const templatesWithJurisdictions = templates.filter(
			(t): t is TemplateWithJurisdictions => 'jurisdictions' in t && Array.isArray(t.jurisdictions)
		);

		const scored = scoreTemplatesByRelevance(templatesWithJurisdictions, inferredLocation);
		return scored.length;
	});

	// Template counts per precision tier (for progressive unlock messaging)
	const templateCountsByTier = $derived.by(() => {
		if (!inferredLocation) {
			return {
				district: 0,
				city: 0,
				state: 0,
				nationwide: templates.length
			};
		}

		// Filter templates to only those with jurisdictions
		const templatesWithJurisdictions = templates.filter(
			(t): t is TemplateWithJurisdictions => 'jurisdictions' in t && Array.isArray(t.jurisdictions)
		);

		// PROGRESSIVE UNLOCK COUNTS: Show what WOULD unlock, not just what currently matches
		// Example: User has state=CA but no city. SF templates exist with city_name='San Francisco'.
		// We should count these as "city templates available" to motivate city entry.

		let districtCount = 0;
		let cityCount = 0;
		let stateCount = 0;
		let nationwideCount = 0;

		for (const template of templatesWithJurisdictions) {
			for (const jurisdiction of template.jurisdictions) {
				// District templates: Have congressional_district AND match user's state
				if (
					jurisdiction.congressional_district &&
					jurisdiction.state_code === inferredLocation.state_code
				) {
					districtCount++;
					break; // Count each template once
				}
				// City templates: Have city_name AND match user's state (would unlock with city entry)
				else if (
					jurisdiction.city_name &&
					jurisdiction.state_code === inferredLocation.state_code
				) {
					cityCount++;
					break;
				}
				// State templates: Have state_code match (but no city/district)
				else if (
					jurisdiction.state_code === inferredLocation.state_code &&
					!jurisdiction.city_name &&
					!jurisdiction.congressional_district
				) {
					stateCount++;
					break;
				}
				// Federal templates: jurisdiction_type === 'federal'
				else if (jurisdiction.jurisdiction_type === 'federal') {
					nationwideCount++;
					break;
				}
			}
		}

		return {
			district: districtCount,
			city: cityCount,
			state: stateCount,
			nationwide: nationwideCount
		};
	});

	// Determine what next precision level unlocks (for CTA messaging)
	const nextUnlock = $derived.by(() => {
		if (!inferredLocation) {
			// No location at all → state is first unlock
			return {
				level: 'state' as const,
				count: templateCountsByTier.state,
				locationContext: null
			};
		}

		if (!inferredLocation.city_name) {
			// Have state, need city
			// City templates are distributed across the state, not in a single city
			const stateName = breadcrumbState || inferredLocation.state_code;
			return {
				level: 'city' as const,
				count: templateCountsByTier.city,
				locationContext: stateName
			};
		}

		if (!inferredLocation.congressional_district) {
			// Have city, need district
			const cityName = breadcrumbCity || inferredLocation.city_name;
			return {
				level: 'district' as const,
				count: templateCountsByTier.district,
				locationContext: cityName
			};
		}

		// Max precision reached
		return null;
	});

	// Load inferred location using the inference engine
	onMount(async () => {
		try {
			// Get user location from inference engine (uses cached if available)
			let location = await getUserLocation();

			// MIGRATION FIX: If we have a GPS signal but no city_name, request fresh geolocation
			// This handles the transition period where old cached locations don't have city_name
			if (location && location.confidence > 0 && browser) {
				const signals = await locationStorage.getSignals();
				const oldGPSSignal = signals.find(
					(s) => (s.source === 'census.browser' || s.source === 'nominatim.browser') && !s.city_name
				);

				if (oldGPSSignal) {
					// Request fresh geolocation which will now include Nominatim city lookup
					const freshSignal = await addBrowserGeolocationSignal();

					if (freshSignal) {
						// Re-infer location with new signal
						location = await getUserLocation(true);
					}
				}
			}

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
		const countryFiltered = templates.filter((template) => {
			// If template specifies countries, enforce country match
			if (template.applicable_countries && template.applicable_countries.length > 0) {
				return (
					inferredLocation.country_code &&
					template.applicable_countries.includes(inferredLocation.country_code)
				);
			}
			// Otherwise show (international/no country specified)
			return true;
		});

		// Filter templates to only those with jurisdictions (for scoring)
		const templatesWithJurisdictions = countryFiltered.filter(
			(t): t is TemplateWithJurisdictions => 'jurisdictions' in t && Array.isArray(t.jurisdictions)
		);

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
				const groups = createTemplateGroups(boosted, inferredLocation, currentScope);

				onFilterChange(groups);
			})
			.catch(() => {
				// Fallback to location-only scoring
				const groups = createTemplateGroups(scored, inferredLocation, currentScope);

				onFilterChange(groups);
			});
	});

	// Emit nextUnlock changes to parent
	$effect(() => {
		onNextUnlockChange(nextUnlock);
	});

	// Emit address modal open handler to parent (for unified modal system)
	$effect(() => {
		onAddressModalOpen(() => {
			showAddressModal = true;
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

	interface VerifiedAddress {
		street: string;
		city: string;
		state: string;
		zipCode: string;
		congressional_district: string;
		county_name?: string;
	}

	async function handleAddressConfirmed(event: CustomEvent<VerifiedAddress>) {
		const verified = event.detail;

		try {
			// Create verified location signal with highest confidence
			const signal: LocationSignal = {
				signal_type: 'verified',
				confidence: 1.0,
				congressional_district: verified.congressional_district,
				state_code: verified.state,
				city_name: verified.city,
				county_fips: null,
				latitude: null,
				longitude: null,
				source: 'user.verified',
				timestamp: new Date().toISOString(),
				metadata: {
					address: `${verified.street}, ${verified.city}, ${verified.state} ${verified.zipCode}`,
					county_name: verified.county_name
				}
			};

			// Store signal (replaces all other signals as highest confidence)
			await locationInferenceEngine.addSignal(signal);

			// Refresh inferred location
			const location = await getUserLocation(true);
			inferredLocation = location;

			// Reload signals for display
			if (browser) {
				const signals = await locationStorage.getSignals();
				locationSignals = signals;
			}

			// Close modal
			showAddressModal = false;
		} catch (error) {
			console.error('[LocationFilter] Error storing verified location:', error);
			locationError = 'Failed to save verified location';
		}
	}

	function handleAddressModalClose() {
		showAddressModal = false;
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
	async function handleLocationSelect(event: CustomEvent<LocationHierarchy>) {
		try {
			// Extract LocationHierarchy from CustomEvent detail
			const result = event.detail;

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
				latitude: result.city?.lat || result.state?.lat || null,
				longitude: result.city?.lon || result.state?.lon || null,
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
  CLS PREVENTION: Explicit min-height reservation.
  Distinguished engineer principle: Don't chase pixel-perfect skeletons.
  Reserve the space explicitly - hydrated state is ~220px on desktop.
-->
<div class="location-filter-container">
	{#if isLoadingLocation}
		<!-- Loading skeleton -->
		<div class="mb-6 rounded-xl bg-white px-4 pb-4 pt-6 shadow-sm ring-1 ring-slate-900/5 sm:px-6">
			<div class="flex flex-col items-start gap-6 lg:flex-row lg:justify-between lg:gap-8">
				<!-- LEFT COLUMN skeleton (matches hydrated left column) -->
				<div class="flex flex-1 animate-pulse items-start gap-3">
					<!-- Location pin icon placeholder -->
					<div class="h-7 w-7 flex-shrink-0 rounded-full bg-slate-100"></div>

					<div class="min-w-0 flex-1 space-y-3">
						<!-- H2 header placeholder -->
						<div class="h-9 w-40 rounded-md bg-slate-100"></div>

						<!-- District metadata placeholder -->
						<div class="h-4 w-56 rounded-md bg-slate-50"></div>

						<!-- Correction affordance placeholder -->
						<div class="h-4 w-32 rounded-md bg-slate-50"></div>

						<!-- Breadcrumb placeholder -->
						<div class="flex items-center gap-2 pt-1">
							<div class="h-7 w-24 rounded-md bg-slate-100"></div>
							<div class="h-4 w-4 rounded bg-slate-50"></div>
							<div class="h-7 w-20 rounded-md bg-slate-100"></div>
						</div>

						<!-- Privacy indicator placeholder -->
						<div class="border-t border-slate-100 pt-3">
							<div class="h-4 w-44 rounded-md bg-slate-50"></div>
						</div>
					</div>
				</div>

				<!-- RIGHT COLUMN skeleton (matches unlock CTA card) -->
				<div
					class="hidden w-full animate-pulse lg:block lg:w-auto lg:min-w-[280px] lg:max-w-[320px] lg:flex-shrink-0"
				>
					<div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
						<!-- Count + label placeholder -->
						<div class="mb-4 flex items-baseline justify-center gap-2">
							<div class="h-10 w-12 rounded-md bg-slate-100"></div>
							<div class="h-4 w-28 rounded-md bg-slate-100"></div>
						</div>
						<!-- Description placeholder -->
						<div class="mx-auto mb-4 h-3 w-40 rounded-md bg-slate-50"></div>
						<!-- Button placeholder -->
						<div class="h-10 w-full rounded-md bg-slate-200"></div>
						<!-- Privacy copy placeholder -->
						<div class="mx-auto mt-4 h-3 w-48 rounded-md bg-slate-50"></div>
					</div>
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
		<!-- TEMPLATE BROWSER HEADER (Two-column: Location left, Unlock right) -->
		<div class="mb-6 rounded-xl bg-white px-4 pb-4 pt-6 shadow-sm ring-1 ring-slate-900/5 sm:px-6">
			<div class="flex flex-col items-start gap-6 lg:flex-row lg:justify-between lg:gap-8">
				<!-- LEFT COLUMN: Location Information -->
				<div class="flex flex-1 items-start gap-3">
					<!-- Location pin icon -->
					<div class="flex-shrink-0">
						<svg
							class="h-7 w-7 text-blue-600"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
							/>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
							/>
						</svg>
					</div>

					<div class="min-w-0 flex-1">
						<!-- H2 header (human-readable location): Satoshi Bold for brand voice -->
						<h2 class="font-brand text-3xl font-bold leading-tight text-slate-900">
							{#if locationLabel}
								{locationLabel}
							{:else}
								Nationwide
							{/if}
						</h2>

						<!-- District metadata (power-agnostic - shown when available): Satoshi Medium -->
						{#if districtLabel}
							<p class="mt-1 font-brand text-sm font-medium text-slate-500">
								{districtLabel}
							</p>
						{/if}

						<!-- Correction affordance (error recovery only): Satoshi Regular -->
						{#if locationLabel}
							<button
								onclick={() => (showAddressModal = true)}
								class="mt-1 font-brand text-sm text-slate-600 underline decoration-dotted underline-offset-2 hover:text-slate-900"
							>
								Not from {locationLabel}?
							</button>
						{/if}

						<!-- Geographic breadcrumb (inline with location elements) -->
						{#if breadcrumbCountry || breadcrumbState || breadcrumbCounty || breadcrumbCity || breadcrumbDistrict}
							<nav
								class="mt-2 flex items-center gap-2 text-sm"
								aria-label="Filter by geographic scope"
							>
								{#if breadcrumbCountry}
									<LocationAutocomplete
										label={breadcrumbCountry}
										level="country"
										isSelected={selectedScope === 'nationwide'}
										on:select={handleLocationSelect}
										on:filter={() => handleScopeFilter('nationwide')}
									/>
								{/if}

								{#if breadcrumbState && breadcrumbCountry}
									<svg
										class="h-4 w-4 text-slate-400"
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
										currentCountry={inferredLocation?.country_code}
										isSelected={selectedScope === 'state'}
										on:select={handleLocationSelect}
										on:filter={() => handleScopeFilter('state')}
									/>
								{/if}

								{#if breadcrumbCounty}
									<svg
										class="h-4 w-4 text-slate-400"
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
										currentCountry={inferredLocation?.country_code}
										currentState={inferredLocation?.state_code}
										isSelected={selectedScope === 'county'}
										on:select={handleLocationSelect}
										on:filter={() => handleScopeFilter('county')}
									/>
								{/if}

								{#if breadcrumbCity}
									<svg
										class="h-4 w-4 text-slate-400"
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
										currentCountry={inferredLocation?.country_code}
										currentState={inferredLocation?.state_code}
										isSelected={selectedScope === 'city'}
										on:select={handleLocationSelect}
										on:filter={() => handleScopeFilter('city')}
									/>
								{/if}

								{#if breadcrumbDistrict}
									<svg
										class="h-4 w-4 text-slate-400"
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
									<!-- District breadcrumb: Display-only (no edit/search - determined by verified address) -->
									<button
										onclick={() => handleScopeFilter('district')}
										class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors hover:bg-slate-100"
										class:bg-slate-100={selectedScope === 'district'}
										class:text-slate-900={selectedScope === 'district'}
										class:text-slate-700={selectedScope !== 'district'}
										aria-label="Filter by {breadcrumbDistrict}"
										title="Congressional district is determined by verified address"
									>
										<span>{breadcrumbDistrict}</span>
									</button>
								{/if}
							</nav>
						{/if}

						<!-- Privacy indicator (passive trust signal) -->
						<div class="mt-4 border-t border-slate-100 pt-3">
							<PrivacyIndicator />
						</div>

						<!-- Technical details (progressive disclosure) -->
						{#if locationSignals.length > 0}
							<details class="group mt-2">
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
										How we determined this location
									</span>
								</summary>
								<div class="mt-3 space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
									<!-- Location source -->
									<div class="text-xs text-slate-600">
										{#if locationSignals.some((s) => s.signal_type === 'verified')}
											From verified address
										{:else if locationSignals.some((s) => s.source === 'census.browser' || s.source === 'nominatim.browser')}
											From GPS (browser location)
										{:else if locationSignals.some((s) => s.source === 'ip.geolocation')}
											From IP address
										{:else if locationSignals.some((s) => s.source.includes('oauth'))}
											From OAuth profile
										{:else}
											From browser timezone and language
										{/if}
									</div>

									<!-- Privacy note -->
									<div class="border-t border-slate-200 pt-2 text-xs text-slate-500">
										Your location data stays in your browser. Never sent to our servers.
									</div>
								</div>
							</details>
						{/if}
					</div>
				</div>

				<!-- RIGHT COLUMN: Progressive Unlock CTA -->
				{#if nextUnlock}
					<div class="group w-full lg:w-auto lg:min-w-[280px] lg:max-w-[320px] lg:flex-shrink-0">
						<div
							class="relative overflow-hidden rounded-participation-lg border border-surface-border bg-surface-base p-4 shadow-participation-sm transition-all duration-300 hover:border-surface-border-strong hover:shadow-participation-md"
						>
							<!-- Subtle noise texture overlay -->
							<div
								class="pointer-events-none absolute inset-0 opacity-[0.015]"
								style="background-image: url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E');"
							></div>

							{#if nextUnlock.count > 0}
								<!-- Active state: Single unified message -->
								<div class="relative mb-4 text-center">
									<div class="inline-flex items-baseline gap-2">
										<!-- Count: JetBrains Mono for metric clarity -->
										<span
											class="font-mono text-4xl font-black tabular-nums leading-none tracking-tighter text-participation-accent-600"
										>
											{nextUnlock.count}
										</span>
										<!-- Label: Satoshi Medium for brand voice -->
										<span class="font-brand text-sm font-medium text-text-secondary">
											{#if nextUnlock.level === 'city'}
												more across cities
											{:else if nextUnlock.level === 'district'}
												more at district level
											{:else}
												more available
											{/if}
										</span>
									</div>
									<!-- Description: Satoshi Regular -->
									<p class="mt-2 font-brand text-xs text-text-tertiary">
										{#if nextUnlock.level === 'city'}
											Enter address to see yours
										{:else if nextUnlock.level === 'district'}
											Enter address for your district
										{:else}
											Enter address to unlock
										{/if}
									</p>
								</div>
							{:else}
								<!-- Empty state: Centered, minimal -->
								<div class="mb-4 text-center">
									<div
										class="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-raised"
									>
										<svg
											class="h-5 w-5 text-text-quaternary"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											stroke-width="2"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
											/>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
											/>
										</svg>
									</div>
									<!-- Heading: Satoshi Semibold -->
									<h3 class="font-brand text-sm font-semibold text-text-secondary">
										Get more precise location
									</h3>
									<!-- Description: Satoshi Regular -->
									<p class="mt-1 font-brand text-xs text-text-tertiary">
										Unlock future coordination opportunities
									</p>
								</div>
							{/if}

							<!-- CTA button: Satoshi Semibold for CTAs -->
							<button
								onclick={() => (showAddressModal = true)}
								class="group/btn relative w-full overflow-hidden rounded-md bg-participation-primary-600 px-4 py-2.5 font-brand text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-participation-primary-700 hover:shadow-md active:scale-[0.98] active:bg-participation-primary-800"
							>
								<span class="relative z-10 inline-flex items-center justify-center gap-2">
									Enter your address
									<svg
										class="h-3.5 w-3.5 transition-transform duration-200 group-hover/btn:translate-x-0.5"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2.5"
									>
										<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
									</svg>
								</span>
								<div
									class="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover/btn:translate-x-full"
								></div>
							</button>

							<!-- CTA copy with privacy reassurance on hover: Satoshi Medium -->
							<div class="relative mt-4 h-4 overflow-hidden">
								<!-- Default state: Agency-driven copy -->
								<p
									class="absolute inset-0 font-brand text-[10px] font-medium leading-tight text-text-tertiary transition-all duration-300 group-hover:translate-y-[-100%] group-hover:opacity-0"
								>
									Unlock precise coordination in your area
								</p>
								<!-- Hover state: Privacy reassurance -->
								<p
									class="absolute inset-0 translate-y-[100%] font-brand text-[10px] font-medium leading-tight text-text-tertiary opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"
								>
									Stays in your browser. Never sent to our servers.
								</p>
							</div>
						</div>
					</div>
				{/if}
			</div>
		</div>
	{:else}
		<!-- No location detected - ask for address -->
		<div class="mb-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
			<div class="mb-3 flex items-start gap-3">
				<div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-50">
					<svg
						class="h-4 w-4 text-blue-600"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
						/>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
						/>
					</svg>
				</div>
				<div class="flex-1">
					<h4 class="text-sm font-semibold text-slate-900">Find coordination in your area</h4>
					<p class="mt-0.5 text-xs leading-relaxed text-slate-600">
						Enter your address to unlock local issues
					</p>
				</div>
			</div>

			<button
				onclick={() => (showAddressModal = true)}
				class="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-blue-700 active:bg-blue-800"
			>
				Enter your address
			</button>
		</div>
	{/if}
</div>

<!-- Address Confirmation Modal -->
<AddressConfirmationModal
	isOpen={showAddressModal}
	on:close={handleAddressModalClose}
	on:confirm={handleAddressConfirmed}
/>

<style>
	/*
	 * CLS Prevention: Explicit height reservation
	 *
	 * Distinguished engineer principle: Don't chase pixel-perfect skeletons.
	 * Skeleton height matching is fragile - content changes, padding changes,
	 * conditional elements appear/disappear.
	 *
	 * Instead: Reserve the space explicitly. The hydrated LocationFilter
	 * with the two-column layout (location info + unlock CTA) measures ~220px.
	 * Using min-height ensures no layout shift regardless of loading state.
	 *
	 * Mobile/Tablet (<1024px): Stacked layout, simpler height (~150px)
	 * Desktop (>=1024px): Two-column layout, ~220px
	 */
	.location-filter-container {
		min-height: 150px; /* Mobile/Tablet: single column */
	}

	@media (min-width: 1024px) {
		.location-filter-container {
			min-height: 220px; /* Desktop: two-column layout */
		}
	}
</style>
