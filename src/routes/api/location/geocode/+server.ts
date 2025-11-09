/**
 * Census Bureau Geocoding API - Server-Side Proxy
 *
 * Why server-side:
 * - Census API doesn't support CORS for address endpoint
 * - Can add caching/rate limiting later
 * - Keeps API structure clean
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface GeocodeRequest {
	street: string;
	city: string;
	state: string;
	zipCode: string;
}

interface VerifiedAddress {
	street: string;
	city: string;
	state: string;
	zipCode: string;
	congressional_district: string;
	county_name?: string;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { street, city, state, zipCode } = (await request.json()) as GeocodeRequest;

		// Validate inputs
		if (!street || !city || !state || !zipCode) {
			return json({ error: 'Missing required fields' }, { status: 400 });
		}

		// Call Census Bureau Geocoding API
		const censusUrl = new URL('https://geocoding.geo.census.gov/geocoder/geographies/address');
		censusUrl.searchParams.set('street', street);
		censusUrl.searchParams.set('city', city);
		censusUrl.searchParams.set('state', state);
		censusUrl.searchParams.set('zip', zipCode);
		censusUrl.searchParams.set('benchmark', '4'); // Public_AR_Current
		censusUrl.searchParams.set('vintage', '4'); // Current vintage
		censusUrl.searchParams.set('format', 'json');

		const response = await fetch(censusUrl.toString());

		if (!response.ok) {
			console.error('[Census API] HTTP error:', response.status);
			return json({ error: 'Census API request failed' }, { status: 502 });
		}

		const data = await response.json();

		// Extract address match
		const match = data?.result?.addressMatches?.[0];
		if (!match) {
			console.warn('[Census API] No address match found for:', { street, city, state, zipCode });
			return json(
				{ error: 'Address not found. Please check your address and try again.' },
				{ status: 404 }
			);
		}

		// Extract congressional district
		const geographies = match.geographies;
		const districts = geographies?.['119th Congressional Districts'];
		const district = districts?.[0];

		if (!district) {
			console.warn('[Census API] No congressional district found');
			console.warn('[Census API] Available geographies:', Object.keys(geographies || {}));
			return json({ error: 'Could not determine congressional district' }, { status: 404 });
		}

		// Extract county
		const counties = geographies?.['Counties'];
		const county = counties?.[0];
		const countyName = county?.NAME || undefined;

		// Parse congressional district (GEOID format: "0611" = CA-11)
		console.log('[Census API] District data:', district);
		const stateFromGeoid = district.STATE; // State FIPS code
		const districtNumber = district.CD119 || district.CD || district.GEOID?.slice(2); // Try multiple field names

		if (!districtNumber) {
			console.error('[Census API] Could not extract district number from:', district);
			return json({ error: 'Could not determine district number' }, { status: 500 });
		}

		// Map FIPS to state code
		const stateFipsMap: Record<string, string> = {
			'01': 'AL',
			'02': 'AK',
			'04': 'AZ',
			'05': 'AR',
			'06': 'CA',
			'08': 'CO',
			'09': 'CT',
			'10': 'DE',
			'11': 'DC',
			'12': 'FL',
			'13': 'GA',
			'15': 'HI',
			'16': 'ID',
			'17': 'IL',
			'18': 'IN',
			'19': 'IA',
			'20': 'KS',
			'21': 'KY',
			'22': 'LA',
			'23': 'ME',
			'24': 'MD',
			'25': 'MA',
			'26': 'MI',
			'27': 'MN',
			'28': 'MS',
			'29': 'MO',
			'30': 'MT',
			'31': 'NE',
			'32': 'NV',
			'33': 'NH',
			'34': 'NJ',
			'35': 'NM',
			'36': 'NY',
			'37': 'NC',
			'38': 'ND',
			'39': 'OH',
			'40': 'OK',
			'41': 'OR',
			'42': 'PA',
			'44': 'RI',
			'45': 'SC',
			'46': 'SD',
			'47': 'TN',
			'48': 'TX',
			'49': 'UT',
			'50': 'VT',
			'51': 'VA',
			'53': 'WA',
			'54': 'WV',
			'55': 'WI',
			'56': 'WY'
		};

		const stateCode = stateFipsMap[stateFromGeoid];
		if (!stateCode) {
			console.error('[Census API] Unknown state FIPS:', stateFromGeoid);
			return json({ error: 'Invalid state code' }, { status: 500 });
		}

		// Format congressional district as "STATE-XX"
		const congressionalDistrict = `${stateCode}-${districtNumber.padStart(2, '0')}`;

		// Return verified address with congressional district
		const verified: VerifiedAddress = {
			street: match.matchedAddress?.split(',')[0] || street,
			city,
			state: stateCode,
			zipCode,
			congressional_district: congressionalDistrict,
			county_name: countyName
		};

		console.log('[Census API] ✓ Address verified:', verified);

		return json(verified);
	} catch (error) {
		console.error('[Census API] Error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
