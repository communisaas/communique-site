/**
 * Session Credential Cache (IndexedDB)
 *
 * Client-side caching of verification credentials to avoid repeated verification.
 *
 * Why IndexedDB (not localStorage):
 * - Can store Uint8Array (for future ZK proof caching)
 * - Larger storage capacity (>50MB vs 5MB)
 * - Better performance for structured data
 * - Async API (non-blocking)
 *
 * Privacy:
 * - NO PII stored (only verification status + district)
 * - Encrypted blob ID points to server storage
 * - Session expires after 3-6 months
 * - User can clear at any time
 *
 * Progressive Verification:
 * - First visit: Full verification required
 * - Return visits: Skip verification (if not expired)
 * - Template submission: Check credential, skip if valid
 * - Expiration: Graceful re-verification prompt
 */

// ============================================================================
// Types
// ============================================================================

export interface SessionCredential {
	/** User identifier */
	userId: string;
	/** Verification status */
	isVerified: boolean;
	/** Verification method used */
	verificationMethod: 'nfc-passport' | 'government-id';
	/** Congressional district (e.g., "CA-12") */
	congressionalDistrict?: string;
	/** Encrypted blob ID in Postgres */
	blobId: string;
	/** When the blob was encrypted */
	encryptedAt: string;
	/** Session expiration date */
	expiresAt: string;
	/** Optional: ZK proof witness data (Phase 2) */
	zkProofWitness?: Uint8Array;
}

// ============================================================================
// IndexedDB Setup
// ============================================================================

const DB_NAME = 'communique-sessions';
const DB_VERSION = 1;
const STORE_NAME = 'verification-credentials';

/**
 * Open IndexedDB database
 */
async function openDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;

			// Create object store if it doesn't exist
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'userId' });
				// Create index for quick expiration checks
				objectStore.createIndex('expiresAt', 'expiresAt', { unique: false });
			}
		};
	});
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Store session credential in IndexedDB
 *
 * @param credential - Session credential to store
 */
export async function storeSessionCredential(credential: SessionCredential): Promise<void> {
	try {
		const db = await openDatabase();
		const transaction = db.transaction([STORE_NAME], 'readwrite');
		const store = transaction.objectStore(STORE_NAME);

		return new Promise((resolve, reject) => {
			const request = store.put(credential);

			request.onsuccess = () => {
				console.log('[Session Cache] Stored credential for user:', credential.userId);
				resolve();
			};

			request.onerror = () => {
				console.error('[Session Cache] Failed to store credential:', request.error);
				reject(request.error);
			};

			transaction.oncomplete = () => db.close();
		});
	} catch (error) {
		console.error('[Session Cache] Store failed:', error);
		throw error;
	}
}

/**
 * Retrieve session credential from IndexedDB
 *
 * @param userId - User identifier
 * @returns Session credential if exists, null otherwise
 */
export async function getSessionCredential(userId: string): Promise<SessionCredential | null> {
	try {
		const db = await openDatabase();
		const transaction = db.transaction([STORE_NAME], 'readonly');
		const store = transaction.objectStore(STORE_NAME);

		return new Promise((resolve, reject) => {
			const request = store.get(userId);

			request.onsuccess = () => {
				const credential = request.result as SessionCredential | undefined;

				if (!credential) {
					console.log('[Session Cache] No credential found for user:', userId);
					resolve(null);
					return;
				}

				// Check expiration
				const expiresAt = new Date(credential.expiresAt);
				const now = new Date();

				if (expiresAt < now) {
					console.log('[Session Cache] Credential expired for user:', userId);
					// Auto-delete expired credential
					deleteSessionCredential(userId);
					resolve(null);
					return;
				}

				console.log('[Session Cache] Retrieved valid credential for user:', userId);
				resolve(credential);
			};

			request.onerror = () => {
				console.error('[Session Cache] Failed to retrieve credential:', request.error);
				reject(request.error);
			};

			transaction.oncomplete = () => db.close();
		});
	} catch (error) {
		console.error('[Session Cache] Retrieve failed:', error);
		return null;
	}
}

/**
 * Delete session credential from IndexedDB
 *
 * @param userId - User identifier
 */
export async function deleteSessionCredential(userId: string): Promise<void> {
	try {
		const db = await openDatabase();
		const transaction = db.transaction([STORE_NAME], 'readwrite');
		const store = transaction.objectStore(STORE_NAME);

		return new Promise((resolve, reject) => {
			const request = store.delete(userId);

			request.onsuccess = () => {
				console.log('[Session Cache] Deleted credential for user:', userId);
				resolve();
			};

			request.onerror = () => {
				console.error('[Session Cache] Failed to delete credential:', request.error);
				reject(request.error);
			};

			transaction.oncomplete = () => db.close();
		});
	} catch (error) {
		console.error('[Session Cache] Delete failed:', error);
		throw error;
	}
}

/**
 * Clear all expired credentials (maintenance)
 */
export async function clearExpiredCredentials(): Promise<number> {
	try {
		const db = await openDatabase();
		const transaction = db.transaction([STORE_NAME], 'readwrite');
		const store = transaction.objectStore(STORE_NAME);
		const index = store.index('expiresAt');

		const now = new Date().toISOString();
		let deletedCount = 0;

		return new Promise((resolve, reject) => {
			// Get all credentials with expiration before now
			const request = index.openCursor(IDBKeyRange.upperBound(now));

			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

				if (cursor) {
					cursor.delete();
					deletedCount++;
					cursor.continue();
				} else {
					console.log('[Session Cache] Cleared expired credentials:', deletedCount);
					resolve(deletedCount);
				}
			};

			request.onerror = () => {
				console.error('[Session Cache] Failed to clear expired credentials:', request.error);
				reject(request.error);
			};

			transaction.oncomplete = () => db.close();
		});
	} catch (error) {
		console.error('[Session Cache] Clear expired failed:', error);
		return 0;
	}
}

/**
 * Check if user has valid session (convenience function)
 *
 * @param userId - User identifier
 * @returns True if valid session exists, false otherwise
 */
export async function hasValidSession(userId: string): Promise<boolean> {
	const credential = await getSessionCredential(userId);
	return credential !== null && credential.isVerified;
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize session cache (run on app startup)
 *
 * Clears expired credentials to keep IndexedDB clean
 */
export async function initializeSessionCache(): Promise<void> {
	try {
		// Clear expired credentials on startup
		await clearExpiredCredentials();
		console.log('[Session Cache] Initialized');
	} catch (error) {
		console.error('[Session Cache] Initialization failed:', error);
	}
}
