/**
 * Server-Side Aggregation
 *
 * Upsert aggregates, apply noise on queries.
 */

import { db } from '$lib/core/db';
import {
	PRIVACY,
	type Metric,
	type Dimensions,
	type AggregateQuery,
	type AggregateResult,
	type AggregateQueryResponse,
	type PrivacyMetadata
} from '$lib/types/analytics';
import { applyLaplace, correctForLDP, correctKaryRR } from './noise';
import { coarsenResults, mergeCoarsenedResults, getCoarseningMetadata } from './coarsen';

// =============================================================================
// RATE LIMITING
// =============================================================================

/**
 * In-memory rate limit map (use Redis in production for multi-instance)
 */
const rateLimits = new Map<
	string,
	{
		count: number;
		windowStart: number;
	}
>();

const MAX_DAILY = PRIVACY.MAX_DAILY_CONTRIBUTIONS;

/**
 * Check contribution limit for a given identifier and metric
 *
 * @param identifier - Hashed IP or session identifier
 * @param metric - Metric being incremented
 * @returns true if contribution allowed, false if limit exceeded
 */
export function checkContributionLimit(identifier: string, metric: Metric): boolean {
	const key = `${identifier}:${metric}`;
	const now = Date.now();
	const windowMs = 24 * 60 * 60 * 1000;

	const entry = rateLimits.get(key);

	if (!entry || now - entry.windowStart > windowMs) {
		rateLimits.set(key, { count: 1, windowStart: now });
		return true;
	}

	if (entry.count >= MAX_DAILY) {
		return false;
	}

	entry.count++;
	return true;
}

/**
 * Prune old entries periodically (prevent memory leak)
 */
export function pruneRateLimits(): void {
	const now = Date.now();
	const windowMs = 24 * 60 * 60 * 1000;

	for (const [key, entry] of rateLimits) {
		if (now - entry.windowStart > windowMs) {
			rateLimits.delete(key);
		}
	}
}

/**
 * Clear rate limits for testing purposes
 *
 * WARNING: Only use in tests. Clears all rate limit state.
 */
export function clearRateLimitsForTesting(): void {
	rateLimits.clear();
}

// =============================================================================
// UTC TIME UTILITIES
// =============================================================================

/**
 * Get today's date at midnight UTC
 *
 * CRITICAL: All time bucketing must use UTC to ensure:
 * 1. Consistent aggregation across timezones
 * 2. Correct privacy budget accounting per calendar day
 * 3. Predictable snapshot materialization timing
 *
 * @returns Date object set to midnight UTC for current day
 */
export function getTodayUTC(): Date {
	const now = new Date();
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
}

/**
 * Get a specific date at midnight UTC
 *
 * @param date - Input date to convert
 * @returns Date object set to midnight UTC for the given date
 */
export function toMidnightUTC(date: Date): Date {
	return new Date(
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0)
	);
}

/**
 * Get date N days ago at midnight UTC
 *
 * @param days - Number of days to subtract
 * @returns Date object set to midnight UTC for N days ago
 */
export function getDaysAgoUTC(days: number): Date {
	const now = new Date();
	const utcDate = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
	);
	return new Date(utcDate.getTime() - days * 24 * 60 * 60 * 1000);
}

// =============================================================================
// INCREMENT (WRITE)
// =============================================================================

/**
 * Increment aggregate counter
 *
 * Atomic upsert: increment if exists, create if not.
 */
export async function incrementAggregate(metric: Metric, dimensions: Dimensions): Promise<void> {
	const today = getTodayUTC();

	// Use empty string for null dimensions in unique constraint (Prisma requirement)
	const template_id = dimensions.template_id ?? '';
	const jurisdiction = dimensions.jurisdiction ?? '';
	const delivery_method = dimensions.delivery_method ?? '';
	const utm_source = dimensions.utm_source ?? '';
	const error_type = dimensions.error_type ?? '';

	await db.analytics_aggregate.upsert({
		where: {
			date_metric_template_id_jurisdiction_delivery_method_utm_source_error_type: {
				date: today,
				metric,
				template_id,
				jurisdiction,
				delivery_method,
				utm_source,
				error_type
			}
		},
		update: {
			count: { increment: 1 }
		},
		create: {
			date: today,
			metric,
			template_id,
			jurisdiction,
			delivery_method,
			utm_source,
			error_type,
			count: 1,
			noise_applied: 0,
			epsilon: PRIVACY.SERVER_EPSILON
		}
	});
}

/**
 * Increment aggregate counter by a specific amount
 *
 * Used for LDP-corrected batch processing where we increment by
 * the corrected count rather than individual increments.
 *
 * @param metric - The metric to increment
 * @param dimensions - Dimension values for aggregation
 * @param amount - Amount to increment by
 */
export async function incrementAggregateByAmount(
	metric: Metric,
	dimensions: Dimensions,
	amount: number
): Promise<void> {
	if (amount <= 0) return; // Nothing to increment

	const today = getTodayUTC();

	// Use empty string for null dimensions in unique constraint (Prisma requirement)
	const template_id = dimensions.template_id ?? '';
	const jurisdiction = dimensions.jurisdiction ?? '';
	const delivery_method = dimensions.delivery_method ?? '';
	const utm_source = dimensions.utm_source ?? '';
	const error_type = dimensions.error_type ?? '';

	await db.analytics_aggregate.upsert({
		where: {
			date_metric_template_id_jurisdiction_delivery_method_utm_source_error_type: {
				date: today,
				metric,
				template_id,
				jurisdiction,
				delivery_method,
				utm_source,
				error_type
			}
		},
		update: {
			count: { increment: amount }
		},
		create: {
			date: today,
			metric,
			template_id,
			jurisdiction,
			delivery_method,
			utm_source,
			error_type,
			count: amount,
			noise_applied: 0,
			epsilon: PRIVACY.SERVER_EPSILON
		}
	});
}

/**
 * Process batch of increments with LDP bias correction
 *
 * High-Performance Implementation:
 * 1. Aggregate in memory first (O(n) pass)
 * 2. Single transaction for all upserts (atomic, connection-pool friendly)
 * 3. No sequential awaits
 *
 * LDP (Local Differential Privacy) adds noise on the client side, biasing
 * the observed metric distribution toward uniform. This function corrects
 * for that bias using k-ary Randomized Response debiasing.
 *
 * CRITICAL: Correction is STATISTICAL - it works on aggregates, not individual reports.
 *
 * @param increments - Array of metric increments to process
 * @returns Object with number of processed increments
 */
export async function processBatch(
	increments: Array<{ metric: Metric; dimensions?: Dimensions }>
): Promise<{ processed: number }> {
	if (increments.length === 0) {
		return { processed: 0 };
	}

	// Step 1: Count observed metrics for LDP correction
	const observedCounts = new Map<Metric, number>();
	for (const inc of increments) {
		observedCounts.set(inc.metric, (observedCounts.get(inc.metric) ?? 0) + 1);
	}

	// Step 2: Apply LDP correction
	const corrected = correctKaryRR(observedCounts, increments.length);

	// Step 3: Aggregate in memory by bucket key
	const buckets = new Map<
		string,
		{
			metric: Metric;
			dimensions: Dimensions;
			count: number;
		}
	>();

	for (const inc of increments) {
		const dims = inc.dimensions ?? {};
		const correctedCount = corrected.get(inc.metric) ?? 0;

		if (correctedCount <= 0) continue;

		const key = makeBucketKey(inc.metric, dims);
		const existing = buckets.get(key);

		if (existing) {
			existing.count += correctedCount;
		} else {
			buckets.set(key, {
				metric: inc.metric,
				dimensions: dims,
				count: correctedCount
			});
		}
	}

	if (buckets.size === 0) {
		return { processed: 0 };
	}

	// Step 4: Single transaction for all upserts
	const today = getTodayUTC();

	await db.$transaction(
		Array.from(buckets.values()).map((bucket) =>
			db.analytics_aggregate.upsert({
				where: {
					date_metric_template_id_jurisdiction_delivery_method_utm_source_error_type: {
						date: today,
						metric: bucket.metric,
						template_id: bucket.dimensions.template_id ?? '',
						jurisdiction: bucket.dimensions.jurisdiction ?? '',
						delivery_method: bucket.dimensions.delivery_method ?? '',
						utm_source: bucket.dimensions.utm_source ?? '',
						error_type: bucket.dimensions.error_type ?? ''
					}
				},
				update: { count: { increment: bucket.count } },
				create: {
					date: today,
					metric: bucket.metric,
					template_id: bucket.dimensions.template_id ?? '',
					jurisdiction: bucket.dimensions.jurisdiction ?? '',
					delivery_method: bucket.dimensions.delivery_method ?? '',
					utm_source: bucket.dimensions.utm_source ?? '',
					error_type: bucket.dimensions.error_type ?? '',
					count: bucket.count,
					noise_applied: 0,
					epsilon: PRIVACY.SERVER_EPSILON
				}
			})
		)
	);

	return { processed: increments.length };
}

/**
 * Make unique bucket key for aggregation
 */
function makeBucketKey(metric: Metric, dims: Dimensions): string {
	return `${metric}|${dims.template_id ?? ''}|${dims.jurisdiction ?? ''}|${dims.delivery_method ?? ''}|${dims.utm_source ?? ''}|${dims.error_type ?? ''}`;
}

// =============================================================================
// QUERY (READ)
// =============================================================================

/**
 * Query aggregates with differential privacy
 */
export async function queryAggregates(params: AggregateQuery): Promise<AggregateQueryResponse> {
	const { metric, start, end, groupBy, filters } = params;

	// Validate date range
	const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
	if (daysDiff > PRIVACY.MAX_QUERY_DAYS) {
		throw new Error(`Query range exceeds ${PRIVACY.MAX_QUERY_DAYS} days`);
	}

	// Build where clause
	const where: Record<string, unknown> = {
		metric,
		date: { gte: start, lte: end }
	};

	if (filters?.template_id) where.template_id = filters.template_id;
	if (filters?.jurisdiction) where.jurisdiction = filters.jurisdiction;
	if (filters?.delivery_method) where.delivery_method = filters.delivery_method;

	// Fetch raw aggregates
	const raw = await db.analytics_aggregate.findMany({
		where,
		select: {
			template_id: true,
			jurisdiction: true,
			delivery_method: true,
			utm_source: true,
			error_type: true,
			count: true
		}
	});

	// Group by requested dimensions
	const grouped = groupByDimensions(raw, groupBy);

	// Apply coarsening for small cohorts (noise applied inside coarsenResults)
	const coarsened = await coarsenResults(
		grouped,
		async (_metric, level, value) => {
			// Get aggregate count at coarser level
			const result = await db.analytics_aggregate.aggregate({
				where: {
					metric,
					date: { gte: start, lte: end },
					...(level === 'state' && { jurisdiction: value }),
					...(level === 'national' && {})
				},
				_sum: { count: true }
			});
			return result._sum.count ?? 0;
		},
		metric
	);

	// Merge results that coarsened to same bucket
	const merged = mergeCoarsenedResults(coarsened);

	// Calculate total epsilon spent (from coarsening)
	const coarseningMetadata = getCoarseningMetadata(merged);

	// Convert to AggregateResult format (noise already applied in coarsening)
	const noisy: AggregateResult[] = merged.map((r) => ({
		dimensions: { [groupBy?.[0] ?? 'jurisdiction']: r.value } as Record<string, string | null>,
		count: r.count, // Already noisy from coarsenResults
		coarsened: r.coarsened,
		coarsen_level: r.coarsened ? r.level : undefined,
		original_level: r.original_level
	}));

	// Build privacy metadata
	const privacy: PrivacyMetadata = {
		epsilon: coarseningMetadata.total_epsilon,
		differential_privacy: true,
		ldp_corrected: true, // k-ary RR correction applied in processBatch
		coarsening_applied: coarseningMetadata.any_coarsened,
		coarsen_threshold: PRIVACY.COARSEN_THRESHOLD
	};

	return {
		success: true,
		metric,
		date_range: {
			start: start.toISOString(),
			end: end.toISOString()
		},
		results: noisy,
		privacy
	};
}

/**
 * Group raw results by dimensions
 */
function groupByDimensions(
	raw: Array<{
		template_id: string | null;
		jurisdiction: string | null;
		delivery_method: string | null;
		utm_source: string | null;
		error_type: string | null;
		count: number;
	}>,
	groupBy?: string[]
): AggregateResult[] {
	if (!groupBy || groupBy.length === 0) {
		// No grouping — sum all
		const total = raw.reduce((sum, r) => sum + r.count, 0);
		return [
			{
				dimensions: {},
				count: total,
				coarsened: false
			}
		];
	}

	// Group by first dimension (simplified)
	const key = groupBy[0] as keyof (typeof raw)[0];
	const groups = new Map<string | null, number>();

	for (const r of raw) {
		const value = r[key] as string | null;
		groups.set(value, (groups.get(value) ?? 0) + r.count);
	}

	return Array.from(groups.entries()).map(([value, count]) => ({
		dimensions: { [key]: value } as Record<string, string | null>,
		count,
		coarsened: false
	}));
}

// =============================================================================
// HEALTH DASHBOARD
// =============================================================================

/**
 * Get platform health metrics
 */
export async function getHealthMetrics() {
	const now = getTodayUTC();
	const thirtyDaysAgo = getDaysAgoUTC(30);
	const sevenDaysAgo = getDaysAgoUTC(7);

	// Template adoption (30 days)
	const [views30d, uses30d] = await Promise.all([
		db.analytics_aggregate.aggregate({
			where: { metric: 'template_view', date: { gte: thirtyDaysAgo } },
			_sum: { count: true }
		}),
		db.analytics_aggregate.aggregate({
			where: { metric: 'template_use', date: { gte: thirtyDaysAgo } },
			_sum: { count: true }
		})
	]);

	// Delivery health (7 days)
	const [attempted7d, succeeded7d, failed7d] = await Promise.all([
		db.analytics_aggregate.aggregate({
			where: { metric: 'delivery_attempt', date: { gte: sevenDaysAgo } },
			_sum: { count: true }
		}),
		db.analytics_aggregate.aggregate({
			where: { metric: 'delivery_success', date: { gte: sevenDaysAgo } },
			_sum: { count: true }
		}),
		db.analytics_aggregate.aggregate({
			where: { metric: 'delivery_fail', date: { gte: sevenDaysAgo } },
			_sum: { count: true }
		})
	]);

	// Apply noise to all counts
	const viewsNoisy = applyLaplace(views30d._sum.count ?? 0);
	const usesNoisy = applyLaplace(uses30d._sum.count ?? 0);
	const attemptedNoisy = applyLaplace(attempted7d._sum.count ?? 0);
	const succeededNoisy = applyLaplace(succeeded7d._sum.count ?? 0);
	const failedNoisy = applyLaplace(failed7d._sum.count ?? 0);

	return {
		success: true,
		metrics: {
			template_adoption: {
				views_30d: viewsNoisy,
				uses_30d: usesNoisy,
				conversion_rate: viewsNoisy > 0 ? usesNoisy / viewsNoisy : 0
			},
			delivery_health: {
				attempted_7d: attemptedNoisy,
				succeeded_7d: succeededNoisy,
				failed_7d: failedNoisy,
				success_rate: attemptedNoisy > 0 ? succeededNoisy / attemptedNoisy : 0
			}
		},
		privacy: {
			epsilon: PRIVACY.SERVER_EPSILON,
			differential_privacy: true as const,
			ldp_corrected: true, // k-ary RR correction applied in processBatch
			coarsening_applied: false,
			coarsen_threshold: PRIVACY.COARSEN_THRESHOLD
		},
		generated_at: new Date().toISOString()
	};
}
