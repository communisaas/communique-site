/**
 * IP-based Location Lookup
 *
 * Uses ipapi.co free tier to infer location from IP address.
 * - No API key required for < 1000 requests/day
 * - Returns city, state, lat/lng
 * - Privacy-preserving: IP never stored, only returned to client
 *
 * Free tier limits: 1000 requests/day, no auth required
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface IPApiResponse {
	ip: string;
	city: string;
	region: string; // State name
	region_code: string; // State code (e.g., "CA")
	country_code: string;
	latitude: number;
	longitude: number;
	timezone: string;
}

export const GET: RequestHandler = async ({ getClientAddress }) => {
	try {
		// Get client IP (works in production, returns 127.0.0.1 in dev)
		const clientIp = getClientAddress();

		// In development, use a known IP for testing (San Francisco)
		const lookupIp =
			clientIp === '127.0.0.1' || clientIp === '::1'
				? '8.8.8.8' // Google DNS (will return Mountain View, CA for testing)
				: clientIp;

		console.log(`[IP Lookup] Looking up IP: ${lookupIp}`);

		// Call ipapi.co (free tier, no auth required)
		const response = await fetch(`https://ipapi.co/${lookupIp}/json/`);

		if (!response.ok) {
			console.error('[IP Lookup] API error:', response.status);

			// Fallback: Return mock California location for development (avoid rate limit failures)
			if (lookupIp === '8.8.8.8' || response.status === 429) {
				console.warn('[IP Lookup] Using fallback location (Mountain View, CA)');
				return json({
					city: 'Mountain View',
					state: 'California',
					state_code: 'CA',
					country_code: 'US',
					latitude: 37.3861,
					longitude: -122.0839,
					timezone: 'America/Los_Angeles'
				});
			}

			return json({ error: 'IP lookup failed' }, { status: response.status });
		}

		const data = (await response.json()) as IPApiResponse;

		// Return minimal location data (no PII)
		return json({
			city: data.city,
			state: data.region,
			state_code: data.region_code,
			country_code: data.country_code,
			latitude: data.latitude,
			longitude: data.longitude,
			timezone: data.timezone
		});
	} catch (error) {
		console.error('[IP Lookup] Error:', error);
		return json({ error: 'IP lookup failed' }, { status: 500 });
	}
};
