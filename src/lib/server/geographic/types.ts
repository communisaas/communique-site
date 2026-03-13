/**
 * Geographic expansion type definitions.
 */

// ── Jurisdiction types ──

/** US 24-slot jurisdictions + international equivalents */
export type JurisdictionType =
	| 'congressional'
	| 'federal-senate'
	| 'state-senate'
	| 'state-house'
	| 'county'
	| 'city'
	| 'city-council'
	| 'unified-school'
	| 'elementary-school'
	| 'secondary-school'
	| 'community-college'
	| 'water'
	| 'fire'
	| 'transit'
	| 'hospital'
	| 'library'
	| 'park'
	| 'conservation'
	| 'utility'
	| 'judicial'
	| 'township'
	| 'precinct'
	// International
	| 'uk-constituency'
	| 'uk-council'
	| 'ca-riding'
	| 'au-electorate';

export type CountryCode = 'US' | 'GB' | 'CA' | 'AU' | 'FR' | 'JP' | 'BR';

export interface ResolverResult {
	districtId: string;
	districtName: string;
	districtType: JurisdictionType;
	country: CountryCode;
	/** Additional data from resolver (council, province, state, etc.) */
	extra?: Record<string, string>;
}

export interface InternationalRepresentativeData {
	id: string;
	countryCode: CountryCode;
	constituencyId: string;
	constituencyName: string;
	name: string;
	party: string | null;
	chamber: string | null;
	office: string | null;
	phone: string | null;
	email: string | null;
	websiteUrl: string | null;
}

export interface FuzzyMatchResult {
	pattern: string;
	canonical: string;
	country: CountryCode;
	scopeLevel: 'country' | 'region' | 'locality' | 'district';
	confidence: number;
}

// ── Validation ──

export const VALID_JURISDICTIONS: JurisdictionType[] = [
	'congressional', 'federal-senate', 'state-senate', 'state-house',
	'county', 'city', 'city-council',
	'unified-school', 'elementary-school', 'secondary-school', 'community-college',
	'water', 'fire', 'transit', 'hospital', 'library', 'park',
	'conservation', 'utility', 'judicial', 'township', 'precinct',
	'uk-constituency', 'uk-council', 'ca-riding', 'au-electorate'
];

export const VALID_COUNTRY_CODES: CountryCode[] = ['US', 'GB', 'CA', 'AU', 'FR', 'JP', 'BR'];

export const SUPPORTED_RESOLVER_COUNTRIES: CountryCode[] = ['US', 'GB', 'CA', 'AU'];

export const COUNTRY_LABELS: Record<CountryCode, string> = {
	US: 'United States',
	GB: 'United Kingdom',
	CA: 'Canada',
	AU: 'Australia',
	FR: 'France',
	JP: 'Japan',
	BR: 'Brazil'
};
