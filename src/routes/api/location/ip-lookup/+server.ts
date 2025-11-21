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
import { lookupIP, getMockLocation } from '$lib/services/geolite2';

export const GET: RequestHandler = async ({ getClientAddress, request, url }) => {
	try {
		// Get client IP (works in production, returns 127.0.0.1 in dev)
		let clientIp = getClientAddress();

		// In development with localhost IP, try to get real external IP from headers
		if (clientIp === '127.0.0.1' || clientIp === '::1') {
			// Priority 1: Standard proxy headers (Cloudflare, nginx, etc.)
			const forwardedFor = request.headers.get('x-forwarded-for');
			const realIp = request.headers.get('x-real-ip');
			const cfConnectingIp = request.headers.get('cf-connecting-ip');

			if (cfConnectingIp) {
				clientIp = cfConnectingIp;
				console.log(`[IP Lookup] Using CF-Connecting-IP: ${clientIp}`);
			} else if (realIp) {
				clientIp = realIp;
				console.log(`[IP Lookup] Using X-Real-IP: ${clientIp}`);
			} else if (forwardedFor) {
				// X-Forwarded-For can be a comma-separated list, take the first IP
				clientIp = forwardedFor.split(',')[0].trim();
				console.log(`[IP Lookup] Using X-Forwarded-For: ${clientIp}`);
			}
			// Priority 2: Fallback to mock location (no external API calls)
			// No X-Dev-IP header or query params - those expose PII in logs/URLs
			else {
				console.log('[IP Lookup] Development mode: No proxy headers found, using mock location');
				const mockLocation = getMockLocation();
				return json(mockLocation);
			}
		}

		console.log(`[IP Lookup] Looking up IP: ${clientIp}`);

		// Look up IP in GeoLite2 database (local, no external API call)
		const location = await lookupIP(clientIp);

		if (!location || !location.state_code) {
			// No location found OR incomplete data (infrastructure IPs like 8.8.8.8 only have country-level data)
			if (!location) {
				console.warn('[IP Lookup] No location found for IP:', clientIp);
			} else {
				console.warn(
					'[IP Lookup] Incomplete location data for IP:',
					clientIp,
					'- missing state_code'
				);
			}

			// Fallback to mock location if database lookup fails or returns incomplete data
			console.log('[IP Lookup] Using mock location as fallback');
			const mockLocation = getMockLocation();
			return json(mockLocation);
		}

		// Return minimal location data (no PII)
		// IMPORTANT: Do NOT return city from IP lookup - IP geolocation is only accurate at state level
		// City from IP is based on ISP routing and is highly unreliable (often returns ISP headquarters)
		return json({
			// city: location.city, // REMOVED - IP cannot reliably determine city
			state: location.state,
			state_code: location.state_code,
			country_code: location.country_code,
			// latitude/longitude also unreliable from IP (ISP routing, VPN exit nodes)
			// latitude: location.latitude,
			// longitude: location.longitude,
			timezone: location.timezone
		});
	} catch (error) {
		console.error('[IP Lookup] Error:', error);

		// Return mock location for development (graceful degradation)
		console.log('[IP Lookup] Error occurred, using mock location as fallback');
		const mockLocation = getMockLocation();
		return json(mockLocation);
	}
};
