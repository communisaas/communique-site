import { json, error } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import { loadOrgContext, requireRole } from '$lib/server/org';
import type { RequestHandler } from './$types';

/** Update organization details. Requires owner role. */
export const PATCH: RequestHandler = async ({ params, locals, request }) => {
	if (!locals.user) throw error(401, 'Authentication required');
	const { org, membership } = await loadOrgContext(params.slug, locals.user.id);
	requireRole(membership.role, 'owner');

	const body = await request.json();
	const { description, billing_email, avatar } = body as {
		description?: string;
		billing_email?: string;
		avatar?: string;
	};

	const data: Record<string, string> = {};
	if (typeof description === 'string') data.description = description;
	if (typeof billing_email === 'string') data.billing_email = billing_email;
	if (typeof avatar === 'string') data.avatar = avatar;

	if (Object.keys(data).length === 0) {
		throw error(400, 'No fields to update');
	}

	await db.organization.update({ where: { id: org.id }, data });
	return json({ ok: true });
};
