import { json, error } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import { loadOrgContext, requireRole } from '$lib/server/org';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const { org, membership } = await loadOrgContext(params.slug, locals.user.id);
	requireRole(membership.role, 'editor');

	const body = await request.json();
	const { title, type, body: campaignBody, templateId, debateEnabled, debateThreshold } = body;

	if (!title || typeof title !== 'string' || !title.trim()) {
		throw error(400, 'Title is required');
	}

	if (!type || !['LETTER', 'EVENT', 'FORM'].includes(type)) {
		throw error(400, 'Invalid campaign type');
	}

	// Validate templateId if provided
	if (templateId) {
		const template = await db.template.findFirst({
			where: { id: templateId, orgId: org.id }
		});
		if (!template) {
			throw error(400, 'Invalid template selection');
		}
	}

	const campaign = await db.campaign.create({
		data: {
			orgId: org.id,
			title: title.trim(),
			type,
			body: campaignBody?.trim() || null,
			templateId: templateId || null,
			debateEnabled: Boolean(debateEnabled),
			debateThreshold: typeof debateThreshold === 'number' ? debateThreshold : 50,
			status: 'DRAFT'
		}
	});

	return json({ id: campaign.id }, { status: 201 });
};
