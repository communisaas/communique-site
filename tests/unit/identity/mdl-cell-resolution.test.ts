/**
 * Tests for Census Bureau tract GEOID resolution in the mDL privacy boundary.
 *
 * resolveCellIdFromAddress() calls the Census Bureau geocoding API to resolve
 * city/state/zip to a Census tract GEOID (11-digit) for Shadow Atlas Tree 2.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveCellIdFromAddress } from '$lib/core/identity/mdl-verification';

// Mock global fetch
const originalFetch = globalThis.fetch;

function mockFetch(handler: (url: string) => Response | Promise<Response>) {
	globalThis.fetch = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
		const url = typeof input === 'string' ? input : input.toString();
		return Promise.resolve(handler(url));
	}) as unknown as typeof fetch;
}

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

describe('resolveCellIdFromAddress', () => {
	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	it('should resolve a tract GEOID from Census Bureau address geocoding', async () => {
		mockFetch((url) => {
			if (url.includes('/geocoder/geographies/address')) {
				return jsonResponse({
					result: {
						addressMatches: [
							{
								matchedAddress: 'Denver, CO 80202',
								geographies: {
									'Census Tracts': [
										{ GEOID: '08031000100', NAME: 'Census Tract 1' }
									]
								}
							}
						]
					}
				});
			}
			return jsonResponse({}, 404);
		});

		const result = await resolveCellIdFromAddress('80202', 'Denver', 'CO');
		expect(result).toBe('08031000100');
	});

	it('should extract tract from block GEOID (first 11 digits)', async () => {
		mockFetch((url) => {
			if (url.includes('/geocoder/geographies/address')) {
				return jsonResponse({
					result: {
						addressMatches: [
							{
								matchedAddress: 'San Francisco, CA 94103',
								geographies: {
									'2020 Census Blocks': [
										{ GEOID: '060750176011234' }
									]
								}
							}
						]
					}
				});
			}
			return jsonResponse({}, 404);
		});

		const result = await resolveCellIdFromAddress('94103', 'San Francisco', 'CA');
		expect(result).toBe('06075017601');
		expect(result).toHaveLength(11);
	});

	it('should return null on Census API HTTP error', async () => {
		mockFetch(() => jsonResponse({ error: 'Internal Server Error' }, 500));

		const result = await resolveCellIdFromAddress('80202', 'Denver', 'CO');
		expect(result).toBeNull();
	});

	it('should return null on Census API timeout', async () => {
		mockFetch(() => {
			return new Promise((_, reject) => {
				setTimeout(() => reject(new DOMException('Aborted', 'AbortError')), 10);
			});
		});

		const result = await resolveCellIdFromAddress('80202', 'Denver', 'CO');
		expect(result).toBeNull();
	});

	it('should return null when no address matches', async () => {
		mockFetch((url) => {
			if (url.includes('/geocoder/geographies/')) {
				return jsonResponse({
					result: {
						addressMatches: []
					}
				});
			}
			return jsonResponse({}, 404);
		});

		const result = await resolveCellIdFromAddress('00000', 'Nowhere', 'XX');
		expect(result).toBeNull();
	});

	it('should return null when geographies missing from response', async () => {
		mockFetch((url) => {
			if (url.includes('/geocoder/geographies/address')) {
				return jsonResponse({
					result: {
						addressMatches: [
							{
								matchedAddress: 'Denver, CO 80202',
								geographies: {}
							}
						]
					}
				});
			}
			// Onelineaddress fallback also empty
			if (url.includes('/geocoder/geographies/onelineaddress')) {
				return jsonResponse({
					result: {
						addressMatches: []
					}
				});
			}
			return jsonResponse({}, 404);
		});

		const result = await resolveCellIdFromAddress('80202', 'Denver', 'CO');
		expect(result).toBeNull();
	});

	it('should use onelineaddress fallback when address endpoint returns no match', async () => {
		mockFetch((url) => {
			if (url.includes('/geocoder/geographies/address')) {
				return jsonResponse({
					result: { addressMatches: [] }
				});
			}
			if (url.includes('/geocoder/geographies/onelineaddress')) {
				return jsonResponse({
					result: {
						addressMatches: [
							{
								matchedAddress: 'Santa Fe, NM 87501',
								geographies: {
									'Census Tracts': [
										{ GEOID: '35049000101' }
									]
								}
							}
						]
					}
				});
			}
			return jsonResponse({}, 404);
		});

		const result = await resolveCellIdFromAddress('87501', 'Santa Fe', 'NM');
		expect(result).toBe('35049000101');
	});

	it('should send correct query parameters to Census Bureau', async () => {
		const capturedUrls: string[] = [];
		mockFetch((url) => {
			capturedUrls.push(url);
			return jsonResponse({
				result: {
					addressMatches: [
						{
							geographies: {
								'Census Tracts': [{ GEOID: '06075017601' }]
							}
						}
					]
				}
			});
		});

		await resolveCellIdFromAddress('94103', 'San Francisco', 'CA');

		expect(capturedUrls).toHaveLength(1);
		const url = new URL(capturedUrls[0]);
		expect(url.hostname).toBe('geocoding.geo.census.gov');
		expect(url.pathname).toBe('/geocoder/geographies/address');
		expect(url.searchParams.get('city')).toBe('San Francisco');
		expect(url.searchParams.get('state')).toBe('CA');
		expect(url.searchParams.get('zip')).toBe('94103');
		expect(url.searchParams.get('format')).toBe('json');
	});

	it('should truncate block GEOID longer than 11 digits to tract', async () => {
		mockFetch((url) => {
			if (url.includes('/geocoder/geographies/address')) {
				return jsonResponse({
					result: {
						addressMatches: [
							{
								geographies: {
									'Census Tracts': [
										// 11-digit tract GEOID
										{ GEOID: '11001000101' }
									],
									'2020 Census Blocks': [
										// 15-digit block GEOID
										{ GEOID: '110010001011234' }
									]
								}
							}
						]
					}
				});
			}
			return jsonResponse({}, 404);
		});

		// Should prefer Census Tracts (11-digit) over Blocks (15-digit)
		const result = await resolveCellIdFromAddress('20001', 'Washington', 'DC');
		expect(result).toBe('11001000101');
		expect(result).toHaveLength(11);
	});
});
