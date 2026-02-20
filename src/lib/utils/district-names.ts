/**
 * Human-readable district name lookup.
 *
 * Maps state abbreviation + district number → "California's 12th District".
 * Used by SocialProofBanner to replace truncated hashes with meaningful names.
 */

const STATE_NAMES: Record<string, string> = {
	AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
	CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
	HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
	KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
	MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
	MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
	NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
	OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
	SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
	VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
	DC: 'District of Columbia', PR: 'Puerto Rico', GU: 'Guam', VI: 'Virgin Islands',
	AS: 'American Samoa', MP: 'Northern Mariana Islands'
};

const ORDINAL_SUFFIX: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' };

function ordinal(n: number): string {
	const tens = n % 100;
	if (tens >= 11 && tens <= 13) return `${n}th`;
	return `${n}${ORDINAL_SUFFIX[n % 10] || 'th'}`;
}

/**
 * Convert "CA-12" → "California's 12th District"
 * At-large districts (e.g., "WY-0" or "WY-AL") → "Wyoming At-Large"
 */
export function formatDistrictName(code: string): string {
	const parts = code.split('-');
	if (parts.length !== 2) return code;

	const [state, district] = parts;
	const stateName = STATE_NAMES[state.toUpperCase()];
	if (!stateName) return code;

	const districtNum = parseInt(district, 10);
	if (isNaN(districtNum) || districtNum === 0 || district.toUpperCase() === 'AL') {
		return `${stateName} At-Large`;
	}

	return `${stateName}'s ${ordinal(districtNum)} District`;
}

/**
 * Get just the state name from a state code.
 */
export function getStateName(stateCode: string): string {
	return STATE_NAMES[stateCode.toUpperCase()] || stateCode;
}

/**
 * Count unique states from an array of district codes (e.g., ["CA-12", "NY-7"]).
 */
export function countUniqueStates(districtCodes: string[]): number {
	const states = new Set(districtCodes.map((code) => code.split('-')[0]?.toUpperCase()));
	return states.size;
}
