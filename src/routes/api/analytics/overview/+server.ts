import { db } from '$lib/core/db';
import {
	analyzeCascade,
	hasActivationData
} from '$lib/experimental/cascade/cascade-analytics-fixed';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	const timeframe = url.searchParams.get('timeframe') || '7d';
	const userId = locals.user?.id;

	if (!userId) {
		return json(
			{
				success: false,
				error: 'Authentication required'
			},
			{ status: 401 }
		);
	}

	try {
		// Calculate timeframe bounds
		const timeframeDays = timeframe === '24h' ? 1 : timeframe === '7d' ? 7 : 30;
		const startDate = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000);

		// Get real-time analytics data from our new system
		const userSessions = await db.user_session.findMany({
			where: {
				userId: userId,
				session_start: {
					gte: startDate
				}
			},
			include: {
				analytics_events: {
					where: {
						timestamp: {
							gte: startDate
						}
					}
				}
			}
		});

		// Get user's templates with analytics
		const userTemplates = await db.template.findMany({
			where: {
				userId: userId,
				createdAt: {
					gte: startDate
				}
			},
			include: {
				template_campaign: {
					where: {
						createdAt: {
							gte: startDate
						}
					}
				},
				analytics_events: {
					where: {
						timestamp: {
							gte: startDate
						}
					}
				}
			}
		});

		// Calculate enhanced overview metrics
		const totalTemplates = userTemplates.length;
		const activeCampaigns = userTemplates.filter((t) => {
			const campaigns = (t as any).template_campaign;
			return campaigns?.some((c: unknown) => c.status === 'delivered' || c.status === 'pending');
		}).length;

		const totalActivations = userTemplates.reduce((sum, template) => {
			const campaigns = (template as any).template_campaign;
			return sum + (campaigns?.filter((c: unknown) => c.status === 'delivered').length || 0);
		}, 0);

		// Calculate analytics metrics
		const totalSessions = userSessions.length;
		const totalPageViews = userSessions.reduce((sum, session) => sum + session.page_views, 0);
		const totalEvents = userSessions.reduce((sum, session) => sum + session.events_count, 0);
		const conversionRate =
			totalSessions > 0 ? userSessions.filter((s) => s.converted).length / totalSessions : 0;

		// Template interaction analytics
		const templateViews = userTemplates.reduce(
			(sum, template) =>
				sum +
				template.analytics_events.filter((e: unknown) => e.event_name === 'template_viewed').length,
			0
		);

		const templateShares = userTemplates.reduce(
			(sum, template) =>
				sum +
				template.analytics_events.filter((e: unknown) => e.event_name === 'template_shared').length,
			0
		);

		// Calculate viral coefficients for each template (sample calculation)
		let totalViralCoeff = 0;
		let templatesWithMetrics = 0;

		const topPerformers = [];

		for (const template of userTemplates.slice(0, 10)) {
			// Limit for performance
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
			} catch (_error) {
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

		const avgViralCoefficient =
			templatesWithMetrics > 0 ? totalViralCoeff / templatesWithMetrics : 0;

		// Sort top performers by viral coefficient
		topPerformers.sort((a, b) => b.viral_coefficient - a.viral_coefficient);

		// Generate recent activity from real analytics events
		const recentEvents = await db.analytics_event.findMany({
			where: {
				userId: userId,
				timestamp: {
					gte: startDate
				},
				event_name: {
					in: ['template_viewed', 'template_used', 'template_shared', 'auth_completed']
				}
			},
			include: {
				template: {
					select: {
						title: true
					}
				}
			},
			orderBy: {
				timestamp: 'desc'
			},
			take: 10
		});

		const recentActivity = recentEvents.map((event) => ({
			timestamp: event.timestamp.toISOString(),
			event: event.event_name,
			template_id: event.template_id,
			template_title: event.template?.title || 'Unknown Template',
			event_properties: event.event_properties
		}));

		return json({
			success: true,
			overview: {
				// Core metrics
				total_templates: totalTemplates,
				active_campaigns: activeCampaigns,
				total_activations: totalActivations,
				avg_viral_coefficient: avgViralCoefficient,

				// Analytics metrics
				total_sessions: totalSessions,
				total_page_views: totalPageViews,
				total_events: totalEvents,
				conversion_rate: conversionRate,
				template_views: templateViews,
				template_shares: templateShares,

				// Performance data
				top_performers: topPerformers.slice(0, 5),
				recent_activity: recentActivity
			},
			timeframe,
			generated_at: new Date().toISOString()
		});
	} catch (_error) {
		console.error('Error:' , _error);

		return json(
			{
				success: false,
				error: 'Failed to generate campaign overview',
				details: _error instanceof Error ? _error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

function getViralStatus(r0: number): string {
	if (r0 > 2.0) return 'highly_viral';
	if (r0 > 1.5) return 'viral';
	if (r0 > 1.0) return 'spreading';
	if (r0 > 0.5) return 'slow_growth';
	return 'stagnant';
}
