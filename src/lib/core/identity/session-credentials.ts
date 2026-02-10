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
 *
 * Security (ISSUE-004):
 * - Credentials encrypted with Web Crypto API before storage
 * - Device-bound, non-extractable AES-256-GCM key
 * - Protects against XSS, malicious extensions, devtools inspection
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import {
	encryptCredential,
	decryptCredential,
	isEncryptionAvailable,
	type EncryptedCredential
} from './credential-encryption';

// ============================================================================
// Types
// ============================================================================

export interface SessionCredential {
	/** User ID (for multi-user support) */
	userId: string;

	/** Identity commitment (Poseidon hash from self.xyz/Didit.me) */
	identityCommitment: string;

	/** Position in Tree 1 (User Identity Merkle tree, depth 20) */
	leafIndex: number;

	/** Tree 1 Merkle siblings for proof generation (20 for two-tree, 12 for legacy) */
	merklePath: string[];

	/** Tree 1 Merkle root (verification anchor) */
	merkleRoot: string;

	/** Congressional district (e.g., "CA-12") */
	congressionalDistrict: string;

	// ═══════════════════════════════════════════════════════════════════════
	// Two-Tree Architecture Support (Issue #21)
	// ═══════════════════════════════════════════════════════════════════════

	/**
	 * Credential type discriminator
	 * - 'single-tree': Traditional district-based merkle tree (backward compatible)
	 * - 'two-tree': Cell-based dual merkle tree (user tree + cell map)
	 */
	credentialType?: 'single-tree' | 'two-tree';

	/**
	 * Census Block GEOID (15-digit cell identifier)
	 *
	 * PRIVACY: Neighborhood-level precision (600-3000 people).
	 * This is encrypted at rest along with other credential data.
	 * Only present when credentialType === 'two-tree'.
	 */
	cellId?: string;

	/**
	 * Tree 2 (Cell-District Map) root hash.
	 * Only present when credentialType === 'two-tree'.
	 */
	cellMapRoot?: string;

	/**
	 * Tree 2 SMT siblings (depth elements, hex-encoded).
	 * Only present when credentialType === 'two-tree'.
	 */
	cellMapPath?: string[];

	/**
	 * Tree 2 SMT direction bits (0=left, 1=right).
	 * Only present when credentialType === 'two-tree'.
	 */
	cellMapPathBits?: number[];

	/**
	 * All 24 district IDs for this cell (hex-encoded).
	 * Per DISTRICT-TAXONOMY.md slot allocation.
	 * Only present when credentialType === 'two-tree'.
	 */
	districts?: string[];

	/**
	 * Registration salt used for leaf computation.
	 * Stored client-side only — never sent to server.
	 * Only present when credentialType === 'two-tree'.
	 */
	registrationSalt?: string;

	/**
	 * User secret used for leaf computation.
	 * Stored client-side only — never sent to server.
	 * Only present when credentialType === 'two-tree'.
	 */
	userSecret?: string;

	// ═══════════════════════════════════════════════════════════════════════

	/** Verification method used */
	verificationMethod: 'self.xyz' | 'didit';

	/** When credential was created */
	createdAt: Date;

	/** When credential expires (6 months from creation) */
	expiresAt: Date;
}

/**
 * Stored credential wrapper
 *
 * Can contain either:
 * - encrypted: New encrypted format
 * - Legacy plaintext fields (for migration)
 */
interface StoredCredential {
	/** User ID (always stored in plaintext for indexing) */
	userId: string;

	/** Encrypted credential data (new format) */
	encrypted?: EncryptedCredential;

	/** Expiration date (stored in plaintext for index queries) */
	expiresAt: Date;

	// Legacy plaintext fields (for migration detection)
	identityCommitment?: string;
	leafIndex?: number;
	merklePath?: string[];
	merkleRoot?: string;
	congressionalDistrict?: string;
	verificationMethod?: 'self.xyz' | 'didit';
	createdAt?: Date;

	// Two-tree support (stored in encrypted data, listed here for type completeness)
	credentialType?: 'single-tree' | 'two-tree';
	cellId?: string;
}

interface SessionCredentialDB extends DBSchema {
	credentials: {
		key: string; // userId
		value: StoredCredential;
		indexes: {
			'by-expires': Date;
		};
	};
}

// ============================================================================
// Database Management
// ============================================================================

const DB_NAME = 'communique-session';
const DB_VERSION = 2; // Bumped for encryption migration
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
		upgrade(db, oldVersion, _newVersion, transaction) {
			if (oldVersion < 1) {
				// Create credentials store
				const store = db.createObjectStore(STORE_NAME, {
					keyPath: 'userId'
				});

				// Index for expiration queries
				store.createIndex('by-expires', 'expiresAt');

				console.log('[Session Credentials] Database initialized');
			}

			if (oldVersion < 2) {
				// Version 2: Added encryption support
				// No schema changes needed - we store encrypted data in the same store
				// Migration happens lazily on read/write
				console.log('[Session Credentials] Upgraded to v2 (encryption support)');
			}
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
// Encryption Helpers
// ============================================================================

/**
 * Check if a stored credential is in legacy plaintext format
 */
function isLegacyPlaintext(stored: StoredCredential): boolean {
	return !stored.encrypted && stored.identityCommitment !== undefined;
}

/**
 * Convert stored credential to SessionCredential
 */
function storedToSessionCredential(stored: StoredCredential): SessionCredential {
	return {
		userId: stored.userId,
		identityCommitment: stored.identityCommitment!,
		leafIndex: stored.leafIndex!,
		merklePath: stored.merklePath!,
		merkleRoot: stored.merkleRoot!,
		congressionalDistrict: stored.congressionalDistrict!,
		verificationMethod: stored.verificationMethod!,
		createdAt: stored.createdAt instanceof Date ? stored.createdAt : new Date(stored.createdAt!),
		expiresAt: stored.expiresAt instanceof Date ? stored.expiresAt : new Date(stored.expiresAt)
	};
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Store session credential in IndexedDB
 *
 * Encrypts the credential using Web Crypto API before storage.
 * Throws if encryption is unavailable (will not store plaintext).
 *
 * @param credential - Credential to store
 * @throws Error if Web Crypto API is unavailable (insecure context, old browser)
 */
export async function storeSessionCredential(credential: SessionCredential): Promise<void> {
	try {
		const db = await getDB();

		// Ensure dates are Date objects
		const normalizedCredential: SessionCredential = {
			...credential,
			createdAt:
				credential.createdAt instanceof Date
					? credential.createdAt
					: new Date(credential.createdAt),
			expiresAt:
				credential.expiresAt instanceof Date ? credential.expiresAt : new Date(credential.expiresAt)
		};

		if (!isEncryptionAvailable()) {
			throw new Error(
				'[Session Credentials] Cannot store credentials: Web Crypto API is unavailable. ' +
				'Credential storage requires a secure context (HTTPS or localhost) with Web Crypto support. ' +
				'Refusing to store credentials in plaintext.'
			);
		}

		// Encrypt credential data
		const encrypted = await encryptCredential(normalizedCredential);

		const storedCredential: StoredCredential = {
			userId: credential.userId,
			encrypted,
			expiresAt: normalizedCredential.expiresAt
		};

		await db.put(STORE_NAME, storedCredential);

		console.log('[Session Credentials] Stored (encrypted):', {
			userId: credential.userId,
			district: credential.congressionalDistrict,
			expiresAt: normalizedCredential.expiresAt.toISOString()
		});
	} catch (error) {
		console.error('[Session Credentials] Store failed:', error);
		throw new Error('Failed to store session credential');
	}
}

/**
 * Retrieve session credential from IndexedDB
 *
 * Automatically handles:
 * - Decryption of encrypted credentials
 * - Migration of legacy plaintext credentials
 * - Expiration checking
 *
 * @param userId - User ID to look up
 * @returns Credential if found and valid, null otherwise
 */
export async function getSessionCredential(userId: string): Promise<SessionCredential | null> {
	try {
		const db = await getDB();
		const stored = await db.get(STORE_NAME, userId);

		if (!stored) {
			console.log('[Session Credentials] Not found:', { userId });
			return null;
		}

		// Check if expired (using plaintext expiresAt)
		const now = new Date();
		const expiresAt = stored.expiresAt instanceof Date ? stored.expiresAt : new Date(stored.expiresAt);
		if (expiresAt < now) {
			console.log('[Session Credentials] Expired, auto-clearing:', {
				userId,
				expiredAt: expiresAt.toISOString()
			});
			await clearSessionCredential(userId);
			return null;
		}

		let credential: SessionCredential;

		if (stored.encrypted) {
			// Decrypt the credential
			try {
				credential = await decryptCredential<SessionCredential>(stored.encrypted);
				// Ensure dates are Date objects after deserialization
				credential.createdAt = new Date(credential.createdAt);
				credential.expiresAt = new Date(credential.expiresAt);
			} catch (decryptError) {
				console.error('[Session Credentials] Decryption failed:', decryptError);
				// Key may have been rotated or device changed - clear invalid credential
				await clearSessionCredential(userId);
				return null;
			}
		} else if (isLegacyPlaintext(stored)) {
			// Legacy plaintext format - migrate to encrypted
			credential = storedToSessionCredential(stored);

			// Migrate to encrypted format in background
			if (isEncryptionAvailable()) {
				storeSessionCredential(credential).catch((error) => {
					console.error('[Session Credentials] Migration failed:', error);
				});
				console.log('[Session Credentials] Migrating to encrypted format:', { userId });
			}
		} else {
			console.error('[Session Credentials] Invalid stored format:', { userId });
			return null;
		}

		console.log('[Session Credentials] Retrieved:', {
			userId,
			district: credential.congressionalDistrict,
			remainingDays: Math.floor(
				(credential.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
			),
			encrypted: !!stored.encrypted
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

// ============================================================================
// Migration Functions
// ============================================================================

/**
 * Migrate all plaintext credentials to encrypted format
 *
 * Call this on app startup to ensure all credentials are encrypted.
 * Safe to call multiple times - skips already encrypted credentials.
 *
 * @returns Number of credentials migrated
 */
export async function migrateToEncrypted(): Promise<number> {
	if (!isEncryptionAvailable()) {
		console.log('[Session Credentials] Encryption unavailable, skipping migration');
		return 0;
	}

	try {
		const db = await getDB();
		const all = await db.getAll(STORE_NAME);

		let migratedCount = 0;

		for (const stored of all) {
			// Skip already encrypted
			if (stored.encrypted) {
				continue;
			}

			// Skip if not valid plaintext format
			if (!isLegacyPlaintext(stored)) {
				continue;
			}

			// Convert and re-store with encryption
			const credential = storedToSessionCredential(stored);
			await storeSessionCredential(credential);
			migratedCount++;
		}

		if (migratedCount > 0) {
			console.log(`[Session Credentials] Migrated ${migratedCount} credentials to encrypted storage`);
		}

		return migratedCount;
	} catch (error) {
		console.error('[Session Credentials] Migration failed:', error);
		return 0;
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

// ============================================================================
// Auto-cleanup and Migration on Load
// ============================================================================

// Run cleanup and migration on module load (background task)
if (typeof window !== 'undefined') {
	// Clear expired credentials first
	clearExpiredCredentials()
		.then(() => {
			// Then migrate any remaining plaintext to encrypted
			return migrateToEncrypted();
		})
		.catch((error) => {
			console.error('[Session Credentials] Auto-initialization failed:', error);
		});
}
