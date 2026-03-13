/**
 * GET /api/v1/sms — List SMS blasts for org (API key determines org)
 */

import { db } from '$lib/core/db';
import { authenticateApiKey, requireScope } from '$lib/server/api-v1/auth';
import { requirePublicApi } from '$lib/server/api-v1/gate';
import { checkApiPlanRateLimit } from '$lib/server/api-v1/rate-limit';
import { apiOk, apiError, parsePagination } from '$lib/server/api-v1/response';
import { FEATURES } from '$lib/config/features';
import { VALID_BLAST_STATUSES } from '$lib/server/sms/types';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, url }) => {
	if (!FEATURES.SMS) return apiError('NOT_FOUND', 'Not found', 404);
	requirePublicApi();
	const auth = await authenticateApiKey(request);
	if (auth instanceof Response) return auth;
	const rateLimit = await checkApiPlanRateLimit(auth);
	if (rateLimit) return rateLimit;

	const scopeErr = requireScope(auth, 'read');
	if (scopeErr) return scopeErr;

	const { cursor, limit } = parsePagination(url);

	const where: Record<string, unknown> = { orgId: auth.orgId };

	const statusFilter = url.searchParams.get('status');
	if (statusFilter && VALID_BLAST_STATUSES.includes(statusFilter as any)) {
		where.status = statusFilter;
	}

	const findArgs: Record<string, unknown> = {
		where,
		take: limit + 1,
		orderBy: { createdAt: 'desc' as const }
	};

	if (cursor) {
		findArgs.cursor = { id: cursor };
		findArgs.skip = 1;
	}

	const [raw, total] = await Promise.all([
		db.smsBlast.findMany(findArgs as Parameters<typeof db.smsBlast.findMany>[0]),
		db.smsBlast.count({ where })
	]);

	const hasMore = raw.length > limit;
	const items = raw.slice(0, limit);
	const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

	const data = items.map((b) => ({
		id: b.id,
		body: b.body,
		fromNumber: b.fromNumber,
		status: b.status,
		totalRecipients: b.totalRecipients,
		sentCount: b.sentCount,
		failedCount: b.failedCount,
		campaignId: b.campaignId,
		sentAt: b.sentAt?.toISOString() ?? null,
		createdAt: b.createdAt.toISOString(),
		updatedAt: b.updatedAt.toISOString()
	}));

	return apiOk(data, { cursor: nextCursor, hasMore, total });
};
