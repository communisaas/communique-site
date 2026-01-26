/**
 * Analytics Module - Barrel Export
 *
 * Aggregation-only analytics with differential privacy.
 *
 * Architecture:
 * - client.ts: Browser-side increment()
 * - aggregate.ts: Server-side upsert/query (RAW DATA - DEPRECATED FOR QUERIES)
 * - snapshot.ts: Materialized noisy views (privacy budget enforcement) ✅ USE THIS
 * - noise.ts: Differential privacy (LDP + Laplace)
 * - coarsen.ts: Geographic hierarchy rollup
 * - sanitize.ts: Input validation
 *
 * ============================================================================
 * DIFFERENTIAL PRIVACY GUARANTEES
 * ============================================================================
 *
 * This system implements a two-layer differential privacy approach:
 *
 * 1. LOCAL DIFFERENTIAL PRIVACY (Client-Side)
 *    - Mechanism: k-ary Randomized Response (RR)
 *    - Epsilon: ε = 2.0 (CLIENT_EPSILON)
 *    - Applied: Before data leaves the client
 *    - Protection: Individual events cannot be traced to a specific user
 *    - Debiasing: Server applies statistical correction (correctKaryRR)
 *
 * 2. CENTRAL DIFFERENTIAL PRIVACY (Server-Side)
 *    - Mechanism: Laplace noise
 *    - Epsilon: ε = 1.0 (SERVER_EPSILON)
 *    - Applied: Once per day during snapshot materialization
 *    - Protection: Aggregate counts cannot reveal individual contributions
 *    - Sensitivity: Δ = 1 (each user can contribute at most 1 to any count)
 *
 * TOTAL PRIVACY BUDGET PER DAY: ε = 10.0 (MAX_DAILY_EPSILON)
 * - Each snapshot materialization consumes ε = 1.0
 * - Budget tracked in privacy_budget table
 * - Budget enforced by snapshot system (queries blocked when exceeded)
 *
 * WHAT EPSILON MEANS:
 * - ε = 0: Perfect privacy (but useless - pure noise)
 * - ε = 1.0: Strong privacy (our server-side setting)
 * - ε = 2.0: Moderate privacy (our client-side setting)
 * - ε = 10+: Weak privacy (total daily budget)
 *
 * Lower ε = stronger privacy but less accurate results
 * Higher ε = weaker privacy but more accurate results
 *
 * PRIVACY THEOREM:
 * For any two neighboring datasets D and D' (differing by one person):
 *   Pr[M(D) = x] ≤ e^ε × Pr[M(D') = x]
 *
 * This means an attacker who sees output x cannot determine with high
 * confidence whether any specific individual's data was included.
 *
 * ============================================================================
 * CRITICAL ARCHITECTURE RULE
 * ============================================================================
 *
 * ⚠️  QUERIES MUST USE SNAPSHOTS, NOT RAW AGGREGATES
 *
 * TWO SYSTEMS:
 * 1. analytics_aggregate table: Raw counts (NO noise applied)
 *    - Purpose: Collect increments efficiently
 *    - Access: WRITE ONLY (increment operations)
 *    - Privacy: NONE (true counts visible)
 *    - Query Risk: Bypasses differential privacy ❌
 *
 * 2. analytics_snapshot table: Noisy counts (Laplace noise applied)
 *    - Purpose: Safe querying with privacy guarantees
 *    - Access: READ ONLY (materialized daily at 00:05 UTC)
 *    - Privacy: FULL (ε = 1.0 per snapshot)
 *    - Query Safety: Privacy enforced ✅
 *
 * CONSOLIDATION (WP-010):
 * - Feature Flag: USE_SNAPSHOT_ONLY (default: true)
 * - When enabled: All queries redirect to snapshots
 * - When disabled: Raw queries allowed (ONLY FOR TESTING)
 * - Deprecation: Raw aggregate queries log warnings
 *
 * EXAMPLE OF PRIVACY LEAK:
 * ```typescript
 * // ❌ WRONG: Queries raw aggregates (no noise, privacy leak)
 * const raw = await db.analytics_aggregate.findMany({
 *   where: { metric: 'template_view' }
 * });
 * const total = raw.reduce((sum, r) => sum + r.count, 0);
 * // Problem: 'total' is the TRUE count, reveals exact user behavior
 *
 * // ✅ CORRECT: Queries noisy snapshots (privacy preserved)
 * const results = await queryNoisySnapshots({
 *   metric: 'template_view',
 *   start: getDaysAgoUTC(7),
 *   end: getTodayUTC()
 * });
 * const total = results[0].count;
 * // Safe: 'total' includes Laplace noise, cannot recover true count
 * ```
 *
 * ============================================================================
 * RATE LIMITING & CONTRIBUTION BOUNDS
 * ============================================================================
 *
 * To maintain DP guarantees, we bound user contributions:
 *
 * - MAX_DAILY_CONTRIBUTIONS: 100 events per metric per day per client
 * - Enforcement: Server-side (checkContributionLimit)
 * - Tracking: Hashed IP addresses (not stored permanently)
 * - Privacy: IP hashes prevent cross-day tracking
 *
 * This ensures the sensitivity Δ = 1 assumption holds (one user cannot
 * contribute unboundedly and break the noise calibration).
 *
 * ============================================================================
 */

// =============================================================================
// CLIENT (Browser)
// =============================================================================

export {
	analytics,
	trackTemplateView,
	trackTemplateUse,
	trackTemplateShare,
	trackDeliveryAttempt,
	trackDeliverySuccess,
	trackDeliveryFailure,
	trackError,
	trackAuthStart,
	trackAuthComplete,
	trackFunnelStep
} from './client';

// =============================================================================
// SERVER (Aggregation)
// =============================================================================

export {
	incrementAggregate,
	processBatch,
	queryAggregates,
	getHealthMetrics,
	getTodayUTC,
	toMidnightUTC,
	getDaysAgoUTC,
	checkContributionLimit,
	clearRateLimitsForTesting
} from './aggregate';

// =============================================================================
// SNAPSHOT (Materialized Views)
// =============================================================================

export {
	materializeNoisySnapshot,
	getRemainingBudget,
	getBudgetStatus,
	queryNoisySnapshots,
	generateNoiseSeed,
	seededLaplace
} from './snapshot';

// =============================================================================
// UTILITIES
// =============================================================================

export {
	sanitizeDimensions,
	sanitizeJurisdiction,
	sanitizeUtmSource,
	categorizeError
} from './sanitize';

export {
	applyLocalDP,
	applyLaplace,
	applyKaryRR,
	correctForLDP,
	correctKaryRR,
	getNoiseStats,
	cryptoRandom
} from './noise';

export { coarsenResults, mergeCoarsenedResults, getCoarseningMetadata } from './coarsen';

// =============================================================================
// DISTRIBUTED RATE LIMITING (Postgres-Based)
// =============================================================================

export {
	checkContributionLimitDB,
	checkContributionLimitHybrid,
	getRateLimitStatus,
	checkBatchRateLimits,
	cleanupOldRateLimits,
	getRateLimitStats,
	isDBRateLimitEnabled,
	pruneLocalCache
} from './rate-limit-db';

export type { RateLimitResult, RateLimitStats } from './rate-limit-db';

// =============================================================================
// TYPES (Re-exported from lib/types/analytics)
// =============================================================================

export {
	METRICS,
	METRIC_VALUES,
	DELIVERY_METHODS,
	ERROR_TYPES,
	PRIVACY,
	isMetric,
	isDeliveryMethod,
	isErrorType
} from '$lib/types/analytics';

export type {
	Metric,
	DeliveryMethod,
	ErrorType,
	Dimensions,
	Increment,
	IncrementBatch,
	AggregateQuery,
	AggregateResult,
	PrivacyMetadata,
	CohortToken,
	CohortRetention,
	JurisdictionHierarchy,
	CoarsenLevel,
	CoarsenResult
} from '$lib/types/analytics';
