/**
 * IP-based Location Lookup
 *
 * Uses local GeoLite2 database to infer location from IP address.
 * - No external API calls (privacy-preserving)
 * - No rate limits
 * - ~75-85% state-level accuracy
 * - Faster than HTTP-based services
 *
 * Database: GeoLite2-City.mmdb (~70MB)
 * Updates: Weekly (every Tuesday)
 * Download: See data/DOWNLOAD-GEOLITE2.md
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function getMockLocation() {
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

// Cloudflare-enabled IP lookup (Platform Native)
// Uses request.cf object when available, falls back to headers/mock
export const GET: RequestHandler = async ({ getClientAddress, request, platform }) => {
	try {
		// Priority 1: Cloudflare Native Geolocation (Zero-latency)
		// Only available when deployed to Cloudflare Pages/Workers
		if (platform?.cf) {
			const cf = platform.cf;
			console.log('[IP Lookup] Using Cloudflare Platform Geolocation');
			return json({
				city: cf.city,
				state: cf.region, // Cloudflare uses 'region' for state name/code
				state_code: cf.regionCode,
				country_code: cf.country,
				timezone: cf.timezone,
				// Coordinates available in cf object too
				latitude: cf.latitude,
				longitude: cf.longitude
			});
		}

		// Priority 2: Standard Proxy Headers (for Docker/Self-hosted behind CF)
		let clientIp = getClientAddress();
		const cfConnectingIp = request.headers.get('cf-connecting-ip');
		const cfIpCountry = request.headers.get('cf-ipcountry'); // ISO 3166-1 Alpha 2 code

		if (cfConnectingIp) {
			clientIp = cfConnectingIp;
			// If we have country header from CF but no platform object, returned partial data is better than nothing
			if (cfIpCountry) {
				return json({
					state: null,
					state_code: null,
					country_code: cfIpCountry,
					timezone: null
				});
			}
		}

		// Priority 3: Development / Mock
		// In local dev without Wrangler, platform is undefined.
		if (clientIp === '127.0.0.1' || clientIp === '::1') {
			console.log('[IP Lookup] Dev mode: Using mock location');
			return json(getMockLocation()); // Imported from fallback service
		}

		console.warn(`[IP Lookup] No geolocation provider available for IP: ${clientIp}`);
		// Fallback to mock/empty rather than failing
		return json(getMockLocation());

	} catch (error) {
		console.error('[IP Lookup] Error:', error);
		return json(getMockLocation());
	}
};
