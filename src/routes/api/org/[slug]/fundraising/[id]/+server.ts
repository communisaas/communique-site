/**
 * PATCH /api/org/[slug]/fundraising/[id] — Update fundraiser campaign
 * DELETE /api/org/[slug]/fundraising/[id] — Cancel (soft-delete) fundraiser
 */

import { json, error } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import { loadOrgContext, requireRole } from '$lib/server/org';
import { FEATURES } from '$lib/config/features';
import type { RequestHandler } from './$types';

const VALID_STATUSES = ['DRAFT', 'ACTIVE', 'COMPLETE'];

async function loadFundraiser(orgId: string, campaignId: string) {
	const campaign = await db.campaign.findFirst({
		where: { id: campaignId, orgId, type: 'FUNDRAISER' }
	});
	if (!campaign) throw error(404, 'Fundraiser not found');
	return campaign;
}

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!FEATURES.FUNDRAISING) throw error(404, 'Not found');
	if (!locals.user) throw error(401, 'Authentication required');

	const { org, membership } = await loadOrgContext(params.slug, locals.user.id);
	requireRole(membership.role, 'editor');

	const campaign = await loadFundraiser(org.id, params.id);

	const body = await request.json();
	const { title, description, status, goalAmountCents } = body;

	const data: Record<string, unknown> = {};

	if (title !== undefined) {
		if (typeof title !== 'string' || title.trim().length < 3) {
			throw error(400, 'Title must be at least 3 characters');
		}
		data.title = title.trim();
	}

	if (description !== undefined) {
		data.description = description?.trim() || null;
	}

	if (status !== undefined) {
		if (!VALID_STATUSES.includes(status)) {
			throw error(400, 'Status must be one of: DRAFT, ACTIVE, COMPLETE');
		}
		data.status = status;
	}

	if (goalAmountCents !== undefined) {
		if (goalAmountCents !== null && (typeof goalAmountCents !== 'number' || !Number.isInteger(goalAmountCents) || goalAmountCents <= 0)) {
			throw error(400, 'Goal amount must be a positive integer (in cents)');
		}
		data.goalAmountCents = goalAmountCents;
	}

	if (Object.keys(data).length === 0) {
		throw error(400, 'No fields to update');
	}

	const updated = await db.campaign.update({
		where: { id: campaign.id },
		data,
		select: {
			id: true,
			title: true,
			description: true,
			status: true,
			goalAmountCents: true,
			raisedAmountCents: true,
			donorCount: true,
			donationCurrency: true,
			updatedAt: true
		}
	});

	return json({
		...updated,
		updatedAt: updated.updatedAt.toISOString()
	});
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!FEATURES.FUNDRAISING) throw error(404, 'Not found');
	if (!locals.user) throw error(401, 'Authentication required');

	const { org, membership } = await loadOrgContext(params.slug, locals.user.id);
	requireRole(membership.role, 'editor');

	const campaign = await loadFundraiser(org.id, params.id);

	// Soft delete — set status to COMPLETE
	await db.campaign.update({
		where: { id: campaign.id },
		data: { status: 'COMPLETE' }
	});

	return json({ success: true });
};
