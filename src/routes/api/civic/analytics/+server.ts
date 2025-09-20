import { json } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import { extractTemplateMetrics } from '$lib/types/templateConfig';
import type { AnalyticsEventCreate } from '$lib/types/api';
import type { AnalyticsEvent } from '$lib/types/analytics';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, getClientAddress }) => {
	try {
		const eventData: AnalyticsEventCreate = await request.json();

		// Create analytics event using new consolidated schema
		const newEvent: Omit<AnalyticsEvent, 'id' | 'created_at'> = {
			session_id: eventData.session_id,
			user_id: locals.user?.id || eventData.user_id || undefined,
			timestamp: eventData.timestamp ? new Date(eventData.timestamp) : new Date(),
			name: eventData.name,
			event_type: eventData.event_type,
			template_id: eventData.template_id,
			funnel_step: eventData.funnel_step,
			experiment_id: eventData.experiment_id,
			properties: {
				...eventData.properties,
				ip_address: getClientAddress(),
				user_agent: request.headers.get('user-agent') || undefined,
				server_timestamp: new Date().toISOString()
			},
			computed_metrics: {}
		};

		// Store in new consolidated analytics_event table
		await storeAnalyticsEvent(newEvent);

		// Forward to external analytics if configured
		await forwardToExternalAnalytics(newEvent);

		return json({ success: true });
	} catch (_error) {
		return json({ error: 'Failed to track event' }, { status: 500 });
	}
};

async function storeAnalyticsEvent(event: Omit<AnalyticsEvent, 'id' | 'created_at'>) {
	try {
		// Store in new consolidated analytics_event table with JSONB properties
		const storedEvent = await db.analytics_event.create({
			data: {
				session_id: event.session_id,
				user_id: event.user_id,
				timestamp: event.timestamp,
				name: event.name,
				event_type: event.event_type,
				template_id: event.template_id,
				funnel_step: event.funnel_step,
				experiment_id: event.experiment_id,
				properties: event.properties,
				computed_metrics: event.computed_metrics
			}
		});

		// Update session data if needed
		if (event.session_id) {
			await updateSessionMetrics(event.session_id, event);
		}

		// Update template metrics if template_id is provided
		if (event.template_id) {
			await updateTemplateMetrics(event.template_id, event);
		}

		return storedEvent;
	} catch (_error) {
		console.error('Failed to store analytics event:', _error);
	}
}

async function updateSessionMetrics(sessionId: string, event: Omit<AnalyticsEvent, 'id' | 'created_at'>) {
	try {
		// Update or create analytics_session with enhanced session tracking
		await db.analytics_session.upsert({
			where: { session_id: sessionId },
			create: {
				session_id: sessionId,
				user_id: event.user_id,
				created_at: new Date(),
				updated_at: new Date(),
				utm_source: event.properties?.utm_source as string,
				utm_medium: event.properties?.utm_medium as string,
				utm_campaign: event.properties?.utm_campaign as string,
				landing_page: event.properties?.landing_page as string,
				referrer: event.properties?.referrer as string,
				device_data: {
					ip_address: event.properties?.ip_address as string,
					user_agent: event.properties?.user_agent as string,
					fingerprint: event.properties?.fingerprint as string
				},
				session_metrics: {
					events_count: 1,
					page_views: event.event_type === 'pageview' ? 1 : 0,
					conversion_count: event.event_type === 'conversion' ? 1 : 0
				},
				funnel_progress: {}
			},
			update: {
				updated_at: new Date(),
				session_metrics: {
					events_count: { increment: 1 },
					page_views: { increment: event.event_type === 'pageview' ? 1 : 0 },
					conversion_count: { increment: event.event_type === 'conversion' ? 1 : 0 }
				}
			}
		});
	} catch (_error) {
		console.warn('Failed to update session metrics:', _error);
	}
}

async function updateTemplateMetrics(templateId: string, event: Omit<AnalyticsEvent, 'id' | 'created_at'>) {
	try {
		const template = await db.template.findUnique({
			where: { id: templateId }
		});

		if (template) {
			const currentMetrics = extractTemplateMetrics(template.metrics);
			const updatedMetrics = { ...currentMetrics };

			// Increment specific event counters based on event name
			switch (event.name) {
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
				where: { id: templateId },
				data: { metrics: updatedMetrics }
			});
		}
	} catch (_error) {
		console.warn('Failed to update template metrics:', _error);
	}
}

async function forwardToExternalAnalytics(event: Omit<AnalyticsEvent, 'id' | 'created_at'>) {
	// TODO: Forward to your preferred analytics service
	// Examples:

	// Mixpanel
	// mixpanel.track(event.name, {
	//   distinct_id: event.user_id || event.session_id,
	//   ...event.properties
	// });

	// Google Analytics 4
	// gtag('event', event.name, {
	//   event_category: event.event_type,
	//   ...event.properties
	// });

	// Placeholder for external analytics integration
	console.log('Analytics event:', {
		event: event.name,
		event_type: event.event_type,
		template_id: event.template_id,
		user_id: event.user_id,
		session_id: event.session_id,
		properties: event.properties
	});
}
