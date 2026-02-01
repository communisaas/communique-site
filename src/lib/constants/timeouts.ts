/**
 * Centralized Timeout Constants
 *
 * Single source of truth for all timeout values used across the application.
 * Organizing timeouts in one place ensures consistency and makes it easier
 * to adjust timing behavior globally.
 *
 * Usage:
 * ```typescript
 * import { TIMEOUTS } from '$lib/constants';
 *
 * await Promise.race([
 *   someOperation(),
 *   new Promise((_, reject) =>
 *     setTimeout(() => reject(new Error('Timeout')), TIMEOUTS.VERIFICATION)
 *   )
 * ]);
 * ```
 */

export const TIMEOUTS = {
	/** API request timeouts */
	API: {
		/** Default API request timeout (2 minutes - increased for demo) */
		DEFAULT: 120_000,
		/** Short timeout for quick operations (30 seconds) */
		SHORT: 30_000,
		/** Long timeout for complex operations (5 minutes - increased for demo) */
		LONG: 300_000
	},

	/** Timeout for Gemini verification phase (2 minutes - increased for demo) */
	VERIFICATION: 120_000,

	/** Timeout for Map API pre-crawl phase (15 seconds) */
	MAP_API: 15_000,

	/** Default polling interval for Firecrawl Agent jobs (2 seconds) */
	FIRECRAWL_POLL: 2_000,

	/** Maximum wait time for Firecrawl Agent jobs (2 minutes) */
	FIRECRAWL_MAX_WAIT: 120_000,

	/** Rate limit delay between starting Firecrawl batch jobs (500ms) */
	FIRECRAWL_BATCH: 500,

	/** Default batch concurrency for Firecrawl jobs */
	FIRECRAWL_BATCH_CONCURRENCY: 4,

	/** Analysis timeout per document in Reducto (60 seconds) */
	DOCUMENT_ANALYSIS: 60_000,

	/** Estimated time per document for progress calculations (30 seconds) */
	DOCUMENT_ANALYSIS_ESTIMATED: 30_000,

	/** Congress API request timeout (30 seconds) */
	CONGRESS_API: 30_000,

	/** Initial retry delay for failed API requests (1 second) */
	RETRY_DELAY_INITIAL: 1_000,

	/** Query complexity thresholds */
	COMPLEX_QUERY: {
		/** Topic count threshold for complex query detection */
		TOPIC_THRESHOLD: 5,
		/** Message length threshold for complex query detection */
		MESSAGE_LENGTH_THRESHOLD: 2000
	}
} as const;

/** Type for accessing TIMEOUTS values */
export type TimeoutValue = typeof TIMEOUTS;
