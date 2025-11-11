/**
 * Session Credential Storage
 *
 * Stores Shadow Atlas registration data in IndexedDB for client-side proof generation.
 * Credentials cached for 6 months to avoid re-verification.
 *
 * Privacy Design:
 * - NO PII stored (address encrypted separately)
 * - Only merkle_path + proof generation metadata
 * - Expires after 6 months (re-verification required)
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

// ============================================================================
// Types
// ============================================================================

export interface SessionCredential {
	/** User ID (for multi-user support) */
	userId: string;

	/** Identity commitment (Poseidon hash from self.xyz/Didit.me) */
	identityCommitment: string;

	/** Position in district Merkle tree (0-4095) */
	leafIndex: number;

	/** Merkle path for proof generation (12 sibling hashes) */
	merklePath: string[];

	/** Merkle root (verification anchor) */
	merkleRoot: string;

	/** Congressional district (e.g., "CA-12") */
	congressionalDistrict: string;

	/** Verification method used */
	verificationMethod: 'self.xyz' | 'didit';

	/** When credential was created */
	createdAt: Date;

	/** When credential expires (6 months from creation) */
	expiresAt: Date;
}

interface SessionCredentialDB extends DBSchema {
	credentials: {
		key: string; // userId
		value: SessionCredential;
		indexes: {
			'by-expires': Date;
		};
	};
}

// ============================================================================
// Database Management
// ============================================================================

const DB_NAME = 'communique-session';
const DB_VERSION = 1;
const STORE_NAME = 'credentials';

let dbInstance: IDBPDatabase<SessionCredentialDB> | null = null;

/**
 * Initialize IndexedDB connection
 */
async function getDB(): Promise<IDBPDatabase<SessionCredentialDB>> {
	if (dbInstance) {
		return dbInstance;
	}

	dbInstance = await openDB<SessionCredentialDB>(DB_NAME, DB_VERSION, {
		upgrade(db) {
			// Create credentials store
			const store = db.createObjectStore(STORE_NAME, {
				keyPath: 'userId'
			});

			// Index for expiration queries
			store.createIndex('by-expires', 'expiresAt');

			console.log('[Session Credentials] Database initialized');
		},
		blocked() {
			console.warn('[Session Credentials] Database upgrade blocked - close other tabs');
		},
		blocking() {
			console.warn('[Session Credentials] Blocking database upgrade - this tab will close');
			dbInstance?.close();
			dbInstance = null;
		},
		terminated() {
			console.error('[Session Credentials] Database connection terminated');
			dbInstance = null;
		}
	});

	return dbInstance;
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Store session credential in IndexedDB
 *
 * @param credential - Credential to store
 */
export async function storeSessionCredential(credential: SessionCredential): Promise<void> {
	try {
		const db = await getDB();

		// Ensure dates are Date objects
		const credentialToStore: SessionCredential = {
			...credential,
			createdAt:
				credential.createdAt instanceof Date
					? credential.createdAt
					: new Date(credential.createdAt),
			expiresAt:
				credential.expiresAt instanceof Date ? credential.expiresAt : new Date(credential.expiresAt)
		};

		await db.put(STORE_NAME, credentialToStore);

		console.log('[Session Credentials] Stored:', {
			userId: credential.userId,
			district: credential.congressionalDistrict,
			expiresAt: credentialToStore.expiresAt.toISOString()
		});
	} catch (error) {
		console.error('[Session Credentials] Store failed:', error);
		throw new Error('Failed to store session credential');
	}
}

/**
 * Retrieve session credential from IndexedDB
 *
 * @param userId - User ID to look up
 * @returns Credential if found and valid, null otherwise
 */
export async function getSessionCredential(userId: string): Promise<SessionCredential | null> {
	try {
		const db = await getDB();
		const credential = await db.get(STORE_NAME, userId);

		if (!credential) {
			console.log('[Session Credentials] Not found:', { userId });
			return null;
		}

		// Check if expired
		const now = new Date();
		if (credential.expiresAt < now) {
			console.log('[Session Credentials] Expired, auto-clearing:', {
				userId,
				expiredAt: credential.expiresAt.toISOString()
			});
			await clearSessionCredential(userId);
			return null;
		}

		console.log('[Session Credentials] Retrieved:', {
			userId,
			district: credential.congressionalDistrict,
			remainingDays: Math.floor(
				(credential.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
			)
		});

		return credential;
	} catch (error) {
		console.error('[Session Credentials] Retrieval failed:', error);
		return null;
	}
}

/**
 * Check if user has valid (non-expired) session credential
 *
 * @param userId - User ID to check
 * @returns True if valid credential exists
 */
export async function hasValidCredential(userId: string): Promise<boolean> {
	const credential = await getSessionCredential(userId);
	return credential !== null;
}

/**
 * Clear session credential (logout, re-verification)
 *
 * @param userId - User ID to clear
 */
export async function clearSessionCredential(userId: string): Promise<void> {
	try {
		const db = await getDB();
		await db.delete(STORE_NAME, userId);
		console.log('[Session Credentials] Cleared:', { userId });
	} catch (error) {
		console.error('[Session Credentials] Clear failed:', error);
		throw new Error('Failed to clear session credential');
	}
}

/**
 * Clear ALL expired credentials (cleanup task)
 *
 * @returns Number of credentials cleared
 */
export async function clearExpiredCredentials(): Promise<number> {
	try {
		const db = await getDB();
		const now = new Date();

		// Get all credentials using index
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const index = tx.store.index('by-expires');

		// Get all credentials that expire before now
		const expiredKeys: string[] = [];
		for await (const cursor of index.iterate(IDBKeyRange.upperBound(now))) {
			expiredKeys.push(cursor.value.userId);
		}

		// Delete expired credentials
		for (const userId of expiredKeys) {
			await tx.store.delete(userId);
		}

		await tx.done;

		if (expiredKeys.length > 0) {
			console.log('[Session Credentials] Cleared expired credentials:', {
				count: expiredKeys.length,
				userIds: expiredKeys
			});
		}

		return expiredKeys.length;
	} catch (error) {
		console.error('[Session Credentials] Cleanup failed:', error);
		return 0;
	}
}

/**
 * Get all active credentials (admin/debugging)
 *
 * @returns List of all non-expired credentials
 */
export async function getAllActiveCredentials(): Promise<SessionCredential[]> {
	try {
		const db = await getDB();
		const allCredentials = await db.getAll(STORE_NAME);

		const now = new Date();
		const active = allCredentials.filter((cred) => cred.expiresAt >= now);

		console.log('[Session Credentials] Active credentials:', {
			total: allCredentials.length,
			active: active.length,
			expired: allCredentials.length - active.length
		});

		return active;
	} catch (error) {
		console.error('[Session Credentials] Get all failed:', error);
		return [];
	}
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate expiration date (6 months from now)
 *
 * @returns Date 6 months in the future
 */
export function calculateExpirationDate(): Date {
	const now = new Date();
	const expiresAt = new Date(now);
	expiresAt.setMonth(expiresAt.getMonth() + 6);
	return expiresAt;
}

/**
 * Format credential for display (debugging)
 *
 * @param credential - Credential to format
 * @returns Human-readable summary
 */
export function formatCredential(credential: SessionCredential): string {
	const now = new Date();
	const remainingMs = credential.expiresAt.getTime() - now.getTime();
	const remainingDays = Math.floor(remainingMs / (1000 * 60 * 60 * 24));

	return `${credential.congressionalDistrict} (${credential.verificationMethod}) - ${remainingDays} days remaining`;
}

// ============================================================================
// Auto-cleanup on Load
// ============================================================================

// Run cleanup on module load (background task)
if (typeof window !== 'undefined') {
	clearExpiredCredentials().catch((error) => {
		console.error('[Session Credentials] Auto-cleanup failed:', error);
	});
}
