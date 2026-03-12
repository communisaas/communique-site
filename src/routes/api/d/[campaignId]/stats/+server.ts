/**
 * GET /api/d/[campaignId]/stats — Public donation stats for live polling
 */

import { json, error } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import { FEATURES } from '$lib/config/features';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	if (!FEATURES.FUNDRAISING) throw error(404, 'Not found');

	const campaign = await db.campaign.findUnique({
		where: { id: params.campaignId },
		select: {
			raisedAmountCents: true,
			donorCount: true,
			goalAmountCents: true,
			donationCurrency: true
		}
	});

	if (!campaign) throw error(404, 'Campaign not found');

	return json({
		raisedAmountCents: campaign.raisedAmountCents,
		donorCount: campaign.donorCount,
		goalAmountCents: campaign.goalAmountCents,
		currency: campaign.donationCurrency
	});
};
