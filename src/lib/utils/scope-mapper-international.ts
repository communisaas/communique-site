/**
 * International Geographic Scope Mapper
 *
 * Deterministic mapping from agent-extracted location text to database codes.
 * Supports US, UK, France, Japan, Brazil with country-specific lookup tables.
 *
 * Universal semantic hierarchy: country → region → locality → district
 */

// ============================================================================
// Types
// ============================================================================

export type ScopeLevel = 'country' | 'region' | 'locality' | 'district';

export interface ScopeMapping {
	country_code: string;
	scope_level: ScopeLevel;
	display_text: string;
	region_code?: string;
	locality_code?: string;
	district_code?: string;
	confidence: number;
	alternatives?: ScopeAlternative[]; // Provide options when confidence < 0.7
	extraction_method?: 'regex' | 'fuzzy' | 'geocoder' | 'llm' | 'user_confirmed';
}

export interface ScopeAlternative {
	display_text: string;
	country_code: string;
	scope_level: ScopeLevel;
	region_code?: string;
	locality_code?: string;
	district_code?: string;
	confidence: number;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Map agent-extracted location text to structured scope data
 *
 * @param locationText - Free-text location from agent ("California", "London", "Tokyo")
 * @param countryCode - ISO 3166-1 alpha-2 country code (default: "US")
 * @returns Structured scope mapping with codes and confidence
 */
export function mapLocationToScope(locationText: string, countryCode: string = 'US'): ScopeMapping {
	const normalized = locationText.trim().toLowerCase();

	// Route to country-specific mapper
	switch (countryCode) {
		case 'US':
			return mapUSLocation(normalized);
		case 'GB':
			return mapUKLocation(normalized);
		case 'FR':
			return mapFranceLocation(normalized);
		case 'JP':
			return mapJapanLocation(normalized);
		case 'BR':
			return mapBrazilLocation(normalized);
		default:
			// Fallback: country-level scope
			return {
				country_code: countryCode,
				scope_level: 'country',
				display_text: locationText,
				confidence: 0.5 // Low confidence for unsupported country
			};
	}
}

// ============================================================================
// US Location Mapper
// ============================================================================

const US_STATES: Record<string, { code: string; name: string }> = {
	california: { code: 'CA', name: 'California' },
	ca: { code: 'CA', name: 'California' },
	'new york': { code: 'NY', name: 'New York' },
	ny: { code: 'NY', name: 'New York' },
	texas: { code: 'TX', name: 'Texas' },
	tx: { code: 'TX', name: 'Texas' },
	florida: { code: 'FL', name: 'Florida' },
	fl: { code: 'FL', name: 'Florida' },
	illinois: { code: 'IL', name: 'Illinois' },
	il: { code: 'IL', name: 'Illinois' },
	pennsylvania: { code: 'PA', name: 'Pennsylvania' },
	pa: { code: 'PA', name: 'Pennsylvania' },
	ohio: { code: 'OH', name: 'Ohio' },
	oh: { code: 'OH', name: 'Ohio' },
	georgia: { code: 'GA', name: 'Georgia' },
	ga: { code: 'GA', name: 'Georgia' },
	michigan: { code: 'MI', name: 'Michigan' },
	mi: { code: 'MI', name: 'Michigan' },
	'north carolina': { code: 'NC', name: 'North Carolina' },
	nc: { code: 'NC', name: 'North Carolina' }
	// Add all 50 states as needed...
};

function mapUSLocation(normalized: string): ScopeMapping {
	// Pattern 1: Congressional district (CA-12, NY-15, etc.)
	const districtMatch = normalized.match(/^([a-z]{2})-(\d{1,2})$/);
	if (districtMatch) {
		const stateCode = districtMatch[1].toUpperCase();
		const districtNum = districtMatch[2];
		return {
			country_code: 'US',
			scope_level: 'district',
			display_text: `${stateCode}-${districtNum}`,
			region_code: stateCode,
			district_code: `${stateCode}-${districtNum}`,
			confidence: 0.95,
			extraction_method: 'regex'
		};
	}

	// Pattern 2: State name or code
	const stateData = US_STATES[normalized];
	if (stateData) {
		return {
			country_code: 'US',
			scope_level: 'region',
			display_text: stateData.name,
			region_code: stateData.code,
			confidence: 0.9,
			extraction_method: 'regex'
		};
	}

	// Pattern 3: Nationwide / All states
	if (
		normalized.includes('nationwide') ||
		normalized.includes('all states') ||
		normalized.includes('federal')
	) {
		return {
			country_code: 'US',
			scope_level: 'country',
			display_text: 'Nationwide',
			confidence: 0.95,
			extraction_method: 'regex'
		};
	}

	// Fallback: country-level with low confidence
	// Provide common state alternatives for user selection
	return {
		country_code: 'US',
		scope_level: 'country',
		display_text: 'Nationwide',
		confidence: 0.5,
		extraction_method: 'regex',
		alternatives: [
			{
				display_text: 'California',
				country_code: 'US',
				scope_level: 'region',
				region_code: 'CA',
				confidence: 0.5
			},
			{
				display_text: 'New York',
				country_code: 'US',
				scope_level: 'region',
				region_code: 'NY',
				confidence: 0.5
			},
			{
				display_text: 'Texas',
				country_code: 'US',
				scope_level: 'region',
				region_code: 'TX',
				confidence: 0.5
			},
			{
				display_text: 'Florida',
				country_code: 'US',
				scope_level: 'region',
				region_code: 'FL',
				confidence: 0.5
			},
			{ display_text: 'Nationwide', country_code: 'US', scope_level: 'country', confidence: 0.5 }
		]
	};
}

// ============================================================================
// UK Location Mapper
// ============================================================================

const UK_REGIONS: Record<string, { code: string; name: string }> = {
	england: { code: 'ENG', name: 'England' },
	scotland: { code: 'SCT', name: 'Scotland' },
	wales: { code: 'WLS', name: 'Wales' },
	'northern ireland': { code: 'NIR', name: 'Northern Ireland' }
};

const UK_CITIES: Record<string, { name: string; region: string }> = {
	london: { name: 'London', region: 'ENG' },
	birmingham: { name: 'Birmingham', region: 'ENG' },
	manchester: { name: 'Manchester', region: 'ENG' },
	edinburgh: { name: 'Edinburgh', region: 'SCT' },
	cardiff: { name: 'Cardiff', region: 'WLS' },
	belfast: { name: 'Belfast', region: 'NIR' }
};

function mapUKLocation(normalized: string): ScopeMapping {
	// Pattern 1: Region
	const regionData = UK_REGIONS[normalized];
	if (regionData) {
		return {
			country_code: 'GB',
			scope_level: 'region',
			display_text: regionData.name,
			region_code: regionData.code,
			confidence: 0.9,
			extraction_method: 'regex'
		};
	}

	// Pattern 2: City
	const cityData = UK_CITIES[normalized];
	if (cityData) {
		return {
			country_code: 'GB',
			scope_level: 'locality',
			display_text: cityData.name,
			region_code: cityData.region,
			locality_code: normalized,
			confidence: 0.85,
			extraction_method: 'regex'
		};
	}

	// Pattern 3: Nationwide
	if (
		normalized.includes('uk') ||
		normalized.includes('nationwide') ||
		normalized.includes('united kingdom')
	) {
		return {
			country_code: 'GB',
			scope_level: 'country',
			display_text: 'United Kingdom',
			confidence: 0.95,
			extraction_method: 'regex'
		};
	}

	// Fallback: country-level
	return {
		country_code: 'GB',
		scope_level: 'country',
		display_text: 'United Kingdom',
		confidence: 0.5,
		extraction_method: 'regex',
		alternatives: [
			{
				display_text: 'England',
				country_code: 'GB',
				scope_level: 'region',
				region_code: 'ENG',
				confidence: 0.5
			},
			{
				display_text: 'Scotland',
				country_code: 'GB',
				scope_level: 'region',
				region_code: 'SCT',
				confidence: 0.5
			},
			{
				display_text: 'Wales',
				country_code: 'GB',
				scope_level: 'region',
				region_code: 'WLS',
				confidence: 0.5
			},
			{
				display_text: 'Northern Ireland',
				country_code: 'GB',
				scope_level: 'region',
				region_code: 'NIR',
				confidence: 0.5
			},
			{
				display_text: 'United Kingdom',
				country_code: 'GB',
				scope_level: 'country',
				confidence: 0.5
			}
		]
	};
}

// ============================================================================
// France Location Mapper
// ============================================================================

const FRANCE_REGIONS: Record<string, { code: string; name: string }> = {
	'île-de-france': { code: '11', name: 'Île-de-France' },
	'ile-de-france': { code: '11', name: 'Île-de-France' },
	'paris region': { code: '11', name: 'Île-de-France' },
	"provence-alpes-côte d'azur": { code: '93', name: "Provence-Alpes-Côte d'Azur" },
	paca: { code: '93', name: "Provence-Alpes-Côte d'Azur" },
	'auvergne-rhône-alpes': { code: '84', name: 'Auvergne-Rhône-Alpes' },
	'nouvelle-aquitaine': { code: '75', name: 'Nouvelle-Aquitaine' },
	occitanie: { code: '76', name: 'Occitanie' }
};

const FRANCE_CITIES: Record<string, { name: string; region: string }> = {
	paris: { name: 'Paris', region: '11' },
	marseille: { name: 'Marseille', region: '93' },
	lyon: { name: 'Lyon', region: '84' },
	toulouse: { name: 'Toulouse', region: '76' }
};

function mapFranceLocation(normalized: string): ScopeMapping {
	// Pattern 1: Region
	const regionData = FRANCE_REGIONS[normalized];
	if (regionData) {
		return {
			country_code: 'FR',
			scope_level: 'region',
			display_text: regionData.name,
			region_code: regionData.code,
			confidence: 0.9,
			extraction_method: 'regex'
		};
	}

	// Pattern 2: City
	const cityData = FRANCE_CITIES[normalized];
	if (cityData) {
		return {
			country_code: 'FR',
			scope_level: 'locality',
			display_text: cityData.name,
			region_code: cityData.region,
			locality_code: normalized,
			confidence: 0.85,
			extraction_method: 'regex'
		};
	}

	// Pattern 3: Nationwide
	if (
		normalized.includes('france') ||
		normalized.includes('nationwide') ||
		normalized.includes('national')
	) {
		return {
			country_code: 'FR',
			scope_level: 'country',
			display_text: 'France',
			confidence: 0.95,
			extraction_method: 'regex'
		};
	}

	// Fallback: country-level
	return {
		country_code: 'FR',
		scope_level: 'country',
		display_text: 'France',
		confidence: 0.5,
		extraction_method: 'regex',
		alternatives: [
			{
				display_text: 'Île-de-France',
				country_code: 'FR',
				scope_level: 'region',
				region_code: '11',
				confidence: 0.5
			},
			{
				display_text: "Provence-Alpes-Côte d'Azur",
				country_code: 'FR',
				scope_level: 'region',
				region_code: '93',
				confidence: 0.5
			},
			{
				display_text: 'Auvergne-Rhône-Alpes',
				country_code: 'FR',
				scope_level: 'region',
				region_code: '84',
				confidence: 0.5
			},
			{ display_text: 'France', country_code: 'FR', scope_level: 'country', confidence: 0.5 }
		]
	};
}

// ============================================================================
// Japan Location Mapper
// ============================================================================

const JAPAN_PREFECTURES: Record<string, { code: string; name: string }> = {
	tokyo: { code: '13', name: 'Tokyo' },
	osaka: { code: '27', name: 'Osaka' },
	kyoto: { code: '26', name: 'Kyoto' },
	hokkaido: { code: '01', name: 'Hokkaido' },
	fukuoka: { code: '40', name: 'Fukuoka' }
};

function mapJapanLocation(normalized: string): ScopeMapping {
	// Pattern 1: Prefecture
	const prefectureData = JAPAN_PREFECTURES[normalized];
	if (prefectureData) {
		return {
			country_code: 'JP',
			scope_level: 'region',
			display_text: prefectureData.name,
			region_code: prefectureData.code,
			confidence: 0.9,
			extraction_method: 'regex'
		};
	}

	// Pattern 2: Nationwide
	if (
		normalized.includes('japan') ||
		normalized.includes('nationwide') ||
		normalized.includes('national')
	) {
		return {
			country_code: 'JP',
			scope_level: 'country',
			display_text: 'Japan',
			confidence: 0.95,
			extraction_method: 'regex'
		};
	}

	// Fallback: country-level
	return {
		country_code: 'JP',
		scope_level: 'country',
		display_text: 'Japan',
		confidence: 0.5,
		extraction_method: 'regex',
		alternatives: [
			{
				display_text: 'Tokyo',
				country_code: 'JP',
				scope_level: 'region',
				region_code: '13',
				confidence: 0.5
			},
			{
				display_text: 'Osaka',
				country_code: 'JP',
				scope_level: 'region',
				region_code: '27',
				confidence: 0.5
			},
			{
				display_text: 'Kyoto',
				country_code: 'JP',
				scope_level: 'region',
				region_code: '26',
				confidence: 0.5
			},
			{ display_text: 'Japan', country_code: 'JP', scope_level: 'country', confidence: 0.5 }
		]
	};
}

// ============================================================================
// Brazil Location Mapper
// ============================================================================

const BRAZIL_STATES: Record<string, { code: string; name: string }> = {
	'são paulo': { code: 'SP', name: 'São Paulo' },
	'sao paulo': { code: 'SP', name: 'São Paulo' },
	sp: { code: 'SP', name: 'São Paulo' },
	'rio de janeiro': { code: 'RJ', name: 'Rio de Janeiro' },
	rj: { code: 'RJ', name: 'Rio de Janeiro' },
	'minas gerais': { code: 'MG', name: 'Minas Gerais' },
	mg: { code: 'MG', name: 'Minas Gerais' },
	bahia: { code: 'BA', name: 'Bahia' },
	ba: { code: 'BA', name: 'Bahia' }
};

function mapBrazilLocation(normalized: string): ScopeMapping {
	// Pattern 1: State
	const stateData = BRAZIL_STATES[normalized];
	if (stateData) {
		return {
			country_code: 'BR',
			scope_level: 'region',
			display_text: stateData.name,
			region_code: stateData.code,
			confidence: 0.9,
			extraction_method: 'regex'
		};
	}

	// Pattern 2: Nationwide
	if (
		normalized.includes('brazil') ||
		normalized.includes('brasil') ||
		normalized.includes('nationwide')
	) {
		return {
			country_code: 'BR',
			scope_level: 'country',
			display_text: 'Brazil',
			confidence: 0.95,
			extraction_method: 'regex'
		};
	}

	// Fallback: country-level
	return {
		country_code: 'BR',
		scope_level: 'country',
		display_text: 'Brazil',
		confidence: 0.5,
		extraction_method: 'regex',
		alternatives: [
			{
				display_text: 'São Paulo',
				country_code: 'BR',
				scope_level: 'region',
				region_code: 'SP',
				confidence: 0.5
			},
			{
				display_text: 'Rio de Janeiro',
				country_code: 'BR',
				scope_level: 'region',
				region_code: 'RJ',
				confidence: 0.5
			},
			{
				display_text: 'Minas Gerais',
				country_code: 'BR',
				scope_level: 'region',
				region_code: 'MG',
				confidence: 0.5
			},
			{ display_text: 'Brazil', country_code: 'BR', scope_level: 'country', confidence: 0.5 }
		]
	};
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate that a scope mapping has required fields
 */
export function validateScopeMapping(mapping: ScopeMapping): boolean {
	if (!mapping.country_code || !mapping.scope_level || !mapping.display_text) {
		return false;
	}

	// Validate scope_level is one of the allowed values
	const validLevels: ScopeLevel[] = ['country', 'region', 'locality', 'district'];
	if (!validLevels.includes(mapping.scope_level)) {
		return false;
	}

	// Validate confidence is between 0 and 1
	if (mapping.confidence < 0 || mapping.confidence > 1) {
		return false;
	}

	return true;
}

/**
 * Get human-readable scope level description
 */
export function getScopeLevelDescription(level: ScopeLevel, countryCode: string): string {
	const descriptions: Record<string, Record<ScopeLevel, string>> = {
		US: {
			country: 'Nationwide',
			region: 'State',
			locality: 'City',
			district: 'Congressional District'
		},
		GB: {
			country: 'Nationwide',
			region: 'Region',
			locality: 'City',
			district: 'Constituency'
		},
		FR: {
			country: 'National',
			region: 'Région',
			locality: 'Commune',
			district: 'Circonscription'
		},
		JP: {
			country: 'National',
			region: 'Prefecture',
			locality: 'Municipality',
			district: 'District'
		},
		BR: {
			country: 'National',
			region: 'State',
			locality: 'Municipality',
			district: 'District'
		}
	};

	return descriptions[countryCode]?.[level] || level;
}
