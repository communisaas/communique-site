/**
 * Location search via server proxy.
 *
 * Replaces direct browser->Nominatim calls (geocoding-api.ts) and the
 * IndexedDB cache wrapper (autocomplete-cache.ts) with a single thin
 * client-side module that calls GET /api/location/search.
 *
 * Migration: swap imports from 'geocoding-api' / 'autocomplete-cache' to
 * this module -- the function signatures are identical.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LocationHierarchy {
	country: {
		/** ISO 3166-1 alpha-2 code (e.g. 'US', 'CA', 'GB'). Empty string if unknown. */
		code: string;
		/** Full country name (e.g. 'United States'). */
		name: string;
	};
	state: {
		/** ISO state/province code (e.g. 'CA', 'ON', 'QLD'). */
		code: string;
		/** Full state/province name (e.g. 'California'). */
		name: string;
		/** Parent country ISO code. */
		country_code: string;
	} | null;
	city: {
		/** City name (e.g. 'San Francisco'). */
		name: string;
		/** Parent state code, if resolvable. */
		state_code: string | null;
		/** Parent country ISO code. */
		country_code: string;
		/** Latitude. */
		lat: number;
		/** Longitude. */
		lon: number;
	} | null;
	/** Human-readable display string (e.g. "San Francisco, California, United States"). */
	display_name: string;
}

// ---------------------------------------------------------------------------
// In-memory cache (replaces IndexedDB autocomplete-cache.ts)
// ---------------------------------------------------------------------------

const cache = new Map<string, { results: LocationHierarchy[]; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour (matches server Cache-Control)
const MAX_CACHE_ENTRIES = 200;

function cacheKey(
	query: string,
	scope: string,
	country?: string,
	state?: string
): string {
	return [query.toLowerCase().trim(), scope, country || '', state || ''].join(':');
}

/**
 * Evict oldest entries when the cache exceeds MAX_CACHE_ENTRIES.
 * Simple LRU-ish: sort by timestamp, remove the oldest quarter.
 */
function evictIfNeeded(): void {
	if (cache.size <= MAX_CACHE_ENTRIES) return;

	const entries = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
	const toRemove = Math.floor(entries.length / 4);
	for (let i = 0; i < toRemove; i++) {
		cache.delete(entries[i][0]);
	}
}

// ---------------------------------------------------------------------------
// Core search function
// ---------------------------------------------------------------------------

/**
 * Search locations via the server-side Nominatim proxy.
 *
 * Returns cached results when available. On network failure returns an empty
 * array (graceful degradation -- the UI should handle empty results).
 *
 * @param query - Search text (min 2 characters)
 * @param scope - Geographic scope: 'country', 'state', or 'city'
 * @param countryCode - ISO 3166-1 country filter (e.g. 'US')
 * @param stateCode - State/province code filter (e.g. 'CA'), only used with scope='city'
 */
export async function searchLocations(
	query: string,
	scope: 'country' | 'state' | 'city' = 'city',
	countryCode?: string,
	stateCode?: string
): Promise<LocationHierarchy[]> {
	if (!query || query.trim().length < 2) return [];

	const key = cacheKey(query, scope, countryCode, stateCode);
	const cached = cache.get(key);
	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		return cached.results;
	}

	const params = new URLSearchParams({ q: query.trim(), scope });
	if (countryCode) params.set('country', countryCode);
	if (stateCode) params.set('state', stateCode);

	try {
		const response = await fetch(`/api/location/search?${params}`);
		if (!response.ok) return [];

		const results: LocationHierarchy[] = await response.json();

		cache.set(key, { results, timestamp: Date.now() });
		evictIfNeeded();

		return results;
	} catch {
		return [];
	}
}

// ---------------------------------------------------------------------------
// Convenience aliases (match old geocoding-api.ts signatures for easy migration)
// ---------------------------------------------------------------------------

/**
 * Search cities within a specific state/country.
 */
export async function searchCities(
	query: string,
	stateCode: string,
	countryCode = 'US'
): Promise<LocationHierarchy[]> {
	return searchLocations(query, 'city', countryCode, stateCode);
}

/**
 * Search states within a specific country.
 */
export async function searchStates(
	query: string,
	countryCode = 'US'
): Promise<LocationHierarchy[]> {
	return searchLocations(query, 'state', countryCode);
}

/**
 * Search countries by name.
 */
export async function searchCountries(query: string): Promise<LocationHierarchy[]> {
	return searchLocations(query, 'country');
}
