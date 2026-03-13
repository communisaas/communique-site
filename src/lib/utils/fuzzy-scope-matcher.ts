/**
 * Fuzzy geographic scope matcher.
 * In-memory matching for common abbreviations and colloquialisms.
 * Runs in <5ms -- no external API calls.
 */

import { levenshteinDistance } from './levenshtein';

export interface FuzzyMatchResult {
	pattern: string;
	canonical: string;
	country: string;
	scopeLevel: 'country' | 'region' | 'locality' | 'district';
	confidence: number;
}

interface FuzzyPattern {
	pattern: string;
	canonical: string;
	scopeLevel: 'country' | 'region' | 'locality' | 'district';
	confidence: number;
}

const FUZZY_PATTERNS: Record<string, FuzzyPattern[]> = {
	US: [
		{ pattern: 'socal', canonical: 'California', scopeLevel: 'region', confidence: 0.85 },
		{ pattern: 'norcal', canonical: 'California', scopeLevel: 'region', confidence: 0.85 },
		{ pattern: 'nyc', canonical: 'New York', scopeLevel: 'locality', confidence: 0.9 },
		{ pattern: 'la', canonical: 'Los Angeles', scopeLevel: 'locality', confidence: 0.75 },
		{ pattern: 'sf', canonical: 'San Francisco', scopeLevel: 'locality', confidence: 0.85 },
		{ pattern: 'bay area', canonical: 'California', scopeLevel: 'region', confidence: 0.8 },
		{
			pattern: 'dmv',
			canonical: 'District of Columbia',
			scopeLevel: 'region',
			confidence: 0.75
		},
		{ pattern: 'tristate', canonical: 'New York', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'tri-state', canonical: 'New York', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'the valley', canonical: 'California', scopeLevel: 'region', confidence: 0.6 },
		{
			pattern: 'silicon valley',
			canonical: 'California',
			scopeLevel: 'region',
			confidence: 0.85
		},
		{
			pattern: 'twin cities',
			canonical: 'Minnesota',
			scopeLevel: 'locality',
			confidence: 0.85
		},
		{
			pattern: 'chicagoland',
			canonical: 'Illinois',
			scopeLevel: 'region',
			confidence: 0.8
		},
		{
			pattern: 'the beltway',
			canonical: 'District of Columbia',
			scopeLevel: 'region',
			confidence: 0.75
		},
		{
			pattern: 'the heartland',
			canonical: 'United States',
			scopeLevel: 'region',
			confidence: 0.5
		},
		{
			pattern: 'new england',
			canonical: 'Massachusetts',
			scopeLevel: 'region',
			confidence: 0.6
		},
		{
			pattern: 'the south',
			canonical: 'United States',
			scopeLevel: 'region',
			confidence: 0.5
		},
		{
			pattern: 'deep south',
			canonical: 'United States',
			scopeLevel: 'region',
			confidence: 0.5
		},
		{
			pattern: 'pacific northwest',
			canonical: 'Washington',
			scopeLevel: 'region',
			confidence: 0.6
		},
		{ pattern: 'pnw', canonical: 'Washington', scopeLevel: 'region', confidence: 0.7 },
		{
			pattern: 'the midwest',
			canonical: 'United States',
			scopeLevel: 'region',
			confidence: 0.5
		},
		{
			pattern: 'rust belt',
			canonical: 'United States',
			scopeLevel: 'region',
			confidence: 0.5
		},
		{
			pattern: 'sun belt',
			canonical: 'United States',
			scopeLevel: 'region',
			confidence: 0.5
		},
		{ pattern: 'ie', canonical: 'California', scopeLevel: 'region', confidence: 0.6 },
		{
			pattern: 'inland empire',
			canonical: 'California',
			scopeLevel: 'region',
			confidence: 0.8
		},
		{ pattern: 'dfw', canonical: 'Texas', scopeLevel: 'locality', confidence: 0.85 },
		{
			pattern: 'the district',
			canonical: 'District of Columbia',
			scopeLevel: 'locality',
			confidence: 0.75
		},
		{
			pattern: 'dc',
			canonical: 'District of Columbia',
			scopeLevel: 'locality',
			confidence: 0.9
		},
		{
			pattern: 'philly',
			canonical: 'Pennsylvania',
			scopeLevel: 'locality',
			confidence: 0.85
		},
		{ pattern: 'vegas', canonical: 'Nevada', scopeLevel: 'locality', confidence: 0.85 },
		// State abbreviations (all 50)
		{ pattern: 'al', canonical: 'Alabama', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'ak', canonical: 'Alaska', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'az', canonical: 'Arizona', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'ar', canonical: 'Arkansas', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'ca', canonical: 'California', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'co', canonical: 'Colorado', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'ct', canonical: 'Connecticut', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'de', canonical: 'Delaware', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'fl', canonical: 'Florida', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'ga', canonical: 'Georgia', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'hi', canonical: 'Hawaii', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'id', canonical: 'Idaho', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'il', canonical: 'Illinois', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'in', canonical: 'Indiana', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'ia', canonical: 'Iowa', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'ks', canonical: 'Kansas', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'ky', canonical: 'Kentucky', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'me', canonical: 'Maine', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'md', canonical: 'Maryland', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'ma', canonical: 'Massachusetts', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'mi', canonical: 'Michigan', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'mn', canonical: 'Minnesota', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'ms', canonical: 'Mississippi', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'mo', canonical: 'Missouri', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'mt', canonical: 'Montana', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'ne', canonical: 'Nebraska', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'nv', canonical: 'Nevada', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'nh', canonical: 'New Hampshire', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'nj', canonical: 'New Jersey', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'nm', canonical: 'New Mexico', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'ny', canonical: 'New York', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'nc', canonical: 'North Carolina', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'nd', canonical: 'North Dakota', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'oh', canonical: 'Ohio', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'ok', canonical: 'Oklahoma', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'or', canonical: 'Oregon', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'pa', canonical: 'Pennsylvania', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'ri', canonical: 'Rhode Island', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'sc', canonical: 'South Carolina', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'sd', canonical: 'South Dakota', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'tn', canonical: 'Tennessee', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'tx', canonical: 'Texas', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'ut', canonical: 'Utah', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'vt', canonical: 'Vermont', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'va', canonical: 'Virginia', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'wa', canonical: 'Washington', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'wv', canonical: 'West Virginia', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'wi', canonical: 'Wisconsin', scopeLevel: 'region', confidence: 0.7 },
		{ pattern: 'wy', canonical: 'Wyoming', scopeLevel: 'region', confidence: 0.7 }
	],
	GB: [
		{
			pattern: 'greater london',
			canonical: 'London',
			scopeLevel: 'locality',
			confidence: 0.9
		},
		{ pattern: 'the city', canonical: 'London', scopeLevel: 'locality', confidence: 0.65 },
		{
			pattern: 'home counties',
			canonical: 'South East England',
			scopeLevel: 'region',
			confidence: 0.7
		},
		{
			pattern: 'the north',
			canonical: 'Northern England',
			scopeLevel: 'region',
			confidence: 0.6
		},
		{
			pattern: 'up north',
			canonical: 'Northern England',
			scopeLevel: 'region',
			confidence: 0.6
		},
		{
			pattern: 'the midlands',
			canonical: 'West Midlands',
			scopeLevel: 'region',
			confidence: 0.65
		},
		{
			pattern: 'east midlands',
			canonical: 'East Midlands',
			scopeLevel: 'region',
			confidence: 0.8
		},
		{
			pattern: 'west midlands',
			canonical: 'West Midlands',
			scopeLevel: 'region',
			confidence: 0.8
		},
		{
			pattern: 'south west',
			canonical: 'South West England',
			scopeLevel: 'region',
			confidence: 0.8
		},
		{
			pattern: 'south east',
			canonical: 'South East England',
			scopeLevel: 'region',
			confidence: 0.8
		},
		{
			pattern: 'north west',
			canonical: 'North West England',
			scopeLevel: 'region',
			confidence: 0.8
		},
		{
			pattern: 'north east',
			canonical: 'North East England',
			scopeLevel: 'region',
			confidence: 0.8
		},
		{ pattern: 'scotland', canonical: 'Scotland', scopeLevel: 'region', confidence: 0.9 },
		{ pattern: 'wales', canonical: 'Wales', scopeLevel: 'region', confidence: 0.9 },
		{
			pattern: 'ni',
			canonical: 'Northern Ireland',
			scopeLevel: 'region',
			confidence: 0.7
		},
		{
			pattern: 'northern ireland',
			canonical: 'Northern Ireland',
			scopeLevel: 'region',
			confidence: 0.9
		},
		{
			pattern: 'westminster',
			canonical: 'London',
			scopeLevel: 'locality',
			confidence: 0.75
		},
		{
			pattern: 'brum',
			canonical: 'Birmingham',
			scopeLevel: 'locality',
			confidence: 0.8
		},
		{
			pattern: 'manc',
			canonical: 'Manchester',
			scopeLevel: 'locality',
			confidence: 0.75
		},
		{
			pattern: 'toon',
			canonical: 'Newcastle',
			scopeLevel: 'locality',
			confidence: 0.7
		}
	],
	CA: [
		{ pattern: 'gta', canonical: 'Toronto', scopeLevel: 'locality', confidence: 0.85 },
		{
			pattern: 'greater toronto',
			canonical: 'Toronto',
			scopeLevel: 'locality',
			confidence: 0.9
		},
		{
			pattern: 'lower mainland',
			canonical: 'Vancouver',
			scopeLevel: 'locality',
			confidence: 0.85
		},
		{ pattern: 'gvrd', canonical: 'Vancouver', scopeLevel: 'locality', confidence: 0.8 },
		{ pattern: 'ncr', canonical: 'Ottawa', scopeLevel: 'locality', confidence: 0.75 },
		{
			pattern: 'national capital region',
			canonical: 'Ottawa',
			scopeLevel: 'locality',
			confidence: 0.85
		},
		{
			pattern: 'the maritimes',
			canonical: 'Nova Scotia',
			scopeLevel: 'region',
			confidence: 0.6
		},
		{
			pattern: 'the prairies',
			canonical: 'Manitoba',
			scopeLevel: 'region',
			confidence: 0.55
		},
		{
			pattern: 'atlantic canada',
			canonical: 'Nova Scotia',
			scopeLevel: 'region',
			confidence: 0.55
		},
		{
			pattern: 'western canada',
			canonical: 'British Columbia',
			scopeLevel: 'region',
			confidence: 0.5
		},
		{
			pattern: 'bc',
			canonical: 'British Columbia',
			scopeLevel: 'region',
			confidence: 0.8
		},
		{ pattern: 'ab', canonical: 'Alberta', scopeLevel: 'region', confidence: 0.75 },
		{
			pattern: 'sk',
			canonical: 'Saskatchewan',
			scopeLevel: 'region',
			confidence: 0.75
		},
		{ pattern: 'mb', canonical: 'Manitoba', scopeLevel: 'region', confidence: 0.75 },
		{ pattern: 'on', canonical: 'Ontario', scopeLevel: 'region', confidence: 0.75 },
		{ pattern: 'qc', canonical: 'Quebec', scopeLevel: 'region', confidence: 0.75 },
		{
			pattern: 'nb',
			canonical: 'New Brunswick',
			scopeLevel: 'region',
			confidence: 0.75
		},
		{
			pattern: 'ns',
			canonical: 'Nova Scotia',
			scopeLevel: 'region',
			confidence: 0.75
		},
		{
			pattern: 'pe',
			canonical: 'Prince Edward Island',
			scopeLevel: 'region',
			confidence: 0.75
		},
		{
			pattern: 'nl',
			canonical: 'Newfoundland and Labrador',
			scopeLevel: 'region',
			confidence: 0.75
		}
	],
	AU: [
		{
			pattern: 'sydney',
			canonical: 'New South Wales',
			scopeLevel: 'locality',
			confidence: 0.85
		},
		{
			pattern: 'melbourne',
			canonical: 'Victoria',
			scopeLevel: 'locality',
			confidence: 0.85
		},
		{
			pattern: 'brisbane',
			canonical: 'Queensland',
			scopeLevel: 'locality',
			confidence: 0.85
		},
		{
			pattern: 'perth',
			canonical: 'Western Australia',
			scopeLevel: 'locality',
			confidence: 0.85
		},
		{
			pattern: 'adelaide',
			canonical: 'South Australia',
			scopeLevel: 'locality',
			confidence: 0.85
		},
		{
			pattern: 'hobart',
			canonical: 'Tasmania',
			scopeLevel: 'locality',
			confidence: 0.85
		},
		{
			pattern: 'darwin',
			canonical: 'Northern Territory',
			scopeLevel: 'locality',
			confidence: 0.85
		},
		{
			pattern: 'canberra',
			canonical: 'Australian Capital Territory',
			scopeLevel: 'locality',
			confidence: 0.9
		},
		{
			pattern: 'act',
			canonical: 'Australian Capital Territory',
			scopeLevel: 'region',
			confidence: 0.75
		},
		{
			pattern: 'nsw',
			canonical: 'New South Wales',
			scopeLevel: 'region',
			confidence: 0.8
		},
		{ pattern: 'vic', canonical: 'Victoria', scopeLevel: 'region', confidence: 0.8 },
		{
			pattern: 'qld',
			canonical: 'Queensland',
			scopeLevel: 'region',
			confidence: 0.8
		},
		{
			pattern: 'sa',
			canonical: 'South Australia',
			scopeLevel: 'region',
			confidence: 0.75
		},
		{
			pattern: 'wa',
			canonical: 'Western Australia',
			scopeLevel: 'region',
			confidence: 0.75
		},
		{ pattern: 'tas', canonical: 'Tasmania', scopeLevel: 'region', confidence: 0.8 },
		{
			pattern: 'nt',
			canonical: 'Northern Territory',
			scopeLevel: 'region',
			confidence: 0.75
		},
		{
			pattern: 'the bush',
			canonical: 'Australia',
			scopeLevel: 'country',
			confidence: 0.5
		},
		{
			pattern: 'the outback',
			canonical: 'Australia',
			scopeLevel: 'country',
			confidence: 0.5
		},
		{
			pattern: 'gold coast',
			canonical: 'Queensland',
			scopeLevel: 'locality',
			confidence: 0.85
		},
		{
			pattern: 'sunshine coast',
			canonical: 'Queensland',
			scopeLevel: 'locality',
			confidence: 0.85
		}
	]
};

/** Fuzzy-match a geographic text input to a known scope pattern */
export function fuzzyMatch(text: string, countryCode?: string): FuzzyMatchResult | null {
	const normalized = text.toLowerCase().trim();
	if (!normalized) return null;

	// Search specified country first, then all countries
	const countries = countryCode
		? [
				countryCode.toUpperCase(),
				...Object.keys(FUZZY_PATTERNS).filter((c) => c !== countryCode.toUpperCase())
			]
		: Object.keys(FUZZY_PATTERNS);

	for (const country of countries) {
		const patterns = FUZZY_PATTERNS[country];
		if (!patterns) continue;

		// Exact match first
		for (const p of patterns) {
			if (normalized === p.pattern) {
				return {
					pattern: p.pattern,
					canonical: p.canonical,
					country,
					scopeLevel: p.scopeLevel,
					confidence: p.confidence
				};
			}
		}

		// Levenshtein tolerance (edit distance <= 2, only for patterns length > 3)
		for (const p of patterns) {
			if (p.pattern.length > 3 && levenshteinDistance(normalized, p.pattern) <= 2) {
				return {
					pattern: p.pattern,
					canonical: p.canonical,
					country,
					scopeLevel: p.scopeLevel,
					confidence: p.confidence * 0.85 // reduce for typo match
				};
			}
		}
	}

	return null;
}
