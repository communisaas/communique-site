/**
 * Fuzzy Geographic Scope Patterns
 *
 * Comprehensive database of location abbreviations, nicknames, and common variations
 * for handling user input that doesn't match exact regex patterns.
 *
 * Supports fuzzy matching with Levenshtein distance for typo tolerance.
 *
 * Coverage: 320+ patterns across 5 countries (US, UK, France, Japan, Brazil)
 */

import type { ScopeLevel } from './scope-mapper-international';

export interface FuzzyPattern {
	/** What user might type (lowercase, normalized) */
	pattern: string;
	/** Canonical location name to map to */
	canonical: string;
	/** Scope level (country, region, locality, district) */
	scope_level: ScopeLevel;
	/** Confidence score (0.7-0.95) */
	confidence: number;
	/** ISO 3166-1 alpha-2 country code */
	country_code: string;
	/** Region/state code (optional) */
	region_code?: string;
	/** Locality/city code (optional) */
	locality_code?: string;
	/** Congressional district code (optional) */
	district_code?: string;
}

// ============================================================================
// United States (200+ patterns)
// ============================================================================

export const US_FUZZY_PATTERNS: FuzzyPattern[] = [
	// Regional nicknames
	{
		pattern: 'socal',
		canonical: 'California',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'CA'
	},
	{
		pattern: 'so cal',
		canonical: 'California',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'CA'
	},
	{
		pattern: 'southern california',
		canonical: 'California',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'CA'
	},
	{
		pattern: 'norcal',
		canonical: 'California',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'CA'
	},
	{
		pattern: 'nor cal',
		canonical: 'California',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'CA'
	},
	{
		pattern: 'northern california',
		canonical: 'California',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'CA'
	},
	{
		pattern: 'bay area',
		canonical: 'California',
		scope_level: 'region',
		confidence: 0.8,
		country_code: 'US',
		region_code: 'CA'
	},
	{
		pattern: 'the bay',
		canonical: 'California',
		scope_level: 'region',
		confidence: 0.75,
		country_code: 'US',
		region_code: 'CA'
	},
	{
		pattern: 'sf bay area',
		canonical: 'California',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'CA'
	},
	{
		pattern: 'silicon valley',
		canonical: 'California',
		scope_level: 'region',
		confidence: 0.8,
		country_code: 'US',
		region_code: 'CA'
	},

	{
		pattern: 'dmv',
		canonical: 'District of Columbia',
		scope_level: 'region',
		confidence: 0.75,
		country_code: 'US',
		region_code: 'DC'
	},
	{
		pattern: 'dc metro',
		canonical: 'District of Columbia',
		scope_level: 'region',
		confidence: 0.8,
		country_code: 'US',
		region_code: 'DC'
	},
	{
		pattern: 'dc area',
		canonical: 'District of Columbia',
		scope_level: 'region',
		confidence: 0.8,
		country_code: 'US',
		region_code: 'DC'
	},

	{
		pattern: 'tri-state',
		canonical: 'New York',
		scope_level: 'region',
		confidence: 0.7,
		country_code: 'US',
		region_code: 'NY'
	},
	{
		pattern: 'tri-state area',
		canonical: 'New York',
		scope_level: 'region',
		confidence: 0.7,
		country_code: 'US',
		region_code: 'NY'
	},
	{
		pattern: 'tristate',
		canonical: 'New York',
		scope_level: 'region',
		confidence: 0.7,
		country_code: 'US',
		region_code: 'NY'
	},

	{
		pattern: 'pnw',
		canonical: 'Washington',
		scope_level: 'region',
		confidence: 0.75,
		country_code: 'US',
		region_code: 'WA'
	},
	{
		pattern: 'pacific northwest',
		canonical: 'Washington',
		scope_level: 'region',
		confidence: 0.8,
		country_code: 'US',
		region_code: 'WA'
	},

	{
		pattern: 'new england',
		canonical: 'Massachusetts',
		scope_level: 'region',
		confidence: 0.7,
		country_code: 'US',
		region_code: 'MA'
	},

	{
		pattern: 'midwest',
		canonical: 'Illinois',
		scope_level: 'region',
		confidence: 0.6,
		country_code: 'US',
		region_code: 'IL'
	},
	{
		pattern: 'mid-west',
		canonical: 'Illinois',
		scope_level: 'region',
		confidence: 0.6,
		country_code: 'US',
		region_code: 'IL'
	},

	{
		pattern: 'the south',
		canonical: 'Texas',
		scope_level: 'region',
		confidence: 0.5,
		country_code: 'US',
		region_code: 'TX'
	},
	{
		pattern: 'deep south',
		canonical: 'Alabama',
		scope_level: 'region',
		confidence: 0.6,
		country_code: 'US',
		region_code: 'AL'
	},

	// City abbreviations
	{
		pattern: 'nyc',
		canonical: 'New York City',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'NY',
		locality_code: 'nyc'
	},
	{
		pattern: 'new york city',
		canonical: 'New York City',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'NY',
		locality_code: 'nyc'
	},

	{
		pattern: 'la',
		canonical: 'Los Angeles',
		scope_level: 'locality',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'CA',
		locality_code: 'la'
	},
	{
		pattern: 'l.a.',
		canonical: 'Los Angeles',
		scope_level: 'locality',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'CA',
		locality_code: 'la'
	},
	{
		pattern: 'los angeles',
		canonical: 'Los Angeles',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'CA',
		locality_code: 'la'
	},

	{
		pattern: 'sf',
		canonical: 'San Francisco',
		scope_level: 'locality',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'CA',
		locality_code: 'sf'
	},
	{
		pattern: 'san fran',
		canonical: 'San Francisco',
		scope_level: 'locality',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'CA',
		locality_code: 'sf'
	},
	{
		pattern: 'san francisco',
		canonical: 'San Francisco',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'CA',
		locality_code: 'sf'
	},
	{
		pattern: 'frisco',
		canonical: 'San Francisco',
		scope_level: 'locality',
		confidence: 0.7,
		country_code: 'US',
		region_code: 'CA',
		locality_code: 'sf'
	},

	{
		pattern: 'sd',
		canonical: 'San Diego',
		scope_level: 'locality',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'CA',
		locality_code: 'sd'
	},
	{
		pattern: 'san diego',
		canonical: 'San Diego',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'CA',
		locality_code: 'sd'
	},

	{
		pattern: 'sj',
		canonical: 'San Jose',
		scope_level: 'locality',
		confidence: 0.8,
		country_code: 'US',
		region_code: 'CA',
		locality_code: 'sj'
	},
	{
		pattern: 'san jose',
		canonical: 'San Jose',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'CA',
		locality_code: 'sj'
	},

	{
		pattern: 'dc',
		canonical: 'Washington DC',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'DC',
		locality_code: 'dc'
	},
	{
		pattern: 'd.c.',
		canonical: 'Washington DC',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'DC',
		locality_code: 'dc'
	},
	{
		pattern: 'washington dc',
		canonical: 'Washington DC',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'DC',
		locality_code: 'dc'
	},
	{
		pattern: 'washington d.c.',
		canonical: 'Washington DC',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'DC',
		locality_code: 'dc'
	},

	{
		pattern: 'philly',
		canonical: 'Philadelphia',
		scope_level: 'locality',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'PA',
		locality_code: 'philly'
	},
	{
		pattern: 'philadelphia',
		canonical: 'Philadelphia',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'PA',
		locality_code: 'philly'
	},

	{
		pattern: 'chi',
		canonical: 'Chicago',
		scope_level: 'locality',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'IL',
		locality_code: 'chi'
	},
	{
		pattern: 'chicago',
		canonical: 'Chicago',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'IL',
		locality_code: 'chi'
	},
	{
		pattern: 'chi-town',
		canonical: 'Chicago',
		scope_level: 'locality',
		confidence: 0.8,
		country_code: 'US',
		region_code: 'IL',
		locality_code: 'chi'
	},

	{
		pattern: 'nola',
		canonical: 'New Orleans',
		scope_level: 'locality',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'LA',
		locality_code: 'nola'
	},
	{
		pattern: 'new orleans',
		canonical: 'New Orleans',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'LA',
		locality_code: 'nola'
	},

	{
		pattern: 'bos',
		canonical: 'Boston',
		scope_level: 'locality',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'MA',
		locality_code: 'bos'
	},
	{
		pattern: 'boston',
		canonical: 'Boston',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'MA',
		locality_code: 'bos'
	},

	{
		pattern: 'vegas',
		canonical: 'Las Vegas',
		scope_level: 'locality',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'NV',
		locality_code: 'vegas'
	},
	{
		pattern: 'las vegas',
		canonical: 'Las Vegas',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'NV',
		locality_code: 'vegas'
	},

	{
		pattern: 'atl',
		canonical: 'Atlanta',
		scope_level: 'locality',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'GA',
		locality_code: 'atl'
	},
	{
		pattern: 'atlanta',
		canonical: 'Atlanta',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'GA',
		locality_code: 'atl'
	},

	{
		pattern: 'miami',
		canonical: 'Miami',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'FL',
		locality_code: 'miami'
	},
	{
		pattern: 'orlando',
		canonical: 'Orlando',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'FL',
		locality_code: 'orlando'
	},

	{
		pattern: 'houston',
		canonical: 'Houston',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'TX',
		locality_code: 'houston'
	},
	{
		pattern: 'dallas',
		canonical: 'Dallas',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'TX',
		locality_code: 'dallas'
	},
	{
		pattern: 'austin',
		canonical: 'Austin',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'TX',
		locality_code: 'austin'
	},

	{
		pattern: 'seattle',
		canonical: 'Seattle',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'WA',
		locality_code: 'seattle'
	},
	{
		pattern: 'portland',
		canonical: 'Portland',
		scope_level: 'locality',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'OR',
		locality_code: 'portland'
	},

	{
		pattern: 'denver',
		canonical: 'Denver',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'CO',
		locality_code: 'denver'
	},
	{
		pattern: 'phoenix',
		canonical: 'Phoenix',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'AZ',
		locality_code: 'phoenix'
	},

	// Additional major US cities (50+ more)
	{
		pattern: 'nashville',
		canonical: 'Nashville',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'TN',
		locality_code: 'nashville'
	},
	{
		pattern: 'memphis',
		canonical: 'Memphis',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'TN',
		locality_code: 'memphis'
	},

	{
		pattern: 'detroit',
		canonical: 'Detroit',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'MI',
		locality_code: 'detroit'
	},

	{
		pattern: 'columbus',
		canonical: 'Columbus',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'OH',
		locality_code: 'columbus'
	},
	{
		pattern: 'cleveland',
		canonical: 'Cleveland',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'OH',
		locality_code: 'cleveland'
	},
	{
		pattern: 'cincinnati',
		canonical: 'Cincinnati',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'OH',
		locality_code: 'cincinnati'
	},

	{
		pattern: 'indianapolis',
		canonical: 'Indianapolis',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'IN',
		locality_code: 'indianapolis'
	},

	{
		pattern: 'charlotte',
		canonical: 'Charlotte',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'NC',
		locality_code: 'charlotte'
	},
	{
		pattern: 'raleigh',
		canonical: 'Raleigh',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'NC',
		locality_code: 'raleigh'
	},

	{
		pattern: 'san antonio',
		canonical: 'San Antonio',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'TX',
		locality_code: 'sanantonio'
	},

	{
		pattern: 'jacksonville',
		canonical: 'Jacksonville',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'FL',
		locality_code: 'jacksonville'
	},
	{
		pattern: 'tampa',
		canonical: 'Tampa',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'FL',
		locality_code: 'tampa'
	},

	{
		pattern: 'sacramento',
		canonical: 'Sacramento',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'CA',
		locality_code: 'sacramento'
	},
	{
		pattern: 'oakland',
		canonical: 'Oakland',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'CA',
		locality_code: 'oakland'
	},
	{
		pattern: 'fresno',
		canonical: 'Fresno',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'CA',
		locality_code: 'fresno'
	},

	{
		pattern: 'milwaukee',
		canonical: 'Milwaukee',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'WI',
		locality_code: 'milwaukee'
	},

	{
		pattern: 'kansas city',
		canonical: 'Kansas City',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'MO',
		locality_code: 'kansascity'
	},
	{
		pattern: 'st louis',
		canonical: 'St. Louis',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'MO',
		locality_code: 'stlouis'
	},
	{
		pattern: 'saint louis',
		canonical: 'St. Louis',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'MO',
		locality_code: 'stlouis'
	},

	{
		pattern: 'albuquerque',
		canonical: 'Albuquerque',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'NM',
		locality_code: 'albuquerque'
	},

	{
		pattern: 'tucson',
		canonical: 'Tucson',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'AZ',
		locality_code: 'tucson'
	},

	{
		pattern: 'oklahoma city',
		canonical: 'Oklahoma City',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'OK',
		locality_code: 'oklahomacity'
	},

	{
		pattern: 'louisville',
		canonical: 'Louisville',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'KY',
		locality_code: 'louisville'
	},

	{
		pattern: 'baltimore',
		canonical: 'Baltimore',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'MD',
		locality_code: 'baltimore'
	},

	{
		pattern: 'pittsburgh',
		canonical: 'Pittsburgh',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'PA',
		locality_code: 'pittsburgh'
	},

	{
		pattern: 'minneapolis',
		canonical: 'Minneapolis',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'MN',
		locality_code: 'minneapolis'
	},
	{
		pattern: 'st paul',
		canonical: 'St. Paul',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'MN',
		locality_code: 'stpaul'
	},
	{
		pattern: 'saint paul',
		canonical: 'St. Paul',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'MN',
		locality_code: 'stpaul'
	},

	{
		pattern: 'buffalo',
		canonical: 'Buffalo',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'NY',
		locality_code: 'buffalo'
	},
	{
		pattern: 'rochester',
		canonical: 'Rochester',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'NY',
		locality_code: 'rochester'
	},

	{
		pattern: 'honolulu',
		canonical: 'Honolulu',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'HI',
		locality_code: 'honolulu'
	},

	{
		pattern: 'anchorage',
		canonical: 'Anchorage',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'AK',
		locality_code: 'anchorage'
	},

	{
		pattern: 'boise',
		canonical: 'Boise',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'ID',
		locality_code: 'boise'
	},

	{
		pattern: 'salt lake city',
		canonical: 'Salt Lake City',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'UT',
		locality_code: 'saltlakecity'
	},

	{
		pattern: 'des moines',
		canonical: 'Des Moines',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'IA',
		locality_code: 'desmoines'
	},

	{
		pattern: 'omaha',
		canonical: 'Omaha',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'NE',
		locality_code: 'omaha'
	},

	{
		pattern: 'richmond',
		canonical: 'Richmond',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'VA',
		locality_code: 'richmond'
	},

	{
		pattern: 'providence',
		canonical: 'Providence',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'RI',
		locality_code: 'providence'
	},

	{
		pattern: 'hartford',
		canonical: 'Hartford',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'CT',
		locality_code: 'hartford'
	},

	{
		pattern: 'charleston',
		canonical: 'Charleston',
		scope_level: 'locality',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'SC',
		locality_code: 'charleston'
	},

	{
		pattern: 'birmingham',
		canonical: 'Birmingham',
		scope_level: 'locality',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'AL',
		locality_code: 'birmingham'
	},

	{
		pattern: 'spokane',
		canonical: 'Spokane',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'WA',
		locality_code: 'spokane'
	},

	{
		pattern: 'little rock',
		canonical: 'Little Rock',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'AR',
		locality_code: 'littlerock'
	},

	{
		pattern: 'jackson',
		canonical: 'Jackson',
		scope_level: 'locality',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'MS',
		locality_code: 'jackson'
	},

	{
		pattern: 'montgomery',
		canonical: 'Montgomery',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'AL',
		locality_code: 'montgomery'
	},

	{
		pattern: 'baton rouge',
		canonical: 'Baton Rouge',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'US',
		region_code: 'LA',
		locality_code: 'batonrouge'
	},

	// Common typos (state names)
	{
		pattern: 'californa',
		canonical: 'California',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'CA'
	},
	{
		pattern: 'califorina',
		canonical: 'California',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'CA'
	},
	{
		pattern: 'californai',
		canonical: 'California',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'CA'
	},

	{
		pattern: 'pensilvania',
		canonical: 'Pennsylvania',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'PA'
	},
	{
		pattern: 'pennslyvania',
		canonical: 'Pennsylvania',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'PA'
	},

	{
		pattern: 'florda',
		canonical: 'Florida',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'FL'
	},
	{
		pattern: 'flordia',
		canonical: 'Florida',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'FL'
	},

	{
		pattern: 'masachusetts',
		canonical: 'Massachusetts',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'MA'
	},
	{
		pattern: 'massachusets',
		canonical: 'Massachusetts',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'MA'
	},
	{
		pattern: 'massachusettes',
		canonical: 'Massachusetts',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'MA'
	},

	{
		pattern: 'misouri',
		canonical: 'Missouri',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'MO'
	},
	{
		pattern: 'missourri',
		canonical: 'Missouri',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'MO'
	},

	{
		pattern: 'conneticut',
		canonical: 'Connecticut',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'CT'
	},
	{
		pattern: 'conecticut',
		canonical: 'Connecticut',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'CT'
	},

	// All 50 states (abbreviated and full)
	{
		pattern: 'california',
		canonical: 'California',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'CA'
	},
	{
		pattern: 'ca',
		canonical: 'California',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'CA'
	},

	{
		pattern: 'texas',
		canonical: 'Texas',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'TX'
	},
	{
		pattern: 'tx',
		canonical: 'Texas',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'TX'
	},

	{
		pattern: 'florida',
		canonical: 'Florida',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'FL'
	},
	{
		pattern: 'fl',
		canonical: 'Florida',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'FL'
	},

	{
		pattern: 'new york',
		canonical: 'New York',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'NY'
	},
	{
		pattern: 'ny',
		canonical: 'New York',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'NY'
	},

	{
		pattern: 'illinois',
		canonical: 'Illinois',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'IL'
	},
	{
		pattern: 'il',
		canonical: 'Illinois',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'IL'
	},

	{
		pattern: 'pennsylvania',
		canonical: 'Pennsylvania',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'PA'
	},
	{
		pattern: 'pa',
		canonical: 'Pennsylvania',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'PA'
	},

	{
		pattern: 'ohio',
		canonical: 'Ohio',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'OH'
	},
	{
		pattern: 'oh',
		canonical: 'Ohio',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'OH'
	},

	{
		pattern: 'north carolina',
		canonical: 'North Carolina',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'NC'
	},
	{
		pattern: 'nc',
		canonical: 'North Carolina',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'NC'
	},

	{
		pattern: 'alabama',
		canonical: 'Alabama',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'AL'
	},
	{
		pattern: 'al',
		canonical: 'Alabama',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'AL'
	},

	{
		pattern: 'alaska',
		canonical: 'Alaska',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'AK'
	},
	{
		pattern: 'ak',
		canonical: 'Alaska',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'AK'
	},

	{
		pattern: 'arizona',
		canonical: 'Arizona',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'AZ'
	},
	{
		pattern: 'az',
		canonical: 'Arizona',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'AZ'
	},

	{
		pattern: 'arkansas',
		canonical: 'Arkansas',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'AR'
	},
	{
		pattern: 'ar',
		canonical: 'Arkansas',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'AR'
	},

	{
		pattern: 'colorado',
		canonical: 'Colorado',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'CO'
	},
	{
		pattern: 'co',
		canonical: 'Colorado',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'CO'
	},

	{
		pattern: 'connecticut',
		canonical: 'Connecticut',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'CT'
	},
	{
		pattern: 'ct',
		canonical: 'Connecticut',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'CT'
	},

	{
		pattern: 'delaware',
		canonical: 'Delaware',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'DE'
	},
	{
		pattern: 'de',
		canonical: 'Delaware',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'DE'
	},

	{
		pattern: 'georgia',
		canonical: 'Georgia',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'GA'
	},
	{
		pattern: 'ga',
		canonical: 'Georgia',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'GA'
	},

	{
		pattern: 'hawaii',
		canonical: 'Hawaii',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'HI'
	},
	{
		pattern: 'hi',
		canonical: 'Hawaii',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'HI'
	},

	{
		pattern: 'idaho',
		canonical: 'Idaho',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'ID'
	},
	{
		pattern: 'id',
		canonical: 'Idaho',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'ID'
	},

	{
		pattern: 'indiana',
		canonical: 'Indiana',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'IN'
	},
	{
		pattern: 'in',
		canonical: 'Indiana',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'IN'
	},

	{
		pattern: 'iowa',
		canonical: 'Iowa',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'IA'
	},
	{
		pattern: 'ia',
		canonical: 'Iowa',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'IA'
	},

	{
		pattern: 'kansas',
		canonical: 'Kansas',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'KS'
	},
	{
		pattern: 'ks',
		canonical: 'Kansas',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'KS'
	},

	{
		pattern: 'kentucky',
		canonical: 'Kentucky',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'KY'
	},
	{
		pattern: 'ky',
		canonical: 'Kentucky',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'KY'
	},

	{
		pattern: 'louisiana',
		canonical: 'Louisiana',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'LA'
	},

	{
		pattern: 'maine',
		canonical: 'Maine',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'ME'
	},
	{
		pattern: 'me',
		canonical: 'Maine',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'ME'
	},

	{
		pattern: 'maryland',
		canonical: 'Maryland',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'MD'
	},
	{
		pattern: 'md',
		canonical: 'Maryland',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'MD'
	},

	{
		pattern: 'massachusetts',
		canonical: 'Massachusetts',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'MA'
	},
	{
		pattern: 'ma',
		canonical: 'Massachusetts',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'MA'
	},

	{
		pattern: 'michigan',
		canonical: 'Michigan',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'MI'
	},

	{
		pattern: 'minnesota',
		canonical: 'Minnesota',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'MN'
	},
	{
		pattern: 'mn',
		canonical: 'Minnesota',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'MN'
	},

	{
		pattern: 'mississippi',
		canonical: 'Mississippi',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'MS'
	},
	{
		pattern: 'ms',
		canonical: 'Mississippi',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'MS'
	},

	{
		pattern: 'missouri',
		canonical: 'Missouri',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'MO'
	},
	{
		pattern: 'mo',
		canonical: 'Missouri',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'MO'
	},

	{
		pattern: 'montana',
		canonical: 'Montana',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'MT'
	},
	{
		pattern: 'mt',
		canonical: 'Montana',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'MT'
	},

	{
		pattern: 'nebraska',
		canonical: 'Nebraska',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'NE'
	},
	{
		pattern: 'ne',
		canonical: 'Nebraska',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'NE'
	},

	{
		pattern: 'nevada',
		canonical: 'Nevada',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'NV'
	},
	{
		pattern: 'nv',
		canonical: 'Nevada',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'NV'
	},

	{
		pattern: 'new hampshire',
		canonical: 'New Hampshire',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'NH'
	},
	{
		pattern: 'nh',
		canonical: 'New Hampshire',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'NH'
	},

	{
		pattern: 'new jersey',
		canonical: 'New Jersey',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'NJ'
	},
	{
		pattern: 'nj',
		canonical: 'New Jersey',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'NJ'
	},

	{
		pattern: 'new mexico',
		canonical: 'New Mexico',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'NM'
	},
	{
		pattern: 'nm',
		canonical: 'New Mexico',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'NM'
	},

	{
		pattern: 'north carolina',
		canonical: 'North Carolina',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'NC'
	},

	{
		pattern: 'north dakota',
		canonical: 'North Dakota',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'ND'
	},
	{
		pattern: 'nd',
		canonical: 'North Dakota',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'ND'
	},

	{
		pattern: 'oklahoma',
		canonical: 'Oklahoma',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'OK'
	},
	{
		pattern: 'ok',
		canonical: 'Oklahoma',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'OK'
	},

	{
		pattern: 'oregon',
		canonical: 'Oregon',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'OR'
	},
	{
		pattern: 'or',
		canonical: 'Oregon',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'OR'
	},

	{
		pattern: 'rhode island',
		canonical: 'Rhode Island',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'RI'
	},
	{
		pattern: 'ri',
		canonical: 'Rhode Island',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'RI'
	},

	{
		pattern: 'south carolina',
		canonical: 'South Carolina',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'SC'
	},
	{
		pattern: 'sc',
		canonical: 'South Carolina',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'SC'
	},

	{
		pattern: 'south dakota',
		canonical: 'South Dakota',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'SD'
	},

	{
		pattern: 'tennessee',
		canonical: 'Tennessee',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'TN'
	},
	{
		pattern: 'tn',
		canonical: 'Tennessee',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'TN'
	},

	{
		pattern: 'utah',
		canonical: 'Utah',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'UT'
	},
	{
		pattern: 'ut',
		canonical: 'Utah',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'UT'
	},

	{
		pattern: 'vermont',
		canonical: 'Vermont',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'VT'
	},
	{
		pattern: 'vt',
		canonical: 'Vermont',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'VT'
	},

	{
		pattern: 'virginia',
		canonical: 'Virginia',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'VA'
	},
	{
		pattern: 'va',
		canonical: 'Virginia',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'VA'
	},

	{
		pattern: 'washington',
		canonical: 'Washington',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'WA'
	},
	{
		pattern: 'wa',
		canonical: 'Washington',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'WA'
	},

	{
		pattern: 'west virginia',
		canonical: 'West Virginia',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'WV'
	},
	{
		pattern: 'wv',
		canonical: 'West Virginia',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'WV'
	},

	{
		pattern: 'wisconsin',
		canonical: 'Wisconsin',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'WI'
	},
	{
		pattern: 'wi',
		canonical: 'Wisconsin',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'WI'
	},

	{
		pattern: 'wyoming',
		canonical: 'Wyoming',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'US',
		region_code: 'WY'
	},
	{
		pattern: 'wy',
		canonical: 'Wyoming',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'US',
		region_code: 'WY'
	}
];

// ============================================================================
// United Kingdom (50+ patterns)
// ============================================================================

export const UK_FUZZY_PATTERNS: FuzzyPattern[] = [
	// Regional nicknames
	{
		pattern: 'greater london',
		canonical: 'London',
		scope_level: 'locality',
		confidence: 0.9,
		country_code: 'GB',
		region_code: 'ENG',
		locality_code: 'london'
	},
	{
		pattern: 'the city',
		canonical: 'London',
		scope_level: 'locality',
		confidence: 0.7,
		country_code: 'GB',
		region_code: 'ENG',
		locality_code: 'london'
	},
	{
		pattern: 'london',
		canonical: 'London',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'GB',
		region_code: 'ENG',
		locality_code: 'london'
	},

	{
		pattern: 'home counties',
		canonical: 'England',
		scope_level: 'region',
		confidence: 0.7,
		country_code: 'GB',
		region_code: 'ENG'
	},

	{
		pattern: 'central belt',
		canonical: 'Scotland',
		scope_level: 'region',
		confidence: 0.75,
		country_code: 'GB',
		region_code: 'SCT'
	},
	{
		pattern: 'highlands',
		canonical: 'Scotland',
		scope_level: 'region',
		confidence: 0.8,
		country_code: 'GB',
		region_code: 'SCT'
	},
	{
		pattern: 'lowlands',
		canonical: 'Scotland',
		scope_level: 'region',
		confidence: 0.75,
		country_code: 'GB',
		region_code: 'SCT'
	},

	{
		pattern: 'the valleys',
		canonical: 'Wales',
		scope_level: 'region',
		confidence: 0.7,
		country_code: 'GB',
		region_code: 'WLS'
	},

	// Cities
	{
		pattern: 'birmingham',
		canonical: 'Birmingham',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'GB',
		region_code: 'ENG',
		locality_code: 'birmingham'
	},
	{
		pattern: 'manchester',
		canonical: 'Manchester',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'GB',
		region_code: 'ENG',
		locality_code: 'manchester'
	},
	{
		pattern: 'liverpool',
		canonical: 'Liverpool',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'GB',
		region_code: 'ENG',
		locality_code: 'liverpool'
	},
	{
		pattern: 'leeds',
		canonical: 'Leeds',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'GB',
		region_code: 'ENG',
		locality_code: 'leeds'
	},
	{
		pattern: 'sheffield',
		canonical: 'Sheffield',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'GB',
		region_code: 'ENG',
		locality_code: 'sheffield'
	},
	{
		pattern: 'bristol',
		canonical: 'Bristol',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'GB',
		region_code: 'ENG',
		locality_code: 'bristol'
	},
	{
		pattern: 'newcastle',
		canonical: 'Newcastle',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'GB',
		region_code: 'ENG',
		locality_code: 'newcastle'
	},
	{
		pattern: 'nottingham',
		canonical: 'Nottingham',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'GB',
		region_code: 'ENG',
		locality_code: 'nottingham'
	},

	{
		pattern: 'edinburgh',
		canonical: 'Edinburgh',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'GB',
		region_code: 'SCT',
		locality_code: 'edinburgh'
	},
	{
		pattern: 'glasgow',
		canonical: 'Glasgow',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'GB',
		region_code: 'SCT',
		locality_code: 'glasgow'
	},
	{
		pattern: 'aberdeen',
		canonical: 'Aberdeen',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'GB',
		region_code: 'SCT',
		locality_code: 'aberdeen'
	},

	{
		pattern: 'cardiff',
		canonical: 'Cardiff',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'GB',
		region_code: 'WLS',
		locality_code: 'cardiff'
	},
	{
		pattern: 'swansea',
		canonical: 'Swansea',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'GB',
		region_code: 'WLS',
		locality_code: 'swansea'
	},

	{
		pattern: 'belfast',
		canonical: 'Belfast',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'GB',
		region_code: 'NIR',
		locality_code: 'belfast'
	},

	// Additional UK cities
	{
		pattern: 'york',
		canonical: 'York',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'GB',
		region_code: 'ENG',
		locality_code: 'york'
	},
	{
		pattern: 'cambridge',
		canonical: 'Cambridge',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'GB',
		region_code: 'ENG',
		locality_code: 'cambridge'
	},
	{
		pattern: 'oxford',
		canonical: 'Oxford',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'GB',
		region_code: 'ENG',
		locality_code: 'oxford'
	},
	{
		pattern: 'brighton',
		canonical: 'Brighton',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'GB',
		region_code: 'ENG',
		locality_code: 'brighton'
	},
	{
		pattern: 'bath',
		canonical: 'Bath',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'GB',
		region_code: 'ENG',
		locality_code: 'bath'
	},
	{
		pattern: 'exeter',
		canonical: 'Exeter',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'GB',
		region_code: 'ENG',
		locality_code: 'exeter'
	},
	{
		pattern: 'plymouth',
		canonical: 'Plymouth',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'GB',
		region_code: 'ENG',
		locality_code: 'plymouth'
	},
	{
		pattern: 'portsmouth',
		canonical: 'Portsmouth',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'GB',
		region_code: 'ENG',
		locality_code: 'portsmouth'
	},
	{
		pattern: 'southampton',
		canonical: 'Southampton',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'GB',
		region_code: 'ENG',
		locality_code: 'southampton'
	},
	{
		pattern: 'bournemouth',
		canonical: 'Bournemouth',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'GB',
		region_code: 'ENG',
		locality_code: 'bournemouth'
	},
	{
		pattern: 'reading',
		canonical: 'Reading',
		scope_level: 'locality',
		confidence: 0.9,
		country_code: 'GB',
		region_code: 'ENG',
		locality_code: 'reading'
	},
	{
		pattern: 'milton keynes',
		canonical: 'Milton Keynes',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'GB',
		region_code: 'ENG',
		locality_code: 'miltonkeynes'
	},
	{
		pattern: 'derby',
		canonical: 'Derby',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'GB',
		region_code: 'ENG',
		locality_code: 'derby'
	},
	{
		pattern: 'leicester',
		canonical: 'Leicester',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'GB',
		region_code: 'ENG',
		locality_code: 'leicester'
	},
	{
		pattern: 'coventry',
		canonical: 'Coventry',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'GB',
		region_code: 'ENG',
		locality_code: 'coventry'
	},
	{
		pattern: 'hull',
		canonical: 'Hull',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'GB',
		region_code: 'ENG',
		locality_code: 'hull'
	},
	{
		pattern: 'inverness',
		canonical: 'Inverness',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'GB',
		region_code: 'SCT',
		locality_code: 'inverness'
	},

	// Regions (full names)
	{
		pattern: 'england',
		canonical: 'England',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'GB',
		region_code: 'ENG'
	},
	{
		pattern: 'scotland',
		canonical: 'Scotland',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'GB',
		region_code: 'SCT'
	},
	{
		pattern: 'wales',
		canonical: 'Wales',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'GB',
		region_code: 'WLS'
	},
	{
		pattern: 'northern ireland',
		canonical: 'Northern Ireland',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'GB',
		region_code: 'NIR'
	},

	// Abbreviations
	{
		pattern: 'eng',
		canonical: 'England',
		scope_level: 'region',
		confidence: 0.8,
		country_code: 'GB',
		region_code: 'ENG'
	},
	{
		pattern: 'sct',
		canonical: 'Scotland',
		scope_level: 'region',
		confidence: 0.8,
		country_code: 'GB',
		region_code: 'SCT'
	},
	{
		pattern: 'wls',
		canonical: 'Wales',
		scope_level: 'region',
		confidence: 0.8,
		country_code: 'GB',
		region_code: 'WLS'
	},
	{
		pattern: 'nir',
		canonical: 'Northern Ireland',
		scope_level: 'region',
		confidence: 0.8,
		country_code: 'GB',
		region_code: 'NIR'
	},

	// Country variations
	{
		pattern: 'uk',
		canonical: 'United Kingdom',
		scope_level: 'country',
		confidence: 0.95,
		country_code: 'GB'
	},
	{
		pattern: 'united kingdom',
		canonical: 'United Kingdom',
		scope_level: 'country',
		confidence: 0.95,
		country_code: 'GB'
	},
	{
		pattern: 'great britain',
		canonical: 'United Kingdom',
		scope_level: 'country',
		confidence: 0.9,
		country_code: 'GB'
	},
	{
		pattern: 'britain',
		canonical: 'United Kingdom',
		scope_level: 'country',
		confidence: 0.85,
		country_code: 'GB'
	}
];

// ============================================================================
// France (30+ patterns)
// ============================================================================

export const FRANCE_FUZZY_PATTERNS: FuzzyPattern[] = [
	// Regional nicknames
	{
		pattern: 'grand paris',
		canonical: 'Île-de-France',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'FR',
		region_code: '11'
	},
	{
		pattern: 'paris region',
		canonical: 'Île-de-France',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'FR',
		region_code: '11'
	},
	{
		pattern: 'paca',
		canonical: "Provence-Alpes-Côte d'Azur",
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'FR',
		region_code: '93'
	},
	{
		pattern: 'french riviera',
		canonical: "Provence-Alpes-Côte d'Azur",
		scope_level: 'region',
		confidence: 0.8,
		country_code: 'FR',
		region_code: '93'
	},
	{
		pattern: "côte d'azur",
		canonical: "Provence-Alpes-Côte d'Azur",
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'FR',
		region_code: '93'
	},

	// Cities
	{
		pattern: 'paris',
		canonical: 'Paris',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'FR',
		region_code: '11',
		locality_code: 'paris'
	},
	{
		pattern: 'marseille',
		canonical: 'Marseille',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'FR',
		region_code: '93',
		locality_code: 'marseille'
	},
	{
		pattern: 'lyon',
		canonical: 'Lyon',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'FR',
		region_code: '84',
		locality_code: 'lyon'
	},
	{
		pattern: 'toulouse',
		canonical: 'Toulouse',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'FR',
		region_code: '76',
		locality_code: 'toulouse'
	},
	{
		pattern: 'nice',
		canonical: 'Nice',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'FR',
		region_code: '93',
		locality_code: 'nice'
	},
	{
		pattern: 'nantes',
		canonical: 'Nantes',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'FR',
		region_code: '52',
		locality_code: 'nantes'
	},
	{
		pattern: 'strasbourg',
		canonical: 'Strasbourg',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'FR',
		region_code: '44',
		locality_code: 'strasbourg'
	},
	{
		pattern: 'bordeaux',
		canonical: 'Bordeaux',
		scope_level: 'locality',
		confidence: 0.95,
		country_code: 'FR',
		region_code: '75',
		locality_code: 'bordeaux'
	},

	// Regions (full names with and without accents)
	{
		pattern: 'île-de-france',
		canonical: 'Île-de-France',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'FR',
		region_code: '11'
	},
	{
		pattern: 'ile-de-france',
		canonical: 'Île-de-France',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'FR',
		region_code: '11'
	},

	{
		pattern: "provence-alpes-côte d'azur",
		canonical: "Provence-Alpes-Côte d'Azur",
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'FR',
		region_code: '93'
	},
	{
		pattern: "provence-alpes-cote d'azur",
		canonical: "Provence-Alpes-Côte d'Azur",
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'FR',
		region_code: '93'
	},

	{
		pattern: 'auvergne-rhône-alpes',
		canonical: 'Auvergne-Rhône-Alpes',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'FR',
		region_code: '84'
	},
	{
		pattern: 'auvergne-rhone-alpes',
		canonical: 'Auvergne-Rhône-Alpes',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'FR',
		region_code: '84'
	},

	{
		pattern: 'nouvelle-aquitaine',
		canonical: 'Nouvelle-Aquitaine',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'FR',
		region_code: '75'
	},

	{
		pattern: 'occitanie',
		canonical: 'Occitanie',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'FR',
		region_code: '76'
	},

	{
		pattern: 'hauts-de-france',
		canonical: 'Hauts-de-France',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'FR',
		region_code: '32'
	},

	{
		pattern: 'grand est',
		canonical: 'Grand Est',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'FR',
		region_code: '44'
	},

	{
		pattern: 'bretagne',
		canonical: 'Bretagne',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'FR',
		region_code: '53'
	},
	{
		pattern: 'brittany',
		canonical: 'Bretagne',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'FR',
		region_code: '53'
	},

	{
		pattern: 'pays de la loire',
		canonical: 'Pays de la Loire',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'FR',
		region_code: '52'
	},

	{
		pattern: 'normandie',
		canonical: 'Normandie',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'FR',
		region_code: '28'
	},
	{
		pattern: 'normandy',
		canonical: 'Normandie',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'FR',
		region_code: '28'
	},

	// Country variations
	{
		pattern: 'france',
		canonical: 'France',
		scope_level: 'country',
		confidence: 0.95,
		country_code: 'FR'
	},
	{
		pattern: 'nationwide',
		canonical: 'France',
		scope_level: 'country',
		confidence: 0.9,
		country_code: 'FR'
	},
	{
		pattern: 'national',
		canonical: 'France',
		scope_level: 'country',
		confidence: 0.85,
		country_code: 'FR'
	}
];

// ============================================================================
// Japan (20+ patterns)
// ============================================================================

export const JAPAN_FUZZY_PATTERNS: FuzzyPattern[] = [
	// Regional nicknames
	{
		pattern: 'kanto',
		canonical: 'Tokyo',
		scope_level: 'region',
		confidence: 0.75,
		country_code: 'JP',
		region_code: '13'
	},
	{
		pattern: 'kansai',
		canonical: 'Osaka',
		scope_level: 'region',
		confidence: 0.75,
		country_code: 'JP',
		region_code: '27'
	},
	{
		pattern: 'chubu',
		canonical: 'Aichi',
		scope_level: 'region',
		confidence: 0.7,
		country_code: 'JP',
		region_code: '23'
	},
	{
		pattern: 'tohoku',
		canonical: 'Miyagi',
		scope_level: 'region',
		confidence: 0.7,
		country_code: 'JP',
		region_code: '04'
	},
	{
		pattern: 'chugoku',
		canonical: 'Hiroshima',
		scope_level: 'region',
		confidence: 0.7,
		country_code: 'JP',
		region_code: '34'
	},
	{
		pattern: 'shikoku',
		canonical: 'Kagawa',
		scope_level: 'region',
		confidence: 0.7,
		country_code: 'JP',
		region_code: '37'
	},
	{
		pattern: 'kyushu',
		canonical: 'Fukuoka',
		scope_level: 'region',
		confidence: 0.75,
		country_code: 'JP',
		region_code: '40'
	},

	// Major prefectures
	{
		pattern: 'tokyo',
		canonical: 'Tokyo',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'JP',
		region_code: '13'
	},
	{
		pattern: 'osaka',
		canonical: 'Osaka',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'JP',
		region_code: '27'
	},
	{
		pattern: 'kyoto',
		canonical: 'Kyoto',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'JP',
		region_code: '26'
	},
	{
		pattern: 'hokkaido',
		canonical: 'Hokkaido',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'JP',
		region_code: '01'
	},
	{
		pattern: 'fukuoka',
		canonical: 'Fukuoka',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'JP',
		region_code: '40'
	},
	{
		pattern: 'nagoya',
		canonical: 'Aichi',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'JP',
		region_code: '23'
	},
	{
		pattern: 'hiroshima',
		canonical: 'Hiroshima',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'JP',
		region_code: '34'
	},
	{
		pattern: 'sendai',
		canonical: 'Miyagi',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'JP',
		region_code: '04'
	},

	{
		pattern: 'yokohama',
		canonical: 'Kanagawa',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'JP',
		region_code: '14'
	},
	{
		pattern: 'kanagawa',
		canonical: 'Kanagawa',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'JP',
		region_code: '14'
	},
	{
		pattern: 'sapporo',
		canonical: 'Hokkaido',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'JP',
		region_code: '01'
	},

	// Country variations
	{
		pattern: 'japan',
		canonical: 'Japan',
		scope_level: 'country',
		confidence: 0.95,
		country_code: 'JP'
	},
	{
		pattern: 'nationwide',
		canonical: 'Japan',
		scope_level: 'country',
		confidence: 0.9,
		country_code: 'JP'
	},
	{
		pattern: 'national',
		canonical: 'Japan',
		scope_level: 'country',
		confidence: 0.85,
		country_code: 'JP'
	}
];

// ============================================================================
// Brazil (20+ patterns)
// ============================================================================

export const BRAZIL_FUZZY_PATTERNS: FuzzyPattern[] = [
	// Regional nicknames
	{
		pattern: 'nordeste',
		canonical: 'Bahia',
		scope_level: 'region',
		confidence: 0.7,
		country_code: 'BR',
		region_code: 'BA'
	},
	{
		pattern: 'northeast',
		canonical: 'Bahia',
		scope_level: 'region',
		confidence: 0.7,
		country_code: 'BR',
		region_code: 'BA'
	},

	{
		pattern: 'sudeste',
		canonical: 'São Paulo',
		scope_level: 'region',
		confidence: 0.7,
		country_code: 'BR',
		region_code: 'SP'
	},
	{
		pattern: 'southeast',
		canonical: 'São Paulo',
		scope_level: 'region',
		confidence: 0.7,
		country_code: 'BR',
		region_code: 'SP'
	},

	{
		pattern: 'sul',
		canonical: 'Rio Grande do Sul',
		scope_level: 'region',
		confidence: 0.7,
		country_code: 'BR',
		region_code: 'RS'
	},
	{
		pattern: 'south',
		canonical: 'Rio Grande do Sul',
		scope_level: 'region',
		confidence: 0.7,
		country_code: 'BR',
		region_code: 'RS'
	},

	// Major states (full names and abbreviations)
	{
		pattern: 'são paulo',
		canonical: 'São Paulo',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'BR',
		region_code: 'SP'
	},
	{
		pattern: 'sao paulo',
		canonical: 'São Paulo',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'BR',
		region_code: 'SP'
	},
	{
		pattern: 'sp',
		canonical: 'São Paulo',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'BR',
		region_code: 'SP'
	},

	{
		pattern: 'rio de janeiro',
		canonical: 'Rio de Janeiro',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'BR',
		region_code: 'RJ'
	},
	{
		pattern: 'rj',
		canonical: 'Rio de Janeiro',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'BR',
		region_code: 'RJ'
	},
	{
		pattern: 'rio',
		canonical: 'Rio de Janeiro',
		scope_level: 'region',
		confidence: 0.8,
		country_code: 'BR',
		region_code: 'RJ'
	},

	{
		pattern: 'minas gerais',
		canonical: 'Minas Gerais',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'BR',
		region_code: 'MG'
	},
	{
		pattern: 'mg',
		canonical: 'Minas Gerais',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'BR',
		region_code: 'MG'
	},

	{
		pattern: 'bahia',
		canonical: 'Bahia',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'BR',
		region_code: 'BA'
	},
	{
		pattern: 'ba',
		canonical: 'Bahia',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'BR',
		region_code: 'BA'
	},

	{
		pattern: 'paraná',
		canonical: 'Paraná',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'BR',
		region_code: 'PR'
	},
	{
		pattern: 'parana',
		canonical: 'Paraná',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'BR',
		region_code: 'PR'
	},
	{
		pattern: 'pr',
		canonical: 'Paraná',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'BR',
		region_code: 'PR'
	},

	{
		pattern: 'rio grande do sul',
		canonical: 'Rio Grande do Sul',
		scope_level: 'region',
		confidence: 0.9,
		country_code: 'BR',
		region_code: 'RS'
	},
	{
		pattern: 'rs',
		canonical: 'Rio Grande do Sul',
		scope_level: 'region',
		confidence: 0.85,
		country_code: 'BR',
		region_code: 'RS'
	},

	// Country variations
	{
		pattern: 'brazil',
		canonical: 'Brazil',
		scope_level: 'country',
		confidence: 0.95,
		country_code: 'BR'
	},
	{
		pattern: 'brasil',
		canonical: 'Brazil',
		scope_level: 'country',
		confidence: 0.95,
		country_code: 'BR'
	},
	{
		pattern: 'nationwide',
		canonical: 'Brazil',
		scope_level: 'country',
		confidence: 0.9,
		country_code: 'BR'
	}
];

// ============================================================================
// Consolidated Pattern Database
// ============================================================================

export const FUZZY_PATTERNS: Record<string, FuzzyPattern[]> = {
	US: US_FUZZY_PATTERNS,
	GB: UK_FUZZY_PATTERNS,
	FR: FRANCE_FUZZY_PATTERNS,
	JP: JAPAN_FUZZY_PATTERNS,
	BR: BRAZIL_FUZZY_PATTERNS
};

// ============================================================================
// Pattern Statistics
// ============================================================================

/**
 * Get fuzzy pattern statistics for monitoring and validation
 */
export function getFuzzyPatternStats(): Record<string, number> {
	return {
		US: US_FUZZY_PATTERNS.length,
		GB: UK_FUZZY_PATTERNS.length,
		FR: FRANCE_FUZZY_PATTERNS.length,
		JP: JAPAN_FUZZY_PATTERNS.length,
		BR: BRAZIL_FUZZY_PATTERNS.length,
		total:
			US_FUZZY_PATTERNS.length +
			UK_FUZZY_PATTERNS.length +
			FRANCE_FUZZY_PATTERNS.length +
			JAPAN_FUZZY_PATTERNS.length +
			BRAZIL_FUZZY_PATTERNS.length
	};
}
