/**
 * State/Province code maps for geocoding.
 *
 * Maps full state names (as returned by Nominatim) to ISO abbreviations.
 * Covers: US states + territories, Canadian provinces, Australian states.
 */

export const US_STATES: Record<string, string> = {
	Alabama: 'AL',
	Alaska: 'AK',
	Arizona: 'AZ',
	Arkansas: 'AR',
	California: 'CA',
	Colorado: 'CO',
	Connecticut: 'CT',
	Delaware: 'DE',
	'District of Columbia': 'DC',
	Florida: 'FL',
	Georgia: 'GA',
	Hawaii: 'HI',
	Idaho: 'ID',
	Illinois: 'IL',
	Indiana: 'IN',
	Iowa: 'IA',
	Kansas: 'KS',
	Kentucky: 'KY',
	Louisiana: 'LA',
	Maine: 'ME',
	Maryland: 'MD',
	Massachusetts: 'MA',
	Michigan: 'MI',
	Minnesota: 'MN',
	Mississippi: 'MS',
	Missouri: 'MO',
	Montana: 'MT',
	Nebraska: 'NE',
	Nevada: 'NV',
	'New Hampshire': 'NH',
	'New Jersey': 'NJ',
	'New Mexico': 'NM',
	'New York': 'NY',
	'North Carolina': 'NC',
	'North Dakota': 'ND',
	Ohio: 'OH',
	Oklahoma: 'OK',
	Oregon: 'OR',
	Pennsylvania: 'PA',
	'Rhode Island': 'RI',
	'South Carolina': 'SC',
	'South Dakota': 'SD',
	Tennessee: 'TN',
	Texas: 'TX',
	Utah: 'UT',
	Vermont: 'VT',
	Virginia: 'VA',
	Washington: 'WA',
	'West Virginia': 'WV',
	Wisconsin: 'WI',
	Wyoming: 'WY',
	'Puerto Rico': 'PR',
	Guam: 'GU',
	'U.S. Virgin Islands': 'VI',
	'American Samoa': 'AS',
	'Northern Mariana Islands': 'MP'
};

export const CA_PROVINCES: Record<string, string> = {
	Alberta: 'AB',
	'British Columbia': 'BC',
	Manitoba: 'MB',
	'New Brunswick': 'NB',
	'Newfoundland and Labrador': 'NL',
	'Northwest Territories': 'NT',
	'Nova Scotia': 'NS',
	Nunavut: 'NU',
	Ontario: 'ON',
	'Prince Edward Island': 'PE',
	Quebec: 'QC',
	Saskatchewan: 'SK',
	Yukon: 'YT'
};

export const AU_STATES: Record<string, string> = {
	'New South Wales': 'NSW',
	Victoria: 'VIC',
	Queensland: 'QLD',
	'South Australia': 'SA',
	'Western Australia': 'WA',
	Tasmania: 'TAS',
	'Northern Territory': 'NT',
	'Australian Capital Territory': 'ACT'
};

/**
 * Get the ISO state/province code from a full state name.
 * Supports US, CA, AU countries.
 */
export function getStateCode(stateName: string | undefined, countryCode: string): string | null {
	if (!stateName) return null;
	const upperCountry = countryCode.toUpperCase();
	if (upperCountry === 'US') return US_STATES[stateName] || null;
	if (upperCountry === 'CA') return CA_PROVINCES[stateName] || null;
	if (upperCountry === 'AU') return AU_STATES[stateName] || null;
	return null;
}

// ---------------------------------------------------------------------------
// Reverse maps: code → full name (built once, cached)
// ---------------------------------------------------------------------------

function buildReverseMap(map: Record<string, string>): Record<string, string> {
	const reverse: Record<string, string> = {};
	for (const [name, code] of Object.entries(map)) {
		reverse[code] = name;
	}
	return reverse;
}

const US_STATE_NAMES = buildReverseMap(US_STATES);
const CA_PROVINCE_NAMES = buildReverseMap(CA_PROVINCES);
const AU_STATE_NAMES = buildReverseMap(AU_STATES);

// Manual overrides where the reverse map yields awkward display names
US_STATE_NAMES['DC'] = 'Washington DC';
US_STATE_NAMES['VI'] = 'US Virgin Islands';

/**
 * Get the full state/province name from a short code.
 * Searches US → CA → AU. Returns the code itself as fallback.
 */
export function getStateName(stateCode: string): string {
	return (
		US_STATE_NAMES[stateCode] ||
		CA_PROVINCE_NAMES[stateCode] ||
		AU_STATE_NAMES[stateCode] ||
		stateCode
	);
}
