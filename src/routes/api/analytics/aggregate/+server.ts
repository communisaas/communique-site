/**
 * GET /api/analytics/aggregate
 *
 * Query aggregated metrics with differential privacy.
 * Applies Laplace noise and geographic coarsening.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	queryAggregates,
	getTodayUTC,
	getDaysAgoUTC,
	toMidnightUTC
} from '$lib/core/analytics/aggregate';
import { isMetric, PRIVACY, type AggregateQuery } from '$lib/types/analytics';

export const GET: RequestHandler = async ({ url }) => {
	try {
		// Parse query parameters
		const metric = url.searchParams.get('metric');
		const startParam = url.searchParams.get('start');
		const endParam = url.searchParams.get('end');
		const groupByParam = url.searchParams.get('groupBy');
		const templateId = url.searchParams.get('template_id');
		const jurisdiction = url.searchParams.get('jurisdiction');
		const deliveryMethod = url.searchParams.get('delivery_method');

		// Validate required parameters
		if (!metric || !isMetric(metric)) {
			return json(
				{ success: false, error: 'Invalid or missing metric parameter' },
				{ status: 400 }
			);
		}

		// Default date range: last 30 days (UTC)
		const now = getTodayUTC();
		const thirtyDaysAgo = getDaysAgoUTC(30);

		const start = startParam ? toMidnightUTC(new Date(startParam)) : thirtyDaysAgo;
		const end = endParam ? toMidnightUTC(new Date(endParam)) : now;

		// Validate date range
		if (isNaN(start.getTime()) || isNaN(end.getTime())) {
			return json({ success: false, error: 'Invalid date format' }, { status: 400 });
		}

		const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
		if (daysDiff > PRIVACY.MAX_QUERY_DAYS) {
			return json(
				{ success: false, error: `Query range exceeds ${PRIVACY.MAX_QUERY_DAYS} days` },
				{ status: 400 }
			);
		}

		// Build query
		const query: AggregateQuery = {
			metric,
			start,
			end,
			groupBy: groupByParam ? groupByParam.split(',') : undefined,
			filters: {}
		};

		if (templateId) query.filters!.template_id = templateId;
		if (jurisdiction) query.filters!.jurisdiction = jurisdiction;
		if (deliveryMethod) query.filters!.delivery_method = deliveryMethod;

		// Execute query with differential privacy
		const result = await queryAggregates(query);

		return json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Query failed';
		return json({ success: false, error: message }, { status: 500 });
	}
};
