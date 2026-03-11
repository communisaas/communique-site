/**
 * GET /api/v1/orgs — Return the org associated with the API key.
 *
 * Unlike AN's API, this returns the single org bound to the key.
 * No multi-org access via a single key.
 */

import { db } from '$lib/core/db';
import { authenticateApiKey, requireScope } from '$lib/server/api-v1/auth';
import { apiOk, apiError } from '$lib/server/api-v1/response';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
	const auth = await authenticateApiKey(request);
	if (auth instanceof Response) return auth;

	const scopeErr = requireScope(auth, 'read');
	if (scopeErr) return scopeErr;

	const org = await db.organization.findUnique({
		where: { id: auth.orgId },
		select: {
			id: true,
			name: true,
			slug: true,
			description: true,
			avatar: true,
			createdAt: true,
			_count: {
				select: {
					supporters: true,
					campaigns: true,
					templates: true
				}
			}
		}
	});

	if (!org) {
		console.error(`[API v1] Org not found for valid API key. orgId=${auth.orgId}, keyId=${auth.keyId}`);
		return apiError('INTERNAL_ERROR', 'Organization could not be resolved', 500);
	}

	return apiOk({
		id: org.id,
		name: org.name,
		slug: org.slug,
		description: org.description,
		avatar: org.avatar,
		createdAt: org.createdAt.toISOString(),
		counts: {
			supporters: org._count.supporters,
			campaigns: org._count.campaigns,
			templates: org._count.templates
		}
	});
};
