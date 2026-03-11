/**
 * GET /api/v1/campaigns/:campaignId/actions — List campaign actions with cursor pagination.
 */

import { db } from '$lib/core/db';
import { authenticateApiKey, requireScope } from '$lib/server/api-v1/auth';
import { apiOk, apiError, parsePagination } from '$lib/server/api-v1/response';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, params, url }) => {
	const auth = await authenticateApiKey(request);
	if (auth instanceof Response) return auth;
	const scopeErr = requireScope(auth, 'read');
	if (scopeErr) return scopeErr;

	// Verify campaign belongs to this org
	const campaign = await db.campaign.findFirst({
		where: { id: params.id, orgId: auth.orgId },
		select: { id: true }
	});
	if (!campaign) return apiError('NOT_FOUND', 'Campaign not found', 404);

	const { cursor, limit } = parsePagination(url);
	const where: Record<string, unknown> = { campaignId: params.id };

	const verified = url.searchParams.get('verified');
	if (verified === 'true') where.verified = true;
	else if (verified === 'false') where.verified = false;

	const findArgs: Record<string, unknown> = {
		where,
		take: limit + 1,
		orderBy: { createdAt: 'desc' as const }
	};
	if (cursor) { findArgs.cursor = { id: cursor }; findArgs.skip = 1; }

	const [raw, total] = await Promise.all([
		db.campaignAction.findMany(findArgs as Parameters<typeof db.campaignAction.findMany>[0]),
		db.campaignAction.count({ where })
	]);

	const hasMore = raw.length > limit;
	const items = raw.slice(0, limit);
	const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

	const data = items.map((a) => ({
		id: a.id,
		campaignId: a.campaignId,
		supporterId: a.supporterId,
		verified: a.verified,
		engagementTier: a.engagementTier,
		districtHash: a.districtHash,
		sentAt: a.sentAt.toISOString(),
		createdAt: a.createdAt.toISOString()
	}));

	return apiOk(data, { cursor: nextCursor, hasMore, total });
};
