/**
 * Centralized Storage Constants
 *
 * Single source of truth for client-side storage names.
 * This ensures consistency across the application and makes it easier
 * to manage storage resources.
 *
 * Note: Server-side MongoDB collection names are defined in
 * src/lib/server/mongodb/schema.ts to maintain separation of concerns.
 *
 * Usage:
 * ```typescript
 * import { DB_NAMES, STORES, LOCAL_STORAGE_KEYS } from '$lib/constants/storage';
 *
 * const db = await openDatabase(DB_NAMES.SESSIONS);
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

/** Type for accessing DB_NAMES values */
export type DBName = (typeof DB_NAMES)[keyof typeof DB_NAMES];

/** Type for accessing STORES values */
export type StoreName = (typeof STORES)[keyof typeof STORES];
