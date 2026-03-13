/**
 * PATCH /api/org/[slug]/campaigns/targeting — Update campaign geographic targeting.
 * Requires editor+ role.
 */

import { json, error } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import { loadOrgContext, requireRole } from '$lib/server/org';
import { VALID_JURISDICTIONS, VALID_COUNTRY_CODES } from '$lib/server/geographic/types';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) throw error(401, 'Authentication required');

	const { org, membership } = await loadOrgContext(params.slug, locals.user.id);
	requireRole(membership.role, 'editor');

	const body = await request.json();
	const { campaignId, targetJurisdiction, targetCountry } = body;

	if (!campaignId) {
		throw error(400, 'campaignId is required');
	}

	// Validate jurisdiction if provided
	if (targetJurisdiction !== undefined && targetJurisdiction !== null) {
		if (!VALID_JURISDICTIONS.includes(targetJurisdiction)) {
			throw error(400, `Invalid jurisdiction: ${targetJurisdiction}`);
		}
	}

	// Validate country if provided
	if (targetCountry !== undefined) {
		if (!VALID_COUNTRY_CODES.includes(targetCountry)) {
			throw error(400, `Invalid country code: ${targetCountry}`);
		}
	}

	// Verify campaign belongs to org
	const campaign = await db.campaign.findFirst({
		where: { id: campaignId, orgId: org.id }
	});

	if (!campaign) {
		throw error(404, 'Campaign not found');
	}

	const data: Record<string, unknown> = {};
	if (targetJurisdiction !== undefined) data.targetJurisdiction = targetJurisdiction;
	if (targetCountry !== undefined) data.targetCountry = targetCountry;

	if (Object.keys(data).length === 0) {
		throw error(400, 'No targeting fields provided');
	}

	const updated = await db.campaign.update({
		where: { id: campaignId },
		data
	});

	return json({
		success: true,
		data: {
			id: updated.id,
			targetJurisdiction: updated.targetJurisdiction,
			targetCountry: updated.targetCountry
		}
	});
};
