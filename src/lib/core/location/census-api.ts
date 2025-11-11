/**
 * Census Bureau Geocoding API Client (Browser-Side)
 *
 * Privacy-preserving geocoding - runs in browser, NOT on server.
 * Used for converting browser geolocation coordinates to congressional district.
 *
 * API Documentation: https://geocoding.geo.census.gov/geocoder/
 */

import type { CensusGeocodingResponse, CensusAddressMatch, LocationSignal } from './types';

// ============================================================================
// Census API Client
// ============================================================================

/**
 * CensusAPIClient: Browser-based geocoding client
 */
export class CensusAPIClient {
	private readonly baseUrl = 'https://geocoding.geo.census.gov/geocoder';

	/**
	 * Geocode coordinates to congressional district using JSONP
	 */
	async geocodeCoordinates(latitude: number, longitude: number): Promise<LocationSignal | null> {
		try {
			// Step 1: Get city name from Nominatim (OpenStreetMap) - free, no API key
			const nominatimData = await this.getNominatimData(latitude, longitude);
			const cityName = nominatimData?.city;
			const stateCode = nominatimData?.state;
			const countyName = nominatimData?.county;

			// Step 2: Get congressional district from Census API using JSONP
			// Census API doesn't support CORS, so we use JSONP instead
			const callbackName = `censusCallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

			return new Promise((resolve) => {
				// Set timeout to prevent hanging
				const timeout = setTimeout(() => {
					cleanup();
					console.warn('[Census API] Request timed out - falling back to Nominatim data');
					// Graceful degradation: Return city/state from Nominatim even if Census fails
					resolve(createFallbackSignal());
				}, 10000); // 10 second timeout

				// Helper to create fallback signal when Census API fails
				const createFallbackSignal = (): LocationSignal | null => {
					if (!cityName && !stateCode) {
						console.warn('[Census API] No data from Nominatim, cannot create fallback signal');
						return null;
					}

					console.log('[Census API] ⚠️ Using fallback signal with Nominatim data only');
					return {
						signal_type: 'browser',
						confidence: 0.4, // Lower confidence without district data
						congressional_district: null, // Can't determine without Census API
						state_code: stateCode || null,
						city_name: cityName || null,
						county_fips: null,
						latitude,
						longitude,
						source: 'nominatim.browser',
						timestamp: new Date().toISOString(),
						metadata: {
							county_name: countyName,
							fallback: true,
							reason: 'Census API unavailable'
						}
					};
				};

				// Create callback function
				(window as typeof window & { [key: string]: (data: unknown) => void })[callbackName] = (
					data: unknown
				) => {
					cleanup();

					console.log('[Census API] Raw response:', data);

					// The /geographies/coordinates endpoint returns nested under "result"
					const responseData = data as {
						result?: {
							geographies?: {
								'119th Congressional Districts'?: Array<{ GEOID: string; NAME: string }>;
								Counties?: Array<{ GEOID: string; NAME: string; STATE: string; COUNTY: string }>;
								States?: Array<{ GEOID: string; NAME: string; STUSAB: string }>;
							};
							input?: {
								location?: { x: number; y: number };
							};
						};
					};

					const geographies = responseData?.result?.geographies;
					if (!geographies) {
						console.warn(
							'[Census API] No geographies in response - falling back to Nominatim data'
						);
						resolve(createFallbackSignal());
						return;
					}

					// Extract congressional district
					const districts = geographies['119th Congressional Districts'];
					const district = districts?.[0];

					// Extract county
					const counties = geographies['Counties'];
					const county = counties?.[0];

					// Extract state
					const states = geographies['States'];
					const state = states?.[0];

					if (!district || !state) {
						console.warn(
							'[Census API] Missing district or state data - falling back to Nominatim data'
						);
						resolve(createFallbackSignal());
						return;
					}

					// Parse congressional district (GEOID format: "0611" = CA-11)
					const censusStateCode = state.STUSAB; // e.g., "CA"
					const districtNumber = district.GEOID.slice(2); // Remove state prefix
					const congressionalDistrict = `${censusStateCode}-${districtNumber}`;

					const censusCountyName = county?.NAME || null;

					// Build location signal with actual city name from Nominatim + district from Census
					const signal: LocationSignal = {
						signal_type: 'browser',
						confidence: 0.6,
						congressional_district: congressionalDistrict,
						state_code: censusStateCode,
						city_name: cityName, // From Nominatim reverse geocoding
						county_fips: county ? county.GEOID : null,
						latitude,
						longitude,
						source: 'census.browser',
						timestamp: new Date().toISOString(),
						metadata: {
							county_name: censusCountyName || countyName, // Prefer Census county, fallback to Nominatim
							district_name: district.NAME
						}
					};

					console.log('[Census API] ✓ Extracted location signal:', signal);
					resolve(signal);
				};

				// Create script element for JSONP request
				const script = document.createElement('script');
				script.src = `${this.baseUrl}/geographies/coordinates?x=${longitude}&y=${latitude}&benchmark=4&vintage=4&format=jsonp&callback=${callbackName}`;
				script.onerror = () => {
					cleanup();
					console.error('[Census API] JSONP request failed - falling back to Nominatim data');
					resolve(createFallbackSignal());
				};

				// Cleanup function
				const cleanup = () => {
					clearTimeout(timeout);
					delete (window as typeof window & { [key: string]: unknown })[callbackName];
					if (script.parentNode) {
						script.parentNode.removeChild(script);
					}
				};

				// Add script to document
				document.head.appendChild(script);
			});
		} catch (error) {
			console.error('Census geocoding error:', error);
			return null;
		}
	}

	/**
	 * Geocode address string to congressional district
	 */
	async geocodeAddress(address: string): Promise<LocationSignal | null> {
		try {
			const url = `${this.baseUrl}/geographies/onelineaddress?address=${encodeURIComponent(address)}&benchmark=4&vintage=4&format=json`;

			const response = await fetch(url);
			if (!response.ok) {
				console.error('Census API error:', response.status);
				return null;
			}

			const data = (await response.json()) as CensusGeocodingResponse;

			// Extract location data from response
			const match = data?.result?.addressMatches?.[0];
			if (!match) {
				console.warn('No census match for address:', address);
				return null;
			}

			return this.extractLocationFromMatch(match, 'oauth');
		} catch (error) {
			console.error('Census geocoding error:', error);
			return null;
		}
	}

	/**
	 * Extract location signal from census match
	 */
	private extractLocationFromMatch(
		match: CensusAddressMatch,
		source: string
	): LocationSignal | null {
		try {
			const geographies = match.geographies;

			// Extract congressional district
			const districts = geographies?.['119th Congressional Districts'];
			const district = districts?.[0];
			const cd = district?.CD119;

			// Extract county
			const counties = geographies?.['Counties'];
			const county = counties?.[0];
			const countyFips = county ? `${county.STATE}${county.COUNTY}` : null;
			const countyName = county?.NAME || null;

			// Extract state from congressional district or county
			const stateCode = district?.STATE || county?.STATE || null;
			const stateName = this.fipsToStateCode(stateCode);

			// Format congressional district as "STATE-XX"
			const congressionalDistrict = stateName && cd ? `${stateName}-${cd.padStart(2, '0')}` : null;

			// Coordinates
			const latitude = match.coordinates?.y || null;
			const longitude = match.coordinates?.x || null;

			// Build location signal
			const signal: LocationSignal = {
				signal_type: source === 'browser' ? 'browser' : 'oauth',
				confidence: source === 'browser' ? 0.6 : 0.8, // Browser geolocation is less reliable
				congressional_district: congressionalDistrict,
				state_code: stateName,
				county_fips: countyFips,
				latitude,
				longitude,
				source: `census.${source}`,
				timestamp: new Date().toISOString(),
				metadata: {
					matched_address: match.matchedAddress,
					county_name: countyName
				}
			};

			return signal;
		} catch (error) {
			console.error('Failed to extract location from census match:', error);
			return null;
		}
	}

	/**
	 * Get location data from Nominatim (OpenStreetMap) reverse geocoding - FREE, no API key
	 */
	private async getNominatimData(
		latitude: number,
		longitude: number
	): Promise<{ city: string | null; state: string | null; county: string | null } | null> {
		try {
			// Nominatim API - free OpenStreetMap reverse geocoding
			// Usage policy: https://operations.osmfoundation.org/policies/nominatim/
			const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;

			const response = await fetch(url, {
				headers: {
					'User-Agent': 'Communique/1.0 (https://communique.app)' // Required by Nominatim
				}
			});

			if (!response.ok) {
				console.warn('[Nominatim] API error:', response.status);
				return null;
			}

			const data = await response.json();
			console.log('[Nominatim] Reverse geocoding response:', data);

			// Extract address components
			const address = data?.address;
			if (!address) return null;

			// Priority: city > town > village > hamlet
			const cityName = address.city || address.town || address.village || address.hamlet || null;

			// Extract state code (ISO3166-2-lvl4 format: "US-CA" → "CA")
			const stateISO = address['ISO3166-2-lvl4']; // e.g., "US-CA"
			const stateCode = stateISO ? stateISO.split('-')[1] : null;

			// Extract county name (may include "County" suffix)
			const countyName = address.county || null;

			return {
				city: cityName,
				state: stateCode,
				county: countyName
			};
		} catch (error) {
			console.error('[Nominatim] Reverse geocoding error:', error);
			return null;
		}
	}

	/**
	 * Convert state FIPS code to state abbreviation
	 */
	private fipsToStateCode(fips: string | null): string | null {
		if (!fips) return null;

		const fipsMap: Record<string, string> = {
			'01': 'AL',
			'02': 'AK',
			'04': 'AZ',
			'05': 'AR',
			'06': 'CA',
			'08': 'CO',
			'09': 'CT',
			'10': 'DE',
			'11': 'DC',
			'12': 'FL',
			'13': 'GA',
			'15': 'HI',
			'16': 'ID',
			'17': 'IL',
			'18': 'IN',
			'19': 'IA',
			'20': 'KS',
			'21': 'KY',
			'22': 'LA',
			'23': 'ME',
			'24': 'MD',
			'25': 'MA',
			'26': 'MI',
			'27': 'MN',
			'28': 'MS',
			'29': 'MO',
			'30': 'MT',
			'31': 'NE',
			'32': 'NV',
			'33': 'NH',
			'34': 'NJ',
			'35': 'NM',
			'36': 'NY',
			'37': 'NC',
			'38': 'ND',
			'39': 'OH',
			'40': 'OK',
			'41': 'OR',
			'42': 'PA',
			'44': 'RI',
			'45': 'SC',
			'46': 'SD',
			'47': 'TN',
			'48': 'TX',
			'49': 'UT',
			'50': 'VT',
			'51': 'VA',
			'53': 'WA',
			'54': 'WV',
			'55': 'WI',
			'56': 'WY',
			'60': 'AS', // American Samoa
			'66': 'GU', // Guam
			'69': 'MP', // Northern Mariana Islands
			'72': 'PR', // Puerto Rico
			'78': 'VI' // U.S. Virgin Islands
		};

		return fipsMap[fips] || null;
	}
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Singleton instance for census API client
 */
export const censusAPI = new CensusAPIClient();

// ============================================================================
// Browser Geolocation Utilities
// ============================================================================

/**
 * Get browser geolocation (requires user permission)
 */
export async function getBrowserGeolocation(): Promise<LocationSignal | null> {
	// Check if geolocation is supported
	if (!navigator.geolocation) {
		console.warn('Geolocation API not supported');
		return null;
	}

	return new Promise((resolve) => {
		navigator.geolocation.getCurrentPosition(
			async (position) => {
				const { latitude, longitude } = position.coords;

				// Geocode coordinates to congressional district
				const signal = await censusAPI.geocodeCoordinates(latitude, longitude);
				resolve(signal);
			},
			(error) => {
				console.warn('Geolocation permission denied or unavailable:', error.message);
				resolve(null);
			},
			{
				enableHighAccuracy: true,
				timeout: 10000,
				maximumAge: 0
			}
		);
	});
}

/**
 * Get timezone-based location inference (weak signal)
 */
export function getTimezoneLocation(): LocationSignal | null {
	try {
		const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		console.log(`[Location] Detected timezone: ${timezone}`);

		// Comprehensive timezone to state mapping
		const timezoneToState: Record<string, string> = {
			// Eastern Time
			'America/New_York': 'NY',
			'America/Detroit': 'MI',
			'America/Toronto': 'NY', // Maps to Eastern timezone
			'America/Montreal': 'NY',
			'America/Nassau': 'NY',
			'America/Panama': 'NY',
			'America/Iqaluit': 'NY',

			// Central Time
			'America/Chicago': 'IL',
			'America/Indiana/Tell_City': 'IN',
			'America/Indiana/Knox': 'IN',
			'America/Menominee': 'MI',
			'America/North_Dakota/Center': 'ND',
			'America/North_Dakota/New_Salem': 'ND',
			'America/North_Dakota/Beulah': 'ND',
			'America/Winnipeg': 'IL',
			'America/Matamoros': 'TX',

			// Mountain Time
			'America/Denver': 'CO',
			'America/Boise': 'ID',
			'America/Phoenix': 'AZ',
			'America/Edmonton': 'CO',
			'America/Hermosillo': 'AZ',
			'America/Mazatlan': 'AZ',
			'America/Ojinaga': 'TX',

			// Pacific Time
			'America/Los_Angeles': 'CA',
			'America/Tijuana': 'CA',
			'America/Vancouver': 'WA',
			'America/Whitehorse': 'WA',
			'America/Dawson': 'WA',

			// Alaska Time
			'America/Anchorage': 'AK',
			'America/Juneau': 'AK',
			'America/Metlakatla': 'AK',
			'America/Nome': 'AK',
			'America/Sitka': 'AK',
			'America/Yakutat': 'AK',

			// Hawaii-Aleutian Time
			'Pacific/Honolulu': 'HI',
			'America/Adak': 'AK',

			// State-specific zones
			'America/Indiana/Indianapolis': 'IN',
			'America/Indiana/Marengo': 'IN',
			'America/Indiana/Petersburg': 'IN',
			'America/Indiana/Vevay': 'IN',
			'America/Indiana/Vincennes': 'IN',
			'America/Indiana/Winamac': 'IN',
			'America/Kentucky/Louisville': 'KY',
			'America/Kentucky/Monticello': 'KY',

			// Territories
			'Pacific/Guam': 'GU',
			'Pacific/Saipan': 'MP',
			'America/Puerto_Rico': 'PR',
			'America/Virgin': 'VI'
		};

		const stateCode = timezoneToState[timezone] || null;

		if (!stateCode) {
			// Fallback: try to extract state from timezone string
			// e.g., "America/New_York" → check if "New_York" contains a state code
			console.warn(`[Location] Unknown timezone: ${timezone}`);
			return null;
		}

		return {
			signal_type: 'ip',
			confidence: 0.2, // Low confidence - timezone is a weak signal
			state_code: stateCode,
			congressional_district: null,
			latitude: null,
			longitude: null,
			source: 'browser.timezone',
			timestamp: new Date().toISOString(),
			metadata: {
				timezone
			}
		};
	} catch (error) {
		console.error('Failed to extract timezone location:', error);
		return null;
	}
}
