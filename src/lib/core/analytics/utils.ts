/**
 * Analytics Utility Functions
 *
 * Shared utility functions for analytics modules.
 * Separated from aggregate.ts to avoid circular dependencies.
 *
 * @module analytics/utils
 */

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
