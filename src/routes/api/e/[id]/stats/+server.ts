/**
 * GET /api/e/[id]/stats — Public live stats for an event
 */

import { json, error } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import { FEATURES } from '$lib/config/features';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	if (!FEATURES.EVENTS) throw error(404, 'Not found');

	const event = await db.event.findUnique({
		where: { id: params.id },
		select: {
			rsvpCount: true,
			attendeeCount: true,
			verifiedAttendees: true
		}
	});

	if (!event) throw error(404, 'Event not found');

	// Get breakdown of RSVP statuses
	const [goingCount, maybeCount] = await Promise.all([
		db.eventRsvp.count({ where: { eventId: params.id, status: 'GOING' } }),
		db.eventRsvp.count({ where: { eventId: params.id, status: 'MAYBE' } })
	]);

	return json({
		rsvpCount: event.rsvpCount,
		attendeeCount: event.attendeeCount,
		verifiedAttendees: event.verifiedAttendees,
		goingCount,
		maybeCount
	});
};
