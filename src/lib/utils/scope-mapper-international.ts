/**
 * International Geographic Scope Types
 *
 * Type definitions for geographic scope mapping.
 * Universal semantic hierarchy: country -> region -> locality -> district
 */

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
