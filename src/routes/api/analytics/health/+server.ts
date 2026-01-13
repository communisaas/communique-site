/**
 * GET /api/analytics/health
 *
 * Platform health dashboard metrics with differential privacy.
 * Returns template adoption and delivery health stats.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getHealthMetrics } from '$lib/core/analytics/aggregate';

export const GET: RequestHandler = async () => {
	try {
		const metrics = await getHealthMetrics();
		return json(metrics);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Health metrics query failed';
		return json({ success: false, error: message }, { status: 500 });
	}
};
