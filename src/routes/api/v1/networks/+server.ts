/**
 * GET /api/v1/networks — List networks for authenticated org
 */

import { db } from '$lib/core/db';
import { authenticateApiKey, requireScope } from '$lib/server/api-v1/auth';
import { requirePublicApi } from '$lib/server/api-v1/gate';
import { checkApiPlanRateLimit } from '$lib/server/api-v1/rate-limit';
import { apiOk, apiError, parsePagination } from '$lib/server/api-v1/response';
import { FEATURES } from '$lib/config/features';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, url }) => {
	if (!FEATURES.NETWORKS) return apiError('NOT_FOUND', 'Not found', 404);
	requirePublicApi();
	const auth = await authenticateApiKey(request);
	if (auth instanceof Response) return auth;
	const rateLimit = await checkApiPlanRateLimit(auth);
	if (rateLimit) return rateLimit;

	const scopeErr = requireScope(auth, 'read');
	if (scopeErr) return scopeErr;

	const { cursor, limit } = parsePagination(url);

	const where = {
		orgId: auth.orgId,
		status: 'active' as const
	};

	const findArgs: Record<string, unknown> = {
		where,
		take: limit + 1,
		orderBy: { joinedAt: 'desc' as const },
		include: {
			network: {
				include: {
					_count: {
						select: { members: true }
					}
				}
			}
		}
	};

	if (cursor) {
		findArgs.cursor = { id: cursor };
		findArgs.skip = 1;
	}

	const [raw, total] = await Promise.all([
		db.orgNetworkMember.findMany(findArgs as Parameters<typeof db.orgNetworkMember.findMany>[0]),
		db.orgNetworkMember.count({ where })
	]);

	const hasMore = raw.length > limit;
	const items = raw.slice(0, limit);
	const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

	const data = items.map((m: any) => ({
		id: m.network.id,
		name: m.network.name,
		slug: m.network.slug,
		description: m.network.description,
		status: m.network.status,
		ownerOrgId: m.network.ownerOrgId,
		memberCount: m.network._count?.members ?? 0,
		role: m.role,
		joinedAt: m.joinedAt.toISOString(),
		createdAt: m.network.createdAt.toISOString(),
		updatedAt: m.network.updatedAt.toISOString()
	}));

	return apiOk(data, { cursor: nextCursor, hasMore, total });
};
