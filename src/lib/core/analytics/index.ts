/**
 * Analytics Module - Barrel Export
 *
 * Aggregation-only analytics with differential privacy.
 *
 * Architecture:
 * - client.ts: Browser-side increment()
 * - aggregate.ts: Server-side upsert/query
 * - snapshot.ts: Materialized noisy views (privacy budget enforcement)
 * - noise.ts: Differential privacy (LDP + Laplace)
 * - coarsen.ts: Geographic hierarchy rollup
 * - sanitize.ts: Input validation
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
