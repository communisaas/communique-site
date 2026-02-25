/**
 * Server-side Nominatim proxy for address geocoding.
 *
 * Proxies browser requests to Nominatim (OpenStreetMap) to avoid
 * CORS issues with SvelteKit's fetch wrapper in dev mode.
 * Rate limited to 1 req/sec per Nominatim usage policy.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

let lastRequestTime = 0;
const MIN_INTERVAL = 1100; // 1.1s — Nominatim policy

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { street, city, state, zip, countryCode } = await request.json();

		if (!street || !city || !state) {
			return json({ error: 'Missing required fields (street, city, state)' }, { status: 400 });
		}

		// Rate limit
		const now = Date.now();
		const elapsed = now - lastRequestTime;
		if (elapsed < MIN_INTERVAL) {
			await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL - elapsed));
		}
		lastRequestTime = Date.now();

		const params = new URLSearchParams({
			street,
			city,
			state,
			format: 'json',
			addressdetails: '1',
			limit: '1'
		});

		if (zip) params.set('postalcode', zip);
		if (countryCode) params.set('countrycodes', countryCode.toLowerCase());

		const response = await fetch(
			`https://nominatim.openstreetmap.org/search?${params}`,
			{
				headers: {
					'User-Agent': 'Communique/1.0 (https://communi.email)'
				}
			}
		);

		if (!response.ok) {
			return json(
				{ error: `Nominatim error: ${response.status}` },
				{ status: 502 }
			);
		}

		const results = await response.json();
		return json(results);
	} catch (error) {
		console.error('[nominatim-proxy] Error:', error);
		return json({ error: 'Geocoding service unavailable' }, { status: 502 });
	}
};
