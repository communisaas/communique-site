import { error, redirect } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import { FEATURES } from '$lib/config/features';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!FEATURES.EVENTS) throw error(404, 'Not found');

	if (!locals.user) throw redirect(302, '/auth/login');

	const org = await db.organization.findUnique({
		where: { slug: params.slug },
		select: { id: true, name: true, slug: true }
	});

	if (!org) throw error(404, 'Organization not found');

	// Verify membership
	const membership = await db.orgMembership.findUnique({
		where: { orgId_userId: { orgId: org.id, userId: locals.user.id } }
	});

	if (!membership) throw error(403, 'Not a member of this organization');

	const events = await db.event.findMany({
		where: { orgId: org.id },
		orderBy: { startAt: 'desc' },
		take: 50,
		select: {
			id: true,
			title: true,
			eventType: true,
			startAt: true,
			endAt: true,
			timezone: true,
			venue: true,
			city: true,
			status: true,
			rsvpCount: true,
			capacity: true,
			attendeeCount: true,
			verifiedAttendees: true
		}
	});

	return {
		org: { name: org.name, slug: org.slug },
		events: events.map((e) => ({
			...e,
			startAt: e.startAt.toISOString(),
			endAt: e.endAt?.toISOString() ?? null
		}))
	};
};
