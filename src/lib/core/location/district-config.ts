/**
 * International District Terminology Configuration
 *
 * Polymorphic configuration for legislative districts across countries.
 * Each country has different terminology, resolution mechanisms, and input requirements.
 *
 * PERCEPTUAL ENGINEERING:
 * - Labels adapt to user's country context (recognition over recall)
 * - Resolution mechanism abstracts API differences
 * - Input requirements minimize friction per country
 *
 * ADAPTER STATUS:
 * - census-bureau (US): ✅ Implemented
 * - uk-postcodes (GB): ❌ Not yet implemented
 * - france-geo (FR): ❌ Not yet implemented
 * - japan-districts (JP): ❌ Not yet implemented
 * - brazil-tse (BR): ❌ Not yet implemented
 */

/** Resolvers that are actually implemented and working */
export const IMPLEMENTED_RESOLVERS = new Set<string>(['census-bureau']);

export interface DistrictConfig {
	/** Full label (e.g., "Congressional District") */
	label: string;

	/** Short label for breadcrumb display */
	shortLabel: string;

	/** Placeholder text for extension affordance (e.g., "+ Your District") */
	placeholder: string;

	/** Resolver type determines which API/method to use */
	resolver: 'census-bureau' | 'uk-postcodes' | 'france-geo' | 'japan-districts' | 'brazil-tse';

	/** Whether street address is required (false = postcode/commune sufficient) */
	requiresStreetAddress: boolean;

	/** Placeholder for street input */
	streetPlaceholder?: string;

	/** Placeholder for postal code input */
	postalPlaceholder?: string;

	/** Postal code pattern for validation */
	postalPattern?: RegExp;

	/** Whether this country has legislative districts at all */
	hasLegislativeDistricts: boolean;
}

/**
 * District configuration by country code (ISO 3166-1 alpha-2)
 */
export const DISTRICT_CONFIG: Record<string, DistrictConfig> = {
	US: {
		label: 'Congressional District',
		shortLabel: 'District',
		placeholder: 'Your District',
		resolver: 'census-bureau',
		requiresStreetAddress: true,
		streetPlaceholder: '1600 Pennsylvania Ave NW',
		postalPlaceholder: 'Zip Code',
		postalPattern: /^\d{5}(-\d{4})?$/,
		hasLegislativeDistricts: true
	},

	GB: {
		label: 'Parliamentary Constituency',
		shortLabel: 'Constituency',
		placeholder: 'Your Constituency',
		resolver: 'uk-postcodes',
		requiresStreetAddress: false, // Postcode sufficient
		postalPlaceholder: 'Postcode (e.g., SW1A 1AA)',
		postalPattern: /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/,
		hasLegislativeDistricts: true
	},

	FR: {
		label: 'Circonscription Législative',
		shortLabel: 'Circonscription',
		placeholder: 'Votre Circonscription',
		resolver: 'france-geo',
		requiresStreetAddress: false, // Commune sufficient
		postalPlaceholder: 'Code Postal (ex: 75001)',
		postalPattern: /^\d{5}$/,
		hasLegislativeDistricts: true
	},

	JP: {
		label: '選挙区',
		shortLabel: '選挙区',
		placeholder: 'あなたの選挙区',
		resolver: 'japan-districts',
		requiresStreetAddress: true,
		streetPlaceholder: '住所',
		postalPlaceholder: '郵便番号 (例: 100-0001)',
		postalPattern: /^\d{3}-?\d{4}$/,
		hasLegislativeDistricts: true
	},

	BR: {
		label: 'Distrito Eleitoral',
		shortLabel: 'Distrito',
		placeholder: 'Seu Distrito',
		resolver: 'brazil-tse',
		requiresStreetAddress: true,
		streetPlaceholder: 'Endereço',
		postalPlaceholder: 'CEP (ex: 01310-100)',
		postalPattern: /^\d{5}-?\d{3}$/,
		hasLegislativeDistricts: true
	}

	// To add a new country:
	// 1. Add config here with appropriate resolver type
	// 2. Create API adapter for that resolver
	// 3. Add resolver to IMPLEMENTED_RESOLVERS
	// 4. Add routing logic in LocationFilter.handleDistrictResolve()
};

/**
 * Get district config for a country code
 * Returns null if:
 * - Country code is not provided
 * - Country doesn't have legislative districts
 * - Country's resolver is not yet implemented
 */
export function getDistrictConfig(countryCode: string | null): DistrictConfig | null {
	if (!countryCode) return null;

	const config = DISTRICT_CONFIG[countryCode.toUpperCase()];

	// Only return config if:
	// 1. The country has legislative districts
	// 2. The resolver is actually implemented
	if (config?.hasLegislativeDistricts && IMPLEMENTED_RESOLVERS.has(config.resolver)) {
		return config;
	}

	return null;
}

/**
 * Format district label for display based on country
 *
 * Examples:
 * - US: "CA-12" → "CA-12" (already formatted)
 * - GB: "Westminster North" → "Westminster North"
 * - FR: "Paris (1re)" → "Paris (1re)"
 */
export function formatDistrictLabel(district: string, config: DistrictConfig): string {
	// For US, ensure proper formatting (STATE-NN)
	if (config.resolver === 'census-bureau') {
		const match = district.match(/^([A-Z]{2})-?(\d+)$/i);
		if (match) {
			const [, state, num] = match;
			return `${state.toUpperCase()}-${num}`;
		}
	}

	// For other countries, return as-is (already localized from resolver)
	return district;
}

/**
 * Timing constants for perceptual coherence
 * All animations use consistent timing to maintain rhythm
 */
export const TIMING = {
	/** Affordance → input expansion */
	EXPAND: 200,

	/** Cancel → return to affordance */
	COLLAPSE: 150,

	/** Minimum spinner duration (feels intentional) */
	RESOLVE_MIN: 400,

	/** Timeout for API call */
	RESOLVE_MAX: 8000,

	/** Checkmark visibility before settling */
	SUCCESS_FLASH: 300,

	/** Error message auto-dismiss */
	ERROR_FADE: 5000
} as const;
