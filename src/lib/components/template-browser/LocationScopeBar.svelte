<script lang="ts">
	/**
	 * LocationScopeBar: Breadcrumb-based geographic scope navigation
	 *
	 * PERCEPTUAL ENGINEERING:
	 * - Breadcrumb hierarchy communicates geographic specificity (Country > State > City)
	 * - Each level is independently editable (hover→pencil, click→scoped autocomplete)
	 * - Each level is independently filterable (click toggles scope filter)
	 * - "Set your location" omnibar entry point when no scope is set
	 * - Chevron separators encode containment relationship
	 *
	 * This is the breadcrumb interaction from LocationFilter, stripped of:
	 * - inference-engine.ts (no automatic IP/browser/OAuth/behavioral signals)
	 * - behavioral-tracker.ts (no view tracking)
	 * - locationStorage / IndexedDB (GeoScope persisted to localStorage by parent)
	 * - District resolution (address verification stays hidden)
	 *
	 * Data flow: User selects via LocationAutocomplete → resolveToGeoScope() → onScopeChange()
	 * Parent derives InferredLocation from GeoScope for scoring engine.
	 */

	import LocationAutocomplete from './LocationAutocomplete.svelte';
	import type { LocationHierarchy } from '$lib/core/location/location-search';
	import { resolveToGeoScope } from '$lib/core/location/location-resolver';
	import { stateCodeToName, countryCodeToName } from '$lib/core/location/location-resolver';
	import type { GeoScope } from '$lib/core/agents/types';
	import type { GeographicScope } from '$lib/core/location/template-filter';

	interface Props {
		scope: GeoScope | null;
		inferred?: boolean; // true when scope came from auto-inference (IP/timezone), not user selection
		onScopeChange: (scope: GeoScope | null) => void;
	}

	let { scope, onScopeChange, inferred = false }: Props = $props();

	// Geographic scope filter for breadcrumb highlighting
	let selectedFilter = $state<GeographicScope>(null);

	// Derive breadcrumb labels from GeoScope
	const breadcrumbCountry = $derived.by(() => {
		if (!scope) return null;
		if (scope.type === 'international') return null;
		return countryCodeToName(scope.country) || scope.country;
	});

	const breadcrumbCountryCode = $derived.by(() => {
		if (!scope) return null;
		if (scope.type === 'international') return null;
		return scope.country;
	});

	const breadcrumbState = $derived.by(() => {
		if (!scope || scope.type !== 'subnational' || !scope.subdivision) return null;
		// subdivision is "US-CA" → extract "CA"
		const stateCode = scope.subdivision.split('-')[1];
		if (!stateCode) return null;
		return stateCodeToName(stateCode, scope.country) || stateCode;
	});

	const breadcrumbStateCode = $derived.by(() => {
		if (!scope || scope.type !== 'subnational' || !scope.subdivision) return null;
		return scope.subdivision.split('-')[1] || null;
	});

	const breadcrumbCity = $derived.by(() => {
		if (!scope || scope.type !== 'subnational') return null;
		return scope.locality || null;
	});

	/**
	 * Handle location selection from any breadcrumb autocomplete.
	 * Converts LocationHierarchy → GeoScope → calls parent.
	 */
	function handleLocationSelect(result: LocationHierarchy) {
		const geoScope = resolveToGeoScope(result);
		selectedFilter = null; // Reset scope filter on new selection
		onScopeChange(geoScope);
	}

	/**
	 * Toggle breadcrumb scope filter (click breadcrumb to filter to that level).
	 */
	function handleScopeFilter(filterScope: GeographicScope) {
		selectedFilter = selectedFilter === filterScope ? null : filterScope;
	}
</script>

<div class="location-breadcrumb-bar">
	{#if scope && scope.type !== 'international'}
		<!-- Breadcrumb navigation: hierarchical geographic scope -->
		<nav
			class="breadcrumb-nav"
			aria-label="Geographic scope navigation"
		>
			{#if breadcrumbCountry}
				<LocationAutocomplete
					label={breadcrumbCountry}
					level="country"
					isSelected={selectedFilter === 'nationwide'}
					onselect={handleLocationSelect}
					onfilter={() => handleScopeFilter('nationwide')}
				/>
			{/if}

			{#if breadcrumbState && breadcrumbCountry}
				<svg class="breadcrumb-chevron" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
			{/if}

			{#if breadcrumbState}
				<LocationAutocomplete
					label={breadcrumbState}
					level="state"
					currentCountry={breadcrumbCountryCode ?? undefined}
					isSelected={selectedFilter === 'state'}
					onselect={handleLocationSelect}
					onfilter={() => handleScopeFilter('state')}
				/>
			{/if}

			{#if breadcrumbCity && breadcrumbState}
				<svg class="breadcrumb-chevron" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
			{/if}

			{#if breadcrumbCity}
				<LocationAutocomplete
					label={breadcrumbCity}
					level="city"
					currentCountry={breadcrumbCountryCode ?? undefined}
					currentState={breadcrumbStateCode ?? undefined}
					isSelected={selectedFilter === 'city'}
					onselect={handleLocationSelect}
					onfilter={() => handleScopeFilter('city')}
				/>
			{/if}

			<!-- Clear affordance -->
			<button
				class="breadcrumb-clear"
				onclick={() => { selectedFilter = null; onScopeChange(null); }}
				aria-label="Clear location"
				title="Clear location"
			>
				<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</nav>

		<!-- Privacy note — pragmatically cypherpunk -->
		<div class="privacy-note">
			<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
			</svg>
			{#if inferred}
				<span>Approximated from your connection. No third parties.</span>
			{:else}
				<span>Stored in your browser. Search queries proxied through our server.</span>
			{/if}
		</div>
	{:else}
		<!-- No location: omnibar entry point -->
		<nav
			class="breadcrumb-nav"
			aria-label="Set your location"
		>
			<LocationAutocomplete
				label="Set your location"
				level="country"
				mode="omnibar"
				isSelected={false}
				onselect={handleLocationSelect}
				onfilter={() => {}}
			/>
			<span class="entry-hint">
				to see relevant campaigns nearby
			</span>
		</nav>
	{/if}
</div>

<style>
	.location-breadcrumb-bar {
		padding: 0.75rem 1rem;
		background: white;
		border-radius: 0.75rem;
		border: 1px solid oklch(0.92 0.01 250);
		box-shadow: 0 1px 2px oklch(0 0 0 / 0.04);
	}

	.breadcrumb-nav {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.375rem;
	}

	.breadcrumb-chevron {
		height: 1rem;
		width: 1rem;
		flex-shrink: 0;
		color: oklch(0.7 0.01 250);
	}

	.breadcrumb-clear {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin-left: 0.25rem;
		padding: 0.25rem;
		border-radius: 50%;
		border: none;
		background: transparent;
		color: oklch(0.6 0.02 250);
		cursor: pointer;
		transition: all 150ms ease-out;
	}

	.breadcrumb-clear:hover {
		background: oklch(0.94 0.02 250);
		color: oklch(0.4 0.03 250);
	}

	.privacy-note {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid oklch(0.95 0.005 250);
		font-size: 0.6875rem;
		color: oklch(0.6 0.02 250);
		font-family: 'Satoshi', system-ui, sans-serif;
	}

	.entry-hint {
		font-size: 0.75rem;
		color: oklch(0.55 0.02 250);
		font-family: 'Satoshi', system-ui, sans-serif;
	}
</style>
