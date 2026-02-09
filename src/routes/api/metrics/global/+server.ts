/**
 * Global Metrics API (Wave 15d)
 *
 * GET /api/metrics/global
 * Returns aggregate coordination metrics across all campaigns.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getGlobalMetrics } from '$lib/core/metrics/coordination-metrics';

export const GET: RequestHandler = async () => {
	try {
		const metrics = await getGlobalMetrics();
		return json(metrics);
	} catch (err) {
		console.error('[Metrics] Global metrics error:', err);
		throw error(502, 'Failed to fetch global metrics');
	}
};
