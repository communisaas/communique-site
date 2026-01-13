/**
 * Postgres-Based Distributed Rate Limiting
 *
 * Multi-instance rate limiting using existing Neon Postgres.
 * Designed for analytics contribution limits but can be used for any rate limiting.
 *
 * ## Design Philosophy
 *
 * 1. **Single Source of Truth**: Postgres handles concurrent access across instances
 * 2. **Atomic Operations**: Upsert with conditional increment prevents race conditions
 * 3. **Graceful Degradation**: Falls back to permissive on DB errors (privacy > blocking)
 * 4. **Minimal Overhead**: Single query per check, day granularity for efficiency
 *
 * ## Why Not Redis?
 *
 * - Neon Postgres already available (zero additional infrastructure)
 * - Single maintainer, operational simplicity matters
 * - For DP limits, approximate enforcement is acceptable
 * - Privacy guarantees come from DP noise, not exact rate limits
 *
 * ## Usage
 *
 * ```typescript
 * import { checkContributionLimitDB, RateLimitResult } from './rate-limit-db';
 *
 * // Check if contribution is allowed
 * const result = await checkContributionLimitDB(hashedIP, 'template_view');
 *
 * if (result.allowed) {
 *   // Process the contribution
 * } else {
 *   // Silently drop (don't reveal rate limiting to client)
 * }
 * ```
 *
 * @see docs/architecture/rate-limiting.md for full design rationale
 */

import { db } from '$lib/core/db';
import { PRIVACY, type Metric } from '$lib/types/analytics';
import { getTodayUTC, getDaysAgoUTC } from './aggregate';

// =============================================================================
// TYPES
// =============================================================================

export interface RateLimitResult {
	/** Whether the contribution is allowed */
	allowed: boolean;
	/** Current count for this window */
	count: number;
	/** Maximum allowed in window */
	limit: number;
	/** Remaining contributions in window */
	remaining: number;
	/** Whether result came from DB or fallback */
	source: 'db' | 'fallback';
}

export interface RateLimitStats {
	/** Total active rate limit entries */
	activeEntries: number;
	/** Entries from today */
	todayEntries: number;
	/** Implementation type */
	implementation: 'postgres';
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Feature flag for DB-based rate limiting
 *
 * When false, always returns allowed=true (use in-memory fallback)
 * Set via environment variable: RATE_LIMIT_USE_DB=true
 */
export function isDBRateLimitEnabled(): boolean {
	return process.env.RATE_LIMIT_USE_DB === 'true';
}

/**
 * Default daily contribution limit per identifier per metric
 */
const DEFAULT_LIMIT = PRIVACY.MAX_DAILY_CONTRIBUTIONS;

// =============================================================================
// CORE RATE LIMITING
// =============================================================================

/**
 * Check and increment contribution limit using Postgres
 *
 * Atomic operation: checks current count and increments in single query.
 * Uses upsert with conditional increment to prevent race conditions.
 *
 * @param identifier - Hashed IP or session identifier (SHA-256 hex string)
 * @param metric - Metric being incremented
 * @param limit - Maximum contributions allowed (default: MAX_DAILY_CONTRIBUTIONS)
 * @returns Rate limit result with allowed status and metadata
 *
 * @example
 * ```typescript
 * const hashedIP = hashIP(clientIP);
 * const result = await checkContributionLimitDB(hashedIP, 'template_view');
 *
 * if (result.allowed) {
 *   await incrementAggregate('template_view', dimensions);
 * }
 * ```
 */
export async function checkContributionLimitDB(
	identifier: string,
	metric: Metric,
	limit: number = DEFAULT_LIMIT
): Promise<RateLimitResult> {
	// Feature flag check
	if (!isDBRateLimitEnabled()) {
		return {
			allowed: true,
			count: 0,
			limit,
			remaining: limit,
			source: 'fallback'
		};
	}

	const key = `${identifier}:${metric}`;
	const windowStart = getTodayUTC();

	try {
		// Atomic upsert with conditional increment
		// Uses raw query for atomic check-and-increment in single round trip
		const result = await db.$queryRaw<
			Array<{
				count: number;
				allowed: boolean;
			}>
		>`
			INSERT INTO rate_limits (id, key, window_start, count, created_at, updated_at)
			VALUES (
				gen_random_uuid()::text,
				${key},
				${windowStart}::date,
				1,
				NOW(),
				NOW()
			)
			ON CONFLICT (key, window_start)
			DO UPDATE SET
				count = CASE
					WHEN rate_limits.count < ${limit} THEN rate_limits.count + 1
					ELSE rate_limits.count
				END,
				updated_at = NOW()
			RETURNING
				count,
				(count <= ${limit}) as allowed
		`;

		const row = result[0];
		if (!row) {
			// Should never happen, but fallback to permissive
			return {
				allowed: true,
				count: 0,
				limit,
				remaining: limit,
				source: 'fallback'
			};
		}

		return {
			allowed: row.allowed,
			count: row.count,
			limit,
			remaining: Math.max(0, limit - row.count),
			source: 'db'
		};
	} catch (error) {
		// Log error but don't block requests
		// Privacy > availability: prefer letting through over blocking
		console.error('[RateLimitDB] Error checking rate limit:', error);

		return {
			allowed: true,
			count: 0,
			limit,
			remaining: limit,
			source: 'fallback'
		};
	}
}

/**
 * Check rate limit without incrementing
 *
 * Useful for checking current status without consuming a slot.
 *
 * @param identifier - Hashed IP or session identifier
 * @param metric - Metric to check
 * @param limit - Maximum contributions allowed
 * @returns Current rate limit status
 */
export async function getRateLimitStatus(
	identifier: string,
	metric: Metric,
	limit: number = DEFAULT_LIMIT
): Promise<RateLimitResult> {
	if (!isDBRateLimitEnabled()) {
		return {
			allowed: true,
			count: 0,
			limit,
			remaining: limit,
			source: 'fallback'
		};
	}

	const key = `${identifier}:${metric}`;
	const windowStart = getTodayUTC();

	try {
		const result = await db.rateLimit.findUnique({
			where: {
				key_window_start: {
					key,
					window_start: windowStart
				}
			},
			select: {
				count: true
			}
		});

		const count = result?.count ?? 0;

		return {
			allowed: count < limit,
			count,
			limit,
			remaining: Math.max(0, limit - count),
			source: 'db'
		};
	} catch (error) {
		console.error('[RateLimitDB] Error getting status:', error);

		return {
			allowed: true,
			count: 0,
			limit,
			remaining: limit,
			source: 'fallback'
		};
	}
}

// =============================================================================
// BATCH OPERATIONS
// =============================================================================

/**
 * Check multiple rate limits in a single query
 *
 * Efficient for batch processing where multiple metrics need checking.
 *
 * @param identifier - Hashed IP or session identifier
 * @param metrics - Array of metrics to check
 * @param limit - Maximum contributions per metric
 * @returns Map of metric to rate limit result
 */
export async function checkBatchRateLimits(
	identifier: string,
	metrics: Metric[],
	limit: number = DEFAULT_LIMIT
): Promise<Map<Metric, RateLimitResult>> {
	const results = new Map<Metric, RateLimitResult>();

	if (!isDBRateLimitEnabled()) {
		for (const metric of metrics) {
			results.set(metric, {
				allowed: true,
				count: 0,
				limit,
				remaining: limit,
				source: 'fallback'
			});
		}
		return results;
	}

	const windowStart = getTodayUTC();
	const keys = metrics.map((m) => `${identifier}:${m}`);

	try {
		// Fetch all existing rate limit entries in one query
		const existing = await db.rateLimit.findMany({
			where: {
				key: { in: keys },
				window_start: windowStart
			},
			select: {
				key: true,
				count: true
			}
		});

		// Build map of existing counts
		const countMap = new Map<string, number>();
		for (const entry of existing) {
			countMap.set(entry.key, entry.count);
		}

		// Build results
		for (const metric of metrics) {
			const key = `${identifier}:${metric}`;
			const count = countMap.get(key) ?? 0;

			results.set(metric, {
				allowed: count < limit,
				count,
				limit,
				remaining: Math.max(0, limit - count),
				source: 'db'
			});
		}

		return results;
	} catch (error) {
		console.error('[RateLimitDB] Error checking batch limits:', error);

		// Fallback to permissive
		for (const metric of metrics) {
			results.set(metric, {
				allowed: true,
				count: 0,
				limit,
				remaining: limit,
				source: 'fallback'
			});
		}
		return results;
	}
}

// =============================================================================
// CLEANUP
// =============================================================================

/**
 * Delete old rate limit entries
 *
 * Should be called daily via cron job.
 * Deletes entries older than specified days (default: 2 days).
 *
 * @param olderThanDays - Delete entries older than this many days
 * @returns Number of deleted entries
 *
 * @example
 * ```typescript
 * // In cron job handler
 * const deleted = await cleanupOldRateLimits(2);
 * console.log(`Cleaned up ${deleted} rate limit entries`);
 * ```
 */
export async function cleanupOldRateLimits(olderThanDays: number = 2): Promise<number> {
	const cutoffDate = getDaysAgoUTC(olderThanDays);

	try {
		const result = await db.rateLimit.deleteMany({
			where: {
				window_start: {
					lt: cutoffDate
				}
			}
		});

		console.log(
			`[RateLimitDB] Cleanup: deleted ${result.count} entries older than ${olderThanDays} days`
		);
		return result.count;
	} catch (error) {
		console.error('[RateLimitDB] Error during cleanup:', error);
		return 0;
	}
}

// =============================================================================
// MONITORING
// =============================================================================

/**
 * Get rate limit statistics for monitoring
 *
 * @returns Statistics about rate limit entries
 */
export async function getRateLimitStats(): Promise<RateLimitStats> {
	try {
		const today = getTodayUTC();

		const [totalCount, todayCount] = await Promise.all([
			db.rateLimit.count(),
			db.rateLimit.count({
				where: {
					window_start: today
				}
			})
		]);

		return {
			activeEntries: totalCount,
			todayEntries: todayCount,
			implementation: 'postgres'
		};
	} catch (error) {
		console.error('[RateLimitDB] Error getting stats:', error);

		return {
			activeEntries: 0,
			todayEntries: 0,
			implementation: 'postgres'
		};
	}
}

// =============================================================================
// HYBRID APPROACH (In-Memory + DB)
// =============================================================================

/**
 * In-memory cache for fast-path rejections
 *
 * Optimization: If we've already seen this identifier exceed the limit today,
 * don't bother hitting the database. This reduces DB load for repeat offenders.
 *
 * IMPORTANT: This cache is per-instance and may allow slightly more requests
 * than the exact limit across multiple instances. For DP purposes, this is
 * acceptable because the privacy guarantee comes from the noise, not exact limits.
 */
const localCache = new Map<
	string,
	{
		exceededAt: number; // Timestamp when limit was exceeded
		windowStart: number; // Day start timestamp
	}
>();

/**
 * Check contribution limit with hybrid in-memory + Postgres approach
 *
 * Fast path: If local cache shows exceeded, skip DB query.
 * Slow path: Query DB for authoritative check.
 *
 * @param identifier - Hashed IP or session identifier
 * @param metric - Metric being incremented
 * @param limit - Maximum contributions allowed
 * @returns Rate limit result
 */
export async function checkContributionLimitHybrid(
	identifier: string,
	metric: Metric,
	limit: number = DEFAULT_LIMIT
): Promise<RateLimitResult> {
	const key = `${identifier}:${metric}`;
	const now = Date.now();
	const todayStart = getTodayUTC().getTime();

	// Fast path: Check local cache for known exceeded limits
	const cached = localCache.get(key);
	if (cached && cached.windowStart === todayStart) {
		// Already exceeded today, skip DB query
		return {
			allowed: false,
			count: limit,
			limit,
			remaining: 0,
			source: 'db' // Report as DB since that's the source of truth
		};
	}

	// Slow path: Authoritative DB check
	const result = await checkContributionLimitDB(identifier, metric, limit);

	// Update local cache if limit exceeded
	if (!result.allowed && result.source === 'db') {
		localCache.set(key, {
			exceededAt: now,
			windowStart: todayStart
		});
	}

	return result;
}

/**
 * Prune local cache periodically
 *
 * Removes entries from previous days to prevent memory growth.
 * Should be called periodically (e.g., every hour).
 */
export function pruneLocalCache(): void {
	const todayStart = getTodayUTC().getTime();
	let removedCount = 0;

	for (const [key, entry] of localCache) {
		if (entry.windowStart < todayStart) {
			localCache.delete(key);
			removedCount++;
		}
	}

	if (removedCount > 0) {
		console.log(`[RateLimitDB] Local cache cleanup: removed ${removedCount} stale entries`);
	}
}

// Start periodic cleanup of local cache (every hour)
if (typeof setInterval !== 'undefined') {
	setInterval(pruneLocalCache, 60 * 60 * 1000);
}
