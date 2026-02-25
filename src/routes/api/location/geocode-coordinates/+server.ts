/**
 * Server-side coordinate geocoding: lat/lng → congressional district + city.
 *
 * Combines:
 * 1. Nominatim reverse geocode (city/state/county name)
 * 2. Census Bureau coordinate geocode (congressional district, census block)
 *
 * Replaces the browser-side JSONP + direct-Nominatim approach that hit
 * CSP violations and SvelteKit fetch wrapper issues.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface CoordinateRequest {
	latitude: number;
	longitude: number;
}

interface NominatimResult {
	city: string | null;
	state: string | null;
	county: string | null;
}

interface CensusResult {
	congressionalDistrict: string | null;
	stateCode: string | null;
	countyFips: string | null;
	countyName: string | null;
	districtName: string | null;
	cellId: string | null;
	tract: string | null;
}

// Nominatim rate limiting (1 req/sec)
let lastNominatimTime = 0;
const NOMINATIM_INTERVAL = 1100;

async function reverseGeocodeNominatim(lat: number, lng: number): Promise<NominatimResult | null> {
	const now = Date.now();
	if (now - lastNominatimTime < NOMINATIM_INTERVAL) {
		await new Promise((r) => setTimeout(r, NOMINATIM_INTERVAL - (now - lastNominatimTime)));
	}
	lastNominatimTime = Date.now();

	try {
		const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
		const res = await fetch(url, {
			headers: { 'User-Agent': 'Communique/1.0 (https://communi.email)' }
		});

		if (!res.ok) return null;

		const data = await res.json();
		const address = data?.address;
		if (!address) return null;

		const city = address.city || address.town || address.village || address.hamlet || null;
		const stateISO = address['ISO3166-2-lvl4']; // e.g. "US-CA"
		const state = stateISO ? stateISO.split('-')[1] : null;
		const county = address.county || null;

		return { city, state, county };
	} catch (e) {
		console.error('[nominatim-reverse] Error:', e);
		return null;
	}
}

async function geocodeCensus(lat: number, lng: number): Promise<CensusResult | null> {
	try {
		const url = new URL('https://geocoding.geo.census.gov/geocoder/geographies/coordinates');
		url.searchParams.set('x', String(lng));
		url.searchParams.set('y', String(lat));
		url.searchParams.set('benchmark', '4');
		url.searchParams.set('vintage', '4');
		url.searchParams.set('format', 'json');

		const res = await fetch(url.toString());
		if (!res.ok) {
			console.error('[census-coords] HTTP error:', res.status);
			return null;
		}

		const data = await res.json();
		const geographies = data?.result?.geographies;
		if (!geographies) return null;

		// Congressional district
		const districts = geographies['119th Congressional Districts'];
		const district = districts?.[0];

		// County
		const counties = geographies['Counties'];
		const county = counties?.[0];

		// State
		const states = geographies['States'];
		const state = states?.[0];

		// Census block (for cell_id)
		const blocks = geographies['2020 Census Blocks'];
		const block = blocks?.[0];

		const stateCode = state?.STUSAB || null;
		const districtNumber = district?.GEOID?.slice(2) || null;
		const congressionalDistrict =
			stateCode && districtNumber ? `${stateCode}-${districtNumber}` : null;

		return {
			congressionalDistrict,
			stateCode,
			countyFips: county?.GEOID || null,
			countyName: county?.NAME || null,
			districtName: district?.NAME || null,
			cellId: block?.GEOID || null,
			tract: block?.TRACT || null
		};
	} catch (e) {
		console.error('[census-coords] Error:', e);
		return null;
	}
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { latitude, longitude } = (await request.json()) as CoordinateRequest;

		if (typeof latitude !== 'number' || typeof longitude !== 'number') {
			return json({ error: 'Missing latitude/longitude' }, { status: 400 });
		}

		// Run both in parallel
		const [nominatim, census] = await Promise.all([
			reverseGeocodeNominatim(latitude, longitude),
			geocodeCensus(latitude, longitude)
		]);

		return json({
			nominatim,
			census,
			latitude,
			longitude,
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		console.error('[geocode-coordinates] Error:', error);
		return json({ error: 'Geocoding failed' }, { status: 502 });
	}
};
