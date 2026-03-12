/**
 * PATCH /api/v1/tags/:id — Rename tag.
 * DELETE /api/v1/tags/:id — Delete tag.
 */

import { db } from '$lib/core/db';
import { authenticateApiKey, requireScope } from '$lib/server/api-v1/auth';
import { requirePublicApi } from '$lib/server/api-v1/gate';
import { apiOk, apiError } from '$lib/server/api-v1/response';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ request, params }) => {
	requirePublicApi();
	const auth = await authenticateApiKey(request);
	if (auth instanceof Response) return auth;
	const scopeErr = requireScope(auth, 'write');
	if (scopeErr) return scopeErr;

	const tag = await db.tag.findFirst({ where: { id: params.id, orgId: auth.orgId } });
	if (!tag) return apiError('NOT_FOUND', 'Tag not found', 404);

	let body: Record<string, unknown>;
	try { body = await request.json(); } catch { return apiError('BAD_REQUEST', 'Invalid JSON body', 400); }

	const { name } = body as { name?: string };
	if (!name || typeof name !== 'string' || !name.trim()) return apiError('BAD_REQUEST', 'Tag name is required', 400);

	const updated = await db.tag.update({ where: { id: params.id }, data: { name: name.trim() } });
	return apiOk({ id: updated.id, name: updated.name });
};

export const DELETE: RequestHandler = async ({ request, params }) => {
	requirePublicApi();
	const auth = await authenticateApiKey(request);
	if (auth instanceof Response) return auth;
	const scopeErr = requireScope(auth, 'write');
	if (scopeErr) return scopeErr;

	const tag = await db.tag.findFirst({ where: { id: params.id, orgId: auth.orgId } });
	if (!tag) return apiError('NOT_FOUND', 'Tag not found', 404);

	await db.tag.delete({ where: { id: params.id } });
	return apiOk({ deleted: true });
};
