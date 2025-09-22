import { json } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import {
	analyzeCascade,
	hasActivationData
} from '$lib/experimental/cascade/cascade-analytics-fixed';
import type { AnalyticsSession, AnalyticsEvent } from '$lib/types/analytics';
import { getSessionMetrics } from '$lib/types/analytics';
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

		// Get real-time analytics data from new consolidated analytics_session table
		const userSessions = await db.analytics_session.findMany({
			where: {
				user_id: userId,
				created_at: {
					gte: startDate
				}
			}
		});

		// Get user's templates with campaigns
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
						created_at: {
							gte: startDate
						}
					}
				}
			}
		});

		// Get analytics events separately
		const analyticsEvents = await db.analytics_event.findMany({
			where: {
				user_id: userId,
				timestamp: {
					gte: startDate
				}
			}
		});

		// Calculate enhanced overview metrics
		const totalTemplates = userTemplates.length;
		const activeCampaigns = userTemplates.filter((t) => {
			return t.template_campaign?.some((c) => c.status === 'delivered' || c.status === 'pending');
		}).length;

		const totalActivations = userTemplates.reduce((sum, template) => {
			return (
				sum + (template.template_campaign?.filter((c) => c.status === 'delivered').length || 0)
			);
		}, 0);

		// Calculate analytics metrics from new consolidated session data
		const totalSessions = userSessions.length;
		const totalPageViews = userSessions.reduce((sum, session) => {
			const metrics = getSessionMetrics(session.session_metrics);
			return sum + metrics.page_views;
		}, 0);
		const totalEvents = userSessions.reduce((sum, session) => {
			const metrics = getSessionMetrics(session.session_metrics);
			return sum + metrics.events_count;
		}, 0);
		const totalConversions = userSessions.reduce((sum, session) => {
			const metrics = getSessionMetrics(session.session_metrics);
			return sum + (metrics.conversion_count || 0);
		}, 0);
		const conversionRate = totalSessions > 0 ? totalConversions / totalSessions : 0;

		// Template interaction analytics
		const templateViews = analyticsEvents.filter((e) => e.name === 'template_viewed').length;
		const templateShares = analyticsEvents.filter((e) => e.name === 'template_shared').length;

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
						activations: template.template_campaign?.length || 0,
						viral_status: getViralStatus(metrics.r0),
						viral_coefficient: viralCoeff,
						has_cascade_data: true
					});
				} else {
					// Template has delivery data but no cascade data yet
					topPerformers.push({
						id: template.id,
						title: template.title,
						activations: template.template_campaign?.length || 0,
						viral_status: 'no_cascade_data',
						viral_coefficient: 0,
						has_cascade_data: false
					});
				}
			} catch (err) {
				console.warn(`Could not analyze template`,err);
				topPerformers.push({
					id: template.id,
					title: template.title,
					activations: template.template_campaign?.length || 0,
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
				user_id: userId,
				timestamp: {
					gte: startDate
				},
				name: {
					in: ['template_viewed', 'template_used', 'template_shared', 'auth_completed']
				}
			},
			orderBy: {
				timestamp: 'desc'
			},
			take: 10
		});

		const recentActivity = recentEvents.map((event) => ({
			timestamp: event.timestamp.toISOString(),
			event: event.name,
			template_id: event.template_id,
			template_title: event.template_id ? 'Template' : null, // Could be enhanced with template lookup
			event_properties: event.properties || {}
		}));

		return json({
			success: true,
			overview: {
				// Core metrics
				total_templates: totalTemplates,
				active_campaigns: activeCampaigns,
				total_activations: totalActivations,
				avg_viral_coefficient: avgViralCoefficient,

				// Analytics metrics from consolidated session data
				total_sessions: totalSessions,
				total_page_views: totalPageViews,
				total_events: totalEvents,
				total_conversions: totalConversions,
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
	} catch (err) {
		console.error('Error occurred');

		return json(
			{
				success: false,
				error: 'Failed to generate campaign overview',
				details: err instanceof Error ? err.message : 'Unknown error'
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
