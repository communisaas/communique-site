import { json } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import { extractTemplateMetrics } from '$lib/types/templateConfig';
import type { AnalyticsEvent, EnrichedAnalyticsEvent } from '$lib/types/api';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, getClientAddress }) => {
	try {
		const event: AnalyticsEvent = await request.json();
		
		// Add server-side context
		const enrichedEvent: EnrichedAnalyticsEvent = {
			...event,
			ip_address: getClientAddress(),
			user_agent: request.headers.get('user-agent') || undefined,
			user_id: locals.user?.id || event.user_id,	
			server_timestamp: new Date().toISOString()
		};

		// Store in database for analysis
		await storeAnalyticsEvent(enrichedEvent);

		// Forward to external analytics if configured
		await forwardToExternalAnalytics(enrichedEvent);

		return json({ success: true });
	} catch (error) {
		return json({ error: 'Failed to track event' }, { status: 500 });
	}
};

async function storeAnalyticsEvent(event: EnrichedAnalyticsEvent) {
	try {
		// Store in a simple analytics table (you might want to create this table)
		// For now, we'll store in template metrics or create a separate analytics table
		
		if (event.template_id) {
			// Update template-specific metrics
			const template = await db.template.findUnique({
				where: { id: event.template_id }
			});

			if (template) {
				const currentMetrics = extractTemplateMetrics(template.metrics);
				const updatedMetrics = { ...currentMetrics };

				// Increment specific event counters
				switch (event.event) {
					case 'template_viewed':
						updatedMetrics.funnel_views = (updatedMetrics.funnel_views || 0) + 1;
						break;
					case 'onboarding_started':
						updatedMetrics.onboarding_starts = (updatedMetrics.onboarding_starts || 0) + 1;
						break;
					case 'auth_completed':
						updatedMetrics.auth_completions = (updatedMetrics.auth_completions || 0) + 1;
						break;
					case 'template_used':
						updatedMetrics.sent = (updatedMetrics.sent || 0) + 1;
						break;
					case 'template_shared':
						updatedMetrics.shares = (updatedMetrics.shares || 0) + 1;
						break;
				}

				await db.template.update({
					where: { id: event.template_id },
					data: { metrics: updatedMetrics }
				});
			}
		}
	} catch (error) {
	}
}

async function forwardToExternalAnalytics(event: EnrichedAnalyticsEvent) {
	// TODO: Forward to your preferred analytics service
	// Examples:

	// PostHog
	// await posthog.capture({
	//   distinctId: event.user_id || event.session_id,
	//   event: event.event,
	//   properties: event.properties
	// });

	// Mixpanel
	// mixpanel.track(event.event, {
	//   distinct_id: event.user_id || event.session_id,
	//   ...event.properties
	// });

	// Google Analytics 4
	// gtag('event', event.event, event.properties);
	
	// Placeholder for external analytics integration
	console.log('Analytics event:', {
		event: event.event,
		template_id: event.template_id,
		user_id: event.user_id,
		source: event.source
	});
}