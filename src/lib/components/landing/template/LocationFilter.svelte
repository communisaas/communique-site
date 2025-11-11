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
		boostByUserBehavior
	} from '$lib/core/location/template-filter';
	import {
		getUserLocation,
		addBrowserGeolocationSignal
	} from '$lib/core/location/inference-engine';
	import { getTemplateViewCounts } from '$lib/core/location/behavioral-tracker';
	import { locationStorage } from '$lib/core/location/storage';
	import type { Template } from '$lib/types/template';
	import AddressConfirmationModal from './AddressConfirmationModal.svelte';
	import TemplatePreviewCard from './TemplatePreviewCard.svelte';
	import { locationInferenceEngine } from '$lib/core/location/inference-engine';

	interface LocationFilterProps {
		templates: Template[];
		onFilterChange: (filtered: Template[]) => void;
	}

	let { templates = [], onFilterChange = () => {} }: LocationFilterProps = $props();

	// State
	let inferredLocation = $state<InferredLocation | null>(null);
	let locationSignals = $state<LocationSignal[]>([]);
	let showLocalOnly = $state(false);
	let isLoadingLocation = $state(true);
	let locationError = $state<string | null>(null);
	let isDetectingLocation = $state(false);
	let showAddressModal = $state(false);
	let forcedPrecision = $state<PrecisionLevel | null>(null); // User-selected precision override

	// Computed
	const hasLocation = $derived(
		inferredLocation && (inferredLocation.congressional_district || inferredLocation.city_name)
	);

	// Breadcrumb components for drill-down navigation
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

	const breadcrumbCounty = $derived.by(() => {
		if (!inferredLocation) return null;

		const countyName = locationSignals[0]?.metadata?.county_name;
		const cityName = inferredLocation.city_name;

		if (cityName && countyName && cityName !== countyName) {
			return `${cityName}, ${countyName}`;
		}
		return countyName || cityName || null;
	});

	const breadcrumbDistrict = $derived.by(() => {
		if (!inferredLocation?.congressional_district) return null;

		// Parse district code (e.g., "CA-16" → "CA-16")
		return inferredLocation.congressional_district;
	});

	const locationLabel = $derived.by(() => {
		if (!inferredLocation) return null;

		const metadata = locationSignals[0]?.metadata;
		const countyName = metadata?.county_name;
		const cityName = inferredLocation.city_name;

		// Strategy 1: "City, County" (most elegant and specific)
		// e.g., "San Francisco, San Francisco County" or "Austin, Travis County"
		if (cityName && countyName) {
			return `${cityName}, ${countyName}`;
		}

		// Strategy 2: City only (if no county)
		if (cityName) {
			return cityName;
		}

		// Strategy 3: County only (if no city)
		if (countyName) {
			return countyName;
		}

		// Strategy 4: State full name (expand abbreviation as fallback)
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

	// Precision levels for progressive funnel
	type PrecisionLevel = 'nationwide' | 'state' | 'county' | 'district';

	// Natural precision based on available location data
	const naturalPrecision = $derived.by((): PrecisionLevel => {
		if (!inferredLocation) return 'nationwide';
		if (inferredLocation.congressional_district) return 'district';
		if (inferredLocation.city_name || locationSignals[0]?.metadata?.county_name) return 'county';
		if (inferredLocation.state_code) return 'state';
		return 'nationwide';
	});

	// Effective precision (respects user drill-down selection)
	const currentPrecision = $derived.by((): PrecisionLevel => {
		// User can drill down to lower precision (state when district is available)
		if (forcedPrecision) return forcedPrecision;
		return naturalPrecision;
	});

	// Calculate coordination counts per precision level
	const coordinationByPrecision = $derived.by(() => {
		const templatesWithJurisdictions = templates.filter(
			(t): t is TemplateWithJurisdictions => 'jurisdictions' in t && Array.isArray(t.jurisdictions)
		);

		const counts = {
			nationwide: 0,
			state: 0,
			county: 0,
			district: 0
		};

		if (!inferredLocation) {
			// Show all federal templates when no location
			counts.nationwide = templatesWithJurisdictions
				.filter((t) => t.jurisdictions.some((j) => j.jurisdiction_type === 'federal'))
				.reduce((total, t) => total + (t.send_count || 0), 0);
			return counts;
		}

		for (const template of templatesWithJurisdictions) {
			const sendCount = template.verified_sends || 0;

			for (const jurisdiction of template.jurisdictions) {
				// Federal templates count at all levels
				if (jurisdiction.jurisdiction_type === 'federal') {
					counts.nationwide += sendCount;
					counts.state += sendCount;
					counts.county += sendCount;
					counts.district += sendCount;
					break;
				}

				// State-level templates
				if (
					jurisdiction.jurisdiction_type === 'state' &&
					jurisdiction.state_code === inferredLocation.state_code
				) {
					counts.state += sendCount;
					counts.county += sendCount;
					counts.district += sendCount;
					break;
				}

				// County-level templates (match by city or county name)
				if (
					jurisdiction.jurisdiction_type === 'city' ||
					jurisdiction.jurisdiction_type === 'county'
				) {
					const countyName = locationSignals[0]?.metadata?.county_name;
					const matchesCity =
						inferredLocation.city_name &&
						(jurisdiction.city_name === inferredLocation.city_name ||
							jurisdiction.county_name?.includes(inferredLocation.city_name));
					const matchesCounty =
						countyName &&
						(jurisdiction.county_name === countyName || jurisdiction.city_name === countyName);

					if (matchesCity || matchesCounty) {
						counts.county += sendCount;
						counts.district += sendCount;
						break;
					}
				}

				// District-level templates
				if (jurisdiction.congressional_district === inferredLocation.congressional_district) {
					counts.district += sendCount;
					break;
				}
			}
		}

		return counts;
	});

	const coordinationCount = $derived.by(() => {
		return coordinationByPrecision[currentPrecision];
	});

	// Count for next precision level (for preview)
	const nextLevelCount = $derived.by(() => {
		const precision = currentPrecision;
		const counts = coordinationByPrecision;

		if (precision === 'state') return counts.county - counts.state;
		if (precision === 'county') return counts.district - counts.county;
		return 0;
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

	// Load inferred location using the inference engine
	onMount(async () => {
		try {
			// DEV MODE: Force location for visual design evaluation
			if (browser && window.location.hostname === 'localhost') {
				console.log('[LocationFilter] 🎨 DEV MODE: Using mock location data for design evaluation');
				inferredLocation = {
					congressional_district: 'CA-16',
					state_code: 'CA',
					city_name: 'San Francisco',
					county_fips: '06075',
					confidence: 0.85,
					signals: [
						{
							signal_type: 'ip',
							confidence: 0.4,
							state_code: 'CA',
							city_name: 'San Francisco',
							congressional_district: 'CA-16',
							county_fips: '06075',
							latitude: 37.7749,
							longitude: -122.4194,
							source: 'dev.mock',
							timestamp: new Date().toISOString(),
							metadata: { county_name: 'San Francisco County' }
						}
					],
					inferred_at: new Date().toISOString()
				};

				locationSignals = inferredLocation.signals;
				isLoadingLocation = false;
				return; // Skip real inference in dev mode
			}

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
					console.log(
						'[LocationFilter] 🔄 Detected GPS signal without city_name - requesting fresh geolocation with Nominatim'
					);
					// Request fresh geolocation which will now include Nominatim city lookup
					const freshSignal = await addBrowserGeolocationSignal();

					if (freshSignal) {
						// Re-infer location with new signal
						location = await getUserLocation(true);
						console.log('[LocationFilter] ✓ Location updated with city_name:', location.city_name);
					}
				}
			}

			if (location && location.confidence > 0) {
				inferredLocation = location;

				// DEBUG: Log inferred location to understand why city isn't showing
				console.log('[LocationFilter] Inferred location:', {
					city_name: location.city_name,
					state_code: location.state_code,
					congressional_district: location.congressional_district,
					confidence: location.confidence
				});

				// Load signals for transparency display
				if (browser) {
					const signals = await locationStorage.getSignals();
					locationSignals = signals;

					// DEBUG: Log signals to understand source
					console.log(
						'[LocationFilter] Location signals:',
						signals.map((s) => ({
							source: s.source,
							city_name: s.city_name,
							confidence: s.confidence
						}))
					);
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
				console.warn(
					'[LocationFilter] 🔥 Detected corrupted IndexedDB schema - initiating recovery'
				);

				try {
					// Nuclear option: Delete and recreate database
					await locationStorage.nukeDatabase();
					console.log('[LocationFilter] ✓ Database nuked - reloading page for clean schema');

					// Force page reload to recreate database with correct schema
					window.location.reload();
					return; // Don't continue execution
				} catch (nukeError) {
					console.error('[LocationFilter] ✗ Failed to recover database:', nukeError);
					locationError = 'Database recovery failed - try clearing browser data';
				}
			} else {
				locationError = 'Unable to load location preferences';
			}

			isLoadingLocation = false;
		}
	});

	// Filter templates by precision level (progressive funnel)
	function filterTemplatesByPrecision(
		templates: TemplateWithJurisdictions[],
		precision: PrecisionLevel
	): TemplateWithJurisdictions[] {
		if (!inferredLocation) {
			// No location: show only federal templates
			return templates.filter((t) =>
				t.jurisdictions.some((j) => j.jurisdiction_type === 'federal')
			);
		}

		return templates.filter((template) => {
			for (const jurisdiction of template.jurisdictions) {
				// Federal templates shown at all levels
				if (jurisdiction.jurisdiction_type === 'federal') {
					return true;
				}

				// State-level: show federal + state templates
				if (precision === 'state') {
					if (
						jurisdiction.jurisdiction_type === 'state' &&
						jurisdiction.state_code === inferredLocation.state_code
					) {
						return true;
					}
				}

				// County-level: show federal + state + county templates
				if (precision === 'county' || precision === 'district') {
					// State templates
					if (
						jurisdiction.jurisdiction_type === 'state' &&
						jurisdiction.state_code === inferredLocation.state_code
					) {
						return true;
					}

					// County/city templates
					if (
						jurisdiction.jurisdiction_type === 'city' ||
						jurisdiction.jurisdiction_type === 'county'
					) {
						const countyName = locationSignals[0]?.metadata?.county_name;
						const matchesCity =
							inferredLocation.city_name &&
							(jurisdiction.city_name === inferredLocation.city_name ||
								jurisdiction.county_name?.includes(inferredLocation.city_name));
						const matchesCounty =
							countyName &&
							(jurisdiction.county_name === countyName || jurisdiction.city_name === countyName);

						if (matchesCity || matchesCounty) {
							return true;
						}
					}
				}

				// District-level: show ALL templates (federal + state + county + district)
				if (precision === 'district') {
					if (jurisdiction.congressional_district === inferredLocation.congressional_district) {
						return true;
					}
				}
			}

			return false;
		});
	}

	// Apply filtering when showLocalOnly or templates change
	$effect(() => {
		if (!showLocalOnly || !inferredLocation) {
			// Show all templates when filter is off
			onFilterChange(templates);
			return;
		}

		// Filter templates to only those with jurisdictions
		const templatesWithJurisdictions = templates.filter(
			(t): t is TemplateWithJurisdictions => 'jurisdictions' in t && Array.isArray(t.jurisdictions)
		);

		// Apply precision-based filtering (progressive funnel)
		const precisionFiltered = filterTemplatesByPrecision(
			templatesWithJurisdictions,
			currentPrecision
		);

		// Score templates by location relevance
		const scored = scoreTemplatesByRelevance(precisionFiltered, inferredLocation);

		// Apply behavioral boosting asynchronously
		getTemplateViewCounts()
			.then((viewCounts) => {
				const boosted = boostByUserBehavior(scored, viewCounts);
				const filtered = boosted.map((s) => s.template as Template);
				onFilterChange(filtered);
			})
			.catch((error) => {
				console.warn('[LocationFilter] Failed to apply behavioral boosting:', error);
				// Fallback to non-boosted results
				const filtered = scored.map((s) => s.template as Template);
				onFilterChange(filtered);
			});
	});

	function handleToggleFilter() {
		showLocalOnly = !showLocalOnly;
	}

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

		console.log('[LocationFilter] Address confirmed:', verified);

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

			console.log('[LocationFilter] ✓ Verified location updated:', location);
		} catch (error) {
			console.error('[LocationFilter] Error storing verified location:', error);
			locationError = 'Failed to save verified location';
		}
	}

	function handleAddressModalClose() {
		showAddressModal = false;
	}

	// Breadcrumb drill-down handlers
	function handleBreadcrumbClick(level: PrecisionLevel) {
		// Toggle precision level when clicking breadcrumb
		if (currentPrecision === level) {
			// Reset to natural precision if clicking current level
			forcedPrecision = null;
		} else {
			// Switch to clicked precision level
			forcedPrecision = level;
		}
	}
</script>

{#if isLoadingLocation}
	<!-- Loading skeleton (elegant, minimal) -->
	<div class="mb-4 animate-pulse rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
		<div class="flex items-center gap-2.5">
			<div class="h-8 w-8 rounded-full bg-slate-100"></div>
			<div class="flex-1 space-y-2">
				<div class="h-4 w-32 rounded-md bg-slate-100"></div>
				<div class="h-3 w-20 rounded-md bg-slate-50"></div>
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
	<!-- MINIMAL LOCATION HEADER (Location-as-Filter Principle) -->
	<div class="mb-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
		<!-- Location name with icon -->
		<div class="flex items-start gap-3">
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

			<div class="flex-1">
				<!-- H2 header (larger, more weight) -->
				<h2 class="text-3xl font-bold leading-tight text-slate-900">
					{#if districtLabel}
						{districtLabel}
					{:else if locationLabel}
						{locationLabel}
					{:else}
						Nationwide
					{/if}
				</h2>

				<!-- Coordination count (when available) -->
				{#if coordinationCount > 0}
					<p class="mt-2 text-base font-medium text-slate-600">
						{coordinationCount.toLocaleString()}
						{coordinationCount === 1 ? 'sent this' : 'coordinating'}
					</p>
				{/if}
			</div>
		</div>

		<!-- Geographic breadcrumb navigation (drill-down) -->
		{#if breadcrumbState || breadcrumbCounty || breadcrumbDistrict}
			<nav class="mt-4 flex items-center gap-2 text-sm" aria-label="Location breadcrumb">
				{#if breadcrumbState}
					<button
						onclick={() => handleBreadcrumbClick('state')}
						class="rounded-md px-3 py-1.5 font-medium transition-colors {currentPrecision ===
						'state'
							? 'bg-blue-100 text-blue-900'
							: 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'}"
						aria-current={currentPrecision === 'state' ? 'location' : undefined}
					>
						{breadcrumbState}
					</button>
				{/if}

				{#if breadcrumbCounty && naturalPrecision !== 'state'}
					<svg class="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 5l7 7-7 7"
						/>
					</svg>
					<button
						onclick={() => handleBreadcrumbClick('county')}
						class="rounded-md px-3 py-1.5 font-medium transition-colors {currentPrecision ===
						'county'
							? 'bg-blue-100 text-blue-900'
							: 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'}"
						aria-current={currentPrecision === 'county' ? 'location' : undefined}
					>
						{breadcrumbCounty}
					</button>
				{/if}

				{#if breadcrumbDistrict && naturalPrecision === 'district'}
					<svg class="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 5l7 7-7 7"
						/>
					</svg>
					<button
						onclick={() => handleBreadcrumbClick('district')}
						class="rounded-md px-3 py-1.5 font-medium transition-colors {currentPrecision ===
						'district'
							? 'bg-blue-100 text-blue-900'
							: 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'}"
						aria-current={currentPrecision === 'district' ? 'location' : undefined}
					>
						{breadcrumbDistrict}
					</button>
				{/if}
			</nav>
		{/if}

		<!-- Progressive affordance buttons (3-step funnel) -->
		<div class="mt-3 space-y-2">
			{#if !districtLabel && !locationLabel}
				<!-- STEP 0: No location → Ask for GPS or address -->
				<button
					onclick={handleUpdateLocation}
					disabled={isDetectingLocation}
					class="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50"
				>
					{isDetectingLocation ? 'Detecting...' : "See what's happening nearby →"}
				</button>
			{:else if !districtLabel && locationLabel}
				<!-- STEP 1: Has state/county → Offer district precision -->
				<div class="space-y-2">
					<button
						onclick={() => (showAddressModal = true)}
						class="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:bg-blue-800"
					>
						Find who represents you →
					</button>
					<!-- Show preview of next-level coordination -->
					{#if nextLevelCount > 0}
						<p class="text-center text-xs text-slate-500">
							{#if currentPrecision === 'state'}
								+{nextLevelCount} more coordinating in your county
							{:else if currentPrecision === 'county'}
								+{nextLevelCount} more coordinating in your district
							{/if}
						</p>
					{:else if coordinationCount > 0}
						<p class="text-center text-xs text-slate-500">
							See congressional district coordination
						</p>
					{/if}
				</div>
			{:else if districtLabel}
				<!-- STEP 2: Has district → Show filter toggle -->
				<div class="flex items-center gap-2">
					{#if coordinationCount > 0}
						<button
							onclick={handleToggleFilter}
							class="flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-all {showLocalOnly
								? 'bg-slate-900 text-white shadow-sm hover:bg-slate-800'
								: 'bg-slate-100 text-slate-700 hover:bg-slate-200'}"
						>
							{showLocalOnly
								? `Showing ${coordinationCount} coordinating`
								: `See ${coordinationCount} coordinating`}
						</button>
					{/if}
					<!-- Change address option -->
					<button
						onclick={() => (showAddressModal = true)}
						class="rounded-lg px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
					>
						Change location
					</button>
				</div>
			{/if}
		</div>

		<!-- Template preview card (next precision level) -->
		{#if nextLevelCount > 0 && (currentPrecision === 'state' || currentPrecision === 'county')}
			<div class="mt-4">
				<TemplatePreviewCard
					templateCount={nextLevelCount}
					precisionLevel={currentPrecision === 'state' ? 'county' : 'district'}
					onUnlock={currentPrecision === 'state'
						? handleUpdateLocation
						: () => (showAddressModal = true)}
				/>
			</div>
		{/if}

		<!-- Technical details (progressive disclosure) -->
		{#if locationSignals.length > 0}
			<details class="group mt-4">
				<summary class="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">
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
					<div class="text-xs">
						<span class="font-medium text-slate-700">Source:</span>
						<span class="ml-1 text-slate-600">
							{#if locationSignals.some((s) => s.signal_type === 'verified')}
								Verified address
							{:else if locationSignals.some((s) => s.source === 'census.browser' || s.source === 'nominatim.browser')}
								GPS (browser location)
							{:else if locationSignals.some((s) => s.source === 'ip.geolocation')}
								IP address
							{:else if locationSignals.some((s) => s.source.includes('oauth'))}
								OAuth profile
							{:else}
								Browser inference
							{/if}
						</span>
					</div>

					<!-- Accuracy level -->
					<div class="text-xs">
						<span class="font-medium text-slate-700">Precision:</span>
						<span class="ml-1 text-slate-600">
							{#if districtLabel}
								District-level (100% accurate)
							{:else if inferredLocation?.city_name}
								City-level (95% accurate)
							{:else if inferredLocation?.state_code}
								State-level (89% accurate)
							{:else}
								Nationwide
							{/if}
						</span>
					</div>

					<!-- Privacy note -->
					<div class="border-t border-slate-200 pt-2 text-xs text-slate-500">
						Your location data stays in your browser. Never sent to our servers.
					</div>
				</div>
			</details>
		{/if}
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
				<h4 class="text-sm font-semibold text-slate-900">Find your representatives</h4>
				<p class="mt-0.5 text-xs leading-relaxed text-slate-600">
					Enter your address to see issues in your district
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

<!-- Address Confirmation Modal -->
<AddressConfirmationModal
	isOpen={showAddressModal}
	on:close={handleAddressModalClose}
	on:confirm={handleAddressConfirmed}
/>
