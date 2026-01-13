/**
 * Analytics Metrics & Dimension Definitions
 *
 * Whitelists for allowed values. Anything not on these lists is rejected.
 */

// =============================================================================
// METRICS
// =============================================================================

/**
 * Allowed metric names
 *
 * These are the ONLY metrics that can be incremented.
 * Grouped by category for clarity.
 */
export const METRICS = {
	// Template lifecycle
	template_view: 'template_view',
	template_use: 'template_use',
	template_share: 'template_share',

	// Delivery outcomes
	delivery_attempt: 'delivery_attempt',
	delivery_success: 'delivery_success',
	delivery_fail: 'delivery_fail',

	// Authentication
	auth_start: 'auth_start',
	auth_complete: 'auth_complete',

	// Errors (categorized, never raw messages)
	error_network: 'error_network',
	error_validation: 'error_validation',
	error_auth: 'error_auth',
	error_timeout: 'error_timeout',
	error_unknown: 'error_unknown',

	// Funnel progression
	funnel_1: 'funnel_1',
	funnel_2: 'funnel_2',
	funnel_3: 'funnel_3',
	funnel_4: 'funnel_4',
	funnel_5: 'funnel_5',

	// Cohort tracking
	cohort_first_seen: 'cohort_first_seen',
	cohort_return: 'cohort_return'
} as const;

export type Metric = (typeof METRICS)[keyof typeof METRICS];

export const METRIC_VALUES = Object.values(METRICS);

/**
 * Domain size for k-ary Randomized Response
 *
 * Used in debiasing calculations on the server side.
 */
export const METRIC_DOMAIN_SIZE = METRIC_VALUES.length;

// =============================================================================
// DIMENSIONS
// =============================================================================

/**
 * Delivery methods
 */
export const DELIVERY_METHODS = {
	cwc: 'cwc', // Communicating With Congress
	email: 'email',
	certified: 'certified'
} as const;

export type DeliveryMethod = (typeof DELIVERY_METHODS)[keyof typeof DELIVERY_METHODS];

/**
 * Error types (categorized)
 *
 * Raw error messages are NEVER stored. They are mapped to these
 * categories to prevent PII leakage through stack traces.
 */
export const ERROR_TYPES = {
	network: 'error_network',
	validation: 'error_validation',
	auth: 'error_auth',
	timeout: 'error_timeout',
	unknown: 'error_unknown'
} as const;

export type ErrorType = (typeof ERROR_TYPES)[keyof typeof ERROR_TYPES];

/**
 * Dimensions for aggregation
 *
 * CRITICAL: No session_id, no user_id, no ip_address, no fingerprint
 */
export interface Dimensions {
	/** Template identifier (public, non-PII) */
	template_id?: string;
	/** State code only (2 uppercase chars), NEVER district */
	jurisdiction?: string;
	/** Delivery method from whitelist */
	delivery_method?: DeliveryMethod;
	/** UTM source (sanitized, alphanumeric only) */
	utm_source?: string;
	/** Error type from categorized whitelist */
	error_type?: ErrorType;
	/** Cohort token (random UUID, optional) */
	cohort_token?: string;
}

/**
 * Dimension keys for grouping queries
 */
export type DimensionKey = keyof Dimensions;

export const DIMENSION_KEYS: DimensionKey[] = [
	'template_id',
	'jurisdiction',
	'delivery_method',
	'utm_source',
	'error_type'
];

// =============================================================================
// PRIVACY CONFIGURATION
// =============================================================================

export const PRIVACY = {
	/** Local DP epsilon (client-side noise) */
	CLIENT_EPSILON: 2.0,
	/** Central DP epsilon (server-side noise) */
	SERVER_EPSILON: 1.0,
	/** Sensitivity for counting queries */
	SENSITIVITY: 1,
	/** Daily query budget */
	MAX_DAILY_EPSILON: 10.0,
	/** Coarsening threshold (roll up counts below this) */
	COARSEN_THRESHOLD: 5,
	/** Maximum date range for queries */
	MAX_QUERY_DAYS: 90,
	/** Maximum batch size for increments */
	MAX_BATCH_SIZE: 100,
	/** Cohort token TTL in days */
	COHORT_TTL_DAYS: 30,
	/** Maximum contributions per metric per day per client */
	MAX_DAILY_CONTRIBUTIONS: 100
} as const;

// =============================================================================
// TYPE GUARDS
// =============================================================================

export function isMetric(value: string): value is Metric {
	return METRIC_VALUES.includes(value as Metric);
}

export function isDeliveryMethod(value: string): value is DeliveryMethod {
	return Object.values(DELIVERY_METHODS).includes(value as DeliveryMethod);
}

export function isErrorType(value: string): value is ErrorType {
	return Object.values(ERROR_TYPES).includes(value as ErrorType);
}

export function isDimensionKey(value: string): value is DimensionKey {
	return DIMENSION_KEYS.includes(value as DimensionKey);
}
