/**
 * GET /api/v1/networks/[id] — Network detail
 */

import { db } from '$lib/core/db';
import { authenticateApiKey, requireScope } from '$lib/server/api-v1/auth';
import { requirePublicApi } from '$lib/server/api-v1/gate';
import { checkApiPlanRateLimit } from '$lib/server/api-v1/rate-limit';
import { apiOk, apiError } from '$lib/server/api-v1/response';
import { FEATURES } from '$lib/config/features';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, request }) => {
	if (!FEATURES.NETWORKS) return apiError('NOT_FOUND', 'Not found', 404);
	requirePublicApi();
	const auth = await authenticateApiKey(request);
	if (auth instanceof Response) return auth;
	const rateLimit = await checkApiPlanRateLimit(auth);
	if (rateLimit) return rateLimit;

	const scopeErr = requireScope(auth, 'read');
	if (scopeErr) return scopeErr;

	// Verify the requesting org is an active member
	const membership = await db.orgNetworkMember.findFirst({
		where: {
			networkId: params.id,
			orgId: auth.orgId,
			status: 'active'
		}
	});

	if (!membership) {
		return apiError('FORBIDDEN', 'Organization is not an active member of this network', 403);
	}

	const network = await db.orgNetwork.findUnique({
		where: { id: params.id },
		include: {
			ownerOrg: {
				select: { id: true, name: true, slug: true }
			},
			members: {
				where: { status: 'active' },
				include: {
					org: {
						select: { id: true, name: true, slug: true }
					}
				},
				orderBy: { joinedAt: 'asc' }
			}
		}
	});

	if (!network) {
		return apiError('NOT_FOUND', 'Network not found', 404);
	}

	return apiOk({
		id: network.id,
		name: network.name,
		slug: network.slug,
		description: network.description,
		status: network.status,
		ownerOrgId: network.ownerOrgId,
		memberCount: network.members.length,
		ownerOrg: {
			id: network.ownerOrg.id,
			name: network.ownerOrg.name,
			slug: network.ownerOrg.slug
		},
		members: network.members.map((m) => ({
			orgId: m.org.id,
			orgName: m.org.name,
			orgSlug: m.org.slug,
			role: m.role,
			joinedAt: m.joinedAt.toISOString()
		})),
		createdAt: network.createdAt.toISOString(),
		updatedAt: network.updatedAt.toISOString()
	});
};
