/**
 * GET /api/v1/workflows — List workflows for org (API key determines org)
 */

import { db } from '$lib/core/db';
import { authenticateApiKey, requireScope } from '$lib/server/api-v1/auth';
import { requirePublicApi } from '$lib/server/api-v1/gate';
import { checkApiPlanRateLimit } from '$lib/server/api-v1/rate-limit';
import { apiOk, apiError, parsePagination } from '$lib/server/api-v1/response';
import { FEATURES } from '$lib/config/features';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, url }) => {
	if (!FEATURES.AUTOMATION) return apiError('NOT_FOUND', 'Not found', 404);
	requirePublicApi();
	const auth = await authenticateApiKey(request);
	if (auth instanceof Response) return auth;
	const rateLimit = await checkApiPlanRateLimit(auth);
	if (rateLimit) return rateLimit;

	const scopeErr = requireScope(auth, 'read');
	if (scopeErr) return scopeErr;

	const { cursor, limit } = parsePagination(url);

	const where: Record<string, unknown> = { orgId: auth.orgId };

	const enabledFilter = url.searchParams.get('enabled');
	if (enabledFilter === 'true') where.enabled = true;
	if (enabledFilter === 'false') where.enabled = false;

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
		db.workflow.findMany(findArgs as Parameters<typeof db.workflow.findMany>[0]),
		db.workflow.count({ where })
	]);

	const hasMore = raw.length > limit;
	const items = raw.slice(0, limit);
	const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

	const data = items.map((w) => ({
		id: w.id,
		name: w.name,
		description: w.description,
		trigger: w.trigger,
		stepCount: Array.isArray(w.steps) ? w.steps.length : 0,
		enabled: w.enabled,
		createdAt: w.createdAt.toISOString(),
		updatedAt: w.updatedAt.toISOString()
	}));

	return apiOk(data, { cursor: nextCursor, hasMore, total });
};
