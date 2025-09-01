/**
 * Analytics Events API Endpoint
 * 
 * Receives batched analytics events from the client and stores them in the database.
 * Handles session management and user identification.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/core/db';
import type { AnalyticsEvent, SessionData } from '$lib/core/analytics/database';

interface EventBatch {
	session_data: SessionData;
	events: AnalyticsEvent[];
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	try {
		const { session_data, events }: EventBatch = await request.json();
		
		if (!session_data?.session_id || !Array.isArray(events)) {
			return json({
				success: false,
				error: 'Invalid request format'
			}, { status: 400 });
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

		// Ensure session exists
		await db.user_session.upsert({
			where: {
				session_id: session_data.session_id
			},
			create: {
				session_id: session_data.session_id,
				user_id: validatedUserId,
				fingerprint: session_data.fingerprint || null,
				ip_address: clientIP,
				user_agent: session_data.user_agent || null,
				referrer: session_data.referrer || null,
				utm_source: session_data.utm_source || null,
				utm_medium: session_data.utm_medium || null,
				utm_campaign: session_data.utm_campaign || null,
				landing_page: session_data.landing_page || null,
				events_count: events.length,
				page_views: events.filter(e => e.event_name === 'page_view').length
			},
			update: {
				user_id: validatedUserId || undefined,
				events_count: {
					increment: events.length
				},
				page_views: {
					increment: events.filter(e => e.event_name === 'page_view').length
				},
				updated_at: new Date()
			}
		});

		// Validate template_ids exist if provided
		const templateIds = [...new Set(events.map(e => e.template_id).filter(Boolean))];
		const validTemplateIds = new Set();
		if (templateIds.length > 0) {
			const existingTemplates = await db.template.findMany({
				where: { id: { in: templateIds } },
				select: { id: true }
			});
			existingTemplates.forEach(t => validTemplateIds.add(t.id));
		}

		// Process and store events
		const eventsToCreate = events.map(event => ({
			session_id: session_data.session_id,
			user_id: event.user_id || validatedUserId || null,
			template_id: event.template_id && validTemplateIds.has(event.template_id) ? event.template_id : null,
			event_type: event.event_type,
			event_name: event.event_name,
			event_properties: event.event_properties || null,
			page_url: event.page_url || null,
			referrer: event.referrer || session_data.referrer || null,
			user_agent: session_data.user_agent || null,
			ip_address: clientIP,
			timestamp: event.timestamp || new Date(),
			created_at: new Date()
		}));

		// Batch insert events
		await db.analytics_event.createMany({
			data: eventsToCreate,
			skipDuplicates: true
		});

		// Update session end time and check for conversions
		const hasConversion = events.some(e => 
			e.event_name === 'template_used' || 
			e.event_name === 'auth_completed'
		);

		if (hasConversion) {
			await db.user_session.update({
				where: {
					session_id: session_data.session_id
				},
				data: {
					converted: true,
					conversion_type: events.find(e => e.event_name === 'template_used') ? 'template_usage' : 'user_registration'
				}
			});
		}

		return json({
			success: true,
			events_processed: events.length,
			session_id: session_data.session_id
		});

	} catch (error) {
		console.error('Analytics events processing failed:', error);
		
		return json({
			success: false,
			error: 'Failed to process analytics events'
		}, { status: 500 });
	}
};

// Optional: GET endpoint for debugging (remove in production)
export const GET: RequestHandler = async ({ url }) => {
	const sessionId = url.searchParams.get('session_id');
	
	if (!sessionId) {
		return json({
			success: false,
			error: 'session_id required'
		}, { status: 400 });
	}

	try {
		const session = await db.user_session.findUnique({
			where: { session_id: sessionId },
			include: {
				analytics_events: {
					orderBy: { timestamp: 'desc' },
					take: 50
				}
			}
		});

		if (!session) {
			return json({
				success: false,
				error: 'Session not found'
			}, { status: 404 });
		}

		return json({
			success: true,
			session,
			events_count: session.analytics_events.length
		});

	} catch (error) {
		console.error('Failed to fetch session data:', error);
		
		return json({
			success: false,
			error: 'Failed to fetch session data'
		}, { status: 500 });
	}
};