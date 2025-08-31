import { json } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import { analyzeCascade, hasActivationData } from '$lib/server/cascade-analytics-fixed';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	const timeframe = url.searchParams.get('timeframe') || '7d';
	const userId = locals.user?.id;
	
	if (!userId) {
		return json({
			success: false,
			error: 'Authentication required'
		}, { status: 401 });
	}
	
	try {
		// Calculate timeframe bounds
		const timeframeDays = timeframe === '24h' ? 1 : timeframe === '7d' ? 7 : 30;
		const startDate = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000);
		
		// Get user's templates
		const userTemplates = await db.template.findMany({
			where: {
				user_id: userId,
				created_at: {
					gte: startDate
				}
			},
			include: {
				template_campaign: {
					where: {
						created_at: {
							gte: startDate
						}
					}
				}
			}
		});
		
		// Calculate overview metrics
		const totalTemplates = userTemplates.length;
		const activeCampaigns = userTemplates.filter(t => 
			t.template_campaign.some(c => c.status === 'delivered' || c.status === 'pending')
		).length;
		
		const totalActivations = userTemplates.reduce((sum, template) => 
			sum + template.template_campaign.filter(c => c.status === 'delivered').length, 0
		);
		
		// Calculate viral coefficients for each template (sample calculation)
		let totalViralCoeff = 0;
		let templatesWithMetrics = 0;
		
		const topPerformers = [];
		
		for (const template of userTemplates.slice(0, 10)) { // Limit for performance
			try {
				// Check if template has REAL cascade data
				const hasCascadeData = await hasActivationData(template.id);
				
				if (hasCascadeData) {
					const metrics = await analyzeCascade(template.id);
					const viralCoeff = metrics.r0 * (1 - metrics.temporal_decay);
					totalViralCoeff += viralCoeff;
					templatesWithMetrics++;
					
					topPerformers.push({
						id: template.id,
						title: template.title,
						activations: template.template_campaign.length,
						viral_status: getViralStatus(metrics.r0),
						viral_coefficient: viralCoeff,
						has_cascade_data: true
					});
				} else {
					// Template has delivery data but no cascade data yet
					topPerformers.push({
						id: template.id,
						title: template.title,
						activations: template.template_campaign.length,
						viral_status: 'no_cascade_data',
						viral_coefficient: 0,
						has_cascade_data: false
					});
				}
			} catch (error) {
				console.warn(`Could not analyze template ${template.id}:`, error);
				topPerformers.push({
					id: template.id,
					title: template.title,
					activations: template.template_campaign.length,
					viral_status: 'error',
					viral_coefficient: 0,
					has_cascade_data: false
				});
			}
		}
		
		const avgViralCoefficient = templatesWithMetrics > 0 ? totalViralCoeff / templatesWithMetrics : 0;
		
		// Sort top performers by viral coefficient
		topPerformers.sort((a, b) => b.viral_coefficient - a.viral_coefficient);
		
		// Generate recent activity (mock data - in real implementation, track actual events)
		const recentActivity = [
			{
				timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
				event: 'activation_spike',
				template_id: userTemplates[0]?.id || 'unknown',
				template_title: userTemplates[0]?.title || 'Unknown Template'
			},
			{
				timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
				event: 'template_created',
				template_id: userTemplates[1]?.id || 'unknown',
				template_title: userTemplates[1]?.title || 'New Template'
			},
			{
				timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
				event: 'campaign_launched',
				template_id: userTemplates[0]?.id || 'unknown',
				template_title: userTemplates[0]?.title || 'Campaign Template'
			}
		].filter(activity => activity.template_id !== 'unknown');
		
		return json({
			success: true,
			overview: {
				total_templates: totalTemplates,
				active_campaigns: activeCampaigns,
				total_activations: totalActivations,
				avg_viral_coefficient: avgViralCoefficient,
				top_performers: topPerformers.slice(0, 5),
				recent_activity: recentActivity
			},
			timeframe,
			generated_at: new Date().toISOString()
		});
		
	} catch (error) {
		console.error('Overview analysis failed:', error);
		
		return json({
			success: false,
			error: 'Failed to generate campaign overview',
			details: error instanceof Error ? error.message : 'Unknown error'
		}, { status: 500 });
	}
};

function getViralStatus(r0: number): string {
	if (r0 > 2.0) return 'highly_viral';
	if (r0 > 1.5) return 'viral';
	if (r0 > 1.0) return 'spreading';
	if (r0 > 0.5) return 'slow_growth';
	return 'stagnant';
}