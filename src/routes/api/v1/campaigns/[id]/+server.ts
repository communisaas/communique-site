/**
 * GET /api/v1/campaigns/:id — Campaign detail.
 * PATCH /api/v1/campaigns/:id — Update campaign.
 */

import { db } from '$lib/core/db';
import { authenticateApiKey, requireScope } from '$lib/server/api-v1/auth';
import { requirePublicApi } from '$lib/server/api-v1/gate';
import { apiOk, apiError } from '$lib/server/api-v1/response';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, params }) => {
	requirePublicApi();
	const auth = await authenticateApiKey(request);
	if (auth instanceof Response) return auth;
	const scopeErr = requireScope(auth, 'read');
	if (scopeErr) return scopeErr;

	const campaign = await db.campaign.findFirst({
		where: { id: params.id, orgId: auth.orgId },
		include: {
			_count: { select: { actions: true, deliveries: true } }
		}
	});

	if (!campaign) return apiError('NOT_FOUND', 'Campaign not found', 404);

	return apiOk({
		id: campaign.id,
		type: campaign.type,
		title: campaign.title,
		body: campaign.body,
		status: campaign.status,
		targets: campaign.targets,
		templateId: campaign.templateId,
		debateEnabled: campaign.debateEnabled,
		debateThreshold: campaign.debateThreshold,
		createdAt: campaign.createdAt.toISOString(),
		updatedAt: campaign.updatedAt.toISOString(),
		counts: {
			actions: campaign._count.actions,
			deliveries: campaign._count.deliveries
		}
	});
};

export const PATCH: RequestHandler = async ({ request, params }) => {
	requirePublicApi();
	const auth = await authenticateApiKey(request);
	if (auth instanceof Response) return auth;
	const scopeErr = requireScope(auth, 'write');
	if (scopeErr) return scopeErr;

	const existing = await db.campaign.findFirst({ where: { id: params.id, orgId: auth.orgId } });
	if (!existing) return apiError('NOT_FOUND', 'Campaign not found', 404);

	let body: Record<string, unknown>;
	try { body = await request.json(); } catch { return apiError('BAD_REQUEST', 'Invalid JSON body', 400); }

	const { title, body: campaignBody, status } = body as { title?: string; body?: string; status?: string };
	const data: Record<string, unknown> = {};
	if (typeof title === 'string') data.title = title.trim();
	if (typeof campaignBody === 'string') data.body = campaignBody.trim();
	if (status && ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETE'].includes(status)) data.status = status;

	if (Object.keys(data).length === 0) return apiError('BAD_REQUEST', 'No fields to update', 400);

	const updated = await db.campaign.update({ where: { id: params.id }, data });
	return apiOk({ id: updated.id, updatedAt: updated.updatedAt.toISOString() });
};
