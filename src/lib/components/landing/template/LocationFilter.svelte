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
	let showPrivacyExplainer = $state(false);
	let showSignalBreakdown = $state(false);
	let showAddressModal = $state(false);

	// Computed
	const hasLocation = $derived(
		inferredLocation && (inferredLocation.congressional_district || inferredLocation.city_name)
	);

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
				'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
				'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
				'DC': 'Washington DC', 'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii',
				'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
				'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine',
				'MD': 'Maryland', 'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota',
				'MS': 'Mississippi', 'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska',
				'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico',
				'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
				'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island',
				'SC': 'South Carolina', 'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas',
				'UT': 'Utah', 'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington',
				'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
				'PR': 'Puerto Rico', 'GU': 'Guam', 'VI': 'US Virgin Islands',
				'AS': 'American Samoa', 'MP': 'Northern Mariana Islands'
			};
			return stateNames[inferredLocation.state_code] || inferredLocation.state_code;
		}

		return null;
	});

	const districtLabel = $derived.by(() => {
		if (!inferredLocation?.congressional_district) return null;
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
					s => (s.source === 'census.browser' || s.source === 'nominatim.browser') && !s.city_name
				);

				if (oldGPSSignal) {
					console.log('[LocationFilter] 🔄 Detected GPS signal without city_name - requesting fresh geolocation with Nominatim');
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
					console.log('[LocationFilter] Location signals:', signals.map(s => ({
						source: s.source,
						city_name: s.city_name,
						confidence: s.confidence
					})));

					// Check if this is first time seeing inferred location (cypherpunk "holy shit" moment)
					const hasSeenExplainer = localStorage.getItem('location_privacy_explainer_seen');
					if (!hasSeenExplainer && signals.length > 0) {
						showPrivacyExplainer = true;
						localStorage.setItem('location_privacy_explainer_seen', 'true');
					}
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

	// Apply filtering when showLocalOnly or templates change
	$effect(() => {
		if (!showLocalOnly || !inferredLocation) {
			// Show all templates
			onFilterChange(templates);
			return;
		}

		// Filter templates to only those with jurisdictions
		const templatesWithJurisdictions = templates.filter(
			(t): t is TemplateWithJurisdictions => 'jurisdictions' in t && Array.isArray(t.jurisdictions)
		);

		// Score templates by location relevance
		const scored = scoreTemplatesByRelevance(templatesWithJurisdictions, inferredLocation);

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
</script>

<!-- Privacy Explainer Modal (First-Time Delightful Discovery) -->
{#if showPrivacyExplainer && hasLocation}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm transition-opacity duration-200"
	>
		<div
			class="max-w-md scale-100 transform rounded-xl bg-white p-6 shadow-2xl ring-1 ring-slate-900/5 transition-all duration-200"
		>
			<!-- Header with Trust Badge -->
			<div class="mb-4 flex items-start gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
					<svg
						class="h-5 w-5 text-emerald-600"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2.5"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
				</div>
				<div>
					<h2 class="text-lg font-semibold tracking-tight text-slate-900">
						Issues in {locationLabel}
					</h2>
					<p class="mt-0.5 text-sm text-slate-600">
						Location inferred from IP
					</p>
				</div>
			</div>

			<!-- Main Message - Simple -->
			<div class="mb-4 text-sm text-slate-700">
				<p class="leading-relaxed">
					Showing legislation relevant to your district.
				</p>

				<!-- Technical Details - Progressive Disclosure -->
				<details class="group mt-3">
					<summary
						class="cursor-pointer text-xs font-medium text-slate-500 transition-colors hover:text-slate-700"
					>
						<span class="inline-flex items-center gap-1">
							How this works
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
						</span>
					</summary>
					<div class="mt-2 space-y-2 pl-1 text-xs text-slate-600">
						<p>
							• Analyzed {locationSignals.length} signal{locationSignals.length !== 1 ? 's' : ''} (IP, timezone,
							OAuth data)
						</p>
						<p>• Stored in browser IndexedDB (not our database)</p>
						<p>
							• {Math.round((inferredLocation?.confidence || 0) * 100)}% confidence based on
							signal quality
						</p>
					</div>
				</details>
			</div>

			<!-- Primary Action - Clean, Confident -->
			<button
				onclick={() => (showPrivacyExplainer = false)}
				class="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-slate-800 active:bg-slate-700"
			>
				Got it
			</button>
		</div>
	</div>
{/if}

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
	<!-- ELEGANT CONSUMER-FRIENDLY LOCATION DISPLAY -->
	<div
		class="group mb-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5 transition-all hover:shadow-md hover:ring-slate-900/10"
	>
		<!-- Location Header -->
		<div class="mb-3 flex items-center gap-2.5">
			<!-- Location Pin Icon -->
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

			<!-- Location Text -->
			<div class="min-w-0 flex-1">
				<h3 class="truncate text-[15px] font-medium tracking-tight text-slate-900">
					{locationLabel}
				</h3>
				<p class="mt-0.5 text-xs text-slate-500">
					{#if districtLabel}
						{districtLabel}
					{:else if inferredLocation?.state_code}
						Showing statewide templates
					{:else}
						Your location
					{/if}
				</p>
			</div>
		</div>

		<!-- Privacy Indicator (Subtle) -->
		<div class="mb-3 flex items-center gap-2 text-xs text-slate-500">
			<svg class="h-3.5 w-3.5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
				<path
					fill-rule="evenodd"
					d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
					clip-rule="evenodd"
				/>
			</svg>
			<span>Data stays in browser</span>
		</div>

		<!-- Signal Breakdown (Progressive Disclosure - Technical Users Only) -->
		{#if locationSignals.length > 0}
			{@const uniqueSignals = locationSignals.filter(
				(signal, index, self) =>
					index === self.findIndex((s) => s.source === signal.source && s.signal_type === signal.signal_type)
			)}
			<details class="group/signals mb-3">
				<summary
					class="cursor-pointer list-none text-xs font-medium text-slate-500 transition-colors hover:text-slate-700"
				>
					<span class="inline-flex items-center gap-1.5">
						<svg
							class="h-3 w-3 transition-transform group-open/signals:rotate-180"
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
						<span>How we determined this</span>
					</span>
				</summary>

				<div class="mt-2.5 space-y-1.5 pl-1">
					{#each uniqueSignals as signal}
						<div class="rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
							{#if signal.source === 'browser.timezone'}
								Inferred from timezone
							{:else if signal.source === 'ip.geolocation'}
								IP address location
							{:else if signal.source === 'census.browser'}
								GPS coordinates
							{:else if signal.source === 'nominatim.browser'}
								GPS coordinates (Census API unavailable)
							{:else if signal.source.includes('oauth')}
								OAuth provider profile
							{:else if signal.signal_type === 'verified'}
								Identity verification
							{:else}
								Browser signal
							{/if}
						</div>
					{/each}
				</div>
			</details>
		{/if}

		<!-- Actions -->
		<div class="flex items-center gap-2">
			{#if !districtLabel}
				<!-- No district: prompt address confirmation -->
				<button
					onclick={() => (showAddressModal = true)}
					class="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-blue-700 active:bg-blue-800"
				>
					Enter your address
				</button>
			{:else}
				<!-- Has district: show filter toggle + change address option -->
				{#if localTemplateCount > 0}
					<button
						onclick={handleToggleFilter}
						class="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-150 {showLocalOnly
							? 'bg-slate-900 text-white shadow-sm hover:bg-slate-800 active:bg-slate-700'
							: 'bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300'}"
					>
						{showLocalOnly ? `Showing ${localTemplateCount} local` : 'Show local issues'}
					</button>
				{/if}
				<button
					onclick={() => (showAddressModal = true)}
					class="rounded-lg px-3.5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
					title="Update your address"
				>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
					</svg>
				</button>
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
