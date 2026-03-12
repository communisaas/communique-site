/**
 * POST /api/org/[slug]/workflows — Create workflow
 * GET  /api/org/[slug]/workflows — List workflows
 */

import { json, error } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import { loadOrgContext, requireRole } from '$lib/server/org';
import { orgMeetsPlan } from '$lib/server/billing/plan-check';
import { FEATURES } from '$lib/config/features';
import { VALID_TRIGGER_TYPES, VALID_STEP_TYPES } from '$lib/server/automation/types';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!FEATURES.AUTOMATION) throw error(404, 'Not found');
	if (!locals.user) throw error(401, 'Authentication required');

	const { org, membership } = await loadOrgContext(params.slug, locals.user.id);
	requireRole(membership.role, 'editor');

	const meetsPlan = await orgMeetsPlan(org.id, 'starter');
	if (!meetsPlan) throw error(403, 'Automation requires a Starter plan or higher');

	const body = await request.json();
	const { name, description, trigger, steps } = body;

	// Validate name
	if (!name || typeof name !== 'string' || name.trim().length < 3) {
		throw error(400, 'Name is required (minimum 3 characters)');
	}

	// Validate trigger
	if (!trigger || typeof trigger !== 'object' || !trigger.type) {
		throw error(400, 'Trigger is required and must have a type');
	}
	if (!VALID_TRIGGER_TYPES.includes(trigger.type)) {
		throw error(400, `Invalid trigger type. Must be one of: ${VALID_TRIGGER_TYPES.join(', ')}`);
	}

	// Validate steps
	if (!Array.isArray(steps) || steps.length < 1) {
		throw error(400, 'At least one step is required');
	}
	for (let i = 0; i < steps.length; i++) {
		const step = steps[i];
		if (!step || typeof step !== 'object' || !step.type) {
			throw error(400, `Step ${i} must have a type`);
		}
		if (!VALID_STEP_TYPES.includes(step.type)) {
			throw error(400, `Step ${i} has invalid type. Must be one of: ${VALID_STEP_TYPES.join(', ')}`);
		}
	}

	const workflow = await db.workflow.create({
		data: {
			orgId: org.id,
			name: name.trim(),
			description: description?.trim() || null,
			trigger,
			steps,
			enabled: false
		}
	});

	return json({ id: workflow.id }, { status: 201 });
};

export const GET: RequestHandler = async ({ params, url, locals }) => {
	if (!FEATURES.AUTOMATION) throw error(404, 'Not found');
	if (!locals.user) throw error(401, 'Authentication required');

	const { org } = await loadOrgContext(params.slug, locals.user.id);

	const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20', 10) || 20, 1), 100);
	const cursor = url.searchParams.get('cursor') || null;
	const enabledFilter = url.searchParams.get('enabled');

	const where: Record<string, unknown> = { orgId: org.id };
	if (enabledFilter === 'true') where.enabled = true;
	if (enabledFilter === 'false') where.enabled = false;

	const findArgs: Record<string, unknown> = {
		where,
		take: limit + 1,
		orderBy: { createdAt: 'desc' as const },
		select: {
			id: true,
			name: true,
			description: true,
			trigger: true,
			steps: true,
			enabled: true,
			createdAt: true,
			updatedAt: true
		}
	};

	if (cursor) {
		findArgs.cursor = { id: cursor };
		findArgs.skip = 1;
	}

	const workflows = await db.workflow.findMany(findArgs as Parameters<typeof db.workflow.findMany>[0]);

	const hasMore = workflows.length > limit;
	const items = workflows.slice(0, limit);
	const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

	return json({
		data: items.map((w) => ({
			...w,
			createdAt: w.createdAt.toISOString(),
			updatedAt: w.updatedAt.toISOString()
		})),
		meta: { cursor: nextCursor, hasMore }
	});
};
