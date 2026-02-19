/**
 * Client-Side Template Filtering
 *
 * Privacy-preserving template discovery.
 * All filtering happens in browser - server NEVER knows user location.
 *
 * Features:
 * - Hierarchical scope-based filtering (country → region → locality → district)
 * - International support (US, UK, France, Japan, Brazil)
 * - Distance-based relevance scoring
 * - Population-based prioritization
 * - Behavioral pattern boosting
 */

import type {
	TemplateWithJurisdictions,
	TemplateJurisdiction,
	InferredLocation,
	ScoredTemplate
} from './types';
import type { ScopeMapping, ScopeLevel } from '$lib/utils/scope-mapper-international';

// ============================================================================
// Template Filter
// ============================================================================

/**
 * Geographic scope filter (breadcrumb selection)
 */
export type GeographicScope = 'district' | 'city' | 'county' | 'state' | 'nationwide' | null;

/**
 * TemplateScope from database (matches Prisma schema)
 */
export interface TemplateScope {
	id: string;
	template_id: string;
	country_code: string;
	region_code?: string | null;
	locality_code?: string | null;
	district_code?: string | null;
	display_text: string;
	scope_level: ScopeLevel;
	confidence: number;
	extraction_method?: string;
}

// ============================================================================
// Hierarchical Scope Matching
// ============================================================================

/**
 * Convert InferredLocation to ScopeMapping for hierarchical matching
 */
function inferredLocationToScope(location: InferredLocation): ScopeMapping {
	// Determine scope level based on most specific location data available
	let scopeLevel: ScopeLevel = 'country';
	let displayText = location.country_code || 'Unknown';

	if (location.congressional_district) {
		scopeLevel = 'district';
		displayText = location.congressional_district;
	} else if (location.city_name) {
		scopeLevel = 'locality';
		displayText = location.city_name;
	} else if (location.state_code) {
		scopeLevel = 'region';
		displayText = location.state_code;
	}

	return {
		country_code: location.country_code || 'US',
		scope_level: scopeLevel,
		display_text: displayText,
		region_code: location.state_code || undefined,
		locality_code: location.city_name || undefined,
		district_code: location.congressional_district || undefined,
		confidence: location.confidence
	};
}

/**
 * Check if template scope matches user location hierarchically
 *
 * Hierarchical matching rules:
 * - User in "CA-12" (district) → matches "CA-12", "California", "Nationwide"
 * - User in "California" (region) → matches "California", "Nationwide" (NOT "CA-12")
 * - User in "US" (country) → matches "Nationwide" only
 *
 * @returns Match level ('district' | 'region' | 'locality' | 'country' | null)
 */
function getHierarchicalMatch(
	userLocation: ScopeMapping,
	templateScope: TemplateScope
): ScopeLevel | null {
	// Country must always match
	if (templateScope.country_code !== userLocation.country_code) {
		return null;
	}

	// Exact match at any level
	if (userLocation.scope_level === templateScope.scope_level) {
		// District-level exact match
		if (
			templateScope.scope_level === 'district' &&
			templateScope.district_code === userLocation.district_code
		) {
			return 'district';
		}

		// Locality-level exact match
		if (
			templateScope.scope_level === 'locality' &&
			templateScope.locality_code === userLocation.locality_code
		) {
			return 'locality';
		}

		// Region-level exact match
		if (
			templateScope.scope_level === 'region' &&
			templateScope.region_code === userLocation.region_code
		) {
			return 'region';
		}

		// Country-level exact match
		if (templateScope.scope_level === 'country') {
			return 'country';
		}
	}

	// Hierarchical fallback: User at more specific level can see broader templates
	// User in district → can see region/country templates in same region/country
	if (userLocation.scope_level === 'district') {
		// District user sees region templates in same region
		if (
			templateScope.scope_level === 'region' &&
			templateScope.region_code === userLocation.region_code
		) {
			return 'region';
		}

		// District user sees country templates in same country
		if (templateScope.scope_level === 'country') {
			return 'country';
		}
	}

	// User in locality → can see region/country templates in same region/country
	if (userLocation.scope_level === 'locality') {
		// Locality user sees region templates in same region
		if (
			templateScope.scope_level === 'region' &&
			templateScope.region_code === userLocation.region_code
		) {
			return 'region';
		}

		// Locality user sees country templates in same country
		if (templateScope.scope_level === 'country') {
			return 'country';
		}
	}

	// User in region → can see country templates in same country (but NOT more specific)
	if (userLocation.scope_level === 'region') {
		// Region user sees country templates in same country
		if (templateScope.scope_level === 'country') {
			return 'country';
		}
	}

	// No match
	return null;
}

/**
 * Convert hierarchical match level to geographic scope for breadcrumb filtering
 */
function matchLevelToGeographicScope(matchLevel: ScopeLevel | null): GeographicScope {
	if (!matchLevel) return null;

	switch (matchLevel) {
		case 'district':
			return 'district';
		case 'locality':
			return 'city'; // Locality maps to city in UI
		case 'region':
			return 'state'; // Region maps to state in UI
		case 'country':
			return 'nationwide';
		default:
			return null;
	}
}

/**
 * ClientSideTemplateFilter: Filter and rank templates by location relevance
 */
export class ClientSideTemplateFilter {
	constructor(
		private inferredLocation: InferredLocation,
		private templates: TemplateWithJurisdictions[],
		private selectedScope: GeographicScope = null
	) {}

	/**
	 * Filter templates by jurisdiction match
	 */
	filterByJurisdiction(): TemplateWithJurisdictions[] {
		if (!this.inferredLocation.congressional_district && !this.inferredLocation.state_code) {
			// No location data - return all templates
			return this.templates;
		}

		return this.templates.filter((template) => {
			return template.jurisdictions.some((jurisdiction) => this.matchesJurisdiction(jurisdiction));
		});
	}

	/**
	 * Score templates by relevance
	 *
	 * NEW: Prioritizes TemplateScope (hierarchical international scoping) over
	 * TemplateJurisdiction (US-only legacy system).
	 *
	 * Scoring strategy:
	 * 1. If template has scopes → use scoreTemplateScope() for hierarchical matching
	 * 2. Else → fall back to scoreJurisdiction() for backward compatibility
	 */
	scoreByRelevance(): ScoredTemplate[] {
		const matched = this.templates
			.map((template) => {
				let bestScore = 0;
				let bestJurisdiction: TemplateJurisdiction | null = null;
				let matchReason = '';

				// PRIORITY 1: Use TemplateScope if available (NEW hierarchical system)
				if (template.scopes && template.scopes.length > 0) {
					for (const scope of template.scopes) {
						const { score, reason } = this.scoreTemplateScope(scope as TemplateScope);

						if (score > bestScore) {
							bestScore = score;
							matchReason = reason;
							// Map scope to jurisdiction for backward compatibility
							bestJurisdiction = null; // No jurisdiction object for scopes
						}
					}
				}
				// FALLBACK: Use TemplateJurisdiction if no scopes (legacy system)
				else if (template.jurisdictions && template.jurisdictions.length > 0) {
					for (const jurisdiction of template.jurisdictions) {
						const { score, reason } = this.scoreJurisdiction(jurisdiction);

						if (score > bestScore) {
							bestScore = score;
							bestJurisdiction = jurisdiction;
							matchReason = reason;
						}
					}
				}

				if (bestScore > 0) {
					// Apply location confidence multiplier
					// High confidence (verified=1.0) → full score
					// Low confidence (IP=0.2) → reduced score certainty
					// EXCEPTION: Country-level templates always get full score (relevant to everyone)
					const isCountryLevel = bestScore === 0.3; // Country-level baseline score
					const confidenceMultiplier = isCountryLevel ? 1.0 : this.inferredLocation.confidence;
					const finalScore = bestScore * confidenceMultiplier;

					// Add confidence indicator to match reason
					const confidenceLabel = isCountryLevel
						? 'national'
						: this.getConfidenceLabel(this.inferredLocation.confidence);
					const enhancedReason = `${matchReason} (${confidenceLabel})`;

					return {
						template,
						score: finalScore,
						matchReason: enhancedReason,
						jurisdiction: bestJurisdiction!
					};
				}

				return null;
			})
			.filter((result): result is ScoredTemplate => result !== null);

		// Sort by score (highest first)
		return matched.sort((a, b) => b.score - a.score);
	}

	/**
	 * Get human-readable confidence label
	 */
	private getConfidenceLabel(confidence: number): string {
		if (confidence >= 0.9) return 'verified';
		if (confidence >= 0.7) return 'high confidence';
		if (confidence >= 0.5) return 'medium confidence';
		if (confidence >= 0.3) return 'low confidence';
		return 'estimated';
	}

	/**
	 * Check if jurisdiction matches user location
	 */
	private matchesJurisdiction(jurisdiction: TemplateJurisdiction): boolean {
		// Exact congressional district match (highest priority)
		if (
			this.inferredLocation.congressional_district &&
			jurisdiction.congressional_district === this.inferredLocation.congressional_district
		) {
			return true;
		}

		// State match (medium priority)
		if (
			this.inferredLocation.state_code &&
			jurisdiction.state_code === this.inferredLocation.state_code
		) {
			return true;
		}

		// County match (medium priority)
		if (
			this.inferredLocation.county_fips &&
			jurisdiction.county_fips === this.inferredLocation.county_fips
		) {
			return true;
		}

		// City match (medium priority)
		if (
			this.inferredLocation.city_name &&
			jurisdiction.city_name?.toLowerCase() === this.inferredLocation.city_name.toLowerCase()
		) {
			return true;
		}

		return false;
	}

	/**
	 * Score jurisdiction by relevance
	 *
	 * Scoring hierarchy (highest to lowest):
	 * 1.0 = District match (most specific)
	 * 0.8 = County match
	 * 0.7 = City match
	 * 0.5 = State match
	 * 0.3 = Federal/national (baseline - always relevant within country)
	 * 0.0 = No match
	 *
	 * NEW: Hierarchical scope matching via TemplateScope table
	 * - Uses international scope hierarchy: country → region → locality → district
	 * - Supports scopes from TemplateScope table (if present)
	 * - Falls back to TemplateJurisdiction for backward compatibility
	 *
	 * Breadcrumb scope boosting:
	 * When user selects a specific breadcrumb level, boost templates matching that level
	 */
	private scoreJurisdiction(jurisdiction: TemplateJurisdiction): { score: number; reason: string } {
		let score = 0;
		let reason = '';
		let matchLevel: GeographicScope = null;

		// Exact congressional district match (1.0 score)
		if (
			this.inferredLocation.congressional_district &&
			jurisdiction.congressional_district === this.inferredLocation.congressional_district
		) {
			score = 1.0;
			matchLevel = 'district';
			reason = `Your district: ${this.inferredLocation.congressional_district}`;
		}
		// County match (0.8 score)
		else if (
			this.inferredLocation.county_fips &&
			jurisdiction.county_fips === this.inferredLocation.county_fips
		) {
			score = 0.8;
			matchLevel = 'county';
			reason = `Your county: ${jurisdiction.county_name || this.inferredLocation.county_fips}`;
		}
		// City match (0.7 score)
		else if (
			this.inferredLocation.city_name &&
			jurisdiction.city_name?.toLowerCase() === this.inferredLocation.city_name.toLowerCase()
		) {
			score = 0.7;
			matchLevel = 'city';
			reason = `Your city: ${this.inferredLocation.city_name}`;
		}
		// State match (0.5 score)
		else if (
			this.inferredLocation.state_code &&
			jurisdiction.state_code === this.inferredLocation.state_code
		) {
			score = 0.5;
			matchLevel = 'state';
			reason = `Your state: ${this.inferredLocation.state_code}`;
		}
		// Federal/national templates (0.3 baseline - always relevant within country)
		// Country boundaries enforced by scope-filtering.ts
		else if (jurisdiction.jurisdiction_type === 'federal') {
			score = 0.3;
			matchLevel = 'nationwide';
			reason = `National issue (${this.inferredLocation.country_code || 'country-wide'})`;
		}

		const baseScore = score;

		// Apply breadcrumb scope boost
		if (score > 0 && this.selectedScope && matchLevel === this.selectedScope) {
			// Boost templates matching the selected breadcrumb level by 30%
			const boostedScore = Math.min(1.0, score * 1.3);
			console.debug('[TemplateFilter] 🎯 Breadcrumb boost applied:', {
				matchLevel,
				selectedScope: this.selectedScope,
				baseScore,
				boostedScore,
				boost: '+30%'
			});
			score = boostedScore;
		}

		return { score, reason };
	}

	/**
	 * Score template using hierarchical scope matching (TemplateScope table)
	 *
	 * This is the NEW scoring method that uses the TemplateScope table
	 * for international hierarchical matching.
	 *
	 * Score hierarchy:
	 * 1.0 = Exact district match
	 * 0.7 = Exact locality match
	 * 0.5 = Exact region match
	 * 0.3 = Country match (baseline)
	 * 0.0 = No match
	 */
	private scoreTemplateScope(templateScope: TemplateScope): { score: number; reason: string } {
		// Convert InferredLocation to ScopeMapping for hierarchical matching
		const userScope = inferredLocationToScope(this.inferredLocation);

		// Get hierarchical match level
		const matchLevel = getHierarchicalMatch(userScope, templateScope);

		if (!matchLevel) {
			return { score: 0, reason: 'No scope match' };
		}

		// Score based on match level
		let score = 0;
		let reason = '';

		switch (matchLevel) {
			case 'district':
				score = 1.0;
				reason = `Your district: ${templateScope.display_text}`;
				break;
			case 'locality':
				score = 0.7;
				reason = `Your city: ${templateScope.display_text}`;
				break;
			case 'region':
				score = 0.5;
				reason = `Your state: ${templateScope.display_text}`;
				break;
			case 'country':
				score = 0.3;
				reason = `Nationwide (${templateScope.country_code})`;
				break;
		}

		const baseScore = score;

		// Convert hierarchical match level to GeographicScope for breadcrumb boost
		const geographicScope = matchLevelToGeographicScope(matchLevel);

		// Apply breadcrumb scope boost
		if (score > 0 && this.selectedScope && geographicScope === this.selectedScope) {
			const boostedScore = Math.min(1.0, score * 1.3);
			console.debug('[TemplateFilter] 🎯 Scope breadcrumb boost applied:', {
				matchLevel,
				geographicScope,
				selectedScope: this.selectedScope,
				baseScore,
				boostedScore,
				boost: '+30%'
			});
			score = boostedScore;
		}

		return { score, reason };
	}
}

// ============================================================================
// Public API Functions
// ============================================================================

/**
 * Filter templates by user location
 */
export function filterTemplatesByLocation(
	templates: TemplateWithJurisdictions[],
	location: InferredLocation
): TemplateWithJurisdictions[] {
	const filter = new ClientSideTemplateFilter(location, templates);
	return filter.filterByJurisdiction();
}

/**
 * Score templates by relevance to user location
 */
export function scoreTemplatesByRelevance(
	templates: TemplateWithJurisdictions[],
	location: InferredLocation,
	selectedScope: GeographicScope = null
): ScoredTemplate[] {
	const filter = new ClientSideTemplateFilter(location, templates, selectedScope);
	return filter.scoreByRelevance();
}

// ============================================================================
// Distance Calculation (for proximity scoring)
// ============================================================================

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const R = 6371; // Earth's radius in kilometers

	const dLat = toRadians(lat2 - lat1);
	const dLon = toRadians(lon2 - lon1);

	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	return R * c;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
	return degrees * (Math.PI / 180);
}

/**
 * Score templates by proximity (if location coordinates available)
 */
export function scoreByProximity(
	templates: TemplateWithJurisdictions[],
	userLat: number,
	userLon: number,
	maxDistance = 100 // kilometers
): ScoredTemplate[] {
	return templates
		.map((template) => {
			// Find closest jurisdiction
			let minDistance = Infinity;
			let closestJurisdiction: TemplateJurisdiction | null = null;

			for (const jurisdiction of template.jurisdictions) {
				if (jurisdiction.latitude && jurisdiction.longitude) {
					const distance = calculateDistance(
						userLat,
						userLon,
						jurisdiction.latitude,
						jurisdiction.longitude
					);

					if (distance < minDistance) {
						minDistance = distance;
						closestJurisdiction = jurisdiction;
					}
				}
			}

			if (closestJurisdiction && minDistance <= maxDistance) {
				// Score inversely proportional to distance
				const score = 1 - minDistance / maxDistance;
				return {
					template,
					score,
					matchReason: `${Math.round(minDistance)} km away`,
					jurisdiction: closestJurisdiction
				};
			}

			return null;
		})
		.filter((result): result is ScoredTemplate => result !== null)
		.sort((a, b) => b.score - a.score);
}

// ============================================================================
// Contextual Boosting (Network Effects)
// ============================================================================

/**
 * Boost templates with high local adoption
 */
export function boostByLocalAdoption(
	scoredTemplates: ScoredTemplate[],
	adoptionData: Map<string, number> // templateId → adoption count
): ScoredTemplate[] {
	return scoredTemplates.map((item) => {
		const adoptionCount = adoptionData.get(item.template.id) || 0;

		// Network effect boost (logarithmic scale)
		const adoptionBoost = adoptionCount > 0 ? 1 + Math.log10(adoptionCount) * 0.1 : 1;

		return {
			...item,
			score: item.score * adoptionBoost
		};
	});
}

/**
 * Boost templates with recent activity
 */
export function boostByRecency(
	scoredTemplates: ScoredTemplate[],
	activityData: Map<string, Date> // templateId → last activity
): ScoredTemplate[] {
	const now = Date.now();
	const dayInMs = 24 * 60 * 60 * 1000;

	return scoredTemplates.map((item) => {
		const lastActivity = activityData.get(item.template.id);

		if (!lastActivity) {
			return item;
		}

		const daysSinceActivity = (now - lastActivity.getTime()) / dayInMs;

		// Recency boost (exponential decay)
		const recencyBoost = Math.exp(-daysSinceActivity / 7); // Half-life of 7 days

		return {
			...item,
			score: item.score * (1 + recencyBoost * 0.3)
		};
	});
}

/**
 * Boost templates based on user's personal viewing behavior
 * Templates viewed more often by this user get boosted in relevance
 */
export function boostByUserBehavior(
	scoredTemplates: ScoredTemplate[],
	viewCounts: Map<string, number> // templateId → view count for this user
): ScoredTemplate[] {
	return scoredTemplates.map((item) => {
		const viewCount = viewCounts.get(item.template.id) || 0;

		if (viewCount === 0) {
			return item;
		}

		// Revealed preference boost
		// 1 view = 1.1x, 2 views = 1.2x, 3+ views = 1.3x (logarithmic scale)
		const behaviorBoost = 1 + Math.min(0.3, Math.log10(viewCount + 1) * 0.2);

		return {
			...item,
			score: item.score * behaviorBoost
		};
	});
}
