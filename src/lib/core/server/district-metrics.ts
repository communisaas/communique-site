import { db } from '$lib/core/db';

export interface DistrictCoverageMetrics {
	districts_covered: number;
	total_districts: number;
	district_coverage_percent: number;
	states_covered: number;
	total_states: number;
}

/**
 * Calculate user geographic spread for a cross-district template
 * based on which districts the USERS are from, not which districts are targeted
 */
export async function calculateUserGeographicSpread(
	templateId: string
): Promise<DistrictCoverageMetrics> {
	try {
		// Get all campaigns with user data for this template
		const campaigns = await db.template_campaign.findMany({
			where: {
				template_id: templateId,
				status: { in: ['delivered', 'confirmed'] } // Successful uses only
			},
			include: {
				template: {
					include: {
						user: {
							select: {
								congressional_district: true,
								state: true
							}
						}
					}
				}
			}
		});

		if (campaigns.length === 0) {
			return {
				districts_covered: 0,
				total_districts: 435,
				district_coverage_percent: 0,
				states_covered: 0,
				total_states: 50
			};
		}

		// Extract unique districts from USERS who used this template
		const userDistricts = campaigns
			.map((campaign) => campaign.template.user?.congressional_district)
			.filter(Boolean) as string[];

		const userStates = campaigns
			.map((campaign) => campaign.template.user?.state)
			.filter(Boolean) as string[];

		const uniqueDistricts = new Set(userDistricts);
		const uniqueStates = new Set(userStates);

		const districts_covered = uniqueDistricts.size;
		const total_districts = 435; // Total House districts
		const district_coverage_percent =
			total_districts > 0 ? Math.round((districts_covered / total_districts) * 100) : 0;

		return {
			districts_covered,
			total_districts,
			district_coverage_percent,
			states_covered: uniqueStates.size,
			total_states: 50
		};
	} catch (_error) {
		return {
			districts_covered: 0,
			total_districts: 435,
			district_coverage_percent: 0,
			states_covered: 0,
			total_states: 50
		};
	}
}

/**
 * Update template metrics with current district coverage
 */
export async function updateTemplateDistrictMetrics(templateId: string): Promise<void> {
	try {
		const coverage = await calculateUserGeographicSpread(templateId);

		// Get current template metrics
		const template = await db.template.findUnique({
			where: { id: templateId },
			select: { metrics: true }
		});

		if (!template) return;

		// Merge new district metrics with existing metrics
		const currentMetrics = (template.metrics as Record<string, unknown>) || {};
		const updatedMetrics = {
			...currentMetrics,
			districts_covered: coverage.districts_covered,
			total_districts: coverage.total_districts,
			district_coverage_percent: coverage.district_coverage_percent
		};

		// Update template with new metrics
		await db.template.update({
			where: { id: templateId },
			data: { metrics: updatedMetrics }
		});
	} catch (_error) {}
}

// Export alias for backwards compatibility
export const getDistrictMetrics = calculateUserGeographicSpread;

/**
 * Batch update district metrics for all congressional templates
 */
export async function updateAllCongressionalTemplateMetrics(): Promise<void> {
	try {
		// Get all congressional templates
		const templates = await db.template.findMany({
			where: {
				deliveryMethod: 'certified' // Congressional templates use 'certified'
			},
			select: { id: true }
		});

		// Update metrics for each template
		for (const template of templates) {
			await updateTemplateDistrictMetrics(template.id);
		}
	} catch (_error) {}
}
