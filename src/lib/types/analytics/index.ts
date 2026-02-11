/**
 * Analytics Types - Barrel Export
 *
 * Modular type system for aggregation-only analytics.
 */

// Metrics and dimensions
export {
	METRICS,
	METRIC_VALUES,
	DELIVERY_METHODS,
	ERROR_TYPES,
	DIMENSION_KEYS,
	PRIVACY,
	isMetric,
	isDeliveryMethod,
	isErrorType,
	isDimensionKey
} from './metrics';

export type { Metric, DeliveryMethod, ErrorType, Dimensions, DimensionKey } from './metrics';

// Aggregate types
export type {
	AggregateRecord,
	Increment,
	IncrementBatch,
	IncrementResponse,
	AggregateQuery,
	AggregateResult,
	PrivacyMetadata,
	AggregateQueryResponse,
	HealthMetrics,
	HealthResponse
} from './aggregate';

// Cohort types
export { COHORT_STORAGE_KEY } from './cohort';

export type {
	CohortToken,
	RetentionRates,
	CohortRetention,
	CohortRecord,
	CohortQuery,
	CohortQueryResponse
} from './cohort';

// Jurisdiction types
export {
	COARSEN_LEVELS,
	REGIONS,
	STATE_TO_REGION,
	METRO_AREAS,
	getRegion,
	parseJurisdiction
} from './jurisdiction';

export type { JurisdictionHierarchy, CoarsenLevel, CoarsenResult } from './jurisdiction';

// Percolation types (specialized analytics)
export type { PercolationData, FusionData, AnalyticsError } from './percolation';

// Session and experiment types (from JSON schema helpers)
export type {
	AnalyticsSession,
	AnalyticsSessionMetrics,
	AnalyticsDeviceData,
	AnalyticsFunnelProgress,
	AnalyticsEventProperties,
	AnalyticsComputedMetrics,
	AnalyticsExperiment,
	AnalyticsExperimentConfig,
	AnalyticsExperimentMetricsCache
} from '../json-schemas';
