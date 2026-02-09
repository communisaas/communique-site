/**
 * Action Domain Metrics API (Wave 15d)
 *
 * GET /api/metrics/action/:domain
 * Returns participation metrics for a specific action domain.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getActionMetrics } from '$lib/core/metrics/coordination-metrics';

export const GET: RequestHandler = async ({ params }) => {
	const domain = params.domain;

	if (!domain || !domain.startsWith('0x')) {
		throw error(400, 'Invalid action domain (expected bytes32 hex)');
	}

	try {
		const metrics = await getActionMetrics(domain);
		return json(metrics);
	} catch (err) {
		console.error('[Metrics] Action metrics error:', err);
		throw error(502, 'Failed to fetch action metrics');
	}
};
