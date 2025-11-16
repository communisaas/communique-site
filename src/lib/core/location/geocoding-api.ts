/**
 * Nominatim-based location autocomplete
 *
 * Free, open-source, worldwide coverage
 * Rate limit: 1 req/sec (public instance)
 *
 * Usage Policy: https://operations.osmfoundation.org/policies/nominatim/
 * - Valid User-Agent required
 * - Max 1 request per second
 * - No heavy usage without prior permission
 */

export interface LocationHierarchy {
	country: {
		code: string; // 'US', 'CA', 'GB' (can be empty string if unknown)
		name: string; // 'United States', 'Canada', 'United Kingdom'
	};
	state: {
		code: string; // 'CA', 'ON', 'QLD'
		name: string; // 'California', 'Ontario', 'Queensland'
		country_code: string; // Parent country
	} | null;
	city: {
		name: string; // 'San Francisco'
		state_code: string | null; // Parent state
		country_code: string; // Parent country
		lat: number;
		lon: number;
	} | null;
	display_name: string; // "San Francisco, California, United States"
}

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
	};
	boundingbox: [string, string, string, string];
}

/**
 * Map state names to ISO codes
 * (Nominatim returns full state names, we need abbreviations)
 */
const US_STATES: Record<string, string> = {
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

const CA_PROVINCES: Record<string, string> = {
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

const AU_STATES: Record<string, string> = {
	'New South Wales': 'NSW',
	Victoria: 'VIC',
	Queensland: 'QLD',
	'South Australia': 'SA',
	'Western Australia': 'WA',
	Tasmania: 'TAS',
	'Northern Territory': 'NT',
	'Australian Capital Territory': 'ACT'
};

function getStateCode(stateName: string | undefined, countryCode: string): string | null {
	if (!stateName) return null;

	const upperCountry = countryCode.toUpperCase();

	if (upperCountry === 'US') {
		return US_STATES[stateName] || null;
	} else if (upperCountry === 'CA') {
		return CA_PROVINCES[stateName] || null;
	} else if (upperCountry === 'AU') {
		return AU_STATES[stateName] || null;
	}

	return null; // No mapping available for this country
}

/**
 * Search locations using Nominatim API
 *
 * @param query - Search query (e.g., "San Francisco", "Texas", "Canada")
 * @param scope - Geographic scope to search ('country', 'state', 'city')
 * @param countryCode - Filter results to specific country (e.g., 'US')
 * @param stateCode - Filter results to specific state (e.g., 'CA')
 * @returns Array of location hierarchies matching the query
 */
export async function searchLocations(
	query: string,
	scope: 'country' | 'state' | 'city' = 'city',
	countryCode?: string,
	stateCode?: string
): Promise<LocationHierarchy[]> {
	if (!query || query.trim().length < 2) {
		return [];
	}

	const params = new URLSearchParams({
		q: query.trim(),
		format: 'json',
		addressdetails: '1',
		limit: '10'
	});

	// Scope filtering
	if (countryCode) {
		params.append('countrycodes', countryCode.toLowerCase());
	}

	if (scope === 'city' && stateCode) {
		// Add state to query for better city filtering
		params.set('q', `${query.trim()}, ${stateCode}`);
	}

	try {
		const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
			headers: {
				'User-Agent': 'Communique/1.0 (civic coordination platform)' // Required by Nominatim usage policy
			}
		});

		if (!response.ok) {
			console.error('[Nominatim] API error:', response.status, response.statusText);
			return [];
		}

		const results: NominatimResult[] = await response.json();

		return results
			.map((r) => {
				const countryCode = r.address.country_code?.toUpperCase() || '';
				const stateName = r.address.state;
				const cityName = r.address.city || r.address.town || r.address.municipality;

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
			})
			.filter((loc) => {
				// Filter based on scope
				if (scope === 'country' && !loc.country.code) return false;
				if (scope === 'state' && !loc.state) return false;
				if (scope === 'city' && !loc.city) return false;
				return true;
			});
	} catch (error) {
		console.error('[Nominatim] Search failed:', error);
		return [];
	}
}

/**
 * Search cities within a specific state/country
 *
 * @param query - City name query
 * @param stateCode - State code (e.g., 'CA')
 * @param countryCode - Country code (e.g., 'US')
 * @returns Array of matching cities
 */
export async function searchCities(
	query: string,
	stateCode: string,
	countryCode: string = 'US'
): Promise<LocationHierarchy[]> {
	return searchLocations(query, 'city', countryCode, stateCode);
}

/**
 * Search states within a specific country
 *
 * @param query - State name query
 * @param countryCode - Country code (e.g., 'US')
 * @returns Array of matching states
 */
export async function searchStates(
	query: string,
	countryCode: string = 'US'
): Promise<LocationHierarchy[]> {
	return searchLocations(query, 'state', countryCode);
}

/**
 * Search countries
 *
 * @param query - Country name query
 * @returns Array of matching countries
 */
export async function searchCountries(query: string): Promise<LocationHierarchy[]> {
	return searchLocations(query, 'country');
}
