/**
 * Cohort Types
 *
 * Types for privacy-preserving cohort analysis.
 */

// =============================================================================
// COHORT TOKEN
// =============================================================================

/**
 * Cohort token stored in browser localStorage
 *
 * Properties:
 * - Random UUID (not derived from identity)
 * - 30-day TTL
 * - User can clear localStorage to opt out
 * - Not linked to user accounts
 */
export interface CohortToken {
	/** Random UUID */
	token: string;
	/** Timestamp when created */
	created: number;
	/** Timestamp when expires */
	expires: number;
}

/**
 * localStorage key for cohort token
 */
export const COHORT_STORAGE_KEY = 'analytics_cohort';

// =============================================================================
// RETENTION METRICS
// =============================================================================

/**
 * Weekly retention rates for a cohort
 */
export interface RetentionRates {
	week_1: number;
	week_2: number;
	week_3: number;
	week_4: number;
}

/**
 * Single cohort's retention data
 */
export interface CohortRetention {
	/** ISO date string for week start */
	cohort_week: string;
	/** Initial cohort size (noisy) */
	initial_size: number;
	/** Retention rates by week (all noisy) */
	retention: RetentionRates;
}

/**
 * Cohort database record
 */
export interface CohortRecord {
	id: string;
	cohort_week: Date;
	initial_size: number;
	week_1_active: number;
	week_2_active: number;
	week_3_active: number;
	week_4_active: number;
	epsilon: number;
}

// =============================================================================
// API TYPES
// =============================================================================

/**
 * Cohort query parameters
 */
export interface CohortQuery {
	/** Number of weeks to include */
	weeks?: number;
	/** Optional template filter */
	template_id?: string;
}

/**
 * Cohort query response
 */
export interface CohortQueryResponse {
	success: boolean;
	cohorts: CohortRetention[];
	privacy: {
		epsilon: number;
		differential_privacy: true;
	};
}
