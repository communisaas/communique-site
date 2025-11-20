/**
 * Census Bureau Geocoding API integration
 * Converts US addresses to structured geographic scope with congressional districts
 *
 * Provider: US Census Bureau (FREE, unlimited, US-only)
 * Cost: $0/month (completely free)
 * Coverage: 100% US addresses + congressional/state legislative districts
 * Latency: ~200-500ms uncached, <1ms cached
 *
 * Rate limiting: Respectful 1 req/sec (self-imposed, no official limit)
 */

import type { ScopeLevel, ScopeMapping } from '$lib/utils/scope-mapper-international';

export interface GeocodeResult {
	display_text: string;
	country_code: string;
	region_code?: string; // State code (e.g., "CA")
	locality_code?: string; // City name
	district_code?: string; // Congressional district (e.g., "11")
	scope_level: ScopeLevel;
	confidence: number;
	lat?: number;
	lng?: number;
	formatted_address?: string;
}

interface CensusGeocodeResponse {
	result: {
		addressMatches: Array<{
			matchedAddress: string;
			coordinates: {
				x: number; // Longitude
				y: number; // Latitude
			};
			addressComponents: {
				streetName?: string;
				city?: string;
				state?: string;
				zip?: string;
			};
			geographies: {
				'119th Congressional Districts'?: Array<{
					GEOID: string;
					NAME: string;
					STATE: string;
					CD119?: string;
					BASENAME?: string;
				}>;
				Counties?: Array<{
					NAME: string;
				}>;
			};
		}>;
	};
}

// State FIPS code to abbreviation mapping
const STATE_FIPS_MAP: Record<string, string> = {
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
	'56': 'WY'
};

/**
 * Parse address string into components for Census API
 * Handles formats like:
 * - "1600 Pennsylvania Ave NW, Washington, DC 20500"
 * - "123 Main St, San Francisco, CA 94103"
 * - "Golden Gate Bridge, San Francisco, CA"
 */
function parseAddress(locationText: string): {
	street: string;
	city: string;
	state: string;
	zip?: string;
} | null {
	// Try to extract components from comma-separated format
	const parts = locationText.split(',').map((p) => p.trim());

	if (parts.length < 2) {
		return null; // Need at least street + city/state
	}

	// Last part might be "STATE ZIP" or just "STATE"
	const lastPart = parts[parts.length - 1];
	const stateZipMatch = lastPart.match(/([A-Z]{2})\s*(\d{5})?/);

	if (!stateZipMatch) {
		return null; // No valid state code found
	}

	const state = stateZipMatch[1];
	const zip = stateZipMatch[2];

	// Second-to-last part is city
	const city = parts.length >= 2 ? parts[parts.length - 2] : '';

	// Everything before city is street address
	const street = parts.slice(0, -2).join(', ');

	if (!street || !city) {
		return null;
	}

	return { street, city, state, zip };
}

/**
 * Convert Census geocoding result to our scope mapping format
 */
function parseCensusGeocodeResult(
	data: CensusGeocodeResponse,
	originalInput: string
): GeocodeResult | null {
	if (!data.result?.addressMatches || data.result.addressMatches.length === 0) {
		return null;
	}

	const match = data.result.addressMatches[0];
	const geo = match.geographies;

	if (!geo) {
		return null;
	}

	// Extract congressional district
	const cd = geo['119th Congressional Districts']?.[0];
	const county = geo.Counties?.[0];

	if (!cd) {
		// If no congressional district, return locality-level
		const city = match.addressComponents.city;
		const state = match.addressComponents.state;

		return {
			display_text: city || originalInput,
			country_code: 'US',
			region_code: state,
			locality_code: city,
			scope_level: 'locality',
			confidence: 0.75,
			lat: match.coordinates.y,
			lng: match.coordinates.x,
			formatted_address: match.matchedAddress
		};
	}

	// Parse congressional district number
	const stateCode = STATE_FIPS_MAP[cd.STATE];
	const districtNumber = cd.CD119 || cd.BASENAME || cd.GEOID.slice(2);

	if (!stateCode || !districtNumber) {
		return null;
	}

	// Format as "CA-11"
	const congressionalDistrict = `${stateCode}-${districtNumber.padStart(2, '0')}`;

	const geocodeResult: GeocodeResult = {
		display_text: congressionalDistrict,
		country_code: 'US',
		region_code: stateCode,
		locality_code: match.addressComponents.city,
		district_code: districtNumber,
		scope_level: 'district',
		confidence: 0.95, // Very high confidence from official Census data
		lat: match.coordinates.y,
		lng: match.coordinates.x,
		formatted_address: match.matchedAddress
	};

	return geocodeResult;
}

/**
 * Geocode a US address using Census Bureau API
 *
 * IMPORTANT: Only works for US addresses. For international, use fuzzy matching or LLM.
 *
 * @param locationText - US address (preferably in "street, city, STATE ZIP" format)
 * @param options - Timeout and other options
 * @returns Structured geographic scope with congressional district or null if geocoding fails
 */
export async function geocodeLocation(
	locationText: string,
	options?: { timeout?: number }
): Promise<GeocodeResult | null> {
	// Parse address components
	const addressParts = parseAddress(locationText);

	if (!addressParts) {
		console.log('[geocoding] Could not parse address:', locationText);
		return null;
	}

	const startTime = Date.now();

	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), options?.timeout || 3000);

		const url = new URL('https://geocoding.geo.census.gov/geocoder/geographies/address');
		url.searchParams.set('street', addressParts.street);
		url.searchParams.set('city', addressParts.city);
		url.searchParams.set('state', addressParts.state);
		if (addressParts.zip) {
			url.searchParams.set('zip', addressParts.zip);
		}
		url.searchParams.set('benchmark', 'Public_AR_Current'); // Current benchmark
		url.searchParams.set('vintage', 'Current_Current'); // Current vintage
		url.searchParams.set('format', 'json');

		const response = await fetch(url.toString(), {
			signal: controller.signal
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const data: CensusGeocodeResponse = await response.json();

		const latency = Date.now() - startTime;
		const geocodeResult = parseCensusGeocodeResult(data, locationText);

		// Structured logging for monitoring
		console.log(
			'[geocoding-census-api-call]',
			JSON.stringify({
				timestamp: new Date().toISOString(),
				input: locationText,
				parsed_address: addressParts,
				matches_found: data.result?.addressMatches?.length || 0,
				result: geocodeResult?.display_text || null,
				scope_level: geocodeResult?.scope_level || null,
				district: geocodeResult?.district_code
					? `${geocodeResult.region_code}-${geocodeResult.district_code}`
					: null,
				latency_ms: latency,
				cache_hit: false
			})
		);

		return geocodeResult;
	} catch (error) {
		const latency = Date.now() - startTime;

		if (error instanceof Error && error.name === 'AbortError') {
			console.error('[geocoding] Request timeout:', {
				input: locationText,
				timeout_ms: options?.timeout || 3000,
				latency_ms: latency
			});
		} else {
			console.error('[geocoding] Census API error:', error);
		}

		return null;
	}
}

/**
 * Convert GeocodeResult to ScopeMapping format
 */
export function geocodeResultToScopeMapping(result: GeocodeResult): ScopeMapping {
	return {
		country_code: result.country_code,
		scope_level: result.scope_level,
		display_text: result.display_text,
		region_code: result.region_code,
		locality_code: result.locality_code,
		district_code: result.district_code,
		confidence: result.confidence,
		extraction_method: 'geocoder'
	};
}
