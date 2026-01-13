/**
 * Daily Analytics Maintenance Cron Endpoint
 *
 * SCHEDULE: Run daily at 00:05 UTC
 *
 * This endpoint performs daily maintenance tasks:
 * 1. Materialize noisy snapshots from raw aggregates
 * 2. Clean up old rate limit entries
 *
 * Snapshots are immutable once created - this job is idempotent.
 *
 * AUTHENTICATION:
 * - Requires CRON_SECRET environment variable in production
 * - Pass as Bearer token: Authorization: Bearer <CRON_SECRET>
 *
 * USAGE:
 * ```bash
 * curl -X GET https://communique.app/api/cron/analytics-snapshot \
 *   -H "Authorization: Bearer $CRON_SECRET"
 * ```
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { materializeNoisySnapshot, getRemainingBudget } from '$lib/core/analytics/snapshot';
import { getDaysAgoUTC } from '$lib/core/analytics/aggregate';
import { cleanupOldRateLimits, isDBRateLimitEnabled } from '$lib/core/analytics/rate-limit-db';

/**
 * GET /api/cron/analytics-snapshot
 *
 * Daily maintenance tasks:
 * 1. Materialize noisy snapshots for yesterday's data
 * 2. Clean up rate limit entries older than 2 days
 */
export const GET: RequestHandler = async ({ request }) => {
	// Verify cron secret (for production security)
	const authHeader = request.headers.get('authorization');
	const cronSecret = process.env.CRON_SECRET;

	if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		// Task 1: Materialize yesterday's data (run at 00:05 UTC to ensure previous day is complete)
		const yesterday = getDaysAgoUTC(1);
		const result = await materializeNoisySnapshot(yesterday);
		const budgetRemaining = await getRemainingBudget(yesterday);

		// Task 2: Clean up old rate limit entries (only if DB rate limiting is enabled)
		let rateLimitsDeleted = 0;
		if (isDBRateLimitEnabled()) {
			rateLimitsDeleted = await cleanupOldRateLimits(2);
		}

		return json({
			success: true,
			date: yesterday.toISOString().split('T')[0],
			snapshots_created: result.created,
			epsilon_spent: result.epsilonSpent,
			budget_remaining: budgetRemaining,
			rate_limits_deleted: rateLimitsDeleted,
			rate_limit_db_enabled: isDBRateLimitEnabled()
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Daily maintenance failed';
		return json({ success: false, error: message }, { status: 500 });
	}
};
