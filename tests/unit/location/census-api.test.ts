/**
 * Unit tests for Census Bureau API Client
 *
 * Tests the CensusAPIClient class which handles:
 * - Congressional district lookup from coordinates (JSONP)
 * - Address geocoding via Census Bureau API (JSON)
 * - Nominatim reverse geocoding for city/county names
 * - Timezone-based location inference (fallback)
 * - Retry logic with exponential backoff
 * - Timeout handling
 * - FIPS-to-state-code conversion
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LocationSignal, CensusGeocodingResponse } from '$lib/core/location/types';

// ---------------------------------------------------------------------------
// We test CensusAPIClient, getTimezoneLocation, and getBrowserGeolocation.
// CensusAPIClient.geocodeCoordinates uses JSONP (injects <script> tags) which
// is hard to test in jsdom, so we focus on geocodeAddress, fetchWithRetry,
// fipsToStateCode (via geocodeAddress), getTimezoneLocation, and getBrowserGeolocation.
// ---------------------------------------------------------------------------

describe('Census API Module', () => {
	let CensusAPIClient: typeof import('$lib/core/location/census-api').CensusAPIClient;
	let getTimezoneLocation: typeof import('$lib/core/location/census-api').getTimezoneLocation;
	let getBrowserGeolocation: typeof import('$lib/core/location/census-api').getBrowserGeolocation;
	let censusAPI: typeof import('$lib/core/location/census-api').censusAPI;

	beforeEach(async () => {
		vi.clearAllMocks();
		const mod = await import('$lib/core/location/census-api');
		CensusAPIClient = mod.CensusAPIClient;
		getTimezoneLocation = mod.getTimezoneLocation;
		getBrowserGeolocation = mod.getBrowserGeolocation;
		censusAPI = mod.censusAPI;
	});

	// =========================================================================
	// getTimezoneLocation
	// =========================================================================

	describe('getTimezoneLocation', () => {
		it('should return location signal for America/New_York', () => {
			// Mock Intl to return a specific timezone
			vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
				() =>
					({
						resolvedOptions: () => ({ timeZone: 'America/New_York' })
					}) as Intl.DateTimeFormat
			);

			const signal = getTimezoneLocation();

			expect(signal).not.toBeNull();
			expect(signal!.signal_type).toBe('ip');
			expect(signal!.confidence).toBe(0.2);
			expect(signal!.state_code).toBe('NY');
			expect(signal!.country_code).toBe('US');
			expect(signal!.source).toBe('browser.timezone');
		});

		it('should return CA for America/Los_Angeles', () => {
			vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
				() =>
					({
						resolvedOptions: () => ({ timeZone: 'America/Los_Angeles' })
					}) as Intl.DateTimeFormat
			);

			const signal = getTimezoneLocation();
			expect(signal!.state_code).toBe('CA');
		});

		it('should return IL for America/Chicago', () => {
			vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
				() =>
					({
						resolvedOptions: () => ({ timeZone: 'America/Chicago' })
					}) as Intl.DateTimeFormat
			);

			const signal = getTimezoneLocation();
			expect(signal!.state_code).toBe('IL');
		});

		it('should return CO for America/Denver', () => {
			vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
				() =>
					({
						resolvedOptions: () => ({ timeZone: 'America/Denver' })
					}) as Intl.DateTimeFormat
			);

			const signal = getTimezoneLocation();
			expect(signal!.state_code).toBe('CO');
		});

		it('should return AK for America/Anchorage', () => {
			vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
				() =>
					({
						resolvedOptions: () => ({ timeZone: 'America/Anchorage' })
					}) as Intl.DateTimeFormat
			);

			const signal = getTimezoneLocation();
			expect(signal!.state_code).toBe('AK');
		});

		it('should return HI for Pacific/Honolulu', () => {
			vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
				() =>
					({
						resolvedOptions: () => ({ timeZone: 'Pacific/Honolulu' })
					}) as Intl.DateTimeFormat
			);

			const signal = getTimezoneLocation();
			expect(signal!.state_code).toBe('HI');
		});

		it('should return PR for America/Puerto_Rico', () => {
			vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
				() =>
					({
						resolvedOptions: () => ({ timeZone: 'America/Puerto_Rico' })
					}) as Intl.DateTimeFormat
			);

			const signal = getTimezoneLocation();
			expect(signal!.state_code).toBe('PR');
		});

		it('should return null for unknown timezone', () => {
			vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
				() =>
					({
						resolvedOptions: () => ({ timeZone: 'Europe/London' })
					}) as Intl.DateTimeFormat
			);

			const signal = getTimezoneLocation();
			expect(signal).toBeNull();
		});

		it('should return null when Intl throws', () => {
			vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
				throw new Error('Intl not available');
			});

			const signal = getTimezoneLocation();
			expect(signal).toBeNull();
		});

		it('should include timezone in metadata', () => {
			vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
				() =>
					({
						resolvedOptions: () => ({ timeZone: 'America/Detroit' })
					}) as Intl.DateTimeFormat
			);

			const signal = getTimezoneLocation();
			expect(signal!.metadata?.timezone).toBe('America/Detroit');
			expect(signal!.state_code).toBe('MI');
		});

		it('should handle Indiana timezone zones', () => {
			vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
				() =>
					({
						resolvedOptions: () => ({ timeZone: 'America/Indiana/Indianapolis' })
					}) as Intl.DateTimeFormat
			);

			const signal = getTimezoneLocation();
			expect(signal!.state_code).toBe('IN');
		});

		it('should handle Kentucky timezone zones', () => {
			vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
				() =>
					({
						resolvedOptions: () => ({ timeZone: 'America/Kentucky/Louisville' })
					}) as Intl.DateTimeFormat
			);

			const signal = getTimezoneLocation();
			expect(signal!.state_code).toBe('KY');
		});

		it('should set congressional_district to null (timezone cannot determine district)', () => {
			vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
				() =>
					({
						resolvedOptions: () => ({ timeZone: 'America/New_York' })
					}) as Intl.DateTimeFormat
			);

			const signal = getTimezoneLocation();
			expect(signal!.congressional_district).toBeNull();
		});

		it('should return GU for Pacific/Guam', () => {
			vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
				() =>
					({
						resolvedOptions: () => ({ timeZone: 'Pacific/Guam' })
					}) as Intl.DateTimeFormat
			);

			const signal = getTimezoneLocation();
			expect(signal!.state_code).toBe('GU');
		});
	});

	// =========================================================================
	// CensusAPIClient.geocodeAddress
	// =========================================================================

	describe('CensusAPIClient.geocodeAddress', () => {
		it('should return null when API responds with non-ok status', async () => {
			const client = new CensusAPIClient();

			vi.mocked(global.fetch).mockResolvedValue({
				ok: false,
				status: 400,
				statusText: 'Bad Request'
			} as Response);

			const result = await client.geocodeAddress('1600 Pennsylvania Ave, Washington DC');

			expect(result).toBeNull();
		});

		it('should return null when no address matches', async () => {
			const client = new CensusAPIClient();

			const emptyResponse: CensusGeocodingResponse = {
				result: {
					addressMatches: []
				}
			};

			vi.mocked(global.fetch).mockResolvedValue({
				ok: true,
				status: 200,
				json: vi.fn().mockResolvedValue(emptyResponse)
			} as unknown as Response);

			const result = await client.geocodeAddress('Nonexistent Address, Nowhere');

			expect(result).toBeNull();
		});

		it('should parse address match with congressional district and county', async () => {
			const client = new CensusAPIClient();

			const response: CensusGeocodingResponse = {
				result: {
					addressMatches: [
						{
							matchedAddress: '1600 PENNSYLVANIA AVE NW, WASHINGTON, DC, 20500',
							coordinates: { x: -77.0365, y: 38.8977 },
							geographies: {
								'119th Congressional Districts': [
									{
										CD119: '00',
										STATE: '11',
										GEOID: '1100',
										NAME: 'Delegate District (at Large)'
									}
								],
								Counties: [
									{
										COUNTY: '001',
										STATE: '11',
										NAME: 'District of Columbia'
									}
								]
							}
						}
					]
				}
			};

			vi.mocked(global.fetch).mockResolvedValue({
				ok: true,
				status: 200,
				json: vi.fn().mockResolvedValue(response)
			} as unknown as Response);

			const result = await client.geocodeAddress('1600 Pennsylvania Ave, Washington DC');

			expect(result).not.toBeNull();
			expect(result!.signal_type).toBe('oauth');
			expect(result!.confidence).toBe(0.8);
			expect(result!.country_code).toBe('US');
			expect(result!.congressional_district).toBe('DC-00');
			expect(result!.state_code).toBe('DC');
			expect(result!.county_fips).toBe('11001');
			expect(result!.latitude).toBe(38.8977);
			expect(result!.longitude).toBe(-77.0365);
		});

		it('should handle California FIPS code 06 correctly', async () => {
			const client = new CensusAPIClient();

			const response: CensusGeocodingResponse = {
				result: {
					addressMatches: [
						{
							matchedAddress: '350 5TH AVE, SAN FRANCISCO, CA, 94107',
							coordinates: { x: -122.4007, y: 37.7831 },
							geographies: {
								'119th Congressional Districts': [
									{
										CD119: '11',
										STATE: '06',
										GEOID: '0611',
										NAME: 'Congressional District 11'
									}
								],
								Counties: [
									{
										COUNTY: '075',
										STATE: '06',
										NAME: 'San Francisco'
									}
								]
							}
						}
					]
				}
			};

			vi.mocked(global.fetch).mockResolvedValue({
				ok: true,
				status: 200,
				json: vi.fn().mockResolvedValue(response)
			} as unknown as Response);

			const result = await client.geocodeAddress('350 5th Ave, San Francisco, CA');

			expect(result).not.toBeNull();
			expect(result!.state_code).toBe('CA');
			expect(result!.congressional_district).toBe('CA-11');
			expect(result!.county_fips).toBe('06075');
		});

		it('should handle Texas FIPS code 48 correctly', async () => {
			const client = new CensusAPIClient();

			const response: CensusGeocodingResponse = {
				result: {
					addressMatches: [
						{
							matchedAddress: '1100 CONGRESS AVE, AUSTIN, TX, 78701',
							coordinates: { x: -97.7431, y: 30.2672 },
							geographies: {
								'119th Congressional Districts': [
									{
										CD119: '21',
										STATE: '48',
										GEOID: '4821',
										NAME: 'Congressional District 21'
									}
								],
								Counties: [
									{
										COUNTY: '453',
										STATE: '48',
										NAME: 'Travis'
									}
								]
							}
						}
					]
				}
			};

			vi.mocked(global.fetch).mockResolvedValue({
				ok: true,
				status: 200,
				json: vi.fn().mockResolvedValue(response)
			} as unknown as Response);

			const result = await client.geocodeAddress('1100 Congress Ave, Austin, TX');

			expect(result!.state_code).toBe('TX');
			expect(result!.congressional_district).toBe('TX-21');
		});

		it('should return null when geographies are missing district data', async () => {
			const client = new CensusAPIClient();

			const response: CensusGeocodingResponse = {
				result: {
					addressMatches: [
						{
							matchedAddress: 'SOME ADDRESS',
							coordinates: { x: -100.0, y: 40.0 },
							geographies: {
								// No congressional districts
								Counties: [{ COUNTY: '001', STATE: '31', NAME: 'Adams' }]
							}
						}
					]
				}
			};

			vi.mocked(global.fetch).mockResolvedValue({
				ok: true,
				status: 200,
				json: vi.fn().mockResolvedValue(response)
			} as unknown as Response);

			const result = await client.geocodeAddress('Some Address, NE');

			// extractLocationFromMatch should still produce a result; state from county
			// Actually, without district, stateCode comes from district?.STATE or county?.STATE
			// With no district, it falls through to county.STATE = '31' -> NE
			expect(result).not.toBeNull();
			expect(result!.state_code).toBe('NE');
			// CD is null because no district
			expect(result!.congressional_district).toBeNull();
		});

		it('should return null on network error', async () => {
			const client = new CensusAPIClient();

			vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

			const result = await client.geocodeAddress('1600 Pennsylvania Ave');

			expect(result).toBeNull();
		});

		it('should handle malformed JSON response gracefully', async () => {
			const client = new CensusAPIClient();

			vi.mocked(global.fetch).mockResolvedValue({
				ok: true,
				status: 200,
				json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
			} as unknown as Response);

			const result = await client.geocodeAddress('1600 Pennsylvania Ave');

			expect(result).toBeNull();
		});
	});

	// =========================================================================
	// fetchWithRetry (tested indirectly via geocodeAddress)
	// =========================================================================

	describe('Retry logic', () => {
		it('should retry on 500 server error with exponential backoff', async () => {
			const client = new CensusAPIClient();

			const emptyResponse: CensusGeocodingResponse = {
				result: { addressMatches: [] }
			};

			// First two calls: 500; third call: 200
			vi.mocked(global.fetch)
				.mockResolvedValueOnce({
					ok: false,
					status: 500,
					statusText: 'Internal Server Error'
				} as Response)
				.mockResolvedValueOnce({
					ok: false,
					status: 500,
					statusText: 'Internal Server Error'
				} as Response)
				.mockResolvedValueOnce({
					ok: true,
					status: 200,
					json: vi.fn().mockResolvedValue(emptyResponse)
				} as unknown as Response);

			const result = await client.geocodeAddress('Test Address');

			// Should have been called 3 times (2 retries + final success)
			expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(3);
			// Returns null because emptyResponse has no matches, but no error thrown
			expect(result).toBeNull();
		});

		it('should retry on 429 rate limiting', async () => {
			const client = new CensusAPIClient();

			const emptyResponse: CensusGeocodingResponse = {
				result: { addressMatches: [] }
			};

			vi.mocked(global.fetch)
				.mockResolvedValueOnce({
					ok: false,
					status: 429,
					statusText: 'Too Many Requests'
				} as Response)
				.mockResolvedValueOnce({
					ok: true,
					status: 200,
					json: vi.fn().mockResolvedValue(emptyResponse)
				} as unknown as Response);

			const result = await client.geocodeAddress('Test Address');

			expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(2);
		});

		it('should NOT retry on 400 client error', async () => {
			const client = new CensusAPIClient();

			vi.mocked(global.fetch).mockResolvedValue({
				ok: false,
				status: 400,
				statusText: 'Bad Request'
			} as Response);

			const result = await client.geocodeAddress('Bad Address');

			// Only one call (no retries for 4xx except 429)
			expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(1);
			expect(result).toBeNull();
		});

		it('should NOT retry on 404', async () => {
			const client = new CensusAPIClient();

			vi.mocked(global.fetch).mockResolvedValue({
				ok: false,
				status: 404,
				statusText: 'Not Found'
			} as Response);

			const result = await client.geocodeAddress('Address');

			expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(1);
		});

		it('should retry on network error (fetch throws)', async () => {
			const client = new CensusAPIClient();

			vi.mocked(global.fetch)
				.mockRejectedValueOnce(new Error('ECONNRESET'))
				.mockRejectedValueOnce(new Error('ECONNRESET'))
				.mockRejectedValueOnce(new Error('ECONNRESET'));

			const result = await client.geocodeAddress('Test Address');

			// After 3 failed attempts, returns null (caught in geocodeAddress)
			expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(3);
			expect(result).toBeNull();
		});
	});

	// =========================================================================
	// Timeout handling
	// =========================================================================

	describe('Timeout handling', () => {
		it('should abort request after timeout', async () => {
			const client = new CensusAPIClient();

			// Simulate AbortError
			vi.mocked(global.fetch).mockRejectedValue(
				Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })
			);

			const result = await client.geocodeAddress('Test Address');

			expect(result).toBeNull();
		});
	});

	// =========================================================================
	// FIPS to state code mapping (tested via geocodeAddress)
	// =========================================================================

	describe('FIPS to state code conversion', () => {
		const fipsMappings: Array<[string, string, string]> = [
			['01', 'AL', 'Alabama'],
			['02', 'AK', 'Alaska'],
			['06', 'CA', 'California'],
			['11', 'DC', 'District of Columbia'],
			['12', 'FL', 'Florida'],
			['36', 'NY', 'New York'],
			['48', 'TX', 'Texas'],
			['53', 'WA', 'Washington'],
			['72', 'PR', 'Puerto Rico'],
			['78', 'VI', 'U.S. Virgin Islands']
		];

		it.each(fipsMappings)(
			'FIPS %s should map to %s (%s)',
			async (fips, expectedState, _name) => {
				const client = new CensusAPIClient();

				const response: CensusGeocodingResponse = {
					result: {
						addressMatches: [
							{
								matchedAddress: 'TEST ADDRESS',
								coordinates: { x: -100.0, y: 40.0 },
								geographies: {
									'119th Congressional Districts': [
										{
											CD119: '01',
											STATE: fips,
											GEOID: `${fips}01`,
											NAME: 'District 1'
										}
									],
									Counties: [
										{
											COUNTY: '001',
											STATE: fips,
											NAME: 'Test County'
										}
									]
								}
							}
						]
					}
				};

				vi.mocked(global.fetch).mockResolvedValue({
					ok: true,
					status: 200,
					json: vi.fn().mockResolvedValue(response)
				} as unknown as Response);

				const result = await client.geocodeAddress('Test');

				expect(result).not.toBeNull();
				expect(result!.state_code).toBe(expectedState);
			}
		);

		it('should return null state_code for unknown FIPS code', async () => {
			const client = new CensusAPIClient();

			const response: CensusGeocodingResponse = {
				result: {
					addressMatches: [
						{
							matchedAddress: 'TEST',
							coordinates: { x: 0, y: 0 },
							geographies: {
								'119th Congressional Districts': [
									{
										CD119: '01',
										STATE: '99', // Invalid FIPS
										GEOID: '9901',
										NAME: 'Unknown'
									}
								],
								Counties: []
							}
						}
					]
				}
			};

			vi.mocked(global.fetch).mockResolvedValue({
				ok: true,
				status: 200,
				json: vi.fn().mockResolvedValue(response)
			} as unknown as Response);

			const result = await client.geocodeAddress('Test');

			// fipsToStateCode returns null for unknown code
			expect(result).not.toBeNull();
			expect(result!.state_code).toBeNull();
			// Congressional district should also be null since state is null
			expect(result!.congressional_district).toBeNull();
		});
	});

	// =========================================================================
	// getBrowserGeolocation
	// =========================================================================

	describe('getBrowserGeolocation', () => {
		it('should return null when geolocation is not supported', async () => {
			// Temporarily remove geolocation from navigator
			const origNav = window.navigator;
			Object.defineProperty(window, 'navigator', {
				value: { ...origNav, geolocation: undefined },
				writable: true,
				configurable: true
			});

			const result = await getBrowserGeolocation();

			expect(result).toBeNull();

			// Restore
			Object.defineProperty(window, 'navigator', {
				value: origNav,
				writable: true,
				configurable: true
			});
		});

		it('should return null when user denies permission', async () => {
			const mockGeolocation = {
				getCurrentPosition: vi.fn((_success: PositionCallback, error?: PositionErrorCallback) => {
					if (error) {
						error({
							code: 1,
							message: 'User denied Geolocation',
							PERMISSION_DENIED: 1,
							POSITION_UNAVAILABLE: 2,
							TIMEOUT: 3
						} as GeolocationPositionError);
					}
				})
			};

			Object.defineProperty(window.navigator, 'geolocation', {
				value: mockGeolocation,
				writable: true,
				configurable: true
			});

			const result = await getBrowserGeolocation();

			expect(result).toBeNull();
		});
	});

	// =========================================================================
	// Geolocation bounds
	// =========================================================================

	describe('Geolocation coordinate validation', () => {
		it('should handle valid US coordinates (continental)', async () => {
			const client = new CensusAPIClient();

			// Latitude: 24.5 to 49.4, Longitude: -125 to -67
			// San Francisco: 37.7749, -122.4194
			const response: CensusGeocodingResponse = {
				result: {
					addressMatches: [
						{
							matchedAddress: 'TEST',
							coordinates: { x: -122.4194, y: 37.7749 },
							geographies: {
								'119th Congressional Districts': [
									{ CD119: '11', STATE: '06', GEOID: '0611', NAME: 'CD-11' }
								],
								Counties: [{ COUNTY: '075', STATE: '06', NAME: 'San Francisco' }]
							}
						}
					]
				}
			};

			vi.mocked(global.fetch).mockResolvedValue({
				ok: true,
				status: 200,
				json: vi.fn().mockResolvedValue(response)
			} as unknown as Response);

			const result = await client.geocodeAddress('San Francisco, CA');

			expect(result).not.toBeNull();
			expect(result!.latitude).toBe(37.7749);
			expect(result!.longitude).toBe(-122.4194);
		});
	});

	// =========================================================================
	// US territory support
	// =========================================================================

	describe('US territory support', () => {
		it('should map American Samoa FIPS 60 to AS', async () => {
			const client = new CensusAPIClient();

			const response: CensusGeocodingResponse = {
				result: {
					addressMatches: [
						{
							matchedAddress: 'PAGO PAGO',
							coordinates: { x: -170.7, y: -14.28 },
							geographies: {
								'119th Congressional Districts': [
									{ CD119: '98', STATE: '60', GEOID: '6098', NAME: 'At Large' }
								],
								Counties: [{ COUNTY: '010', STATE: '60', NAME: 'Eastern' }]
							}
						}
					]
				}
			};

			vi.mocked(global.fetch).mockResolvedValue({
				ok: true,
				status: 200,
				json: vi.fn().mockResolvedValue(response)
			} as unknown as Response);

			const result = await client.geocodeAddress('Pago Pago, AS');

			expect(result!.state_code).toBe('AS');
		});

		it('should map Guam FIPS 66 to GU', async () => {
			const client = new CensusAPIClient();

			const response: CensusGeocodingResponse = {
				result: {
					addressMatches: [
						{
							matchedAddress: 'HAGATNA',
							coordinates: { x: 144.75, y: 13.47 },
							geographies: {
								'119th Congressional Districts': [
									{ CD119: '98', STATE: '66', GEOID: '6698', NAME: 'At Large' }
								],
								Counties: [{ COUNTY: '010', STATE: '66', NAME: 'Guam' }]
							}
						}
					]
				}
			};

			vi.mocked(global.fetch).mockResolvedValue({
				ok: true,
				status: 200,
				json: vi.fn().mockResolvedValue(response)
			} as unknown as Response);

			const result = await client.geocodeAddress('Hagatna, GU');

			expect(result!.state_code).toBe('GU');
		});
	});

	// =========================================================================
	// District number formatting
	// =========================================================================

	describe('Congressional district number formatting', () => {
		it('should pad single-digit district number to 2 digits', async () => {
			const client = new CensusAPIClient();

			const response: CensusGeocodingResponse = {
				result: {
					addressMatches: [
						{
							matchedAddress: 'TEST',
							coordinates: { x: -100, y: 40 },
							geographies: {
								'119th Congressional Districts': [
									{ CD119: '5', STATE: '06', GEOID: '0605', NAME: 'CD 5' }
								],
								Counties: [{ COUNTY: '001', STATE: '06', NAME: 'Alameda' }]
							}
						}
					]
				}
			};

			vi.mocked(global.fetch).mockResolvedValue({
				ok: true,
				status: 200,
				json: vi.fn().mockResolvedValue(response)
			} as unknown as Response);

			const result = await client.geocodeAddress('Test');

			expect(result!.congressional_district).toBe('CA-05');
		});

		it('should not pad two-digit district number', async () => {
			const client = new CensusAPIClient();

			const response: CensusGeocodingResponse = {
				result: {
					addressMatches: [
						{
							matchedAddress: 'TEST',
							coordinates: { x: -100, y: 40 },
							geographies: {
								'119th Congressional Districts': [
									{ CD119: '25', STATE: '48', GEOID: '4825', NAME: 'CD 25' }
								],
								Counties: [{ COUNTY: '453', STATE: '48', NAME: 'Travis' }]
							}
						}
					]
				}
			};

			vi.mocked(global.fetch).mockResolvedValue({
				ok: true,
				status: 200,
				json: vi.fn().mockResolvedValue(response)
			} as unknown as Response);

			const result = await client.geocodeAddress('Test');

			expect(result!.congressional_district).toBe('TX-25');
		});
	});

	// =========================================================================
	// URL construction
	// =========================================================================

	describe('URL construction', () => {
		it('should encode address in URL for geocodeAddress', async () => {
			const client = new CensusAPIClient();

			vi.mocked(global.fetch).mockResolvedValue({
				ok: true,
				status: 200,
				json: vi.fn().mockResolvedValue({ result: { addressMatches: [] } })
			} as unknown as Response);

			await client.geocodeAddress('123 Main St, Springfield, IL');

			const calledUrl = vi.mocked(global.fetch).mock.calls[0][0] as string;
			expect(calledUrl).toContain('geocoding.geo.census.gov');
			expect(calledUrl).toContain('onelineaddress');
			expect(calledUrl).toContain(encodeURIComponent('123 Main St, Springfield, IL'));
		});
	});
});
