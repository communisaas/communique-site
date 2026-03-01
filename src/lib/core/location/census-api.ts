/**
 * Census Bureau Geocoding API Client
 *
 * Coordinate geocoding proxied through server to avoid CSP/CORS issues.
 * Address geocoding uses Census Bureau directly (JSON format, no CSP issue).
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
	private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
	private readonly MAX_RETRIES = 3;
	private readonly RETRY_DELAY = 1000; // 1 second

	/**
	 * Execute fetch with timeout
	 */
	private async fetchWithTimeout(
		url: string,
		options: RequestInit = {},
		timeout: number = this.DEFAULT_TIMEOUT
	): Promise<Response> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		try {
			const response = await fetch(url, {
				...options,
				signal: controller.signal
			});
			clearTimeout(timeoutId);
			return response;
		} catch (error) {
			clearTimeout(timeoutId);
			if (error instanceof Error && error.name === 'AbortError') {
				const timeoutError = new Error(`Request timeout after ${timeout}ms: ${url}`);
				console.error('[Census API] Timeout:', timeoutError.message);
				throw timeoutError;
			}
			throw error;
		}
	}

	/**
	 * Execute fetch with retry logic for transient failures
	 */
	private async fetchWithRetry(
		url: string,
		options: RequestInit = {},
		timeout: number = this.DEFAULT_TIMEOUT
	): Promise<Response> {
		let lastError: Error | null = null;

		for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
			try {
				const response = await this.fetchWithTimeout(url, options, timeout);

				// Don't retry on client errors (4xx except 429)
				if (response.status >= 400 && response.status < 500 && response.status !== 429) {
					return response;
				}

				// Retry on server errors (5xx) or rate limiting (429)
				if (response.status === 429 || response.status >= 500) {
					if (attempt < this.MAX_RETRIES - 1) {
						const delay = this.RETRY_DELAY * Math.pow(2, attempt);
						console.warn(
							`[Census API] Request failed with status ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${this.MAX_RETRIES})`
						);
						await new Promise((resolve) => setTimeout(resolve, delay));
						continue;
					}
				}

				return response;
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));

				// Don't retry on timeout if it's the last attempt
				if (attempt === this.MAX_RETRIES - 1) {
					console.error(`[Census API] Request failed after ${this.MAX_RETRIES} attempts:`, lastError.message);
					throw lastError;
				}

				// Exponential backoff for retries
				const delay = this.RETRY_DELAY * Math.pow(2, attempt);
				console.warn(
					`[Census API] Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${this.MAX_RETRIES}): ${lastError.message}`
				);
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}

		throw lastError || new Error('Request failed after retries');
	}

	/**
	 * Geocode address string to congressional district
	 */
	async geocodeAddress(address: string): Promise<LocationSignal | null> {
		try {
			const url = `${this.baseUrl}/geographies/onelineaddress?address=${encodeURIComponent(address)}&benchmark=4&vintage=4&format=json`;

			const response = await this.fetchWithRetry(url);
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
				country_code: 'US', // Census API only covers US
				congressional_district: congressionalDistrict,
				state_code: stateName,
				city_name: null,
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
			(position) => {
				const { latitude, longitude } = position.coords;

				// Return minimal signal with coordinates only.
				// District resolution happens server-side via /api/location/resolve
				// (Census Bureau for cell_id + Shadow Atlas for districts/officials).
				resolve({
					signal_type: 'browser',
					confidence: 0.6,
					country_code: 'US',
					congressional_district: null,
					state_code: null,
					city_name: null,
					county_fips: null,
					latitude,
					longitude,
					source: 'browser.geolocation',
					timestamp: new Date().toISOString()
				});
			},
			(error) => {
				console.warn('Geolocation permission denied or unavailable:', error.message);
				resolve(null);
			},
			{
				enableHighAccuracy: true,
				timeout: 30000, // 30 seconds for geolocation
				maximumAge: 0
			}
		);
	});
}

/**
 * Get timezone-based location inference (country-level only).
 *
 * Design principle: timezone → country is reliable (IANA zone names are
 * geographically scoped). Timezone → state is NOT (US Eastern covers 20+
 * states, Canada and US share America/* prefix). We intentionally do NOT
 * infer state/province from timezone — that's what IP lookup and user
 * selection are for.
 *
 * The map below covers IANA reference cities for countries we actively
 * support. Unknown zones return null. This scales globally by adding
 * one line per IANA city, not per state×timezone.
 */
export function getTimezoneLocation(): LocationSignal | null {
	try {
		const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		console.debug(`[Location] Detected timezone: ${timezone}`);

		// IANA reference city → ISO 3166-1 alpha-2 country code
		// One entry per city. No state inference — country only.
		const tzToCountry: Record<string, string> = {
			// North America
			'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US',
			'America/Los_Angeles': 'US', 'America/Phoenix': 'US', 'America/Anchorage': 'US',
			'America/Boise': 'US', 'America/Detroit': 'US', 'America/Juneau': 'US',
			'America/Nome': 'US', 'America/Sitka': 'US', 'America/Yakutat': 'US',
			'America/Metlakatla': 'US', 'America/Adak': 'US', 'America/Menominee': 'US',
			'America/Indiana/Indianapolis': 'US', 'America/Indiana/Knox': 'US',
			'America/Indiana/Marengo': 'US', 'America/Indiana/Petersburg': 'US',
			'America/Indiana/Tell_City': 'US', 'America/Indiana/Vevay': 'US',
			'America/Indiana/Vincennes': 'US', 'America/Indiana/Winamac': 'US',
			'America/Kentucky/Louisville': 'US', 'America/Kentucky/Monticello': 'US',
			'America/North_Dakota/Beulah': 'US', 'America/North_Dakota/Center': 'US',
			'America/North_Dakota/New_Salem': 'US',
			'Pacific/Honolulu': 'US', 'America/Puerto_Rico': 'US', 'America/Virgin': 'US',
			'Pacific/Guam': 'US', 'Pacific/Saipan': 'US',
			'America/Toronto': 'CA', 'America/Montreal': 'CA', 'America/Vancouver': 'CA',
			'America/Winnipeg': 'CA', 'America/Edmonton': 'CA', 'America/Halifax': 'CA',
			'America/St_Johns': 'CA', 'America/Regina': 'CA', 'America/Iqaluit': 'CA',
			'America/Whitehorse': 'CA', 'America/Dawson': 'CA', 'America/Moncton': 'CA',
			'America/Yellowknife': 'CA',
			'America/Mexico_City': 'MX', 'America/Tijuana': 'MX', 'America/Hermosillo': 'MX',
			'America/Mazatlan': 'MX', 'America/Matamoros': 'MX', 'America/Ojinaga': 'MX',
			// Caribbean & Central America
			'America/Nassau': 'BS', 'America/Panama': 'PA',
			'America/Jamaica': 'JM', 'America/Barbados': 'BB',
			// Oceania
			'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Australia/Brisbane': 'AU',
			'Australia/Adelaide': 'AU', 'Australia/Perth': 'AU', 'Australia/Hobart': 'AU',
			'Australia/Darwin': 'AU', 'Australia/Canberra': 'AU',
			'Pacific/Auckland': 'NZ', 'Pacific/Chatham': 'NZ',
			// Europe
			'Europe/London': 'GB', 'Europe/Dublin': 'IE', 'Europe/Paris': 'FR',
			'Europe/Berlin': 'DE', 'Europe/Madrid': 'ES', 'Europe/Rome': 'IT',
			'Europe/Amsterdam': 'NL', 'Europe/Brussels': 'BE', 'Europe/Zurich': 'CH',
			'Europe/Vienna': 'AT', 'Europe/Stockholm': 'SE', 'Europe/Oslo': 'NO',
			'Europe/Copenhagen': 'DK', 'Europe/Helsinki': 'FI', 'Europe/Warsaw': 'PL',
			'Europe/Prague': 'CZ', 'Europe/Lisbon': 'PT', 'Europe/Athens': 'GR',
			'Europe/Bucharest': 'RO', 'Europe/Budapest': 'HU',
			// Asia
			'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Shanghai': 'CN',
			'Asia/Hong_Kong': 'HK', 'Asia/Singapore': 'SG', 'Asia/Kolkata': 'IN',
			'Asia/Dubai': 'AE', 'Asia/Jerusalem': 'IL', 'Asia/Bangkok': 'TH',
			'Asia/Jakarta': 'ID', 'Asia/Taipei': 'TW', 'Asia/Manila': 'PH',
			// South America
			'America/Sao_Paulo': 'BR', 'America/Buenos_Aires': 'AR',
			'America/Santiago': 'CL', 'America/Bogota': 'CO', 'America/Lima': 'PE',
			// Africa
			'Africa/Lagos': 'NG', 'Africa/Cairo': 'EG', 'Africa/Johannesburg': 'ZA',
			'Africa/Nairobi': 'KE', 'Africa/Casablanca': 'MA'
		};

		const countryCode = tzToCountry[timezone];

		if (!countryCode) {
			console.debug(`[Location] No country mapping for timezone: ${timezone}`);
			return null;
		}

		return {
			signal_type: 'ip',
			confidence: 0.15, // Very low — country-level hint only
			country_code: countryCode,
			state_code: null, // Intentionally null: timezone cannot reliably infer state
			city_name: null,
			congressional_district: null,
			county_fips: null,
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
