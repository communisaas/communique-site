/**
 * Analytics Events API Endpoint
 *
 * Receives batched analytics events from the client and stores them in the database.
 * Handles session management and user identification.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/core/db';
import type { AnalyticsEvent as _AnalyticsEvent } from '$lib/types/analytics';

// Incoming event structure from client (flexible)
interface ClientAnalyticsEvent {
	session_id: string;
	event_name?: string;
	name?: string;
	event_type?: string;
	user_id?: string;
	template_id?: string;
	funnel_id?: string;
	campaign_id?: string;
	variation_id?: string;
	timestamp?: Date | string;
	page_url?: string;
	event_properties?: Record<string, unknown>;
	properties?: Record<string, unknown>;
}

interface EventBatch {
	session_data: {
		session_id: string;
		user_id?: string;
		fingerprint?: string;
		ip_address?: string;
		user_agent?: string;
		referrer?: string;
		utm_source?: string;
		utm_medium?: string;
		utm_campaign?: string;
		landing_page?: string;
	};
	events: ClientAnalyticsEvent[];
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	try {
		const { session_data, events }: EventBatch = await request.json();

		if (!session_data?.session_id || !Array.isArray(events)) {
			return json(
				{
					success: false,
					error: 'Invalid request format'
				},
				{ status: 400 }
			);
		}

		// Get client IP for geolocation (if not provided)
		const clientIP = session_data.ip_address || getClientAddress();

		// Validate user_id exists if provided
		let validatedUserId: string | null = null;
		if (session_data.user_id) {
			const userExists = await db.user.findUnique({
				where: { id: session_data.user_id },
				select: { id: true }
			});
			validatedUserId = userExists ? session_data.user_id : null;
		}

		// Ensure analytics session exists using new consolidated schema
		await db.analytics_session.upsert({
			where: {
				session_id: session_data.session_id
			},
			create: {
				session_id: session_data.session_id,
				user_id: validatedUserId,
				created_at: new Date(),
				updated_at: new Date(),
				utm_source: session_data.utm_source,
				utm_medium: session_data.utm_medium,
				utm_campaign: session_data.utm_campaign,
				landing_page: session_data.landing_page,
				referrer: session_data.referrer,
				device_data: {
					ip_address: clientIP,
					user_agent: session_data.user_agent,
					fingerprint: session_data.fingerprint
				},
				session_metrics: {
					events_count: events.length,
					page_views: events.filter((e) => (e.event_name || e.name) === 'page_view').length,
					conversion_count: events.filter((e) => (e.event_name || e.name) === 'conversion').length
				},
				funnel_progress: {}
			},
			update: {
				user_id: validatedUserId || undefined,
				updated_at: new Date(),
				session_metrics: {
					events_count: { increment: events.length },
					page_views: {
						increment: events.filter((e) => (e.event_name || e.name) === 'page_view').length
					},
					conversion_count: {
						increment: events.filter((e) => (e.event_name || e.name) === 'conversion').length
					}
				}
			}
		});

		// Validate template_ids exist if provided
		const templateIds = [
			...new Set(events.map((e) => e.template_id).filter((id): id is string => Boolean(id)))
		];
		const validTemplateIds = new Set();
		if (templateIds.length > 0) {
			const existingTemplates = await db.template.findMany({
				where: { id: { in: templateIds } },
				select: { id: true }
			});
			existingTemplates.forEach((t) => validTemplateIds.add(t.id));
		}

		// Helper function to safely stringify properties (handle circular references)
		const safeStringify = (obj: unknown): string => {
			if (!obj || typeof obj !== 'object') return String(obj);

			const seen = new WeakSet();
			return JSON.stringify(obj, (key, value) => {
				// Skip DOM elements (only available in browser)
				if (typeof HTMLElement !== 'undefined' && value instanceof HTMLElement) {
					return '[HTMLElement]';
				}
				// Skip Window/Document objects
				if (value === globalThis || value === globalThis.document) {
					return '[Window/Document]';
				}
				// Handle circular references
				if (typeof value === 'object' && value !== null) {
					if (seen.has(value)) {
						return '[Circular]';
					}
					seen.add(value);
				}
				// Skip functions
				if (typeof value === 'function') {
					return '[Function]';
				}
				return value;
			});
		};

		// Process and store events using new consolidated schema with JSONB properties
		const eventsToCreate = [];

		for (const event of events) {
			// Handle event properties (merge both properties and event_properties)
			const properties = {
				...(event.properties || {}),
				...(event.event_properties || {}),
				page_url: event.page_url
			};

			// Clean properties to prevent circular references and large objects
			const cleanedProperties: Record<string, unknown> = {};
			for (const [key, value] of Object.entries(properties)) {
				if (value !== undefined && value !== null) {
					try {
						if (typeof value === 'object') {
							// For objects, stringify and parse to ensure they're JSON-safe
							cleanedProperties[key] = JSON.parse(safeStringify(value));
						} else {
							cleanedProperties[key] = value;
						}
					} catch (error) {
						console.warn(`Could not analyze template`, error);
						cleanedProperties[key] = '[Serialization Error]';
					}
				}
			}

			// Determine event type
			const eventName = event.event_name || event.name || 'unknown';
			let eventType: 'pageview' | 'interaction' | 'conversion' | 'funnel' | 'campaign' =
				'interaction';

			if (eventName === 'page_view' || eventName.includes('viewed')) {
				eventType = 'pageview';
			} else if (
				eventName.includes('conversion') ||
				eventName === 'template_used' ||
				eventName === 'auth_completed'
			) {
				eventType = 'conversion';
			} else if (event.funnel_id) {
				eventType = 'funnel';
			} else if (event.campaign_id) {
				eventType = 'campaign';
			}

			eventsToCreate.push({
				session_id: session_data.session_id,
				user_id: event.user_id || validatedUserId || null,
				timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
				name: eventName,
				event_type: eventType,
				template_id:
					event.template_id && validTemplateIds.has(event.template_id) ? event.template_id : null,
				funnel_step: event.funnel_id ? 1 : null, // Could be enhanced based on event data
				experiment_id: event.variation_id || event.campaign_id || null,
				properties: cleanedProperties,
				computed_metrics: {}
			});
		}

		// Batch insert events
		if (eventsToCreate.length > 0) {
			await db.analytics_event.createMany({
				data: eventsToCreate,
				skipDuplicates: true
			});
		}

		// Update session end time and check for conversions
		const _hasConversion = events.some(
			(e) => e.event_name === 'template_used' || e.event_name === 'auth_completed'
		);

		// Note: Conversion tracking would require additional user_session schema fields
		// For now, we track conversions through analyticsevent records

		return json({
			success: true,
			events_processed: events.length,
			session_id: session_data.session_id
		});
	} catch (error) {
		console.error('Error occurred');

		return json(
			{
				success: false,
				error: 'Failed to process analytics events'
			},
			{ status: 500 }
		);
	}
};

// Optional: GET endpoint for debugging (remove in production)
export const GET: RequestHandler = async ({ url }) => {
	const sessionId = url.searchParams.get('session_id');

	if (!sessionId) {
		return json(
			{
				success: false,
				error: 'session_id required'
			},
			{ status: 400 }
		);
	}

	try {
		const session = await db.analytics_session.findUnique({
			where: { session_id: sessionId }
		});

		if (!session) {
			return json(
				{
					success: false,
					error: 'Session not found'
				},
				{ status: 404 }
			);
		}

		// Get analytics events for this session from consolidated analyticsevent table
		const analyticsEvents = await db.analytics_event.findMany({
			where: { session_id: sessionId },
			orderBy: { timestamp: 'desc' },
			take: 50
		});

		return json({
			success: true,
			session: {
				...session,
				// Convert JSONB fields to objects for response
				device_data: session.device_data || {},
				session_metrics: session.session_metrics || {},
				funnel_progress: session.funnel_progress || {}
			},
			analyticsevents: analyticsEvents.map((event) => ({
				...event,
				properties: event.properties || {},
				computed_metrics: event.computed_metrics || {}
			})),
			events_count: analyticsEvents.length
		});
	} catch (error) {
		console.error('Error occurred');

		return json(
			{
				success: false,
				error: 'Failed to fetch session data'
			},
			{ status: 500 }
		);
	}
};
