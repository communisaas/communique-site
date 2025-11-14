/**
 * Client-Side Template Filtering
 *
 * Privacy-preserving template discovery.
 * All filtering happens in browser - server NEVER knows user location.
 *
 * Features:
 * - Jurisdiction-based filtering (federal, state, county, city)
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

// ============================================================================
// Template Filter
// ============================================================================

/**
 * ClientSideTemplateFilter: Filter and rank templates by location relevance
 */
export class ClientSideTemplateFilter {
	constructor(
		private inferredLocation: InferredLocation,
		private templates: TemplateWithJurisdictions[]
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
	 */
	scoreByRelevance(): ScoredTemplate[] {
		const matched = this.templates
			.map((template) => {
				// Find best matching jurisdiction for this template
				let bestScore = 0;
				let bestJurisdiction: TemplateJurisdiction | null = null;
				let matchReason = '';

				for (const jurisdiction of template.jurisdictions) {
					const { score, reason } = this.scoreJurisdiction(jurisdiction);

					if (score > bestScore) {
						bestScore = score;
						bestJurisdiction = jurisdiction;
						matchReason = reason;
					}
				}

				if (bestScore > 0 && bestJurisdiction) {
					// Apply location confidence multiplier
					// High confidence (verified=1.0) → full score
					// Low confidence (IP=0.2) → reduced score certainty
					// EXCEPTION: Federal templates always get full score (relevant to everyone)
					const isFederal = bestJurisdiction.jurisdiction_type === 'federal';
					const confidenceMultiplier = isFederal ? 1.0 : this.inferredLocation.confidence;
					const finalScore = bestScore * confidenceMultiplier;

					// Add confidence indicator to match reason
					const confidenceLabel = isFederal
						? 'national'
						: this.getConfidenceLabel(this.inferredLocation.confidence);
					const enhancedReason = `${matchReason} (${confidenceLabel})`;

					return {
						template,
						score: finalScore,
						matchReason: enhancedReason,
						jurisdiction: bestJurisdiction
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
	 */
	private scoreJurisdiction(jurisdiction: TemplateJurisdiction): { score: number; reason: string } {
		let score = 0;
		let reason = '';

		// Exact congressional district match (1.0 score)
		if (
			this.inferredLocation.congressional_district &&
			jurisdiction.congressional_district === this.inferredLocation.congressional_district
		) {
			score = 1.0;
			reason = `Your district: ${this.inferredLocation.congressional_district}`;
			return { score, reason };
		}

		// County match (0.8 score)
		if (
			this.inferredLocation.county_fips &&
			jurisdiction.county_fips === this.inferredLocation.county_fips
		) {
			score = 0.8;
			reason = `Your county: ${jurisdiction.county_name || this.inferredLocation.county_fips}`;
			return { score, reason };
		}

		// City match (0.7 score)
		if (
			this.inferredLocation.city_name &&
			jurisdiction.city_name?.toLowerCase() === this.inferredLocation.city_name.toLowerCase()
		) {
			score = 0.7;
			reason = `Your city: ${this.inferredLocation.city_name}`;
			return { score, reason };
		}

		// State match (0.5 score)
		if (
			this.inferredLocation.state_code &&
			jurisdiction.state_code === this.inferredLocation.state_code
		) {
			score = 0.5;
			reason = `Your state: ${this.inferredLocation.state_code}`;
			return { score, reason };
		}

		// Federal/national templates (0.3 baseline - always relevant within country)
		// Country boundaries enforced by scope-filtering.ts
		if (jurisdiction.jurisdiction_type === 'federal') {
			score = 0.3;
			reason = `National issue (${this.inferredLocation.country_code || 'country-wide'})`;
			return { score, reason };
		}

		// No match
		return { score: 0, reason: 'No location match' };
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
	location: InferredLocation
): ScoredTemplate[] {
	const filter = new ClientSideTemplateFilter(location, templates);
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
