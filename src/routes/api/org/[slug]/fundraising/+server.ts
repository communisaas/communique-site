/**
 * POST /api/org/[slug]/fundraising — Create fundraiser campaign
 * GET  /api/org/[slug]/fundraising — List fundraiser campaigns
 */

import { json, error } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import { loadOrgContext, requireRole } from '$lib/server/org';
import { orgMeetsPlan } from '$lib/server/billing/plan-check';
import { FEATURES } from '$lib/config/features';
import type { RequestHandler } from './$types';

const VALID_STATUSES = ['DRAFT', 'ACTIVE', 'COMPLETE'];

export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!FEATURES.FUNDRAISING) throw error(404, 'Not found');
	if (!locals.user) throw error(401, 'Authentication required');

	const { org, membership } = await loadOrgContext(params.slug, locals.user.id);
	requireRole(membership.role, 'editor');

	const meetsPlan = await orgMeetsPlan(org.id, 'starter');
	if (!meetsPlan) throw error(403, 'Fundraising requires a Starter plan or higher');

	const body = await request.json();
	const { title, description, goalAmountCents, currency } = body;

	if (!title || typeof title !== 'string' || title.trim().length < 3) {
		throw error(400, 'Title is required (minimum 3 characters)');
	}

	if (goalAmountCents !== undefined && goalAmountCents !== null) {
		if (typeof goalAmountCents !== 'number' || !Number.isInteger(goalAmountCents) || goalAmountCents <= 0) {
			throw error(400, 'Goal amount must be a positive integer (in cents)');
		}
	}

	const campaign = await db.campaign.create({
		data: {
			orgId: org.id,
			title: title.trim(),
			description: description?.trim() || null,
			type: 'FUNDRAISER',
			status: 'DRAFT',
			goalAmountCents: goalAmountCents || null,
			donationCurrency: currency || 'usd'
		}
	});

	return json({ id: campaign.id }, { status: 201 });
};

export const GET: RequestHandler = async ({ params, url, locals }) => {
	if (!FEATURES.FUNDRAISING) throw error(404, 'Not found');
	if (!locals.user) throw error(401, 'Authentication required');

	const { org } = await loadOrgContext(params.slug, locals.user.id);

	const status = url.searchParams.get('status');
	const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20', 10) || 20, 1), 100);
	const cursor = url.searchParams.get('cursor') || null;

	const where: Record<string, unknown> = { orgId: org.id, type: 'FUNDRAISER' };
	if (status && VALID_STATUSES.includes(status)) {
		where.status = status;
	}

	const findArgs: Record<string, unknown> = {
		where,
		take: limit + 1,
		orderBy: { createdAt: 'desc' as const },
		select: {
			id: true,
			title: true,
			description: true,
			status: true,
			goalAmountCents: true,
			raisedAmountCents: true,
			donorCount: true,
			donationCurrency: true,
			createdAt: true,
			updatedAt: true
		}
	};

	if (cursor) {
		findArgs.cursor = { id: cursor };
		findArgs.skip = 1;
	}

	const campaigns = await db.campaign.findMany(findArgs as Parameters<typeof db.campaign.findMany>[0]);

	const hasMore = campaigns.length > limit;
	const items = campaigns.slice(0, limit);
	const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

	return json({
		data: items.map((c) => ({
			...c,
			createdAt: c.createdAt.toISOString(),
			updatedAt: c.updatedAt.toISOString()
		})),
		meta: { cursor: nextCursor, hasMore }
	});
};
