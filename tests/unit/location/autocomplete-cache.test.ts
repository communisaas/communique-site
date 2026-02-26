/**
 * Location Search Module Tests
 *
 * Tests the in-memory cached location search client (location-search.ts)
 * which replaces the old IndexedDB-backed autocomplete-cache.ts.
 *
 * The module calls GET /api/location/search via fetch and caches results
 * in a Map with 1-hour TTL and 200-entry eviction.
 *
 * Strategy:
 * - Mocks the module's internal fetch call via vi.mock + hoisted mock
 * - Uses vi.spyOn(Date, 'now') for TTL testing
 * - Uses vi.resetModules() to clear the module-level cache between tests
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LocationHierarchy } from '$lib/core/location/location-search';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLocationResult(overrides: Partial<LocationHierarchy> = {}): LocationHierarchy {
	return {
		country: { code: 'US', name: 'United States' },
		state: { code: 'CA', name: 'California', country_code: 'US' },
		city: {
			name: 'San Francisco',
			state_code: 'CA',
			country_code: 'US',
			lat: 37.7749,
			lon: -122.4194
		},
		display_name: 'San Francisco, California, United States',
		...overrides
	};
}

const BASE_TIME = new Date('2026-02-23T12:00:00Z').getTime();

// ---------------------------------------------------------------------------
// Tracking mock for fetch — captures URL and returns configured responses
// ---------------------------------------------------------------------------

let fetchResponses: Array<{ data: unknown; status: number } | { error: Error }> = [];
let fetchCalls: string[] = [];

/**
 * Custom fetch that the module calls. Captures URLs and returns
 * pre-configured responses from the fetchResponses queue.
 */
async function mockFetchImpl(input: string | URL | Request): Promise<Response> {
	const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
	fetchCalls.push(url);

	const next = fetchResponses.shift();
	if (!next) {
		// Default: return empty array (no data configured)
		return new Response(JSON.stringify([]), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	if ('error' in next) {
		throw next.error;
	}

	return new Response(JSON.stringify(next.data), {
		status: next.status,
		headers: { 'Content-Type': 'application/json' }
	});
}

/** Queue a successful fetch response */
function queueFetchSuccess(data: unknown) {
	fetchResponses.push({ data, status: 200 });
}

/** Queue a fetch error response */
function queueFetchError(status = 500) {
	fetchResponses.push({ data: { error: 'Server error' }, status });
}

/** Queue a network error */
function queueFetchNetworkError() {
	fetchResponses.push({ error: new TypeError('Failed to fetch') });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Location Search (location-search.ts)', () => {
	let dateNowSpy: ReturnType<typeof vi.spyOn> | null = null;
	let simulatedNow: number;

	let searchLocations: typeof import('$lib/core/location/location-search').searchLocations;
	let searchCities: typeof import('$lib/core/location/location-search').searchCities;
	let searchStates: typeof import('$lib/core/location/location-search').searchStates;
	let searchCountries: typeof import('$lib/core/location/location-search').searchCountries;

	function advanceTime(ms: number) {
		simulatedNow += ms;
		if (dateNowSpy) dateNowSpy.mockReturnValue(simulatedNow);
	}

	beforeEach(async () => {
		// Reset response queue and call tracker
		fetchResponses = [];
		fetchCalls = [];
		simulatedNow = BASE_TIME;
		dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(simulatedNow);

		// Stub global fetch BEFORE importing the module
		vi.stubGlobal('fetch', mockFetchImpl);

		// Reset modules to clear the module-level cache Map
		vi.resetModules();
		const mod = await import('$lib/core/location/location-search');
		searchLocations = mod.searchLocations;
		searchCities = mod.searchCities;
		searchStates = mod.searchStates;
		searchCountries = mod.searchCountries;
	});

	afterEach(() => {
		if (dateNowSpy) dateNowSpy.mockRestore();
		dateNowSpy = null;
		vi.unstubAllGlobals();
	});

	// =========================================================================
	// searchLocations - cache miss vs hit
	// =========================================================================

	describe('searchLocations', () => {
		it('should call fetch on cache miss and return results', async () => {
			queueFetchSuccess([makeLocationResult()]);

			const actual = await searchLocations('San Francisco', 'city', 'US', 'CA');

			expect(actual).toHaveLength(1);
			expect(actual[0].city?.name).toBe('San Francisco');
			expect(fetchCalls).toHaveLength(1);

			// Verify the fetch URL
			expect(fetchCalls[0]).toContain('/api/location/search');
			expect(fetchCalls[0]).toContain('q=San+Francisco');
			expect(fetchCalls[0]).toContain('scope=city');
			expect(fetchCalls[0]).toContain('country=US');
			expect(fetchCalls[0]).toContain('state=CA');
		});

		it('should return cached results on cache hit without calling fetch', async () => {
			queueFetchSuccess([makeLocationResult()]);

			await searchLocations('San Francisco', 'city', 'US', 'CA');
			expect(fetchCalls).toHaveLength(1);

			// Second call should use cache
			const results = await searchLocations('San Francisco', 'city', 'US', 'CA');
			expect(results).toHaveLength(1);
			expect(results[0].city?.name).toBe('San Francisco');
			expect(fetchCalls).toHaveLength(1); // Still 1 — cache hit
		});

		it('should re-fetch after TTL expiry (1 hour)', async () => {
			queueFetchSuccess([makeLocationResult()]);
			await searchLocations('Austin', 'city', 'US', 'TX');

			// Advance past the 1-hour TTL
			advanceTime(61 * 60 * 1000);

			const updatedResult = makeLocationResult({
				city: {
					name: 'Austin Updated',
					state_code: 'TX',
					country_code: 'US',
					lat: 30.2672,
					lon: -97.7431
				}
			});
			queueFetchSuccess([updatedResult]);

			const results = await searchLocations('Austin', 'city', 'US', 'TX');
			expect(fetchCalls).toHaveLength(2);
			expect(results[0].city?.name).toBe('Austin Updated');
		});

		it('should serve from cache within TTL (30 minutes)', async () => {
			queueFetchSuccess([makeLocationResult()]);
			await searchLocations('Denver', 'city', 'US', 'CO');

			advanceTime(30 * 60 * 1000); // 30 minutes

			await searchLocations('Denver', 'city', 'US', 'CO');
			expect(fetchCalls).toHaveLength(1); // Cache hit
		});

		it('should use default scope of city when not specified', async () => {
			queueFetchSuccess([makeLocationResult()]);

			await searchLocations('Portland');

			expect(fetchCalls[0]).toContain('scope=city');
		});

		it('should cache different queries separately', async () => {
			const sfResult = [makeLocationResult()];
			const laResult = [
				makeLocationResult({
					city: {
						name: 'Los Angeles',
						state_code: 'CA',
						country_code: 'US',
						lat: 34.0522,
						lon: -118.2437
					},
					display_name: 'Los Angeles, California, United States'
				})
			];

			queueFetchSuccess(sfResult);
			queueFetchSuccess(laResult);

			const r1 = await searchLocations('San Francisco', 'city');
			const r2 = await searchLocations('Los Angeles', 'city');

			expect(r1[0].city?.name).toBe('San Francisco');
			expect(r2[0].city?.name).toBe('Los Angeles');
			expect(fetchCalls).toHaveLength(2);
		});

		it('should generate case-insensitive cache keys (lowercase + trim)', async () => {
			queueFetchSuccess([makeLocationResult()]);

			await searchLocations('  San Francisco  ', 'city', 'US', 'CA');

			// Same query in lowercase should be a cache hit
			await searchLocations('san francisco', 'city', 'US', 'CA');
			expect(fetchCalls).toHaveLength(1);
		});

		it('should treat different scopes as separate cache entries', async () => {
			queueFetchSuccess([makeLocationResult()]);
			queueFetchSuccess([makeLocationResult()]);

			await searchLocations('California', 'state', 'US');
			await searchLocations('California', 'city', 'US');
			expect(fetchCalls).toHaveLength(2);
		});

		it('should return empty array for queries shorter than 2 characters', async () => {
			const results = await searchLocations('A');
			expect(results).toHaveLength(0);
			expect(fetchCalls).toHaveLength(0);
		});

		it('should return empty array for empty query', async () => {
			const results = await searchLocations('');
			expect(results).toHaveLength(0);
			expect(fetchCalls).toHaveLength(0);
		});

		it('should return empty array on fetch error (graceful degradation)', async () => {
			queueFetchError(500);

			const results = await searchLocations('ErrorCity', 'city');
			expect(results).toHaveLength(0);
		});

		it('should return empty array on network error (graceful degradation)', async () => {
			queueFetchNetworkError();

			const results = await searchLocations('OfflineCity', 'city');
			expect(results).toHaveLength(0);
		});

		it('should handle API returning empty results', async () => {
			queueFetchSuccess([]);

			const results = await searchLocations('Nonexistent Place', 'city');
			expect(results).toHaveLength(0);
		});
	});

	// =========================================================================
	// searchCities
	// =========================================================================

	describe('searchCities', () => {
		it('should delegate to searchLocations with city scope', async () => {
			queueFetchSuccess([makeLocationResult()]);

			const results = await searchCities('Austin', 'TX', 'US');

			expect(results).toHaveLength(1);
			expect(fetchCalls[0]).toContain('scope=city');
			expect(fetchCalls[0]).toContain('country=US');
			expect(fetchCalls[0]).toContain('state=TX');
		});

		it('should default countryCode to US', async () => {
			queueFetchSuccess([makeLocationResult()]);

			await searchCities('Portland', 'OR');

			expect(fetchCalls[0]).toContain('country=US');
			expect(fetchCalls[0]).toContain('state=OR');
		});

		it('should accept non-US country codes', async () => {
			queueFetchSuccess([makeLocationResult()]);

			await searchCities('Toronto', 'ON', 'CA');

			expect(fetchCalls[0]).toContain('country=CA');
			expect(fetchCalls[0]).toContain('state=ON');
		});

		it('should return cached city results on repeated calls', async () => {
			queueFetchSuccess([makeLocationResult()]);

			await searchCities('Austin', 'TX', 'US');
			await searchCities('Austin', 'TX', 'US');
			expect(fetchCalls).toHaveLength(1);
		});
	});

	// =========================================================================
	// searchStates
	// =========================================================================

	describe('searchStates', () => {
		it('should delegate to searchLocations with state scope', async () => {
			queueFetchSuccess([makeLocationResult()]);

			await searchStates('California');

			expect(fetchCalls[0]).toContain('scope=state');
			expect(fetchCalls[0]).toContain('country=US');
		});

		it('should default countryCode to US', async () => {
			queueFetchSuccess([makeLocationResult()]);

			await searchStates('Texas');

			expect(fetchCalls[0]).toContain('country=US');
		});

		it('should accept non-US country codes', async () => {
			queueFetchSuccess([makeLocationResult()]);

			await searchStates('Ontario', 'CA');

			expect(fetchCalls[0]).toContain('country=CA');
		});

		it('should cache state search results', async () => {
			queueFetchSuccess([makeLocationResult()]);

			await searchStates('New York');
			await searchStates('New York');
			expect(fetchCalls).toHaveLength(1);
		});
	});

	// =========================================================================
	// searchCountries
	// =========================================================================

	describe('searchCountries', () => {
		it('should delegate to searchLocations with country scope', async () => {
			queueFetchSuccess([makeLocationResult()]);

			await searchCountries('United States');

			expect(fetchCalls[0]).toContain('scope=country');
			expect(fetchCalls[0]).not.toContain('country=');
			expect(fetchCalls[0]).not.toContain('state=');
		});

		it('should cache country search results', async () => {
			queueFetchSuccess([makeLocationResult()]);

			await searchCountries('Canada');
			await searchCountries('Canada');
			expect(fetchCalls).toHaveLength(1);
		});

		it('should handle partial country names', async () => {
			queueFetchSuccess([makeLocationResult()]);

			await searchCountries('Unit');

			expect(fetchCalls[0]).toContain('q=Unit');
		});
	});

	// =========================================================================
	// Edge cases
	// =========================================================================

	describe('Edge cases', () => {
		it('should handle special characters in query strings', async () => {
			queueFetchSuccess([makeLocationResult()]);

			await searchLocations("St. Louis' Park", 'city', 'US');

			expect(fetchCalls[0]).toContain('q=St.');
		});

		it('should handle unicode characters', async () => {
			queueFetchSuccess([makeLocationResult()]);

			await searchLocations('München', 'city');

			expect(fetchCalls).toHaveLength(1);
		});

		it('should cache results with multiple locations', async () => {
			const multipleResults = [
				makeLocationResult({ display_name: 'Portland, Oregon, US' }),
				makeLocationResult({
					city: {
						name: 'Portland',
						state_code: 'ME',
						country_code: 'US',
						lat: 43.6591,
						lon: -70.2568
					},
					display_name: 'Portland, Maine, US'
				})
			];
			queueFetchSuccess(multipleResults);

			const first = await searchLocations('Portland', 'city', 'US');
			const second = await searchLocations('Portland', 'city', 'US');

			expect(first).toHaveLength(2);
			expect(second).toHaveLength(2);
			expect(fetchCalls).toHaveLength(1); // Cache hit on second call
		});

		it('should generate distinct cache keys for different state filters', async () => {
			queueFetchSuccess([makeLocationResult()]);
			queueFetchSuccess([makeLocationResult()]);

			await searchLocations('Portland', 'city', 'US', 'OR');
			await searchLocations('Portland', 'city', 'US', 'ME');
			expect(fetchCalls).toHaveLength(2);
		});

		it('should treat undefined and missing filters as equivalent', async () => {
			queueFetchSuccess([makeLocationResult()]);

			await searchLocations('London', 'city', undefined, undefined);
			await searchLocations('London', 'city');
			expect(fetchCalls).toHaveLength(1); // Cache hit
		});
	});

	// =========================================================================
	// Concurrent access
	// =========================================================================

	describe('Concurrent access', () => {
		it('should handle concurrent requests for different queries', async () => {
			const sfResult = [makeLocationResult()];
			const laResult = [
				makeLocationResult({
					city: {
						name: 'Los Angeles',
						state_code: 'CA',
						country_code: 'US',
						lat: 34.0522,
						lon: -118.2437
					}
				})
			];

			queueFetchSuccess(sfResult);
			queueFetchSuccess(laResult);

			const [r1, r2] = await Promise.all([
				searchLocations('San Francisco', 'city'),
				searchLocations('Los Angeles', 'city')
			]);

			expect(r1[0].city?.name).toBe('San Francisco');
			expect(r2[0].city?.name).toBe('Los Angeles');
			expect(fetchCalls).toHaveLength(2);
		});
	});

	// =========================================================================
	// Query parameter generation
	// =========================================================================

	describe('query parameter generation', () => {
		it('should not include country param when not provided', async () => {
			queueFetchSuccess([makeLocationResult()]);

			await searchLocations('London', 'city');

			expect(fetchCalls[0]).not.toContain('country=');
		});

		it('should not include state param when not provided', async () => {
			queueFetchSuccess([makeLocationResult()]);

			await searchLocations('California', 'state', 'US');

			expect(fetchCalls[0]).not.toContain('state=');
		});

		it('should trim whitespace from query', async () => {
			queueFetchSuccess([makeLocationResult()]);

			await searchLocations('  Portland  ', 'city');

			// The fetch URL should have trimmed query
			expect(fetchCalls[0]).toContain('q=Portland');
		});
	});
});
