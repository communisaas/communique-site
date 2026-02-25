/**
 * AddressCollectionForm Integration Tests
 *
 * Contract tests for the client-side geocoding flow used by
 * AddressCollectionForm.verifyAddress(). Since Svelte 5 component rendering
 * is not set up in vitest, we test the API integration contracts directly:
 *
 * 1. geocodeAddress() — Nominatim geocoding (privacy-critical: runs in browser)
 * 2. Privacy guarantee — address data never reaches our server
 * 3. Confidence clamping — importance values capped at 1.0
 * 4. Error handling — network failures and empty results
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../setup/api-test-setup';
import { geocodeAddress } from '$lib/core/location/address-geocode';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Standard Nominatim response for a valid US address */
function nominatimResult(overrides: Record<string, unknown> = {}) {
	return {
		display_name: '123 Main Street, Springfield, Illinois, 62704, United States',
		lat: '39.7817',
		lon: '-89.6501',
		importance: 0.82,
		address: {
			country: 'United States',
			country_code: 'us',
			state: 'Illinois',
			city: 'Springfield'
		},
		...overrides
	};
}

/** Register an MSW handler that returns a Nominatim response */
function mockNominatim(results: unknown[]) {
	server.use(
		http.get('https://nominatim.openstreetmap.org/search', () => {
			return HttpResponse.json(results);
		})
	);
}

/** Register an MSW handler that simulates a Nominatim network error */
function mockNominatimNetworkError() {
	server.use(
		http.get('https://nominatim.openstreetmap.org/search', () => {
			return HttpResponse.error();
		})
	);
}

/** Standard address input for geocodeAddress */
const testAddress = {
	street: '123 Main Street',
	city: 'Springfield',
	state: 'IL',
	zip: '62704',
	countryCode: 'US' as const
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AddressCollectionForm — geocodeAddress contract', () => {
	beforeEach(() => {
		// Reset the rate limiter so tests don't wait 1.1s between calls.
		// The module uses a module-level `lastRequestTime` variable;
		// we can't access it directly, but we can use vi.useFakeTimers
		// to skip the rate-limit delay.
		vi.useFakeTimers({ shouldAdvanceTime: true });
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	// ========================================================================
	// Test 1: Happy path — geocodeAddress returns structured result
	// ========================================================================

	it('returns structured GeocodeResult from Nominatim response', async () => {
		mockNominatim([nominatimResult()]);

		const result = await geocodeAddress(testAddress);

		expect(result).not.toBeNull();
		expect(result).toEqual({
			lat: 39.7817,
			lng: -89.6501,
			formattedAddress: '123 Main Street, Springfield, Illinois, 62704, United States',
			confidence: 0.82,
			countryCode: 'US',
			stateCode: 'IL'
		});
	});

	// ========================================================================
	// Test 2: Empty results → null
	// ========================================================================

	it('returns null when Nominatim returns empty results', async () => {
		mockNominatim([]);

		const result = await geocodeAddress(testAddress);

		expect(result).toBeNull();
	});

	// ========================================================================
	// Test 3: Network error → null
	// ========================================================================

	it('returns null on network error', async () => {
		mockNominatimNetworkError();

		const result = await geocodeAddress(testAddress);

		expect(result).toBeNull();
	});

	// ========================================================================
	// Test 4: Privacy — geocodeAddress only calls Nominatim, never our API
	// ========================================================================

	it('never sends address data to our server', async () => {
		const capturedUrls: string[] = [];

		// Intercept ALL requests to capture URLs
		server.use(
			http.get('https://nominatim.openstreetmap.org/search', ({ request }) => {
				capturedUrls.push(request.url);
				return HttpResponse.json([nominatimResult()]);
			}),
			// Trap any request to our API (localhost)
			http.all('http://localhost:*/*', ({ request }) => {
				capturedUrls.push(request.url);
				return HttpResponse.json({ error: 'should not be called' }, { status: 500 });
			})
		);

		await geocodeAddress(testAddress);

		// Verify only Nominatim was called
		expect(capturedUrls.length).toBeGreaterThanOrEqual(1);
		for (const url of capturedUrls) {
			expect(url).toContain('nominatim.openstreetmap.org');
		}
	});

	// ========================================================================
	// Test 5: Confidence clamping — importance > 1.0 gets clamped to 1.0
	// ========================================================================

	it('clamps confidence to max 1.0 when Nominatim returns importance > 1', async () => {
		mockNominatim([nominatimResult({ importance: 1.5 })]);

		const result = await geocodeAddress(testAddress);

		expect(result).not.toBeNull();
		expect(result!.confidence).toBe(1);
	});

	// ========================================================================
	// Additional contract tests
	// ========================================================================

	it('uses default confidence 0.5 when importance is missing', async () => {
		mockNominatim([nominatimResult({ importance: undefined })]);

		const result = await geocodeAddress(testAddress);

		expect(result).not.toBeNull();
		expect(result!.confidence).toBe(0.5);
	});

	it('returns null when lat/lon are not valid numbers', async () => {
		mockNominatim([nominatimResult({ lat: 'not-a-number', lon: 'invalid' })]);

		const result = await geocodeAddress(testAddress);

		expect(result).toBeNull();
	});

	it('sends correct query parameters to Nominatim', async () => {
		let capturedUrl = '';

		server.use(
			http.get('https://nominatim.openstreetmap.org/search', ({ request }) => {
				capturedUrl = request.url;
				return HttpResponse.json([nominatimResult()]);
			})
		);

		await geocodeAddress(testAddress);

		const url = new URL(capturedUrl);
		expect(url.searchParams.get('street')).toBe('123 Main Street');
		expect(url.searchParams.get('city')).toBe('Springfield');
		expect(url.searchParams.get('state')).toBe('IL');
		expect(url.searchParams.get('postalcode')).toBe('62704');
		expect(url.searchParams.get('countrycodes')).toBe('us');
		expect(url.searchParams.get('format')).toBe('json');
		expect(url.searchParams.get('addressdetails')).toBe('1');
		expect(url.searchParams.get('limit')).toBe('1');
	});

	it('returns null when Nominatim returns HTTP error', async () => {
		server.use(
			http.get('https://nominatim.openstreetmap.org/search', () => {
				return HttpResponse.json({ error: 'rate limit' }, { status: 429 });
			})
		);

		const result = await geocodeAddress(testAddress);

		expect(result).toBeNull();
	});

	it('skips postalcode param when zip is not provided', async () => {
		let capturedUrl = '';

		server.use(
			http.get('https://nominatim.openstreetmap.org/search', ({ request }) => {
				capturedUrl = request.url;
				return HttpResponse.json([nominatimResult()]);
			})
		);

		await geocodeAddress({ street: '123 Main', city: 'Springfield', state: 'IL' });

		const url = new URL(capturedUrl);
		expect(url.searchParams.has('postalcode')).toBe(false);
	});

	it('skips countrycodes param when countryCode is not provided', async () => {
		let capturedUrl = '';

		server.use(
			http.get('https://nominatim.openstreetmap.org/search', ({ request }) => {
				capturedUrl = request.url;
				return HttpResponse.json([nominatimResult()]);
			})
		);

		await geocodeAddress({ street: '123 Main', city: 'Springfield', state: 'IL' });

		const url = new URL(capturedUrl);
		expect(url.searchParams.has('countrycodes')).toBe(false);
	});
});
