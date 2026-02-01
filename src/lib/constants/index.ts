/**
 * Centralized Constants Module
 *
 * Re-exports all application constants for convenient access.
 *
 * Usage:
 * ```typescript
 * import { TIMEOUTS, CACHE_TTL, DB_NAMES } from '$lib/constants';
 * ```
 */

// Timeout constants
export { TIMEOUTS } from './timeouts';
export type { TimeoutValue } from './timeouts';

// Cache TTL constants
export {
	CACHE_TTL,
	CACHE_TTL_SECONDS,
	MS_PER_SECOND,
	MS_PER_MINUTE,
	MS_PER_HOUR,
	MS_PER_DAY,
	SECONDS_PER_DAY
} from './cache';
export type { CacheTTLValue } from './cache';

// Database constants
export { DB_NAMES, STORES, LOCAL_STORAGE_KEYS, COLLECTIONS } from './database';
export type { DBName, StoreName, CollectionName } from './database';

// AI timing constants (existing)
export { AI_SUGGESTION_TIMING } from './ai-timing';
