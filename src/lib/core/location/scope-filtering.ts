/**
 * Location-as-Context: Scope-based Template Filtering
 *
 * PHILOSOPHY:
 * - Location provides CONTEXT, not GATING (except where explicitly required)
 * - Templates have varying geographic scopes (international → local)
 * - Broader scopes remain visible as you zoom in (progressive enhancement)
 *
 * KEY INSIGHT:
 * Getting more precise location should ADD local context, not REMOVE global context.
 */

import type { Template } from '$lib/types/template';
import type { InferredLocation } from './types';

// ============================================================================
// Types
// ============================================================================

export type GeographicScope =
	| 'international' // UN, WHO, global corps (Amazon, Google, Meta)
	| 'national' // US Congress (House as body), federal agencies, national corps
	| 'state' // US Senate, state legislature, statewide ballot measures
	| 'metro' // Regional issues (Bay Area housing, transit authorities)
	| 'district' // US House member, state house district
	| 'local'; // City council, school board, local business

export type MinimumPrecision =
	| 'none' // Anyone globally can join
	| 'country' // Need to be in US (for federal issues)
	| 'state' // Need state verification (Senate, state legislature)
	| 'county' // Need county verification (regional coordination)
	| 'district'; // Need district verification (US House, state house)

export type UserPrecisionLevel = 'none' | 'country' | 'state' | 'county' | 'district';

// User precision hierarchy (weakest → strongest)
// none: No location data at all
// country: IP can reliably determine country (VPN-resistant)
// state: IP/OAuth can maybe determine state (VPN-vulnerable)
// county: GPS or partial address
// district: Full address verification

export interface CoordinationBreakdown {
	total: number;
	breakdown?: {
		state?: { code: string; name: string; count: number };
		county?: { name: string; count: number };
		district?: { code: string; count: number };
	};
}

// ============================================================================
// User Precision Calculation
// ============================================================================

/**
 * Determine user's current precision level from inferred location
 *
 * Hierarchy: none → country → state → county → district
 * - country: IP-based (highly reliable, VPN-resistant)
 * - state: IP/OAuth (VPN-vulnerable, may be wrong)
 * - county: GPS or partial address
 * - district: Full verified address
 */
export function getUserPrecisionLevel(location: InferredLocation | null): UserPrecisionLevel {
	if (!location) return 'none';

	// District: Full address verification (highest precision)
	if (location.congressional_district) return 'district';

	// County: GPS or partial address
	if (location.city_name || location.county_fips) return 'county';

	// State: IP/OAuth (may be wrong due to VPN)
	if (location.state_code) return 'state';

	// Country: IP-based (highly reliable, even with VPN)
	if (location.country_code) return 'country';

	return 'none';
}

// ============================================================================
// Precision Requirement Checking
// ============================================================================

/**
 * Check if user meets template's minimum precision requirement
 *
 * Returns true if:
 * - Template requires no precision (anyone can join)
 * - User has sufficient precision AND location matches (if applicable)
 *
 * ARCHITECTURE: Country-First Filtering
 * - Country boundaries are HARD BOUNDARIES (required for legislative adapters)
 * - Templates with applicable_countries ONLY show to users in those countries
 * - This enables US Congress, UK Parliament, Canadian legislatures to coexist
 */
export function meetsMinimumPrecision(
	template: Template,
	userPrecision: UserPrecisionLevel,
	userLocation: InferredLocation | null
): boolean {
	const required = template.minimum_precision_required || 'none';

	// STEP 1: COUNTRY BOUNDARY CHECK (applies to ALL precision levels)
	// If template specifies applicable countries, user MUST be in one of them
	if (template.applicable_countries && template.applicable_countries.length > 0) {
		if (
			!userLocation?.country_code ||
			!template.applicable_countries.includes(userLocation.country_code)
		) {
			// User is in wrong country or country unknown - HARD REJECT
			return false;
		}
	}

	// STEP 2: PRECISION REQUIREMENT CHECK (within country boundary)

	// No precision required - anyone globally can join
	if (required === 'none') return true;

	// Country requirement: User must have country detected (highly reliable via IP)
	if (required === 'country') {
		const hasSufficientPrecision = ['country', 'state', 'county', 'district'].includes(
			userPrecision
		);
		// Country match already verified in STEP 1
		return hasSufficientPrecision;
	}

	// State requirement: User must be in specific state (within country)
	if (required === 'state') {
		const hasSufficientPrecision = ['state', 'county', 'district'].includes(userPrecision);
		const hasMatchingState =
			userLocation?.state_code &&
			template.specific_locations?.some((loc) => loc.includes(userLocation.state_code || ''));

		return hasSufficientPrecision && (hasMatchingState || !template.specific_locations?.length);
	}

	// County requirement: User must have county-level precision
	if (required === 'county') {
		const hasSufficientPrecision = ['county', 'district'].includes(userPrecision);
		// TODO: Add county matching logic when we have county data on templates
		return hasSufficientPrecision && !!userLocation?.county_fips;
	}

	// District requirement: User must have district-level precision
	if (required === 'district') {
		const hasSufficientPrecision = userPrecision === 'district';
		// TODO: Add district matching logic when we have district data on templates
		return hasSufficientPrecision && !!userLocation?.congressional_district;
	}

	return false;
}

// ============================================================================
// Template Filtering
// ============================================================================

/**
 * Filter templates based on user's precision level
 *
 * KEY BEHAVIOR:
 * - Templates are hidden ONLY if user doesn't meet minimum precision requirement
 * - Otherwise, ALL templates are visible (broader scopes remain visible)
 * - This is the opposite of the old behavior which hid broader scopes
 */
export function filterTemplatesByScope(
	templates: Template[],
	userPrecision: UserPrecisionLevel,
	userLocation: InferredLocation | null
): Template[] {
	return templates.filter((template) => {
		// Check if user meets minimum precision requirement
		return meetsMinimumPrecision(template, userPrecision, userLocation);
	});
}

// ============================================================================
// Coordination Count Calculation
// ============================================================================

/**
 * Get coordination count with optional local breakdown
 *
 * For international/national scope templates:
 * - Shows total global count
 * - Adds state/district breakdown if user has that precision
 *
 * For state/district scope templates:
 * - Shows only matching location count (no broader context)
 */
export function getCoordinationCount(
	template: Template,
	userLocation: InferredLocation | null
): CoordinationBreakdown {
	const total = template.send_count || 0;
	const scope = template.geographic_scope || 'national';

	// International/national scope: Show total + breakdown
	if (scope === 'international' || scope === 'national') {
		const breakdown: CoordinationBreakdown['breakdown'] = {};

		// Add state breakdown if user has state precision
		if (userLocation?.state_code) {
			// TODO: Calculate actual state count from template data
			// For now, estimate as 10% of total (placeholder)
			breakdown.state = {
				code: userLocation.state_code,
				name: getStateName(userLocation.state_code),
				count: Math.round(total * 0.1)
			};
		}

		// Add district breakdown if user has district precision
		if (userLocation?.congressional_district) {
			// TODO: Calculate actual district count from template data
			// For now, estimate as 2% of total (placeholder)
			breakdown.district = {
				code: userLocation.congressional_district,
				count: Math.round(total * 0.02)
			};
		}

		return {
			total,
			breakdown: Object.keys(breakdown).length > 0 ? breakdown : undefined
		};
	}

	// State/metro/district/local scope: Just show total (already filtered)
	return { total };
}

/**
 * Format coordination count for display
 */
export function formatCoordinationCount(breakdown: CoordinationBreakdown): string {
	const { total, breakdown: details } = breakdown;

	if (!details) {
		return `${total.toLocaleString()} coordinating`;
	}

	// Build breakdown string
	const parts: string[] = [`${total.toLocaleString()} globally`];

	if (details.state) {
		parts.push(`${details.state.count.toLocaleString()} in ${details.state.name}`);
	}

	if (details.district) {
		parts.push(`${details.district.count.toLocaleString()} in ${details.district.code}`);
	}

	return parts.join(' • ');
}

// ============================================================================
// Template Grouping by Scope
// ============================================================================

export interface TemplateGroup {
	title: string;
	description: string;
	templates: Template[];
	requiresAction?: boolean; // If true, user needs to provide more location data
}

/**
 * Group templates by their relevance to user's location
 *
 * Creates sections:
 * 1. "In Your District" (requires district precision)
 * 2. "In Your State" (requires state precision)
 * 3. "Anyone Can Join" (no precision required)
 */
export function groupTemplatesByScope(
	templates: Template[],
	userPrecision: UserPrecisionLevel,
	userLocation: InferredLocation | null
): TemplateGroup[] {
	const groups: TemplateGroup[] = [];

	// Group 1: District-level (only if user has district precision)
	if (userPrecision === 'district' && userLocation?.congressional_district) {
		const districtTemplates = templates.filter(
			(t) => t.minimum_precision_required === 'district' && t.geographic_scope === 'district'
		);

		if (districtTemplates.length > 0) {
			groups.push({
				title: `In Your District (${userLocation.congressional_district})`,
				description: 'Templates targeting your specific congressional district',
				templates: districtTemplates
			});
		}
	}

	// Group 2: State-level (only if user has state precision)
	if (['state', 'county', 'district'].includes(userPrecision) && userLocation?.state_code) {
		const stateTemplates = templates.filter(
			(t) =>
				t.minimum_precision_required === 'state' &&
				(t.geographic_scope === 'state' || t.geographic_scope === 'metro')
		);

		if (stateTemplates.length > 0) {
			const stateName = getStateName(userLocation.state_code);
			groups.push({
				title: `In Your State (${stateName})`,
				description: 'Templates targeting your state or region',
				templates: stateTemplates
			});
		}
	}

	// Group 3: Anyone can join (no precision required)
	const openTemplates = templates.filter(
		(t) =>
			t.minimum_precision_required === 'none' ||
			t.minimum_precision_required === 'country' ||
			!t.minimum_precision_required
	);

	if (openTemplates.length > 0) {
		groups.push({
			title: 'Anyone Can Join',
			description: 'National and international campaigns open to everyone',
			templates: openTemplates
		});
	}

	// Group 4: Locked (requires more precision)
	const lockedTemplates = templates.filter((t) => {
		return !meetsMinimumPrecision(t, userPrecision, userLocation);
	});

	if (lockedTemplates.length > 0) {
		const needsDistrict = lockedTemplates.some((t) => t.minimum_precision_required === 'district');
		const needsState = lockedTemplates.some((t) => t.minimum_precision_required === 'state');

		let actionText = '';
		if (needsDistrict && userPrecision !== 'district') {
			actionText = 'Enter your address to unlock district-specific campaigns';
		} else if (needsState && !['state', 'county', 'district'].includes(userPrecision)) {
			actionText = 'Enable GPS to unlock state-level campaigns';
		}

		groups.push({
			title: 'Get More Specific',
			description: actionText,
			templates: lockedTemplates,
			requiresAction: true
		});
	}

	return groups;
}

// ============================================================================
// Utility Functions
// ============================================================================

function getStateName(code: string): string {
	const stateNames: Record<string, string> = {
		AL: 'Alabama',
		AK: 'Alaska',
		AZ: 'Arizona',
		AR: 'Arkansas',
		CA: 'California',
		CO: 'Colorado',
		CT: 'Connecticut',
		DE: 'Delaware',
		DC: 'Washington DC',
		FL: 'Florida',
		GA: 'Georgia',
		HI: 'Hawaii',
		ID: 'Idaho',
		IL: 'Illinois',
		IN: 'Indiana',
		IA: 'Iowa',
		KS: 'Kansas',
		KY: 'Kentucky',
		LA: 'Louisiana',
		ME: 'Maine',
		MD: 'Maryland',
		MA: 'Massachusetts',
		MI: 'Michigan',
		MN: 'Minnesota',
		MS: 'Mississippi',
		MO: 'Missouri',
		MT: 'Montana',
		NE: 'Nebraska',
		NV: 'Nevada',
		NH: 'New Hampshire',
		NJ: 'New Jersey',
		NM: 'New Mexico',
		NY: 'New York',
		NC: 'North Carolina',
		ND: 'North Dakota',
		OH: 'Ohio',
		OK: 'Oklahoma',
		OR: 'Oregon',
		PA: 'Pennsylvania',
		RI: 'Rhode Island',
		SC: 'South Carolina',
		SD: 'South Dakota',
		TN: 'Tennessee',
		TX: 'Texas',
		UT: 'Utah',
		VT: 'Vermont',
		VA: 'Virginia',
		WA: 'Washington',
		WV: 'West Virginia',
		WI: 'Wisconsin',
		WY: 'Wyoming',
		PR: 'Puerto Rico',
		GU: 'Guam',
		VI: 'US Virgin Islands',
		AS: 'American Samoa',
		MP: 'Northern Mariana Islands'
	};

	return stateNames[code] || code;
}
