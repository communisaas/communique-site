/**
 * Centralized Database Constants
 *
 * Single source of truth for database names and collection names.
 * This ensures consistency across the application and makes it easier
 * to manage database resources.
 *
 * Usage:
 * ```typescript
 * import { DB_NAMES, COLLECTIONS } from '$lib/constants';
 *
 * const db = await openDatabase(DB_NAMES.SESSIONS);
 * const collection = db.collection(COLLECTIONS.VERIFICATION_CREDENTIALS);
 * ```
 */

/**
 * IndexedDB database names (client-side storage)
 */
export const DB_NAMES = {
	/** Main application database */
	MAIN: 'communique',

	/** Session credentials storage (encrypted verification data) */
	SESSIONS: 'communique-sessions',

	/** Encryption key storage (device-bound keys) */
	KEYSTORE: 'communique-keystore',

	/** Location signals and inferred location data */
	LOCATION: 'communique-location'
} as const;

/**
 * IndexedDB object store names
 */
export const STORES = {
	/** Verification credentials store */
	VERIFICATION_CREDENTIALS: 'verification-credentials',

	/** Encryption keys store */
	ENCRYPTION_KEYS: 'encryption-keys'
} as const;

/**
 * localStorage key prefixes and keys
 */
export const LOCAL_STORAGE_KEYS = {
	/** Guest template state */
	GUEST_STATE: 'communique_guest_template',

	/** Prefix for all communique localStorage items */
	PREFIX: 'communique'
} as const;

/**
 * MongoDB collection names (server-side)
 */
export const COLLECTIONS = {
	/** Bills data from Congress */
	BILLS: 'bills',

	/** Cached geocoding results */
	GEOCODING: 'geocoding_cache',

	/** LLM extraction cache */
	LLM_CACHE: 'llm_cache',

	/** Document analysis cache */
	DOCUMENTS: 'documents',

	/** Member data from Congress API */
	MEMBERS: 'members',

	/** Vote history */
	VOTES: 'votes',

	/** Firecrawl map results cache */
	FIRECRAWL_MAP: 'firecrawl_map_cache'
} as const;

/** Type for accessing DB_NAMES values */
export type DBName = (typeof DB_NAMES)[keyof typeof DB_NAMES];

/** Type for accessing STORES values */
export type StoreName = (typeof STORES)[keyof typeof STORES];

/** Type for accessing COLLECTIONS values */
export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
