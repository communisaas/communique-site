/**
 * Congressional District → Representative Lookup
 *
 * Integrates with existing congressional representative data to provide
 * district information for jurisdiction picker.
 */

import type { DistrictLookupResult } from './types';
import { db } from '$lib/core/db';

// State abbreviation → Full name mapping
const STATE_NAMES: Record<string, string> = {
	AL: 'Alabama',
	AK: 'Alaska',
	AZ: 'Arizona',
	AR: 'Arkansas',
	CA: 'California',
	CO: 'Colorado',
	CT: 'Connecticut',
	DE: 'Delaware',
	FL: 'Florida',
	GA: 'Georgia',
	HI: 'Hawaii',
	ID: 'Idaho',
	IL: 'Illinois',
	IN: 'Indiana',
	IA: 'Iowa',
	KS: 'Kansas',
	KY: 'Kentucky',
	LA: 'Louisiana',
	ME: 'Maine',
	MD: 'Maryland',
	MA: 'Massachusetts',
	MI: 'Michigan',
	MN: 'Minnesota',
	MS: 'Mississippi',
	MO: 'Missouri',
	MT: 'Montana',
	NE: 'Nebraska',
	NV: 'Nevada',
	NH: 'New Hampshire',
	NJ: 'New Jersey',
	NM: 'New Mexico',
	NY: 'New York',
	NC: 'North Carolina',
	ND: 'North Dakota',
	OH: 'Ohio',
	OK: 'Oklahoma',
	OR: 'Oregon',
	PA: 'Pennsylvania',
	RI: 'Rhode Island',
	SC: 'South Carolina',
	SD: 'South Dakota',
	TN: 'Tennessee',
	TX: 'Texas',
	UT: 'Utah',
	VT: 'Vermont',
	VA: 'Virginia',
	WA: 'Washington',
	WV: 'West Virginia',
	WI: 'Wisconsin',
	WY: 'Wyoming',
	DC: 'District of Columbia'
};

/**
 * Lookup representative for a congressional district
 *
 * @param district - Congressional district (e.g., "TX-18", "CA-12")
 * @returns District information with current representative
 */
export async function lookupCongressionalDistrict(
	district: string
): Promise<DistrictLookupResult | null> {
	// Parse district format: "TX-18" → state="TX", districtNumber="18"
	const match = district.match(/^([A-Z]{2})-(\d+)$/);
	if (!match) {
		console.warn('Invalid congressional district format:', district);
		return null;
	}

	const [, state, districtNumber] = match;
	const stateName = STATE_NAMES[state];

	if (!stateName) {
		console.warn('Unknown state abbreviation:', state);
		return null;
	}

	try {
		// Query representative table for current representative
		const representative = await db.representative.findFirst({
			where: {
				state,
				district: districtNumber,
				chamber: 'house',
				is_active: true
			}
		});

		const result: DistrictLookupResult = {
			district,
			state,
			stateName
		};

		if (representative) {
			result.representative = {
				name: representative.name,
				party: representative.party,
				bioguideId: representative.bioguide_id,
				office: representative.office_address || undefined,
				phone: representative.phone || undefined,
				email: representative.email || undefined
			};
		}

		return result;
	} catch (error) {
		console.error('District lookup error:', error);
		return {
			district,
			state,
			stateName
		};
	}
}

/**
 * Lookup all congressional districts for a state
 *
 * @param stateCode - Two-letter state abbreviation (e.g., "TX", "CA")
 * @returns Array of district information
 */
export async function lookupStateDistricts(stateCode: string): Promise<DistrictLookupResult[]> {
	const stateName = STATE_NAMES[stateCode];
	if (!stateName) {
		console.warn('Unknown state abbreviation:', stateCode);
		return [];
	}

	try {
		const representatives = await db.representative.findMany({
			where: {
				state: stateCode,
				chamber: 'house',
				is_active: true
			},
			orderBy: {
				district: 'asc'
			}
		});

		return representatives.map((rep) => ({
			district: `${stateCode}-${rep.district}`,
			state: stateCode,
			stateName,
			representative: {
				name: rep.name,
				party: rep.party,
				bioguideId: rep.bioguide_id,
				office: rep.office_address || undefined,
				phone: rep.phone || undefined,
				email: rep.email || undefined
			}
		}));
	} catch (error) {
		console.error('State districts lookup error:', error);
		return [];
	}
}

/**
 * Get list of all US states with congressional districts
 *
 * @returns Array of state codes and names
 */
export function getAllStates(): { code: string; name: string }[] {
	return Object.entries(STATE_NAMES).map(([code, name]) => ({
		code,
		name
	}));
}

/**
 * Normalize state input (handle full names or abbreviations)
 *
 * @param input - State name or abbreviation
 * @returns State code (e.g., "TX") or null if not found
 */
export function normalizeStateCode(input: string): string | null {
	const normalized = input.trim().toUpperCase();

	// Check if input is already a state code
	if (STATE_NAMES[normalized]) {
		return normalized;
	}

	// Check if input is a full state name
	const entry = Object.entries(STATE_NAMES).find(([, name]) => name.toUpperCase() === normalized);

	return entry ? entry[0] : null;
}
