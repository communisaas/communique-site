/**
 * Campaign Metrics API (Wave 15d)
 *
 * GET /api/metrics/campaign/:id
 * Returns coordination integrity metrics for a specific campaign.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCampaignMetrics } from '$lib/core/metrics/coordination-metrics';

export const GET: RequestHandler = async ({ params }) => {
	const campaignId = params.id;

	if (!campaignId || campaignId.length < 10) {
		throw error(400, 'Invalid campaign ID');
	}

	try {
		const metrics = await getCampaignMetrics(campaignId);
		return json(metrics);
	} catch (err) {
		if (err instanceof Error && err.message.includes('not found')) {
			throw error(404, 'Campaign not found');
		}
		console.error('[Metrics] Campaign metrics error:', err);
		throw error(502, 'Failed to fetch campaign metrics');
	}
};
