import { json, error } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import { loadOrgContext, requireRole } from '$lib/server/org';
import type { RequestHandler } from './$types';

/** Endorse a template on behalf of this org. Requires editor role. */
export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) throw error(401, 'Authentication required');

	const { membership } = await loadOrgContext(params.slug, locals.user.id);
	requireRole(membership.role as 'owner' | 'editor' | 'member', 'editor');

	const body = await request.json();
	const { templateId } = body as { templateId?: string };

	if (!templateId) throw error(400, 'templateId is required');

	// Verify template exists and is public
	const template = await db.template.findUnique({
		where: { id: templateId },
		select: { id: true, is_public: true }
	});
	if (!template) throw error(404, 'Template not found');
	if (!template.is_public) throw error(403, 'Cannot endorse a private template');

	const org = await db.organization.findUnique({
		where: { slug: params.slug },
		select: { id: true }
	});
	if (!org) throw error(404, 'Organization not found');

	// Upsert to handle duplicate endorsement gracefully
	const endorsement = await db.templateEndorsement.upsert({
		where: {
			templateId_orgId: { templateId, orgId: org.id }
		},
		create: {
			templateId,
			orgId: org.id,
			endorsedBy: locals.user.id
		},
		update: {} // no-op if already exists
	});

	return json({ id: endorsement.id }, { status: 201 });
};

/** Remove an endorsement. Requires editor role. */
export const DELETE: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) throw error(401, 'Authentication required');

	const { membership } = await loadOrgContext(params.slug, locals.user.id);
	requireRole(membership.role as 'owner' | 'editor' | 'member', 'editor');

	const body = await request.json();
	const { templateId } = body as { templateId?: string };

	if (!templateId) throw error(400, 'templateId is required');

	const org = await db.organization.findUnique({
		where: { slug: params.slug },
		select: { id: true }
	});
	if (!org) throw error(404, 'Organization not found');

	await db.templateEndorsement.deleteMany({
		where: { templateId, orgId: org.id }
	});

	return json({ ok: true });
};
