import { db } from './db';

export interface DistrictCoverageMetrics {
    districts_covered: number;
    total_districts: number;
    district_coverage_percent: number;
    states_covered: number;
    total_states: number;
}

/**
 * Calculate district coverage metrics for a congressional template
 * based on actual campaign deliveries and representative data
 */
export async function calculateDistrictCoverage(templateId: string): Promise<DistrictCoverageMetrics> {
    try {
        // Get all campaigns for this template
        const campaigns = await db.template_campaign.findMany({
            where: {
                template_id: templateId,
                delivery_type: 'congressional', // Only congressional deliveries
                status: { in: ['delivered', 'confirmed'] } // Successful deliveries only
            }
        });

        if (campaigns.length === 0) {
            return {
                districts_covered: 0,
                total_districts: 435, // Total House districts
                district_coverage_percent: 0,
                states_covered: 0,
                total_states: 50
            };
        }

        // Extract unique office codes from successful deliveries
        const officeCodes = campaigns
            .map(campaign => campaign.metadata as any)
            .filter(metadata => metadata?.office_code)
            .map(metadata => metadata.office_code as string);

        // Get representatives for these office codes to determine districts
        const representatives = await db.representative.findMany({
            where: {
                office_code: { in: officeCodes },
                is_active: true
            },
            select: {
                state: true,
                district: true,
                chamber: true
            }
        });

        // Calculate unique House districts (exclude Senate)
        const houseReps = representatives.filter(rep => rep.chamber === 'house');
        const uniqueDistricts = new Set(
            houseReps.map(rep => `${rep.state}-${rep.district}`)
        );
        const uniqueStates = new Set(houseReps.map(rep => rep.state));

        const districts_covered = uniqueDistricts.size;
        const total_districts = 435; // Total House districts
        const district_coverage_percent = total_districts > 0 
            ? Math.round((districts_covered / total_districts) * 100) 
            : 0;

        return {
            districts_covered,
            total_districts,
            district_coverage_percent,
            states_covered: uniqueStates.size,
            total_states: 50
        };

    } catch (error) {
        console.error('Error calculating district coverage:', error);
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
        const coverage = await calculateDistrictCoverage(templateId);
        
        // Get current template metrics
        const template = await db.Template.findUnique({
            where: { id: templateId },
            select: { metrics: true }
        });

        if (!template) return;

        // Merge new district metrics with existing metrics
        const updatedMetrics = {
            ...(template.metrics as any),
            districts_covered: coverage.districts_covered,
            total_districts: coverage.total_districts,
            district_coverage_percent: coverage.district_coverage_percent
        };

        // Update template with new metrics
        await db.Template.update({
            where: { id: templateId },
            data: { metrics: updatedMetrics }
        });

    } catch (error) {
        console.error('Error updating template district metrics:', error);
    }
}

/**
 * Batch update district metrics for all congressional templates
 */
export async function updateAllCongressionalTemplateMetrics(): Promise<void> {
    try {
        // Get all congressional templates
        const templates = await db.Template.findMany({
            where: {
                deliveryMethod: 'both' // Congressional templates use 'both'
            },
            select: { id: true }
        });

        // Update metrics for each template
        for (const template of templates) {
            await updateTemplateDistrictMetrics(template.id);
        }

        console.log(`Updated district metrics for ${templates.length} congressional templates`);
    } catch (error) {
        console.error('Error updating all congressional template metrics:', error);
    }
} 