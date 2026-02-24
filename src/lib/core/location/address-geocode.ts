/**
 * Client-side address geocoding via Nominatim (OpenStreetMap)
 *
 * Converts a structured address to lat/lng coordinates entirely in the browser.
 * The address NEVER reaches our server — privacy-preserving by design.
 *
 * Rate limit: 1 req/sec (Nominatim public instance policy)
 * Usage Policy: https://operations.osmfoundation.org/policies/nominatim/
 */

// ============================================================================
// Types
// ============================================================================

export interface StructuredAddress {
	street: string;
	city: string;
	state: string;
	zip?: string;
	countryCode?: string; // ISO 3166-1, default 'US'
}

export interface GeocodeResult {
	lat: number;
	lng: number;
	formattedAddress: string;
	confidence: number; // 0-1, from Nominatim importance field
	countryCode: string;
	stateCode: string | null;
}

interface NominatimSearchResult {
	display_name: string;
	lat: string;
	lon: string;
	importance?: number;
	address: {
		country?: string;
		country_code?: string;
		state?: string;
		city?: string;
		town?: string;
		municipality?: string;
	};
}

import { getStateCode } from './state-codes';

// ============================================================================
// Rate Limiting
// ============================================================================

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1100; // 1.1 seconds to be safe

async function enforceRateLimit(): Promise<void> {
	const now = Date.now();
	const elapsed = now - lastRequestTime;

	if (elapsed < MIN_REQUEST_INTERVAL) {
		await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL - elapsed));
	}

	lastRequestTime = Date.now();
}

// ============================================================================
// Geocode Function
// ============================================================================

/**
 * Geocode a structured address using Nominatim (OpenStreetMap).
 *
 * Runs entirely in the browser — address never reaches our server.
 * Returns null on any error (network, parsing, no results).
 */
export async function geocodeAddress(address: StructuredAddress): Promise<GeocodeResult | null> {
	try {
		const params = new URLSearchParams({
			street: address.street,
			city: address.city,
			state: address.state,
			format: 'json',
			addressdetails: '1',
			limit: '1'
		});

		if (address.zip) {
			params.set('postalcode', address.zip);
		}

		if (address.countryCode) {
			params.set('countrycodes', address.countryCode.toLowerCase());
		}

		await enforceRateLimit();

		const response = await fetch(
			`https://nominatim.openstreetmap.org/search?${params}`,
			{
				headers: {
					'User-Agent': 'Communique/1.0 (https://communi.email)'
				}
			}
		);

		if (!response.ok) {
			console.error('[address-geocode] Nominatim error:', response.status, response.statusText);
			return null;
		}

		const results: NominatimSearchResult[] = await response.json();

		if (results.length === 0) {
			return null;
		}

		const result = results[0];
		const lat = parseFloat(result.lat);
		const lng = parseFloat(result.lon);

		if (isNaN(lat) || isNaN(lng)) {
			return null;
		}

		const countryCode = result.address.country_code?.toUpperCase() || address.countryCode?.toUpperCase() || 'US';
		const stateCode = getStateCode(result.address.state, countryCode);
		const confidence = typeof result.importance === 'number' ? Math.min(result.importance, 1) : 0.5;

		return {
			lat,
			lng,
			formattedAddress: result.display_name,
			confidence,
			countryCode,
			stateCode
		};
	} catch (error) {
		console.error('[address-geocode] Geocoding failed:', error);
		return null;
	}
}
