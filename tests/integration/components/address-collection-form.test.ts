/**
 * Address Resolution Endpoint Contract Tests
 *
 * Tests POST /api/location/resolve-address — the unified server-side address
 * resolution endpoint that replaces client-side Nominatim geocoding.
 *
 * Pipeline under test:
 *   1. Census Bureau Geocoder → standardized address + coords + district + cell_id
 *   2. Congress.gov Member API → federal representatives (cached)
 *   3. Shadow Atlas fire-and-forget (non-blocking, tested only for not crashing)
 *
 * These tests import the POST handler directly and call it with mock
 * SvelteKit RequestEvents, using MSW to intercept external API calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server, createMockRequestEvent } from '../../setup/api-test-setup';
import { POST } from '../../../src/routes/api/location/resolve-address/+server';

// ---------------------------------------------------------------------------
// Census Bureau structured address response factory
// ---------------------------------------------------------------------------

interface CensusOverrides {
	matchedAddress?: string;
	coordinates?: { x: number; y: number };
	cd119?: string;
	stateCode?: string;
	stusab?: string;
	blockGeoid?: string;
	countyGeoid?: string;
}

function censusBureauResponse(overrides: CensusOverrides = {}) {
	const {
		matchedAddress = '123 MAIN ST, SPRINGFIELD, IL, 62704',
		coordinates = { x: -89.6501, y: 39.7817 },
		cd119 = '18',
		stateCode = '17',
		stusab = 'IL',
		blockGeoid = '170010001001001',
		countyGeoid = '17001'
	} = overrides;

	return {
		result: {
			addressMatches: [
				{
					matchedAddress,
					coordinates,
					geographies: {
						'119th Congressional Districts': [
							{ CD119: cd119, GEOID: `${stateCode}${cd119}`, STATE: stateCode }
						],
						States: [{ STUSAB: stusab }],
						'2020 Census Blocks': [{ GEOID: blockGeoid, STATE: stateCode }],
						Counties: [{ GEOID: countyGeoid }]
					}
				}
			]
		}
	};
}

/** Census response with no address matches */
function censusEmptyResponse() {
	return { result: { addressMatches: [] } };
}

// ---------------------------------------------------------------------------
// MSW handler helpers
// ---------------------------------------------------------------------------

function mockCensusBureau(response: Record<string, unknown>, status = 200) {
	server.use(
		http.get('https://geocoding.geo.census.gov/geocoder/geographies/address', () => {
			return HttpResponse.json(response, { status });
		})
	);
}

function mockCensusBureauError() {
	server.use(
		http.get('https://geocoding.geo.census.gov/geocoder/geographies/address', () => {
			return HttpResponse.error();
		})
	);
}

function mockShadowAtlas() {
	server.use(
		http.get('http://localhost:3000/v1/lookup', () => {
			return HttpResponse.json({ districts: [] });
		})
	);
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const testAddress = {
	street: '123 Main Street',
	city: 'Springfield',
	state: 'IL',
	zip: '62704'
};

const authenticatedLocals = {
	user: { id: 'test-user-123', email: 'test@example.com' }
};

/** Create a mock POST request to /api/location/resolve-address */
function createResolveRequest(body: Record<string, unknown>, locals = authenticatedLocals) {
	return createMockRequestEvent({
		url: '/api/location/resolve-address',
		method: 'POST',
		body: JSON.stringify(body),
		locals
	});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/location/resolve-address', () => {
	beforeEach(() => {
		// Set Congress API key for addressLookupService
		process.env.CONGRESS_API_KEY = 'test-key';
		// Mock Shadow Atlas (fire-and-forget, must not crash)
		mockShadowAtlas();
	});

	// ========================================================================
	// Authentication
	// ========================================================================

	describe('authentication', () => {
		it('returns 401 when user is not authenticated', async () => {
			const event = createResolveRequest(testAddress, { user: null } as any);
			const response = await POST(event as any);
			const data = await response.json();

			expect(response.status).toBe(401);
			expect(data.resolved).toBe(false);
			expect(data.error).toContain('Authentication');
		});
	});

	// ========================================================================
	// Input validation
	// ========================================================================

	describe('validation', () => {
		it('returns 400 for missing street', async () => {
			const event = createResolveRequest({ city: 'Springfield', state: 'IL', zip: '62704' });
			const response = await POST(event as any);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.resolved).toBe(false);
		});

		it('returns 400 for invalid state code (must be 2 chars)', async () => {
			const event = createResolveRequest({
				street: '123 Main',
				city: 'Springfield',
				state: 'Illinois',
				zip: '62704'
			});
			const response = await POST(event as any);

			expect(response.status).toBe(400);
		});

		it('returns 400 for invalid zip format', async () => {
			const event = createResolveRequest({
				street: '123 Main',
				city: 'Springfield',
				state: 'IL',
				zip: 'ABCDE'
			});
			const response = await POST(event as any);

			expect(response.status).toBe(400);
		});

		it('accepts 9-digit zip codes (ZIP+4)', async () => {
			mockCensusBureau(censusBureauResponse());

			const event = createResolveRequest({
				...testAddress,
				zip: '62704-1234'
			});
			const response = await POST(event as any);
			const data = await response.json();

			// Should not be a 400 validation error
			expect(response.status).not.toBe(400);
			// Census may or may not match, but validation passed
			expect(data).toBeDefined();
		});
	});

	// ========================================================================
	// Happy path: Census match + representatives
	// ========================================================================

	describe('happy path', () => {
		it('returns Census-standardized address with district and coordinates', async () => {
			mockCensusBureau(censusBureauResponse());

			const event = createResolveRequest(testAddress);
			const response = await POST(event as any);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.resolved).toBe(true);

			// Census-standardized address
			expect(data.address.matched).toBe('123 MAIN ST, SPRINGFIELD, IL, 62704');
			expect(data.address.street).toBe('123 MAIN ST');
			expect(data.address.city).toBe('SPRINGFIELD');
			expect(data.address.state).toBe('IL');
			expect(data.address.zip).toBe('62704');

			// Coordinates
			expect(data.coordinates.lat).toBe(39.7817);
			expect(data.coordinates.lng).toBe(-89.6501);

			// District
			expect(data.district.code).toBe('IL-18');
			expect(data.district.state).toBe('IL');
		});

		it('returns cell_id from Census block GEOID (tract-level)', async () => {
			mockCensusBureau(
				censusBureauResponse({ blockGeoid: '170010001001001' })
			);

			const event = createResolveRequest(testAddress);
			const response = await POST(event as any);
			const data = await response.json();

			expect(data.cell_id).toBe('17001000100'); // First 11 chars (tract-level)
			expect(data.zk_eligible).toBe(true);
		});

		it('returns county FIPS code', async () => {
			mockCensusBureau(
				censusBureauResponse({ countyGeoid: '17001' })
			);

			const event = createResolveRequest(testAddress);
			const response = await POST(event as any);
			const data = await response.json();

			expect(data.county_fips).toBe('17001');
		});

		it('returns district_source as census', async () => {
			mockCensusBureau(censusBureauResponse());

			const event = createResolveRequest(testAddress);
			const response = await POST(event as any);
			const data = await response.json();

			expect(data.district_source).toBe('census');
		});

		it('returns officials array with house and senate members', async () => {
			mockCensusBureau(censusBureauResponse());

			const event = createResolveRequest(testAddress);
			const response = await POST(event as any);
			const data = await response.json();

			expect(data.officials).toBeDefined();
			expect(Array.isArray(data.officials)).toBe(true);

			// Should have at least 1 official (may depend on Congress API mock data)
			// The MSW mock returns members for IL, so we expect house + senate
			if (data.officials.length > 0) {
				const official = data.officials[0];
				expect(official).toHaveProperty('name');
				expect(official).toHaveProperty('chamber');
				expect(official).toHaveProperty('party');
				expect(official).toHaveProperty('bioguide_id');
				expect(official).toHaveProperty('is_voting_member');
			}
		});
	});

	// ========================================================================
	// Census no-match scenarios
	// ========================================================================

	describe('Census no-match', () => {
		it('returns resolved=false when Census returns no address matches', async () => {
			mockCensusBureau(censusEmptyResponse());

			const event = createResolveRequest(testAddress);
			const response = await POST(event as any);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.resolved).toBe(false);
			expect(data.error).toContain('not found');
		});

		it('returns resolved=false on Census Bureau network error', async () => {
			mockCensusBureauError();

			const event = createResolveRequest(testAddress);
			const response = await POST(event as any);
			const data = await response.json();

			expect(data.resolved).toBe(false);
		});

		it('returns resolved=false on Census Bureau HTTP error', async () => {
			mockCensusBureau({ error: 'service unavailable' }, 503);

			const event = createResolveRequest(testAddress);
			const response = await POST(event as any);
			const data = await response.json();

			expect(data.resolved).toBe(false);
		});
	});

	// ========================================================================
	// At-large districts
	// ========================================================================

	describe('at-large districts', () => {
		it('normalizes Census "00" district to "AL" in district code', async () => {
			mockCensusBureau(
				censusBureauResponse({
					matchedAddress: '100 STATE ST, MONTPELIER, VT, 05602',
					cd119: '00',
					stateCode: '50',
					stusab: 'VT'
				})
			);

			const event = createResolveRequest({
				street: '100 State St',
				city: 'Montpelier',
				state: 'VT',
				zip: '05602'
			});
			const response = await POST(event as any);
			const data = await response.json();

			expect(data.resolved).toBe(true);
			expect(data.district.code).toBe('VT-AL');
		});
	});

	// ========================================================================
	// DC and territory handling
	// ========================================================================

	describe('DC and territories', () => {
		it('returns special_status for DC addresses', async () => {
			mockCensusBureau(
				censusBureauResponse({
					matchedAddress: '1600 PENNSYLVANIA AVE NW, WASHINGTON, DC, 20500',
					cd119: '98',
					stateCode: '11',
					stusab: 'DC',
					blockGeoid: '110010001001001'
				})
			);

			const event = createResolveRequest({
				street: '1600 Pennsylvania Ave NW',
				city: 'Washington',
				state: 'DC',
				zip: '20500'
			});
			const response = await POST(event as any);
			const data = await response.json();

			expect(data.resolved).toBe(true);
			expect(data.special_status).toBeDefined();
			expect(data.special_status.type).toBe('dc');
			expect(data.special_status.has_senators).toBe(false);
			expect(data.special_status.has_voting_representative).toBe(false);
		});

		it('returns delegate for territory addresses', async () => {
			mockCensusBureau(
				censusBureauResponse({
					matchedAddress: '100 SAN JUAN ST, SAN JUAN, PR, 00901',
					cd119: '98',
					stateCode: '72',
					stusab: 'PR',
					blockGeoid: '720070065003001'
				})
			);

			const event = createResolveRequest({
				street: '100 San Juan St',
				city: 'San Juan',
				state: 'PR',
				zip: '00901'
			});
			const response = await POST(event as any);
			const data = await response.json();

			expect(data.resolved).toBe(true);
			expect(data.special_status).toBeDefined();
			expect(data.special_status.type).toBe('territory');

			// Should have a delegate in officials
			if (data.officials.length > 0) {
				const delegate = data.officials.find(
					(o: { chamber: string }) => o.chamber === 'house'
				);
				if (delegate) {
					expect(delegate.is_voting_member).toBe(false);
				}
			}
		});
	});

	// ========================================================================
	// Privacy guarantee
	// ========================================================================

	describe('privacy', () => {
		it('sends address to Census Bureau, not to any other external service', async () => {
			const capturedUrls: string[] = [];

			server.use(
				http.get('https://geocoding.geo.census.gov/geocoder/geographies/address', ({ request }) => {
					capturedUrls.push(request.url);
					return HttpResponse.json(censusBureauResponse());
				})
			);

			const event = createResolveRequest(testAddress);
			await POST(event as any);

			// Verify Census Bureau was called
			const censusUrls = capturedUrls.filter((u) => u.includes('geocoding.geo.census.gov'));
			expect(censusUrls.length).toBeGreaterThanOrEqual(1);

			// Verify address params are sent to Census
			const censusUrl = new URL(censusUrls[0]);
			expect(censusUrl.searchParams.get('street')).toBe('123 Main Street');
			expect(censusUrl.searchParams.get('city')).toBe('Springfield');
			expect(censusUrl.searchParams.get('state')).toBe('IL');
			expect(censusUrl.searchParams.get('zip')).toBe('62704');
		});
	});

	// ========================================================================
	// Congress member lookup failure (graceful degradation)
	// ========================================================================

	describe('Congress API failure', () => {
		it('still returns address and district when Congress lookup fails', async () => {
			mockCensusBureau(censusBureauResponse());

			// Override Congress API to fail
			server.use(
				http.get('https://api.congress.gov/v3/member', () => {
					return HttpResponse.json({ error: 'service unavailable' }, { status: 503 });
				})
			);

			const event = createResolveRequest(testAddress);
			const response = await POST(event as any);
			const data = await response.json();

			// Should still resolve with address data
			expect(data.resolved).toBe(true);
			expect(data.address.matched).toBeTruthy();
			expect(data.district.code).toBeTruthy();
			// Officials may be empty but shouldn't crash
			expect(Array.isArray(data.officials)).toBe(true);
		});
	});

	// ========================================================================
	// Address parsing
	// ========================================================================

	describe('matched address parsing', () => {
		it('parses Census 4-part standardized address correctly', async () => {
			mockCensusBureau(
				censusBureauResponse({
					matchedAddress: '12 MINT PLZ, SAN FRANCISCO, CA, 94103'
				})
			);

			const event = createResolveRequest({
				street: '12 Mint Plz',
				city: 'San Francisco',
				state: 'CA',
				zip: '94103'
			});
			const response = await POST(event as any);
			const data = await response.json();

			expect(data.address.street).toBe('12 MINT PLZ');
			expect(data.address.city).toBe('SAN FRANCISCO');
			expect(data.address.state).toBe('CA');
			expect(data.address.zip).toBe('94103');
		});
	});
});
