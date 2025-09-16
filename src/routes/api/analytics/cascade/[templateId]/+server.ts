import { json } from '@sveltejs/kit';
import {
	analyzeCascade,
	calculateTemplateR0,
	calculateActivationVelocity,
	getTemplateActivationChain,
	hasActivationData
} from '$lib/experimental/cascade/cascade-analytics-fixed';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const { templateId } = params;

	if (!templateId) {
		return json(
			{
				success: false,
				error: 'Template ID required'
			},
			{ status: 400 }
		);
	}

	try {
		// Check if we have real cascade data first
		const hasCascadeData = await hasActivationData(templateId);

		if (!hasCascadeData) {
			return json({
				success: true,
				template_id: templateId,
				cascade_metrics: {
					r0: 0,
					generation_depth: 0,
					activation_velocity: 0,
					geographic_jump_rate: 0,
					temporal_decay: 0
				},
				summary: {
					total_activations: 0,
					viral_coefficient: 0,
					geographic_spread: 0,
					average_time_to_activation_hours: 0,
					viral_status: 'no_data',
					geographic_reach: 'no_data'
				},
				activation_timeline: [],
				recommendations: ['Template has no cascade data yet - start sharing to track viral spread'],
				note: 'Using REAL user_activation data - no cascade activity detected yet'
			});
		}

		// Run comprehensive cascade analysis using REAL data
		const metrics = await analyzeCascade(templateId);
		const activationChain = await getTemplateActivationChain(templateId);

		// Additional derived metrics
		const totalActivations = activationChain.length;
		const uniqueDistricts = new Set(activationChain.map((a) => a.user_id)).size;
		const avgTimeToActivation =
			activationChain
				.filter((a) => a.time_to_activation > 0)
				.reduce((sum, a) => sum + a.time_to_activation, 0) /
			Math.max(1, activationChain.filter((a) => a.time_to_activation > 0).length);

		// Viral coefficient calculation
		const viralCoefficient = metrics.r0 * (1 - metrics.temporal_decay);

		return json({
			success: true,
			template_id: templateId,
			cascade_metrics: metrics,
			summary: {
				total_activations: totalActivations,
				viral_coefficient: viralCoefficient,
				geographic_spread: uniqueDistricts,
				average_time_to_activation_hours: avgTimeToActivation,
				viral_status: getViralStatus(metrics.r0, viralCoefficient),
				geographic_reach: getGeographicReach(metrics.geographic_jump_rate)
			},
			activation_timeline: activationChain.map((a) => ({
				user_id: a.user_id,
				activated_at: a.activated_at,
				generation: a.activation_generation,
				time_to_activation: a.time_to_activation,
				geographic_distance: a.geographic_distance
			})),
			recommendations: generateRecommendations(metrics, viralCoefficient)
		});
	} catch (error) {
		console.error('Cascade analysis failed:', error);

		return json(
			{
				success: false,
				error: 'Failed to analyze template cascade',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

function getViralStatus(r0: number, viralCoefficient: number): string {
	if (viralCoefficient > 1.5) return 'highly_viral';
	if (viralCoefficient > 1.0) return 'viral';
	if (r0 > 0.8) return 'spreading';
	if (r0 > 0.3) return 'slow_growth';
	return 'stagnant';
}

function getGeographicReach(jumpRate: number): string {
	if (jumpRate > 0.7) return 'national';
	if (jumpRate > 0.4) return 'regional';
	if (jumpRate > 0.2) return 'statewide';
	return 'local';
}

function generateRecommendations(metrics: any, viralCoefficient: number): string[] {
	const recommendations = [];

	if (viralCoefficient < 1.0) {
		recommendations.push('Consider optimizing message content for better engagement');
		recommendations.push('Target users in high-connectivity districts');
	}

	if (metrics.geographic_jump_rate < 0.3) {
		recommendations.push('Focus on cross-district sharing to increase geographic spread');
	}

	if (metrics.activation_velocity < 2.0) {
		recommendations.push('Consider timing optimization - peak engagement hours are 7-9pm');
	}

	if (metrics.temporal_decay > 0.8) {
		recommendations.push('Message losing momentum quickly - consider follow-up campaigns');
	}

	if (metrics.generation_depth < 3) {
		recommendations.push('Template not spreading beyond direct connections - improve shareability');
	}

	return recommendations;
}
