/**
 * GET /api/analytics/cohort
 *
 * Query cohort retention metrics with differential privacy.
 * Returns day-N retention rates for cohort analysis.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/core/db';
import { applyLaplace } from '$lib/core/analytics/noise';
import { getTodayUTC, getDaysAgoUTC, toMidnightUTC } from '$lib/core/analytics/aggregate';
import { PRIVACY, type CohortQueryResponse, type RetentionRates } from '$lib/types/analytics';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const cohortDate = url.searchParams.get('cohort_date');
		const daysParam = url.searchParams.get('days');

		// Default: last 30 days of cohorts (UTC)
		const now = getTodayUTC();
		const thirtyDaysAgo = getDaysAgoUTC(30);

		const startDate = cohortDate ? toMidnightUTC(new Date(cohortDate)) : thirtyDaysAgo;
		const days = daysParam ? parseInt(daysParam, 10) : 7;

		if (isNaN(startDate.getTime())) {
			return json({ success: false, error: 'Invalid cohort_date format' }, { status: 400 });
		}

		if (isNaN(days) || days < 1 || days > 30) {
			return json({ success: false, error: 'days must be 1-30' }, { status: 400 });
		}

		// Query cohort first-seen and return events
		const [firstSeenResult, returnResults] = await Promise.all([
			db.analytics_aggregate.aggregate({
				where: {
					metric: 'cohort_first_seen',
					date: { gte: startDate, lte: now }
				},
				_sum: { count: true }
			}),
			Promise.all(
				Array.from({ length: days }, (_, i) => i + 1).map(async (day) => {
					const dayStart = new Date(startDate.getTime() + day * 24 * 60 * 60 * 1000);
					const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

					const result = await db.analytics_aggregate.aggregate({
						where: {
							metric: 'cohort_return',
							date: { gte: dayStart, lt: dayEnd }
						},
						_sum: { count: true }
					});

					return { day, count: result._sum.count ?? 0 };
				})
			)
		]);

		const cohortSize = firstSeenResult._sum.count ?? 0;
		const noisyCohortSize = applyLaplace(cohortSize);

		// Build retention rates with noise
		const retention: RetentionRates = {};
		for (const { day, count } of returnResults) {
			const noisyCount = applyLaplace(count);
			retention[`day_${day}` as keyof RetentionRates] =
				noisyCohortSize > 0 ? noisyCount / noisyCohortSize : 0;
		}

		const response: CohortQueryResponse = {
			success: true,
			cohort_date: startDate.toISOString().split('T')[0],
			cohort_size: noisyCohortSize,
			retention,
			privacy: {
				epsilon: PRIVACY.SERVER_EPSILON,
				differential_privacy: true,
				ldp_corrected: false,
				coarsening_applied: false,
				coarsen_threshold: PRIVACY.COARSEN_THRESHOLD
			}
		};

		return json(response);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Cohort query failed';
		return json({ success: false, error: message }, { status: 500 });
	}
};
