/**
 * GET /api/v1/events — List events for org (API key determines org)
 */

import { db } from '$lib/core/db';
import { authenticateApiKey, requireScope } from '$lib/server/api-v1/auth';
import { requirePublicApi } from '$lib/server/api-v1/gate';
import { checkApiPlanRateLimit } from '$lib/server/api-v1/rate-limit';
import { apiOk, apiError, parsePagination } from '$lib/server/api-v1/response';
import { FEATURES } from '$lib/config/features';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, url }) => {
	if (!FEATURES.EVENTS) return apiError('NOT_FOUND', 'Not found', 404);
	requirePublicApi();
	const auth = await authenticateApiKey(request);
	if (auth instanceof Response) return auth;
	const rateLimit = await checkApiPlanRateLimit(auth);
	if (rateLimit) return rateLimit;

	const scopeErr = requireScope(auth, 'read');
	if (scopeErr) return scopeErr;

	const { cursor, limit } = parsePagination(url);

	const where: Record<string, unknown> = { orgId: auth.orgId };

	const status = url.searchParams.get('status');
	if (status && ['DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED'].includes(status)) {
		where.status = status;
	}

	const eventType = url.searchParams.get('eventType');
	if (eventType && ['IN_PERSON', 'VIRTUAL', 'HYBRID'].includes(eventType)) {
		where.eventType = eventType;
	}

	const findArgs: Record<string, unknown> = {
		where,
		take: limit + 1,
		orderBy: { startAt: 'desc' as const }
	};

	if (cursor) {
		findArgs.cursor = { id: cursor };
		findArgs.skip = 1;
	}

	const [raw, total] = await Promise.all([
		db.event.findMany(findArgs as Parameters<typeof db.event.findMany>[0]),
		db.event.count({ where })
	]);

	const hasMore = raw.length > limit;
	const items = raw.slice(0, limit);
	const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

	const data = items.map((e) => ({
		id: e.id,
		title: e.title,
		description: e.description,
		eventType: e.eventType,
		startAt: e.startAt.toISOString(),
		endAt: e.endAt?.toISOString() ?? null,
		timezone: e.timezone,
		venue: e.venue,
		city: e.city,
		state: e.state,
		virtualUrl: e.virtualUrl,
		capacity: e.capacity,
		status: e.status,
		rsvpCount: e.rsvpCount,
		attendeeCount: e.attendeeCount,
		verifiedAttendees: e.verifiedAttendees,
		campaignId: e.campaignId,
		createdAt: e.createdAt.toISOString(),
		updatedAt: e.updatedAt.toISOString()
	}));

	return apiOk(data, { cursor: nextCursor, hasMore, total });
};
