/**
 * Jurisdiction Types
 *
 * Types for geographic hierarchy and coarsening.
 */

// =============================================================================
// HIERARCHY
// =============================================================================

/**
 * Jurisdiction hierarchy levels (finest to coarsest)
 */
export interface JurisdictionHierarchy {
	/** Congressional district: 'CA-02', 'NY-14' */
	district?: string;
	/** Metro area: 'SF Bay Area', 'NYC Metro' */
	metro?: string;
	/** State: 'CA', 'NY' */
	state: string;
	/** Region: 'West', 'Northeast' */
	region: string;
	/** National: always 'US' */
	national: string;
}

/**
 * Coarsening level names
 */
export type CoarsenLevel = keyof JurisdictionHierarchy;

/**
 * Ordered levels from finest to coarsest
 */
export const COARSEN_LEVELS: CoarsenLevel[] = ['district', 'metro', 'state', 'region', 'national'];

// =============================================================================
// REGIONS
// =============================================================================

/**
 * US Census regions
 */
export const REGIONS: Record<string, string[]> = {
	Northeast: ['CT', 'ME', 'MA', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT'],
	Southeast: ['AL', 'AR', 'FL', 'GA', 'KY', 'LA', 'MD', 'MS', 'NC', 'SC', 'TN', 'VA', 'WV', 'DC'],
	Midwest: ['IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI'],
	Southwest: ['AZ', 'NM', 'OK', 'TX'],
	West: ['AK', 'CA', 'CO', 'HI', 'ID', 'MT', 'NV', 'OR', 'UT', 'WA', 'WY']
};

/**
 * State to region lookup
 */
export const STATE_TO_REGION: Record<string, string> = Object.entries(REGIONS).reduce(
	(acc, [region, states]) => {
		states.forEach((state) => {
			acc[state] = region;
		});
		return acc;
	},
	{} as Record<string, string>
);

// =============================================================================
// METRO AREAS (simplified)
// =============================================================================

/**
 * Major metro areas for intermediate coarsening
 */
export const METRO_AREAS: Record<string, string[]> = {
	'NYC Metro': ['NY-01', 'NY-02', 'NY-03', 'NY-04', 'NY-05', 'NY-06', 'NY-07', 'NY-08'],
	'LA Metro': ['CA-25', 'CA-26', 'CA-27', 'CA-28', 'CA-29', 'CA-30', 'CA-31', 'CA-32', 'CA-33'],
	'SF Bay Area': ['CA-11', 'CA-12', 'CA-14', 'CA-15', 'CA-16', 'CA-17', 'CA-18', 'CA-19'],
	'Northern California': ['CA-01', 'CA-02', 'CA-03', 'CA-04', 'CA-05', 'CA-06', 'CA-07'],
	'Chicago Metro': ['IL-01', 'IL-02', 'IL-03', 'IL-04', 'IL-05', 'IL-06', 'IL-07'],
	'DC Metro': ['DC-01', 'MD-04', 'MD-05', 'VA-08', 'VA-10', 'VA-11']
};

// =============================================================================
// COARSEN RESULT
// =============================================================================

/**
 * Result of geographic coarsening
 */
export interface CoarsenResult {
	/** Level at which threshold was met */
	level: CoarsenLevel;
	/** Value at that level */
	value: string;
	/** Aggregate count (noisy) */
	count: number;
	/** Whether coarsening was applied */
	coarsened: boolean;
	/** Original level before coarsening */
	original_level?: CoarsenLevel;
	/** Total privacy budget spent (epsilon) */
	epsilon_spent?: number;
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Get region for a state
 */
export function getRegion(state: string): string {
	return STATE_TO_REGION[state.toUpperCase()] ?? 'Unknown';
}

/**
 * Parse jurisdiction string into hierarchy
 */
export function parseJurisdiction(jurisdiction: string): JurisdictionHierarchy {
	const normalized = jurisdiction.toUpperCase();

	// District format: CA-02
	if (normalized.includes('-')) {
		const state = normalized.split('-')[0];
		return {
			district: normalized,
			metro: findMetro(normalized),
			state,
			region: getRegion(state),
			national: 'US'
		};
	}

	// State format: CA
	if (normalized.length === 2) {
		return {
			state: normalized,
			region: getRegion(normalized),
			national: 'US'
		};
	}

	// Region or unknown
	return {
		state: 'XX',
		region: normalized in REGIONS ? normalized : 'Unknown',
		national: 'US'
	};
}

/**
 * Find metro area for a district
 */
function findMetro(district: string): string | undefined {
	for (const [metro, districts] of Object.entries(METRO_AREAS)) {
		if (districts.includes(district)) {
			return metro;
		}
	}
	return undefined;
}
