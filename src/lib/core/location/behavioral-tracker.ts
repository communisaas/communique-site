/**
 * Behavioral Location Tracker
 *
 * Infers user location from template engagement patterns.
 * Privacy-preserving: only stores jurisdiction IDs, not template content.
 *
 * Algorithm:
 * 1. Track which templates user views/engages with
 * 2. Extract jurisdiction patterns from template views
 * 3. Compute confidence based on view frequency and consistency
 * 4. Generate high-confidence location signal from revealed preference
 */

import { locationStorage } from './storage';
import type {
	TemplateViewEvent,
	TemplateJurisdiction,
	LocationSignal,
	BehavioralLocationPattern
} from './types';

// ============================================================================
// Behavioral Location Tracker
// ============================================================================

/**
 * BehavioralLocationTracker: Infer location from template engagement
 */
export class BehavioralLocationTracker {
	/**
	 * Track a template view
	 */
	async trackTemplateView(
		templateId: string,
		templateSlug: string,
		jurisdictions: TemplateJurisdiction[]
	): Promise<void> {
		try {
			// Serialize jurisdictions to remove bigint fields (IndexedDB can't clone bigint)
			const serializedJurisdictions = jurisdictions.map((j) => ({
				id: j.id,
				template_id: j.template_id,
				jurisdiction_type: j.jurisdiction_type,
				congressional_district: j.congressional_district || null,
				senate_class: j.senate_class || null,
				state_code: j.state_code || null,
				state_senate_district: j.state_senate_district || null,
				state_house_district: j.state_house_district || null,
				county_fips: j.county_fips || null,
				county_name: j.county_name || null,
				city_name: j.city_name || null,
				city_fips: j.city_fips || null,
				school_district_id: j.school_district_id || null,
				school_district_name: j.school_district_name || null,
				latitude: j.latitude || null,
				longitude: j.longitude || null,
				// Convert bigint to number for storage (safe for population counts)
				estimated_population: j.estimated_population ? Number(j.estimated_population) : null,
				coverage_notes: j.coverage_notes || null
			}));

			const event: TemplateViewEvent = {
				template_id: templateId,
				template_slug: templateSlug,
				jurisdictions: serializedJurisdictions as TemplateJurisdiction[],
				viewed_at: new Date().toISOString()
			};

			await locationStorage.recordTemplateView(event);

			// Trigger location inference after recording view
			await this.inferFromBehavior();
		} catch (error) {
			console.error('Failed to track template view:', error);
		}
	}

	/**
	 * Infer location from behavioral patterns
	 */
	async inferFromBehavior(): Promise<LocationSignal | null> {
		try {
			// Get all template views
			const views = await locationStorage.getTemplateViews();

			if (views.length === 0) {
				return null;
			}

			// Extract jurisdiction patterns
			const patterns = this.extractJurisdictionPatterns(views);

			if (patterns.length === 0) {
				return null;
			}

			// Find highest confidence pattern
			const bestPattern = patterns.reduce((best, current) =>
				current.confidence > best.confidence ? current : best
			);

			// Only generate signal if confidence is high enough
			if (bestPattern.confidence < 0.5) {
				return null;
			}

			// Create location signal from behavioral pattern
			const signal: LocationSignal = {
				signal_type: 'behavioral',
				confidence: bestPattern.confidence,
				congressional_district: bestPattern.congressional_district,
				state_code: bestPattern.state_code,
				source: 'behavioral.template_views',
				timestamp: new Date().toISOString(),
				metadata: {
					view_count: bestPattern.view_count,
					first_seen: bestPattern.first_seen,
					last_seen: bestPattern.last_seen
				}
			};

			// Store behavioral signal
			await locationStorage.storeSignal(signal);

			return signal;
		} catch (error) {
			console.error('Failed to infer location from behavior:', error);
			return null;
		}
	}

	/**
	 * Extract jurisdiction patterns from template views
	 */
	private extractJurisdictionPatterns(views: TemplateViewEvent[]): BehavioralLocationPattern[] {
		// Group views by jurisdiction
		const jurisdictionCounts = new Map<
			string,
			{
				congressional_district: string | null;
				state_code: string | null;
				views: TemplateViewEvent[];
			}
		>();

		for (const view of views) {
			for (const jurisdiction of view.jurisdictions) {
				// Build jurisdiction key
				const key = this.buildJurisdictionKey(jurisdiction);

				if (!jurisdictionCounts.has(key)) {
					jurisdictionCounts.set(key, {
						congressional_district: jurisdiction.congressional_district || null,
						state_code: jurisdiction.state_code || null,
						views: []
					});
				}

				jurisdictionCounts.get(key)!.views.push(view);
			}
		}

		// Convert to patterns with confidence scores
		const patterns: BehavioralLocationPattern[] = [];

		for (const [_key, data] of jurisdictionCounts.entries()) {
			const viewCount = data.views.length;
			const totalViews = views.length;

			// Calculate confidence based on:
			// 1. View frequency (percentage of total views)
			// 2. Consistency (same jurisdiction across multiple views)
			// 3. Recency (recent views weighted higher)

			const frequency = viewCount / totalViews;
			const consistencyBonus = viewCount >= 3 ? 0.2 : 0; // Bonus for 3+ views
			const recencyBonus = this.calculateRecencyBonus(data.views);

			const confidence = Math.min(0.9, frequency + consistencyBonus + recencyBonus);

			const sortedViews = data.views.sort(
				(a, b) => new Date(a.viewed_at).getTime() - new Date(b.viewed_at).getTime()
			);

			patterns.push({
				congressional_district: data.congressional_district,
				state_code: data.state_code,
				view_count: viewCount,
				confidence,
				first_seen: sortedViews[0].viewed_at,
				last_seen: sortedViews[sortedViews.length - 1].viewed_at
			});
		}

		// Sort by confidence (highest first)
		return patterns.sort((a, b) => b.confidence - a.confidence);
	}

	/**
	 * Build jurisdiction key for grouping
	 */
	private buildJurisdictionKey(jurisdiction: TemplateJurisdiction): string {
		const parts: string[] = [];

		if (jurisdiction.congressional_district) {
			parts.push(`cd:${jurisdiction.congressional_district}`);
		}

		if (jurisdiction.state_code) {
			parts.push(`state:${jurisdiction.state_code}`);
		}

		if (jurisdiction.county_fips) {
			parts.push(`county:${jurisdiction.county_fips}`);
		}

		if (jurisdiction.city_fips) {
			parts.push(`city:${jurisdiction.city_fips}`);
		}

		return parts.join('|') || 'unknown';
	}

	/**
	 * Calculate recency bonus (recent views = higher confidence)
	 */
	private calculateRecencyBonus(views: TemplateViewEvent[]): number {
		const now = Date.now();
		const recentThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days

		const recentViews = views.filter((view) => {
			const viewTime = new Date(view.viewed_at).getTime();
			return now - viewTime < recentThreshold;
		});

		// Bonus proportional to recent views
		return recentViews.length > 0 ? 0.1 : 0;
	}

	/**
	 * Get behavioral location patterns (for debugging)
	 */
	async getPatterns(): Promise<BehavioralLocationPattern[]> {
		const views = await locationStorage.getTemplateViews();
		return this.extractJurisdictionPatterns(views);
	}

	/**
	 * Clear behavioral tracking data
	 */
	async clear(): Promise<void> {
		await locationStorage.clearOldTemplateViews();
	}
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Singleton instance for behavioral location tracking
 */
export const behavioralTracker = new BehavioralLocationTracker();

// ============================================================================
// Template View Hook (for Svelte components)
// ============================================================================

/**
 * Track template view (call from template pages)
 */
export async function trackTemplateView(
	templateId: string,
	templateSlug: string,
	jurisdictions: TemplateJurisdiction[]
): Promise<void> {
	await behavioralTracker.trackTemplateView(templateId, templateSlug, jurisdictions);
}

/**
 * Get current behavioral patterns (for debugging)
 */
export async function getBehavioralPatterns(): Promise<BehavioralLocationPattern[]> {
	return behavioralTracker.getPatterns();
}

/**
 * Get template view counts (for behavioral boosting in template scoring)
 */
export async function getTemplateViewCounts(): Promise<Map<string, number>> {
	const views = await locationStorage.getTemplateViews();
	const counts = new Map<string, number>();

	for (const view of views) {
		const currentCount = counts.get(view.template_id) || 0;
		counts.set(view.template_id, currentCount + 1);
	}

	return counts;
}
