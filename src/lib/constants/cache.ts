/**
 * Centralized Cache TTL Constants
 *
 * Single source of truth for all cache Time-To-Live (TTL) values.
 * Consistent caching strategy across the application.
 *
 * All values are in milliseconds unless otherwise noted.
 *
 * Usage:
 * ```typescript
 * import { CACHE_TTL, MS_PER_DAY } from '$lib/constants';
 *
 * const expiresAt = new Date(Date.now() + CACHE_TTL.ORGANIZATION);
 * ```
 */

/** Milliseconds per second */
export const MS_PER_SECOND = 1_000;

/** Milliseconds per minute */
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;

/** Milliseconds per hour */
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;

/** Milliseconds per day */
export const MS_PER_DAY = 24 * MS_PER_HOUR;

/** Seconds per day (for APIs that use seconds) */
export const SECONDS_PER_DAY = 24 * 60 * 60;

export const CACHE_TTL = {
	/** Session credential cache (7 days) */
	SESSION: 7 * MS_PER_DAY,

	/** Organization data cache (30 days) */
	ORGANIZATION: 30 * MS_PER_DAY,

	/** Geocoding results cache (30 days - locations don't change often) */
	GEOCODING: 30 * MS_PER_DAY,

	/** Census data cache (365 days - annual updates) */
	CENSUS: 365 * MS_PER_DAY,

	/** Bill data cache (90 days) */
	BILL: 90 * MS_PER_DAY,

	/** LLM extraction cache (90 days - semi-permanent for template reuse) */
	LLM_EXTRACTION: 90 * MS_PER_DAY,

	/** Document cache (30 days) */
	DOCUMENT: 30 * MS_PER_DAY,

	/** Member data cache from Congress API (24 hours) */
	CONGRESS_MEMBER: 24 * MS_PER_HOUR,

	/** Vote history cache (1 hour - votes update frequently during sessions) */
	VOTE_HISTORY: MS_PER_HOUR,

	/** AI suggestion cache (5 minutes) */
	AI_SUGGESTION: 5 * MS_PER_MINUTE,

	/** Percolation analysis cache (5 minutes) */
	PERCOLATION: 5 * MS_PER_MINUTE
} as const;

/**
 * Cache TTL values in seconds (for Redis and other second-based APIs)
 */
export const CACHE_TTL_SECONDS = {
	/** Geocoding cache TTL in seconds (30 days) */
	GEOCODING: 30 * SECONDS_PER_DAY,

	/** LLM extraction cache TTL in seconds (90 days) */
	LLM_EXTRACTION: 90 * SECONDS_PER_DAY,

	/** Document cache TTL in seconds (30 days) */
	DOCUMENT: 30 * SECONDS_PER_DAY
} as const;

/** Type for accessing CACHE_TTL values */
export type CacheTTLValue = typeof CACHE_TTL;
