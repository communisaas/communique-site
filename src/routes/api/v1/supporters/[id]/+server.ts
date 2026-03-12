/**
 * GET /api/v1/supporters/:id — Supporter detail.
 * PATCH /api/v1/supporters/:id — Update supporter.
 * DELETE /api/v1/supporters/:id — Remove supporter.
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

	const supporter = await db.supporter.findFirst({
		where: { id: params.id, orgId: auth.orgId },
		include: { tags: { include: { tag: { select: { id: true, name: true } } } } }
	});

	if (!supporter) return apiError('NOT_FOUND', 'Supporter not found', 404);

	return apiOk({
		id: supporter.id,
		email: supporter.email,
		name: supporter.name,
		postalCode: supporter.postalCode,
		country: supporter.country,
		phone: supporter.phone,
		verified: supporter.verified,
		emailStatus: supporter.emailStatus,
		source: supporter.source,
		customFields: supporter.customFields,
		createdAt: supporter.createdAt.toISOString(),
		updatedAt: supporter.updatedAt.toISOString(),
		tags: supporter.tags.map((st: { tag: { id: string; name: string } }) => ({ id: st.tag.id, name: st.tag.name }))
	});
};

export const PATCH: RequestHandler = async ({ request, params }) => {
	requirePublicApi();
	const auth = await authenticateApiKey(request);
	if (auth instanceof Response) return auth;
	const scopeErr = requireScope(auth, 'write');
	if (scopeErr) return scopeErr;

	const existing = await db.supporter.findFirst({ where: { id: params.id, orgId: auth.orgId } });
	if (!existing) return apiError('NOT_FOUND', 'Supporter not found', 404);

	let body: Record<string, unknown>;
	try { body = await request.json(); } catch { return apiError('BAD_REQUEST', 'Invalid JSON body', 400); }

	const { name, postalCode, country, phone, customFields } = body as {
		name?: string; postalCode?: string; country?: string; phone?: string; customFields?: Record<string, unknown>;
	};

	const data: Record<string, unknown> = {};
	if (typeof name === 'string') data.name = name;
	if (typeof postalCode === 'string') data.postalCode = postalCode;
	if (typeof country === 'string') data.country = country;
	if (typeof phone === 'string') data.phone = phone;
	if (customFields && typeof customFields === 'object') data.customFields = customFields;

	if (Object.keys(data).length === 0) return apiError('BAD_REQUEST', 'No fields to update', 400);

	const updated = await db.supporter.update({ where: { id: params.id }, data });
	return apiOk({ id: updated.id, updatedAt: updated.updatedAt.toISOString() });
};

export const DELETE: RequestHandler = async ({ request, params }) => {
	requirePublicApi();
	const auth = await authenticateApiKey(request);
	if (auth instanceof Response) return auth;
	const scopeErr = requireScope(auth, 'write');
	if (scopeErr) return scopeErr;

	const existing = await db.supporter.findFirst({ where: { id: params.id, orgId: auth.orgId } });
	if (!existing) return apiError('NOT_FOUND', 'Supporter not found', 404);

	await db.supporter.delete({ where: { id: params.id } });
	return apiOk({ deleted: true });
};
