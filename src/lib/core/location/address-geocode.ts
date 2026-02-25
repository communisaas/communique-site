/**
 * Address geocoding via Nominatim (OpenStreetMap)
 *
 * Proxied through our server to avoid CORS/fetch wrapper issues.
 * Rate limiting enforced server-side per Nominatim usage policy.
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
// Geocode Function
// ============================================================================

/**
 * Geocode a structured address using Nominatim (OpenStreetMap).
 *
 * Proxied through /api/location/nominatim to avoid CORS/fetch issues.
 * Returns null on any error (network, parsing, no results).
 */
export async function geocodeAddress(address: StructuredAddress): Promise<GeocodeResult | null> {
	try {
		const response = await fetch('/api/location/nominatim', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				street: address.street,
				city: address.city,
				state: address.state,
				zip: address.zip,
				countryCode: address.countryCode
			})
		});

		if (!response.ok) {
			console.error('[address-geocode] Geocode proxy error:', response.status);
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
