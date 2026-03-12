/**
 * PATCH /api/org/[slug]/workflows/[id] — Update workflow
 * DELETE /api/org/[slug]/workflows/[id] — Delete workflow
 */

import { json, error } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import { loadOrgContext, requireRole } from '$lib/server/org';
import { orgMeetsPlan } from '$lib/server/billing/plan-check';
import { FEATURES } from '$lib/config/features';
import { VALID_TRIGGER_TYPES, VALID_STEP_TYPES } from '$lib/server/automation/types';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!FEATURES.AUTOMATION) throw error(404, 'Not found');
	if (!locals.user) throw error(401, 'Authentication required');

	const { org, membership } = await loadOrgContext(params.slug, locals.user.id);
	requireRole(membership.role, 'editor');

	const meetsPlan = await orgMeetsPlan(org.id, 'starter');
	if (!meetsPlan) throw error(403, 'Automation requires a Starter plan or higher');

	// Verify workflow belongs to this org
	const existing = await db.workflow.findFirst({
		where: { id: params.id, orgId: org.id }
	});
	if (!existing) throw error(404, 'Workflow not found');

	const body = await request.json();
	const data: Record<string, unknown> = {};

	if (body.name !== undefined) {
		if (typeof body.name !== 'string' || body.name.trim().length < 3) {
			throw error(400, 'Name must be at least 3 characters');
		}
		data.name = body.name.trim();
	}

	if (body.description !== undefined) {
		data.description = body.description?.trim() || null;
	}

	if (body.trigger !== undefined) {
		if (!body.trigger || typeof body.trigger !== 'object' || !body.trigger.type) {
			throw error(400, 'Trigger must have a type');
		}
		if (!VALID_TRIGGER_TYPES.includes(body.trigger.type)) {
			throw error(400, `Invalid trigger type. Must be one of: ${VALID_TRIGGER_TYPES.join(', ')}`);
		}
		data.trigger = body.trigger;
	}

	if (body.steps !== undefined) {
		if (!Array.isArray(body.steps) || body.steps.length < 1) {
			throw error(400, 'At least one step is required');
		}
		for (let i = 0; i < body.steps.length; i++) {
			const step = body.steps[i];
			if (!step || typeof step !== 'object' || !step.type) {
				throw error(400, `Step ${i} must have a type`);
			}
			if (!VALID_STEP_TYPES.includes(step.type)) {
				throw error(400, `Step ${i} has invalid type. Must be one of: ${VALID_STEP_TYPES.join(', ')}`);
			}
		}
		data.steps = body.steps;
	}

	if (body.enabled !== undefined) {
		data.enabled = Boolean(body.enabled);
	}

	if (Object.keys(data).length === 0) {
		throw error(400, 'No valid fields to update');
	}

	const updated = await db.workflow.update({
		where: { id: params.id },
		data
	});

	return json({
		id: updated.id,
		name: updated.name,
		enabled: updated.enabled,
		updatedAt: updated.updatedAt.toISOString()
	});
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!FEATURES.AUTOMATION) throw error(404, 'Not found');
	if (!locals.user) throw error(401, 'Authentication required');

	const { org, membership } = await loadOrgContext(params.slug, locals.user.id);
	requireRole(membership.role, 'editor');

	// Verify workflow belongs to this org
	const existing = await db.workflow.findFirst({
		where: { id: params.id, orgId: org.id }
	});
	if (!existing) throw error(404, 'Workflow not found');

	// Hard delete — cascades to executions + logs via Prisma onDelete
	await db.workflow.delete({ where: { id: params.id } });

	return json({ success: true });
};
