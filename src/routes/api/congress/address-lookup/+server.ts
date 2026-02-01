/**
 * Congress Address Lookup API
 *
 * POST /api/congress/address-lookup - Address to representatives
 *
 * Request Body (one of):
 * - { address: string } - Full address string
 * - { street, city, state, zip } - Structured address
 * - { lat: number, lng: number } - Coordinates
 *
 * Response: { district: string, representatives: Member[] }
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rateLimiter } from '$lib/server/rate-limiter';
import { addressLookupService } from '$lib/core/congress/address-lookup';
import { getMemberByDistrict, getSenatorsByState, type Member } from '$lib/server/congress/votes';

export const POST: RequestHandler = async ({ request, locals, getClientAddress }) => {
	// Authentication recommended but not required for basic lookups
	// Authenticated users get higher rate limits
	const isAuthenticated = !!locals.user;

	// Rate limiting: 30 req/min for anonymous, 100 req/min for authenticated
	const clientIp = getClientAddress();
	const rateLimit = isAuthenticated ? 100 : 30;
	const rateLimitResult = await rateLimiter.limit(
		`congress-address:${clientIp}`,
		rateLimit,
		60 * 1000
	);

	if (!rateLimitResult.success) {
		return json(
			{
				error: 'Rate limit exceeded',
				retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
			},
			{
				status: 429,
				headers: {
					'Retry-After': String(Math.ceil((rateLimitResult.reset - Date.now()) / 1000))
				}
			}
		);
	}

	try {
		const body = await request.json();

		// Validate request body
		if (!body || typeof body !== 'object') {
			return json({ error: 'Invalid request body' }, { status: 400 });
		}

		let district: { state: string; district: string } | null = null;
		let representatives: Member[] = [];

		// Handle different input formats
		if ('lat' in body && 'lng' in body) {
			// Coordinates-based lookup
			const { lat, lng } = body;

			if (typeof lat !== 'number' || typeof lng !== 'number') {
				return json(
					{ error: 'Invalid coordinates. lat and lng must be numbers.' },
					{ status: 400 }
				);
			}

			// Validate coordinate ranges
			if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
				return json(
					{ error: 'Coordinates out of range. lat: -90 to 90, lng: -180 to 180.' },
					{ status: 400 }
				);
			}

			// Use Census Bureau reverse geocoding
			const censusResult = await reverseGeocodeCoordinates(lat, lng);

			if (!censusResult) {
				return json(
					{
						error: 'Could not determine congressional district from coordinates. ' +
							'Please provide a US address instead.'
					},
					{ status: 400 }
				);
			}

			district = censusResult.district;
		} else if ('address' in body) {
			// Full address string
			const { address } = body;

			if (typeof address !== 'string' || address.trim().length < 5) {
				return json(
					{ error: 'Invalid address. Please provide a complete US address.' },
					{ status: 400 }
				);
			}

			// Parse address string into components
			const parsed = parseAddressString(address);

			if (!parsed) {
				return json(
					{
						error: 'Could not parse address. Please provide in format: "Street, City, State ZIP"'
					},
					{ status: 400 }
				);
			}

			// Use addressLookupService for district lookup
			const result = await addressLookupService.lookupRepsByAddress(parsed);
			district = result.district;

			// Format representatives from result
			representatives = [result.house, ...result.senate];

			return json({
				district: `${district.state}-${district.district}`,
				representatives: representatives.map(formatRepresentative),
				special_status: result.special_status,
				meta: {
					inputType: 'address',
					normalized: parsed
				}
			});
		} else if ('street' in body && 'city' in body && 'state' in body && 'zip' in body) {
			// Structured address
			const { street, city, state, zip } = body;

			// Validate required fields
			if (!street || !city || !state || !zip) {
				return json(
					{ error: 'All address fields are required: street, city, state, zip' },
					{ status: 400 }
				);
			}

			// Validate ZIP format
			const zipRegex = /^\d{5}(-\d{4})?$/;
			if (!zipRegex.test(zip)) {
				return json({ error: 'Invalid ZIP code format' }, { status: 400 });
			}

			// Use addressLookupService
			const result = await addressLookupService.lookupRepsByAddress({
				street,
				city,
				state,
				zip
			});

			district = result.district;
			representatives = [result.house, ...result.senate];

			return json({
				district: `${district.state}-${district.district}`,
				representatives: representatives.map(formatRepresentative),
				special_status: result.special_status,
				meta: {
					inputType: 'structured',
					normalized: { street, city, state, zip }
				}
			});
		} else {
			return json(
				{
					error:
						'Invalid request. Provide one of: { address: string }, ' +
						'{ street, city, state, zip }, or { lat, lng }'
				},
				{ status: 400 }
			);
		}

		// For coordinate-based lookup, fetch representatives separately
		if (district && representatives.length === 0) {
			const districtNum = parseInt(district.district, 10) || 0;

			// Fetch House representative
			const houseRep = await getMemberByDistrict(district.state, districtNum);
			if (houseRep) {
				representatives.push(houseRep);
			}

			// Fetch Senators
			const senators = await getSenatorsByState(district.state);
			representatives.push(...senators);
		}

		return json({
			district: `${district!.state}-${district!.district}`,
			representatives: representatives.map(formatRepresentative),
			meta: {
				inputType: 'coordinates'
			}
		});
	} catch (error) {
		console.error('[Congress Address Lookup] Error:', error);

		const errorMessage = error instanceof Error ? error.message : 'Unknown error';

		if (errorMessage.includes('Rate limit')) {
			return json(
				{ error: 'External API rate limit exceeded. Please try again later.' },
				{ status: 503 }
			);
		}

		if (errorMessage.includes('not found') || errorMessage.includes('No match')) {
			return json(
				{
					error:
						'Address not found. Please verify the address is correct and within the United States.'
				},
				{ status: 400 }
			);
		}

		return json({ error: 'Failed to lookup address' }, { status: 500 });
	}
};

/**
 * Parse address string into components
 */
function parseAddressString(address: string): {
	street: string;
	city: string;
	state: string;
	zip: string;
} | null {
	// Try to parse common address formats
	// "123 Main St, City, ST 12345"
	const parts = address.split(',').map((p) => p.trim());

	if (parts.length < 2) {
		return null;
	}

	const street = parts[0];

	// Last part should contain state and ZIP
	const lastPart = parts[parts.length - 1];
	const stateZipMatch = lastPart.match(/([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?/i);

	if (!stateZipMatch) {
		return null;
	}

	const state = stateZipMatch[1].toUpperCase();
	const zip = stateZipMatch[2] || '';

	// City is the part before state/ZIP
	let city = '';
	if (parts.length >= 3) {
		city = parts[parts.length - 2];
	} else {
		// Try to extract city from the state/ZIP part
		const cityMatch = lastPart.match(/^(.+?)\s+[A-Z]{2}/i);
		if (cityMatch) {
			city = cityMatch[1].trim();
		}
	}

	if (!street || !city || !state) {
		return null;
	}

	return { street, city, state, zip };
}

/**
 * Reverse geocode coordinates using Census Bureau API
 */
async function reverseGeocodeCoordinates(
	lat: number,
	lng: number
): Promise<{ district: { state: string; district: string } } | null> {
	try {
		const url = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lng}&y=${lat}&benchmark=4&vintage=4&format=json`;

		const response = await fetch(url);

		if (!response.ok) {
			console.error(`Census geocoding error: ${response.status}`);
			return null;
		}

		const data = await response.json();
		const geographies = data.result?.geographies;

		if (!geographies) {
			return null;
		}

		// Extract congressional district
		const cd = geographies['119th Congressional Districts']?.[0];

		if (!cd) {
			return null;
		}

		// Extract state from GEOID (first 2 digits are state FIPS)
		const stateFips = cd.GEOID?.substring(0, 2);
		const districtNum = cd.CD119 || cd.GEOID?.substring(2);

		// Convert FIPS to state code
		const stateCode = fipsToState(stateFips);

		if (!stateCode || !districtNum) {
			return null;
		}

		return {
			district: {
				state: stateCode,
				district: districtNum.padStart(2, '0')
			}
		};
	} catch (error) {
		console.error('[Census Geocoding] Error:', error);
		return null;
	}
}

/**
 * Convert FIPS code to state abbreviation
 */
function fipsToState(fips: string): string | null {
	const fipsMap: Record<string, string> = {
		'01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA',
		'08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL',
		'13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN',
		'19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME',
		'24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS',
		'29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH',
		'34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
		'39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
		'45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT',
		'50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI',
		'56': 'WY', '60': 'AS', '66': 'GU', '69': 'MP', '72': 'PR',
		'78': 'VI'
	};

	return fipsMap[fips] || null;
}

/**
 * Format representative for API response
 */
function formatRepresentative(member: Member | { bioguide_id: string; name: string; party: string; state: string; district: string; chamber: string; office_code?: string; is_voting_member?: boolean; delegate_type?: string }) {
	// Handle both Member type and the address-lookup result type
	if ('bioguideId' in member) {
		return {
			bioguideId: member.bioguideId,
			name: member.name,
			party: member.party,
			state: member.state,
			district: member.district,
			chamber: member.chamber,
			website: member.website,
			photoUrl: member.photoUrl,
			phone: member.phone
		};
	}

	// Address lookup result format
	return {
		bioguideId: member.bioguide_id,
		name: member.name,
		party: member.party,
		state: member.state,
		district: member.district,
		chamber: member.chamber,
		isVotingMember: member.is_voting_member,
		delegateType: member.delegate_type
	};
}
