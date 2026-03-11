/**
 * Client-Side Credential Wallet (IndexedDB) — v2 Per-User Isolation
 *
 * Provides a unified store for W3C Verifiable Credentials on the client.
 * Credentials are stored in IndexedDB, encrypted with per-user HKDF-derived keys,
 * and keyed by HMAC(userId, masterKey) for enumeration protection.
 *
 * SSR-safe: all operations check for `indexedDB` availability and return
 * graceful fallbacks (null / false / 0) when running on the server.
 *
 * Database: 'communique-credentials', Version: 2
 * Object Store: 'credentials', Key: recordId (HMAC-based)
 */

import {
	encryptCredential,
	decryptCredential,
	isEncryptionAvailable,
	computeRecordId,
	type EncryptedCredential
} from './credential-encryption';

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

/** Internal storage record */
interface CredentialRecord {
	recordId: string; // HMAC(userId+type, masterKey)
	encrypted: EncryptedCredential;
	expiresAt: string; // ISO 8601 (plaintext for index queries)
}

/** Legacy record (v1 format, compound key [userId, type]) */
interface LegacyRecord {
	userId: string;
	type: CredentialType;
	credential: unknown;
	issuedAt: string;
	expiresAt: string;
	credentialHash: string;
}

// ============================================================================
// Constants
// ============================================================================

const DB_NAME = 'communique-credentials';
const DB_VERSION = 2;
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

function openDB(): Promise<IDBDatabase | null> {
	if (!isIndexedDBAvailable()) return Promise.resolve(null);

	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onupgradeneeded = (event) => {
			const db = request.result;
			const oldVersion = event.oldVersion;

			if (oldVersion < 1) {
				// Fresh install — create v2 schema directly
				const store = db.createObjectStore(STORE_NAME, { keyPath: 'recordId' });
				store.createIndex('by-expires', 'expiresAt');
			} else if (oldVersion < 2) {
				// Upgrade from v1: delete old compound-key store, create new one
				// Legacy records will be lost (acceptable — VCs can be re-issued)
				if (db.objectStoreNames.contains(STORE_NAME)) {
					db.deleteObjectStore(STORE_NAME);
				}
				const store = db.createObjectStore(STORE_NAME, { keyPath: 'recordId' });
				store.createIndex('by-expires', 'expiresAt');
				console.debug('[CredentialStore] Upgraded to v2 (per-user isolation)');
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

async function sha256Hex(data: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', encoder.encode(data));
	const arr = new Uint8Array(digest);
	return Array.from(arr)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

/**
 * Compute record ID for a (userId, type) pair.
 * Uses HMAC so User B cannot enumerate User A's credential types.
 */
async function credentialRecordId(userId: string, type: CredentialType): Promise<string> {
	const base = await computeRecordId(`${userId}:${type}`);
	return `vc:${base}`;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Store a credential in the IndexedDB wallet.
 *
 * Encrypts with per-user HKDF-derived key. HMAC-based record ID.
 */
export async function storeCredential(
	userId: string,
	type: CredentialType,
	credential: unknown,
	expiresAt: string
): Promise<void> {
	const db = await openDB();
	if (!db) return;

	if (!isEncryptionAvailable()) {
		throw new Error('[CredentialStore] Web Crypto API unavailable. Refusing plaintext storage.');
	}

	const credentialHash = await sha256Hex(JSON.stringify(credential));

	const record: StoredCredential = {
		userId,
		type,
		credential,
		issuedAt: new Date().toISOString(),
		expiresAt,
		credentialHash
	};

	const encrypted = await encryptCredential(record, userId);
	const recordId = await credentialRecordId(userId, type);

	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		const request = store.put({
			recordId,
			encrypted,
			expiresAt
		} as CredentialRecord);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
		tx.oncomplete = () => db.close();
	});
}

/**
 * Retrieve a credential from the wallet.
 *
 * Returns null if: SSR, not found, or decryption fails.
 */
export async function getCredential(
	userId: string,
	type: CredentialType
): Promise<StoredCredential | null> {
	const db = await openDB();
	if (!db) return null;

	const recordId = await credentialRecordId(userId, type);

	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readonly');
		const store = tx.objectStore(STORE_NAME);
		const request = store.get(recordId);

		request.onsuccess = async () => {
			const stored = request.result as CredentialRecord | undefined;
			if (!stored?.encrypted) {
				resolve(null);
				return;
			}

			try {
				const decrypted = await decryptCredential<StoredCredential>(stored.encrypted, userId);
				resolve(decrypted);
			} catch (error) {
				console.error('[CredentialStore] Decryption failed:', error);
				resolve(null);
			}
		};

		request.onerror = () => reject(request.error);
		tx.oncomplete = () => db.close();
	});
}

/**
 * Check whether a non-expired credential of the given type exists.
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

	const recordId = await credentialRecordId(userId, type);

	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		const request = store.delete(recordId);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
		tx.oncomplete = () => db.close();
	});
}

/**
 * Remove all expired credentials from the wallet.
 */
export async function pruneExpiredCredentials(): Promise<number> {
	const db = await openDB();
	if (!db) return 0;

	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		const index = store.index('by-expires');
		const now = new Date().toISOString();
		const range = IDBKeyRange.upperBound(now);
		const request = index.openCursor(range);
		let pruned = 0;

		request.onsuccess = () => {
			const cursor = request.result;
			if (!cursor) return;

			cursor.delete();
			pruned++;
			cursor.continue();
		};

		request.onerror = () => reject(request.error);
		tx.oncomplete = () => {
			db.close();
			resolve(pruned);
		};
	});
}
