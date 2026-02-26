/**
 * Server-side Nominatim search proxy for location autocomplete.
 *
 * Replaces direct browser->Nominatim calls (geocoding-api.ts) with a server
 * proxy that enforces rate limiting, transforms results, and respects the
 * Nominatim usage policy (1 req/sec, valid User-Agent).
 *
 * No auth required -- this powers public template browsing.
 *
 * Usage Policy: https://operations.osmfoundation.org/policies/nominatim/
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStateCode } from '$lib/core/location/state-codes';

/** Structured location hierarchy returned to clients. */
interface LocationHierarchy {
	country: { code: string; name: string };
	state: { code: string; name: string; country_code: string } | null;
	city: { name: string; state_code: string | null; country_code: string; lat: number; lon: number } | null;
	display_name: string;
}

// ---------------------------------------------------------------------------
// Rate limiting (module-level singleton -- survives across requests)
// ---------------------------------------------------------------------------

let lastNominatimTime = 0;
const NOMINATIM_INTERVAL = 1100; // ms -- Nominatim policy: max 1 req/sec

/**
 * Wait until at least NOMINATIM_INTERVAL ms have elapsed since the last
 * Nominatim request. Queues callers rather than rejecting them.
 */
async function enforceRateLimit(): Promise<void> {
	const now = Date.now();
	const elapsed = now - lastNominatimTime;
	if (elapsed < NOMINATIM_INTERVAL) {
		await new Promise((resolve) => setTimeout(resolve, NOMINATIM_INTERVAL - elapsed));
	}
	lastNominatimTime = Date.now();
}

// ---------------------------------------------------------------------------
// Nominatim result type (raw JSON shape)
// ---------------------------------------------------------------------------

interface NominatimResult {
	display_name: string;
	lat: string;
	lon: string;
	address: {
		country?: string;
		country_code?: string;
		state?: string;
		city?: string;
		town?: string;
		county?: string;
		municipality?: string;
		village?: string;
	};
}

// ---------------------------------------------------------------------------
// Transform helpers
// ---------------------------------------------------------------------------

function transformResult(r: NominatimResult): LocationHierarchy {
	const countryCode = r.address.country_code?.toUpperCase() || '';
	const stateName = r.address.state;
	const cityName = r.address.city || r.address.town || r.address.municipality || r.address.village;

	return {
		country: {
			code: countryCode,
			name: r.address.country || ''
		},
		state: stateName
			? {
					code: getStateCode(stateName, countryCode) || stateName,
					name: stateName,
					country_code: countryCode
				}
			: null,
		city: cityName
			? {
					name: cityName,
					state_code: getStateCode(stateName, countryCode),
					country_code: countryCode,
					lat: parseFloat(r.lat),
					lon: parseFloat(r.lon)
				}
			: null,
		display_name: r.display_name
	};
}

function filterByScope(
	results: LocationHierarchy[],
	scope: 'country' | 'state' | 'city'
): LocationHierarchy[] {
	return results.filter((loc) => {
		if (scope === 'country' && !loc.country.code) return false;
		if (scope === 'state' && !loc.state) return false;
		if (scope === 'city' && !loc.city) return false;
		return true;
	});
}

// ---------------------------------------------------------------------------
// GET /api/location/search
// ---------------------------------------------------------------------------

export const GET: RequestHandler = async ({ url }) => {
	// -- Parse & validate query params ----------------------------------------

	const q = url.searchParams.get('q')?.trim() ?? '';
	const scope = (url.searchParams.get('scope') ?? 'city') as 'country' | 'state' | 'city';
	const country = url.searchParams.get('country') ?? undefined;
	const state = url.searchParams.get('state') ?? undefined;
	const rawLimit = parseInt(url.searchParams.get('limit') ?? '5', 10);

	if (!q || q.length < 2) {
		return json(
			{ error: 'Query parameter "q" is required and must be at least 2 characters' },
			{ status: 400 }
		);
	}

	if (!['country', 'state', 'city'].includes(scope)) {
		return json(
			{ error: 'Invalid scope. Must be one of: country, state, city' },
			{ status: 400 }
		);
	}

	const limit = Math.max(1, Math.min(rawLimit, 10));

	// -- Build Nominatim request -----------------------------------------------

	let searchQuery = q;
	if (scope === 'city' && state) {
		searchQuery = `${q}, ${state}`;
	}

	const params = new URLSearchParams({
		q: searchQuery,
		format: 'json',
		addressdetails: '1',
		limit: String(limit)
	});

	if (country) {
		params.set('countrycodes', country.toLowerCase());
	}

	// -- Rate limit & fetch ----------------------------------------------------

	await enforceRateLimit();

	let nominatimResults: NominatimResult[];

	try {
		const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
			headers: {
				'User-Agent': 'Communique/1.0 (https://communi.email)'
			},
			signal: AbortSignal.timeout(10_000)
		});

		if (!response.ok) {
			console.error('[location/search] Nominatim HTTP error:', response.status, response.statusText);
			// Graceful degradation: return empty array, not an error
			return json([], {
				headers: { 'Cache-Control': 'public, max-age=60' } // Short cache on failure
			});
		}

		nominatimResults = await response.json();
	} catch (error) {
		console.error(
			'[location/search] Nominatim fetch failed:',
			error instanceof Error ? error.message : error
		);
		// Graceful degradation
		return json([], {
			headers: { 'Cache-Control': 'public, max-age=60' }
		});
	}

	// -- Transform & filter ----------------------------------------------------

	const transformed = nominatimResults.map(transformResult);
	const filtered = filterByScope(transformed, scope);

	return json(filtered, {
		headers: {
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
