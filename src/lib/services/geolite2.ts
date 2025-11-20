/**
 * GeoLite2 IP Lookup Service
 *
 * Uses geolite2-redist package with bundled, auto-updating databases.
 * - No external API calls (privacy-preserving)
 * - No rate limits
 * - ~75-85% state-level accuracy
 * - Faster than HTTP-based services
 * - Auto-updates weekly (no manual download required)
 *
 * Package: geolite2-redist (bundles GeoLite2 databases)
 * Updates: Automatic background updates
 */

import maxmind, { type CityResponse } from 'maxmind';
import { open as openGeoLite2 } from 'geolite2-redist';

let lookup: maxmind.Reader<CityResponse> | null = null;

/**
 * Initialize GeoLite2 database from geolite2-redist package
 */
async function initGeoLite2(): Promise<maxmind.Reader<CityResponse>> {
	if (lookup) {
		return lookup;
	}

	// Open GeoLite2-City database with maxmind reader
	// geolite2-redist handles auto-updates and provides the .mmdb file path
	console.log('[GeoLite2] Opening database from geolite2-redist package...');

	const reader = await openGeoLite2('GeoLite2-City', (path) => {
		console.log('[GeoLite2] Loading database from:', path);
		return maxmind.open<CityResponse>(path);
	});

	lookup = reader;
	console.log('[GeoLite2] Database loaded successfully');

	return lookup;
}

export interface GeoLocation {
	city: string | null;
	state: string | null;
	state_code: string | null;
	country_code: string | null;
	latitude: number | null;
	longitude: number | null;
	timezone: string | null;
}

/**
 * Look up IP address location using GeoLite2
 */
export async function lookupIP(ip: string): Promise<GeoLocation | null> {
	try {
		const reader = await initGeoLite2();
		const result = reader.get(ip);

		if (!result) {
			console.warn('[GeoLite2] No location found for IP:', ip);
			return null;
		}

		// Extract location data
		const city = result.city?.names?.en || null;
		const state = result.subdivisions?.[0]?.names?.en || null;
		const stateCode = result.subdivisions?.[0]?.iso_code || null;
		const countryCode = result.country?.iso_code || null;
		const latitude = result.location?.latitude || null;
		const longitude = result.location?.longitude || null;
		const timezone = result.location?.time_zone || null;

		return {
			city,
			state,
			state_code: stateCode,
			country_code: countryCode,
			latitude,
			longitude,
			timezone
		};
	} catch (error) {
		console.error('[GeoLite2] Lookup error:', error);
		return null;
	}
}

/**
 * Get mock location for development/testing
 */
export function getMockLocation(): GeoLocation {
	return {
		city: 'San Francisco',
		state: 'California',
		state_code: 'CA',
		country_code: 'US',
		latitude: 37.7749,
		longitude: -122.4194,
		timezone: 'America/Los_Angeles'
	};
}
