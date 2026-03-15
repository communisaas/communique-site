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
import { dev } from '$app/environment';
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
		// Dev mode: always return mock.
		// Miniflare's getPlatformProxy() provides platform.cf locally, but its
		// geolocation comes from Cloudflare's WHOIS/IP database — which resolves
		// to the ISP's registered address, not the user's physical location.
		// In production, CF edge does the lookup at the network layer (nearest PoP),
		// which is far more accurate. Skip the bad local data entirely.
		if (dev) {
			return json(getMockLocation());
		}

		// Priority 1: Cloudflare Native Geolocation (Zero-latency)
		// Only available when deployed to Cloudflare Pages/Workers
		interface CfProperties {
			city?: string;
			region?: string;
			regionCode?: string;
			country?: string;
			latitude?: string;
			longitude?: string;
			timezone?: string;
		}
		const cf = (platform as { cf?: CfProperties } | undefined)?.cf;
		if (cf) {
			return json({
				city: cf.city,
				state: cf.region,
				state_code: cf.regionCode,
				country_code: cf.country,
				timezone: cf.timezone,
				latitude: cf.latitude,
				longitude: cf.longitude
			});
		}

		// Priority 2: Standard Proxy Headers (for Docker/Self-hosted behind CF)
		const cfConnectingIp = request.headers.get('cf-connecting-ip');
		const cfIpCountry = request.headers.get('cf-ipcountry');

		if (cfConnectingIp && cfIpCountry) {
			return json({
				state: null,
				state_code: null,
				country_code: cfIpCountry,
				timezone: null
			});
		}

		// No geolocation provider available
		return json(getMockLocation());

	} catch (error) {
		console.error('[IP Lookup] Error:', error);
		return json(getMockLocation());
	}
};
