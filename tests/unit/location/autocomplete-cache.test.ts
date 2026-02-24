/**
 * Unit tests for Autocomplete Cache
 *
 * Tests IndexedDB-backed caching of Nominatim location search results
 * with TTL expiry, cache key generation, and all 6 exported functions.
 *
 * Strategy:
 * - Uses fake-indexeddb/auto for IndexedDB polyfill in jsdom
 * - Does NOT use vi.useFakeTimers() (incompatible with fake-indexeddb async)
 * - Uses vi.spyOn(Date, 'now') to control time for TTL tests
 * - Uses clearAllCache() between tests instead of vi.resetModules()
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LocationHierarchy } from '$lib/core/location/geocoding-api';

// ---------------------------------------------------------------------------
// IndexedDB polyfill (must precede all imports)
// ---------------------------------------------------------------------------

import 'fake-indexeddb/auto';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mockSearchLocations = vi.hoisted(() => vi.fn());

vi.mock('$lib/core/location/geocoding-api', () => ({
	searchLocations: (...args: unknown[]) => mockSearchLocations(...args),
	searchCities: vi.fn(),
	searchStates: vi.fn(),
	searchCountries: vi.fn()
}));

// ---------------------------------------------------------------------------
// Import SUT (single import, no resetModules)
// ---------------------------------------------------------------------------

import {
	searchLocationsCached,
	searchCitiesCached,
	searchStatesCached,
	searchCountriesCached,
	clearExpiredCache,
	clearAllCache
} from '$lib/core/location/autocomplete-cache';

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

/** Small delay to let IndexedDB transactions commit */
function tick(ms = 50): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

const BASE_TIME = new Date('2026-02-23T12:00:00Z').getTime();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Autocomplete Cache', () => {
	let dateNowSpy: ReturnType<typeof vi.spyOn> | null = null;
	let simulatedNow: number;

	function setTime(time: number) {
		simulatedNow = time;
		if (dateNowSpy) dateNowSpy.mockRestore();
		dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(simulatedNow);
	}

	function advanceTime(ms: number) {
		simulatedNow += ms;
		if (dateNowSpy) dateNowSpy.mockReturnValue(simulatedNow);
	}

	beforeEach(async () => {
		vi.clearAllMocks();
		simulatedNow = BASE_TIME;
		dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(simulatedNow);

		mockSearchLocations.mockResolvedValue([makeLocationResult()]);

		// Clear all cache entries to start fresh each test
		await clearAllCache();
	});

	afterEach(() => {
		if (dateNowSpy) dateNowSpy.mockRestore();
		dateNowSpy = null;
	});

	// =========================================================================
	// searchLocationsCached - cache miss vs hit
	// =========================================================================

	describe('searchLocationsCached', () => {
		it('should call API on cache miss and return results', async () => {
			const results = await searchLocationsCached('San Francisco', 'city', 'US', 'CA');

			expect(results).toHaveLength(1);
			expect(results[0].city?.name).toBe('San Francisco');
			expect(mockSearchLocations).toHaveBeenCalledWith('San Francisco', 'city', 'US', 'CA');
		});

		it('should return cached results on cache hit without calling API', async () => {
			await searchLocationsCached('San Francisco', 'city', 'US', 'CA');
			expect(mockSearchLocations).toHaveBeenCalledTimes(1);

			await tick();

			const results = await searchLocationsCached('San Francisco', 'city', 'US', 'CA');
			expect(results).toHaveLength(1);
			expect(results[0].city?.name).toBe('San Francisco');
			expect(mockSearchLocations).toHaveBeenCalledTimes(1);
		});

		it('should re-fetch after TTL expiry (24 hours)', async () => {
			await searchLocationsCached('Austin', 'city', 'US', 'TX');
			await tick();

			advanceTime(25 * 60 * 60 * 1000);

			const updatedResult = makeLocationResult({
				city: { name: 'Austin Updated', state_code: 'TX', country_code: 'US', lat: 30.2672, lon: -97.7431 }
			});
			mockSearchLocations.mockResolvedValue([updatedResult]);

			const results = await searchLocationsCached('Austin', 'city', 'US', 'TX');
			expect(mockSearchLocations).toHaveBeenCalledTimes(2);
			expect(results[0].city?.name).toBe('Austin Updated');
		});

		it('should serve from cache within TTL (12 hours)', async () => {
			await searchLocationsCached('Denver', 'city', 'US', 'CO');
			await tick();

			advanceTime(12 * 60 * 60 * 1000);

			await searchLocationsCached('Denver', 'city', 'US', 'CO');
			expect(mockSearchLocations).toHaveBeenCalledTimes(1);
		});

		it('should use default scope of city when not specified', async () => {
			await searchLocationsCached('Portland');
			expect(mockSearchLocations).toHaveBeenCalledWith('Portland', 'city', undefined, undefined);
		});

		it('should cache different queries separately', async () => {
			const sfResult = [makeLocationResult()];
			const laResult = [makeLocationResult({
				city: { name: 'Los Angeles', state_code: 'CA', country_code: 'US', lat: 34.0522, lon: -118.2437 },
				display_name: 'Los Angeles, California, United States'
			})];

			mockSearchLocations.mockResolvedValueOnce(sfResult).mockResolvedValueOnce(laResult);

			const r1 = await searchLocationsCached('San Francisco', 'city');
			const r2 = await searchLocationsCached('Los Angeles', 'city');

			expect(r1[0].city?.name).toBe('San Francisco');
			expect(r2[0].city?.name).toBe('Los Angeles');
			expect(mockSearchLocations).toHaveBeenCalledTimes(2);
		});

		it('should generate case-insensitive cache keys (lowercase + trim)', async () => {
			await searchLocationsCached('  San Francisco  ', 'city', 'US', 'CA');
			await tick();

			await searchLocationsCached('san francisco', 'city', 'US', 'CA');
			expect(mockSearchLocations).toHaveBeenCalledTimes(1);
		});

		it('should treat different scopes as separate cache entries', async () => {
			await searchLocationsCached('California', 'state', 'US');
			await tick();

			await searchLocationsCached('California', 'city', 'US');
			expect(mockSearchLocations).toHaveBeenCalledTimes(2);
		});

		it('should handle API returning empty results', async () => {
			mockSearchLocations.mockResolvedValue([]);

			const results = await searchLocationsCached('Nonexistent Place', 'city');
			expect(results).toHaveLength(0);
		});

		it('should propagate API errors', async () => {
			mockSearchLocations.mockRejectedValueOnce(new Error('Network error'));

			await expect(searchLocationsCached('ErrorCity', 'city')).rejects.toThrow('Network error');
		});
	});

	// =========================================================================
	// searchCitiesCached
	// =========================================================================

	describe('searchCitiesCached', () => {
		it('should delegate to searchLocationsCached with city scope', async () => {
			const results = await searchCitiesCached('Austin', 'TX', 'US');
			expect(results).toHaveLength(1);
			expect(mockSearchLocations).toHaveBeenCalledWith('Austin', 'city', 'US', 'TX');
		});

		it('should default countryCode to US', async () => {
			await searchCitiesCached('Portland', 'OR');
			expect(mockSearchLocations).toHaveBeenCalledWith('Portland', 'city', 'US', 'OR');
		});

		it('should accept non-US country codes', async () => {
			await searchCitiesCached('Toronto', 'ON', 'CA');
			expect(mockSearchLocations).toHaveBeenCalledWith('Toronto', 'city', 'CA', 'ON');
		});

		it('should return cached city results on repeated calls', async () => {
			await searchCitiesCached('Austin', 'TX', 'US');
			await tick();

			await searchCitiesCached('Austin', 'TX', 'US');
			expect(mockSearchLocations).toHaveBeenCalledTimes(1);
		});
	});

	// =========================================================================
	// searchStatesCached
	// =========================================================================

	describe('searchStatesCached', () => {
		it('should delegate to searchLocationsCached with state scope', async () => {
			await searchStatesCached('California');
			expect(mockSearchLocations).toHaveBeenCalledWith('California', 'state', 'US', undefined);
		});

		it('should default countryCode to US', async () => {
			await searchStatesCached('Texas');
			expect(mockSearchLocations).toHaveBeenCalledWith('Texas', 'state', 'US', undefined);
		});

		it('should accept non-US country codes', async () => {
			await searchStatesCached('Ontario', 'CA');
			expect(mockSearchLocations).toHaveBeenCalledWith('Ontario', 'state', 'CA', undefined);
		});

		it('should cache state search results', async () => {
			await searchStatesCached('New York');
			await tick();

			await searchStatesCached('New York');
			expect(mockSearchLocations).toHaveBeenCalledTimes(1);
		});
	});

	// =========================================================================
	// searchCountriesCached
	// =========================================================================

	describe('searchCountriesCached', () => {
		it('should delegate to searchLocationsCached with country scope', async () => {
			await searchCountriesCached('United States');
			expect(mockSearchLocations).toHaveBeenCalledWith('United States', 'country', undefined, undefined);
		});

		it('should cache country search results', async () => {
			await searchCountriesCached('Canada');
			await tick();

			await searchCountriesCached('Canada');
			expect(mockSearchLocations).toHaveBeenCalledTimes(1);
		});

		it('should handle partial country names', async () => {
			await searchCountriesCached('Unit');
			expect(mockSearchLocations).toHaveBeenCalledWith('Unit', 'country', undefined, undefined);
		});
	});

	// =========================================================================
	// clearExpiredCache
	// =========================================================================

	describe('clearExpiredCache', () => {
		it('should not remove entries within TTL', async () => {
			await searchLocationsCached('San Francisco', 'city', 'US');
			await tick();

			advanceTime(12 * 60 * 60 * 1000); // 12 hours

			await clearExpiredCache();

			mockSearchLocations.mockClear();
			await searchLocationsCached('San Francisco', 'city', 'US');
			expect(mockSearchLocations).not.toHaveBeenCalled();
		});

		it('should remove entries past TTL', async () => {
			await searchLocationsCached('Portland', 'city', 'US');
			await tick();

			advanceTime(25 * 60 * 60 * 1000); // 25 hours

			await clearExpiredCache();

			mockSearchLocations.mockClear();
			mockSearchLocations.mockResolvedValue([makeLocationResult()]);
			await searchLocationsCached('Portland', 'city', 'US');
			expect(mockSearchLocations).toHaveBeenCalledTimes(1);
		});

		it('should selectively remove only expired entries', async () => {
			// First entry at t=0
			await searchLocationsCached('Austin', 'city', 'US');
			await tick();

			// Advance 23 hours
			advanceTime(23 * 60 * 60 * 1000);

			// Second entry at t=23h
			const denverResult = makeLocationResult({
				city: { name: 'Denver', state_code: 'CO', country_code: 'US', lat: 39.7392, lon: -104.9903 }
			});
			mockSearchLocations.mockResolvedValue([denverResult]);
			await searchLocationsCached('Denver', 'city', 'US');
			await tick();

			// Advance 2 more hours (Austin: 25h = expired, Denver: 2h = fresh)
			advanceTime(2 * 60 * 60 * 1000);

			await clearExpiredCache();

			mockSearchLocations.mockClear();
			mockSearchLocations.mockResolvedValue([makeLocationResult()]);

			// Denver should still be cached
			await searchLocationsCached('Denver', 'city', 'US');
			expect(mockSearchLocations).not.toHaveBeenCalled();

			// Austin expired and was cleared
			await searchLocationsCached('Austin', 'city', 'US');
			expect(mockSearchLocations).toHaveBeenCalledTimes(1);
		});

		it('should handle empty cache without error', async () => {
			await expect(clearExpiredCache()).resolves.toBeUndefined();
		});
	});

	// =========================================================================
	// clearAllCache
	// =========================================================================

	describe('clearAllCache', () => {
		it('should remove all cached entries', async () => {
			await searchLocationsCached('San Francisco', 'city', 'US');
			await tick();
			await searchLocationsCached('New York', 'city', 'US');
			await tick();

			await clearAllCache();

			mockSearchLocations.mockClear();
			mockSearchLocations.mockResolvedValue([makeLocationResult()]);

			await searchLocationsCached('San Francisco', 'city', 'US');
			await searchLocationsCached('New York', 'city', 'US');
			expect(mockSearchLocations).toHaveBeenCalledTimes(2);
		});

		it('should handle empty cache without error', async () => {
			await expect(clearAllCache()).resolves.toBeUndefined();
		});

		it('should allow re-populating cache after clear', async () => {
			await searchLocationsCached('Austin', 'city');
			await tick();

			await clearAllCache();

			mockSearchLocations.mockClear();
			mockSearchLocations.mockResolvedValue([makeLocationResult()]);
			await searchLocationsCached('Austin', 'city');
			await tick();

			mockSearchLocations.mockClear();
			await searchLocationsCached('Austin', 'city');
			expect(mockSearchLocations).not.toHaveBeenCalled();
		});
	});

	// =========================================================================
	// Edge cases
	// =========================================================================

	describe('Edge cases', () => {
		it('should handle special characters in query strings', async () => {
			await searchLocationsCached("St. Louis' Park", 'city', 'US');
			expect(mockSearchLocations).toHaveBeenCalledWith("St. Louis' Park", 'city', 'US', undefined);
		});

		it('should handle very long query strings', async () => {
			const longQuery = 'A'.repeat(500);
			await searchLocationsCached(longQuery, 'city');
			expect(mockSearchLocations).toHaveBeenCalledWith(longQuery, 'city', undefined, undefined);
		});

		it('should handle unicode characters', async () => {
			await searchLocationsCached('Munchen', 'city');
			expect(mockSearchLocations).toHaveBeenCalledWith('Munchen', 'city', undefined, undefined);
		});

		it('should cache results with multiple locations', async () => {
			const multipleResults = [
				makeLocationResult({ display_name: 'Portland, Oregon, US' }),
				makeLocationResult({
					city: { name: 'Portland', state_code: 'ME', country_code: 'US', lat: 43.6591, lon: -70.2568 },
					display_name: 'Portland, Maine, US'
				})
			];
			mockSearchLocations.mockResolvedValue(multipleResults);

			const first = await searchLocationsCached('Portland', 'city', 'US');
			await tick();

			mockSearchLocations.mockClear();
			const second = await searchLocationsCached('Portland', 'city', 'US');

			expect(first).toHaveLength(2);
			expect(second).toHaveLength(2);
			expect(mockSearchLocations).not.toHaveBeenCalled();
		});

		it('should generate distinct cache keys for different state filters', async () => {
			await searchLocationsCached('Portland', 'city', 'US', 'OR');
			await tick();

			await searchLocationsCached('Portland', 'city', 'US', 'ME');
			expect(mockSearchLocations).toHaveBeenCalledTimes(2);
		});

		it('should treat undefined and missing filters as equivalent', async () => {
			await searchLocationsCached('London', 'city', undefined, undefined);
			await tick();

			mockSearchLocations.mockClear();
			await searchLocationsCached('London', 'city');
			expect(mockSearchLocations).not.toHaveBeenCalled();
		});
	});

	// =========================================================================
	// Concurrent access
	// =========================================================================

	describe('Concurrent access', () => {
		it('should handle concurrent requests for the same query', async () => {
			const [r1, r2] = await Promise.all([
				searchLocationsCached('San Diego', 'city', 'US'),
				searchLocationsCached('San Diego', 'city', 'US')
			]);

			expect(r1).toHaveLength(1);
			expect(r2).toHaveLength(1);
		});

		it('should handle concurrent requests for different queries', async () => {
			const sfResult = [makeLocationResult()];
			const laResult = [makeLocationResult({
				city: { name: 'Los Angeles', state_code: 'CA', country_code: 'US', lat: 34.0522, lon: -118.2437 }
			})];

			mockSearchLocations.mockResolvedValueOnce(sfResult).mockResolvedValueOnce(laResult);

			const [r1, r2] = await Promise.all([
				searchLocationsCached('San Francisco', 'city'),
				searchLocationsCached('Los Angeles', 'city')
			]);

			expect(r1[0].city?.name).toBe('San Francisco');
			expect(r2[0].city?.name).toBe('Los Angeles');
			expect(mockSearchLocations).toHaveBeenCalledTimes(2);
		});
	});
});
