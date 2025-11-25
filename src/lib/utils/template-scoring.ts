/**
 * Template Scoring: Dual-Signal Ranking (Newness + Coordination)
 *
 * Perceptual Engineering Principle:
 * Users don't choose "new vs popular" - they scan for "what matters to me"
 * Both signals must be visible simultaneously via:
 * - Position (scoring determines sort order)
 * - Visual weight (card scale encodes coordination)
 * - Temporal badge ("New" badge for <72hrs)
 */

export interface TemplateMetrics {
	send_count: number;
	created_at: Date;
	updated_at: Date;
}

export interface ScoredTemplate {
	isNew: boolean;
	coordinationScale: number; // log10(send_count + 1)
	displayScore: number; // Fusion score for sorting
}

/**
 * Determine if template should show "New" badge
 *
 * Criteria:
 * - Created <72 hours ago, OR
 * - Updated <24 hours ago (author edited)
 *
 * Note: Habituation prevention (badge removal after 3 views)
 * is handled in component layer via localStorage
 */
export function isNewTemplate(template: TemplateMetrics, now: Date = new Date()): boolean {
	const hoursSinceCreation = (now.getTime() - template.created_at.getTime()) / (1000 * 60 * 60);
	const hoursSinceUpdate = (now.getTime() - template.updated_at.getTime()) / (1000 * 60 * 60);

	return hoursSinceCreation < 72 || hoursSinceUpdate < 24;
}

/**
 * Calculate fusion score: Newness + Coordination
 *
 * Algorithm:
 * - First 48 hours: 2x recency boost (new templates highly visible)
 * - Days 3-7: 0.5x gentle boost (gradual transition)
 * - After 7 days: pure coordination score
 *
 * Logarithmic coordination prevents dominance:
 * - 10 sends vs 100 sends is only 1 point difference
 * - Allows new templates (2 sends) to compete with established (50 sends)
 */
export function calculateDisplayScore(template: TemplateMetrics, now: Date = new Date()): number {
	const hoursSinceCreation = (now.getTime() - template.created_at.getTime()) / (1000 * 60 * 60);

	// Coordination score (logarithmic to prevent dominance)
	const coordinationScore = Math.log10(template.send_count + 1);

	// Recency boost (linear decay over 7 days = 168 hours)
	const recencyBoost = Math.max(0, 1 - hoursSinceCreation / 168);

	// Fusion: Different boost multipliers by age
	if (hoursSinceCreation < 48) {
		// First 48 hours: 2x newness boost
		return coordinationScore + recencyBoost * 2;
	} else {
		// Days 3-7: 0.5x gentle boost
		return coordinationScore + recencyBoost * 0.5;
	}
}

/**
 * Enrich template with scoring metrics
 */
export function scoreTemplate(template: TemplateMetrics, now: Date = new Date()): ScoredTemplate {
	return {
		isNew: isNewTemplate(template, now),
		coordinationScale: Math.log10(template.send_count + 1),
		displayScore: calculateDisplayScore(template, now)
	};
}

/**
 * Sort templates by display score (descending)
 * Higher score = appears first in list
 */
export function sortTemplatesByScore<T extends ScoredTemplate>(templates: T[]): T[] {
	return [...templates].sort((a, b) => b.displayScore - a.displayScore);
}
