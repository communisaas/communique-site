/**
 * PATCH /api/org/[slug]/sms/[id] — Update blast or trigger send
 * DELETE /api/org/[slug]/sms/[id] — Delete blast
 */

import { json, error } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import { loadOrgContext, requireRole } from '$lib/server/org';
import { FEATURES } from '$lib/config/features';
import { SMS_MAX_LENGTH } from '$lib/server/sms/types';
import { sendSmsBlast } from '$lib/server/sms/send-blast';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!FEATURES.SMS) throw error(404, 'Not found');
	if (!locals.user) throw error(401, 'Authentication required');

	const { org, membership } = await loadOrgContext(params.slug, locals.user.id);
	requireRole(membership.role, 'editor');

	// Verify blast belongs to this org
	const existing = await db.smsBlast.findFirst({
		where: { id: params.id, orgId: org.id }
	});
	if (!existing) throw error(404, 'SMS blast not found');

	const body = await request.json();

	// Trigger send action
	if (body.action === 'send') {
		if (existing.status !== 'draft') {
			throw error(400, 'Only draft blasts can be sent');
		}
		// Fire-and-forget
		void sendSmsBlast(existing.id);

		return json({
			id: existing.id,
			status: 'sending',
			updatedAt: new Date().toISOString()
		});
	}

	// Update fields (only if draft)
	if (existing.status !== 'draft') {
		throw error(400, 'Only draft blasts can be updated');
	}

	const data: Record<string, unknown> = {};

	if (body.body !== undefined) {
		if (typeof body.body !== 'string' || body.body.trim().length === 0) {
			throw error(400, 'SMS body is required');
		}
		if (body.body.length > SMS_MAX_LENGTH) {
			throw error(400, `SMS body must not exceed ${SMS_MAX_LENGTH} characters`);
		}
		data.body = body.body.trim();
	}

	if (body.recipientFilter !== undefined) {
		data.recipientFilter = body.recipientFilter;
	}

	if (body.fromNumber !== undefined) {
		data.fromNumber = body.fromNumber || null;
	}

	if (Object.keys(data).length === 0) {
		throw error(400, 'No valid fields to update');
	}

	const updated = await db.smsBlast.update({
		where: { id: params.id },
		data
	});

	return json({
		id: updated.id,
		body: updated.body,
		fromNumber: updated.fromNumber,
		status: updated.status,
		updatedAt: updated.updatedAt.toISOString()
	});
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!FEATURES.SMS) throw error(404, 'Not found');
	if (!locals.user) throw error(401, 'Authentication required');

	const { org, membership } = await loadOrgContext(params.slug, locals.user.id);
	requireRole(membership.role, 'editor');

	// Verify blast belongs to this org
	const existing = await db.smsBlast.findFirst({
		where: { id: params.id, orgId: org.id }
	});
	if (!existing) throw error(404, 'SMS blast not found');

	if (existing.status === 'sending') {
		throw error(400, 'Cannot delete a blast that is currently sending');
	}

	// Delete messages first, then blast
	await db.smsMessage.deleteMany({ where: { blastId: params.id } });
	await db.smsBlast.delete({ where: { id: params.id } });

	return new Response(null, { status: 204 });
};
