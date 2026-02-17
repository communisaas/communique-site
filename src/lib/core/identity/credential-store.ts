/**
 * Client-Side Credential Wallet (IndexedDB)
 *
 * Provides a unified store for W3C Verifiable Credentials on the client.
 * Credentials are stored in IndexedDB and keyed by [userId, type].
 *
 * SSR-safe: all operations check for `indexedDB` availability and return
 * graceful fallbacks (null / false / 0) when running on the server.
 *
 * Database: 'communique-credentials', Version: 1
 * Object Store: 'credentials', Key: compound [userId, type]
 */

// ============================================================================
// Types
// ============================================================================

export type CredentialType = 'district_residency' | 'shadow_atlas' | 'identity';

export interface StoredCredential {
	userId: string;
	type: CredentialType;
	credential: unknown; // The VC JSON
	issuedAt: string; // ISO 8601
	expiresAt: string; // ISO 8601
	credentialHash: string; // SHA-256 for integrity
}

// ============================================================================
// Constants
// ============================================================================

const DB_NAME = 'communique-credentials';
const DB_VERSION = 1;
const STORE_NAME = 'credentials';

// ============================================================================
// SSR Guard
// ============================================================================

function isIndexedDBAvailable(): boolean {
	return typeof indexedDB !== 'undefined';
}

// ============================================================================
// Database Connection
// ============================================================================

/**
 * Open (or create) the IndexedDB database.
 * Returns null if IndexedDB is not available (SSR).
 */
function openDB(): Promise<IDBDatabase | null> {
	if (!isIndexedDBAvailable()) return Promise.resolve(null);

	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				// Compound key: [userId, type]
				db.createObjectStore(STORE_NAME, { keyPath: ['userId', 'type'] });
			}
		};

		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

// ============================================================================
// Internal Helpers
// ============================================================================

const encoder = new TextEncoder();

/**
 * Compute SHA-256 hash of arbitrary data. Returns lowercase hex.
 * Used for credential integrity verification.
 */
async function sha256Hex(data: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', encoder.encode(data));
	const arr = new Uint8Array(digest);
	return Array.from(arr)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Store a credential in the IndexedDB wallet.
 *
 * Computes a SHA-256 hash of the credential JSON for integrity tracking.
 * If a credential with the same [userId, type] already exists it is overwritten.
 */
export async function storeCredential(
	userId: string,
	type: CredentialType,
	credential: unknown,
	expiresAt: string
): Promise<void> {
	const db = await openDB();
	if (!db) return;

	const credentialHash = await sha256Hex(JSON.stringify(credential));

	const record: StoredCredential = {
		userId,
		type,
		credential,
		issuedAt: new Date().toISOString(),
		expiresAt,
		credentialHash
	};

	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		const request = store.put(record);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
		tx.oncomplete = () => db.close();
	});
}

/**
 * Retrieve a credential from the wallet.
 *
 * Returns null if:
 *  - Running on server (SSR)
 *  - No matching credential found
 */
export async function getCredential(
	userId: string,
	type: CredentialType
): Promise<StoredCredential | null> {
	const db = await openDB();
	if (!db) return null;

	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readonly');
		const store = tx.objectStore(STORE_NAME);
		const request = store.get([userId, type]);
		request.onsuccess = () => resolve((request.result as StoredCredential) ?? null);
		request.onerror = () => reject(request.error);
		tx.oncomplete = () => db.close();
	});
}

/**
 * Check whether a non-expired credential of the given type exists.
 *
 * Returns false on server (SSR) or if no valid credential is found.
 */
export async function hasValidCredential(
	userId: string,
	type: CredentialType
): Promise<boolean> {
	const record = await getCredential(userId, type);
	if (!record) return false;
	return new Date(record.expiresAt).getTime() > Date.now();
}

/**
 * Delete a specific credential from the wallet.
 */
export async function deleteCredential(
	userId: string,
	type: CredentialType
): Promise<void> {
	const db = await openDB();
	if (!db) return;

	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		const request = store.delete([userId, type]);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
		tx.oncomplete = () => db.close();
	});
}

/**
 * Remove all expired credentials from the wallet.
 *
 * Returns the number of pruned entries (0 on server).
 */
export async function pruneExpiredCredentials(): Promise<number> {
	const db = await openDB();
	if (!db) return 0;

	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		const request = store.openCursor();
		const now = Date.now();
		let pruned = 0;

		request.onsuccess = () => {
			const cursor = request.result;
			if (!cursor) {
				// Iteration complete
				return;
			}

			const record = cursor.value as StoredCredential;
			if (new Date(record.expiresAt).getTime() <= now) {
				cursor.delete();
				pruned++;
			}
			cursor.continue();
		};

		request.onerror = () => reject(request.error);
		tx.oncomplete = () => {
			db.close();
			resolve(pruned);
		};
	});
}
