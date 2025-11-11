/**
 * Contextual Boosting for Search Ranking
 *
 * Applies multi-dimensional boosting to raw similarity scores:
 * 1. Geographic proximity (2x boost for local templates)
 * 2. Temporal relevance (1.5x boost for trending templates)
 * 3. Network effects (3x boost for templates with local adoption)
 * 4. Impact/quality (2x boost for high-quality templates)
 *
 * Privacy: All boosting happens client-side using public data
 */

import type { TemplateWithEmbedding, InferredLocation, BoostingFactors } from './types';

export class ContextualBooster {
	private userLocation: InferredLocation | null;
	private templates: TemplateWithEmbedding[];
	private now: Date;

	constructor(userLocation: InferredLocation | null, templates: TemplateWithEmbedding[]) {
		this.userLocation = userLocation;
		this.templates = templates;
		this.now = new Date();
	}

	/**
	 * Geographic proximity boost (0.0 - 2.0)
	 *
	 * Logic:
	 * - Same congressional district: 2.0x boost
	 * - Same county: 1.8x boost
	 * - Same city: 1.6x boost
	 * - Same state: 1.3x boost
	 * - Federal (applies everywhere): 1.1x boost
	 * - No match: 1.0x (no boost)
	 */
	calculateGeographicBoost(template: TemplateWithEmbedding): number {
		// No user location available
		if (!this.userLocation) {
			return 1.0;
		}

		// No jurisdictions defined for template
		if (!template.jurisdictions || template.jurisdictions.length === 0) {
			return 1.0;
		}

		let maxBoost = 1.0;

		for (const jurisdiction of template.jurisdictions) {
			// Federal templates (apply everywhere)
			if (jurisdiction.jurisdiction_type === 'federal') {
				maxBoost = Math.max(maxBoost, 1.1);
			}

			// Congressional district match (highest priority)
			if (
				jurisdiction.congressional_district &&
				this.userLocation.congressional_district &&
				jurisdiction.congressional_district === this.userLocation.congressional_district
			) {
				maxBoost = Math.max(maxBoost, 2.0);
			}

			// County match
			if (
				jurisdiction.county_fips &&
				this.userLocation.county_fips &&
				jurisdiction.county_fips === this.userLocation.county_fips
			) {
				maxBoost = Math.max(maxBoost, 1.8);
			}

			// City match
			if (
				jurisdiction.city_fips &&
				this.userLocation.city_fips &&
				jurisdiction.city_fips === this.userLocation.city_fips
			) {
				maxBoost = Math.max(maxBoost, 1.6);
			}

			// State match
			if (
				jurisdiction.state_code &&
				this.userLocation.state_code &&
				jurisdiction.state_code === this.userLocation.state_code
			) {
				maxBoost = Math.max(maxBoost, 1.3);
			}
		}

		return maxBoost;
	}

	/**
	 * Temporal relevance boost (0.0 - 1.5)
	 *
	 * Logic:
	 * - Recently sent (< 7 days): 1.5x boost
	 * - Recently sent (< 30 days): 1.3x boost
	 * - Recently sent (< 90 days): 1.1x boost
	 * - Older: 1.0x (no boost)
	 * - Never sent: 0.9x (slight penalty)
	 */
	calculateTemporalBoost(_template: TemplateWithEmbedding): number {
		// NOTE: Temporal boosting disabled - send_count and last_sent_at removed from schema
		// Use verified_sends aggregate metric instead (Phase 5 feature)
		return 1.0; // No boost
	}

	/**
	 * Network effects boost (0.0 - 3.0)
	 *
	 * Logic:
	 * - High adoption (>1000 sends): 3.0x boost
	 * - Moderate adoption (>100 sends): 2.0x boost
	 * - Some adoption (>10 sends): 1.5x boost
	 * - Low adoption (<10 sends): 1.0x (no boost)
	 *
	 * Note: In Phase 5, this will incorporate on-chain adoption counts
	 * from local districts (privacy-preserving via hashed commitments)
	 */
	calculateNetworkBoost(_template: TemplateWithEmbedding): number {
		// NOTE: Network boosting disabled - send_count removed from schema
		// Use verified_sends aggregate metric instead (Phase 5 feature)
		return 1.0; // No boost
	}

	/**
	 * Impact/quality boost (0.0 - 2.0)
	 *
	 * Logic:
	 * - High quality (score >= 80): 2.0x boost
	 * - Good quality (score >= 60): 1.5x boost
	 * - Average quality (score >= 40): 1.0x (no boost)
	 * - Low quality (score < 40): 0.7x (penalty)
	 */
	calculateImpactBoost(template: TemplateWithEmbedding): number {
		const quality = template.quality_score || 50;

		if (quality >= 80) {
			return 2.0; // High quality
		} else if (quality >= 60) {
			return 1.5; // Good quality
		} else if (quality >= 40) {
			return 1.0; // Average quality
		}

		return 0.7; // Low quality (penalty)
	}

	/**
	 * Calculate all boosting factors for a template
	 */
	calculateBoost(template: TemplateWithEmbedding): BoostingFactors {
		return {
			geographic: this.calculateGeographicBoost(template),
			temporal: this.calculateTemporalBoost(template),
			network: this.calculateNetworkBoost(template),
			impact: this.calculateImpactBoost(template)
		};
	}

	/**
	 * Apply boost to similarity score
	 * Returns final_score = similarity * total_boost
	 */
	applyBoost(similarity: number, boost: BoostingFactors): number {
		const totalBoost = boost.geographic * boost.temporal * boost.network * boost.impact;
		return similarity * totalBoost;
	}

	/**
	 * Calculate boosted score for a template
	 */
	calculateBoostedScore(
		template: TemplateWithEmbedding,
		similarity: number
	): {
		boost: BoostingFactors;
		final_score: number;
	} {
		const boost = this.calculateBoost(template);
		const final_score = this.applyBoost(similarity, boost);

		return { boost, final_score };
	}
}

/**
 * Create contextual booster instance
 */
export function createContextualBooster(
	userLocation: InferredLocation | null,
	templates: TemplateWithEmbedding[]
): ContextualBooster {
	return new ContextualBooster(userLocation, templates);
}
