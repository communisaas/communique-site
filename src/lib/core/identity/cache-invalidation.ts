/**
 * Cache Invalidation Utilities
 *
 * Handles clearing of client-side caches for:
 * 1. Address/location updates (invalidate stale location data)
 * 2. Logout (clear all user-specific cached data)
 *
 * Caches managed:
 * - communique-sessions (IndexedDB): Session credentials with district info
 * - communique-location (IndexedDB): Location signals and inferred location
 * - communique_guest_template (localStorage): Guest state with address
 */

import { z } from 'zod';
import { browser } from '$app/environment';

// IndexedDB database names
const SESSION_DB_NAME = 'communique-sessions';
const LOCATION_DB_NAME = 'communique-location';

// localStorage keys
const GUEST_STATE_KEY = 'communique_guest_template';

// =============================================================================
// ZOD SCHEMA
// =============================================================================

const GuestStateSchema = z.object({
	address: z.string().optional()
}).passthrough(); // Allow additional fields

/**
 * Clear all location-related caches
 * Call when user updates their address
 */
export async function invalidateLocationCaches(): Promise<void> {
	if (!browser) return;

	console.log('[CacheInvalidation] Clearing location caches...');

	try {
		// Clear location storage (location signals, inferred location)
		const { locationStorage } = await import('$lib/core/location/storage');
		await locationStorage.clearAll();
		console.log('[CacheInvalidation] Cleared location storage');
	} catch (error) {
		console.error('[CacheInvalidation] Failed to clear location storage:', error);
	}

	try {
		// Clear guest state address
		const storedState = localStorage.getItem(GUEST_STATE_KEY);
		if (storedState) {
			const parsed = JSON.parse(storedState);
			const validationResult = GuestStateSchema.safeParse(parsed);

			if (!validationResult.success) {
				console.warn(
					'[CacheInvalidation] Invalid guest state structure:',
					validationResult.error.flatten()
				);
				// Remove invalid data entirely
				localStorage.removeItem(GUEST_STATE_KEY);
			} else if (validationResult.data.address) {
				delete validationResult.data.address;
				localStorage.setItem(GUEST_STATE_KEY, JSON.stringify(validationResult.data));
				console.log('[CacheInvalidation] Cleared guest state address');
			}
		}
	} catch (error) {
		console.error('[CacheInvalidation] Failed to clear guest state address:', error);
	}
}

/**
 * Clear session credentials cache for a specific user
 * Call when user's verification/identity changes
 */
export async function invalidateSessionCredentials(userId?: string): Promise<void> {
	if (!browser) return;

	console.log('[CacheInvalidation] Clearing session credentials...');

	try {
		if (userId) {
			// Clear specific user's credentials
			const { deleteSessionCredential } = await import('$lib/core/identity/session-cache');
			await deleteSessionCredential(userId);
			console.log('[CacheInvalidation] Cleared session credential for user:', userId);
		} else {
			// Clear all session credentials (nuclear option)
			await clearDatabase(SESSION_DB_NAME);
			console.log('[CacheInvalidation] Cleared all session credentials');
		}
	} catch (error) {
		console.error('[CacheInvalidation] Failed to clear session credentials:', error);
	}
}

/**
 * Clear all client-side caches (for logout)
 * Call before redirecting to /auth/logout
 */
export async function clearAllClientCaches(): Promise<void> {
	if (!browser) return;

	console.log('[CacheInvalidation] Clearing ALL client caches...');

	// Clear location storage
	await invalidateLocationCaches();

	// Clear session credentials
	await invalidateSessionCredentials();

	// Clear guest state entirely
	try {
		localStorage.removeItem(GUEST_STATE_KEY);
		console.log('[CacheInvalidation] Cleared guest state');
	} catch (error) {
		console.error('[CacheInvalidation] Failed to clear guest state:', error);
	}

	// Clear any other localStorage items specific to the user
	try {
		// Only clear communique-prefixed items
		const keysToRemove: string[] = [];
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key && key.startsWith('communique')) {
				keysToRemove.push(key);
			}
		}
		keysToRemove.forEach((key) => localStorage.removeItem(key));
		console.log('[CacheInvalidation] Cleared localStorage items:', keysToRemove);
	} catch (error) {
		console.error('[CacheInvalidation] Failed to clear localStorage:', error);
	}

	console.log('[CacheInvalidation] All client caches cleared');
}

/**
 * Helper to delete an entire IndexedDB database
 */
async function clearDatabase(dbName: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.deleteDatabase(dbName);
		request.onsuccess = () => {
			console.log(`[CacheInvalidation] Deleted database: ${dbName}`);
			resolve();
		};
		request.onerror = () => {
			console.error(`[CacheInvalidation] Failed to delete database: ${dbName}`);
			reject(request.error);
		};
		request.onblocked = () => {
			console.warn(`[CacheInvalidation] Database deletion blocked: ${dbName}`);
			// Still resolve as the deletion will complete when connections close
			resolve();
		};
	});
}

/**
 * Logout with proper cache clearing
 * Use this instead of directly navigating to /auth/logout
 */
export async function performLogout(): Promise<void> {
	if (!browser) return;

	// Clear all client caches first
	await clearAllClientCaches();

	// Then redirect to server-side logout
	window.location.href = '/auth/logout';
}
