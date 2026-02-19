/**
 * Credential Encryption Service
 *
 * Uses Web Crypto API to encrypt session credentials before IndexedDB storage.
 * The encryption key is:
 * - Device-bound (stored in IndexedDB, not exportable)
 * - Non-extractable (cannot be read by JavaScript after creation)
 * - AES-GCM 256-bit for authenticated encryption
 *
 * SECURITY: This is defense-in-depth. Same-origin scripts with full DOM access
 * can still invoke decrypt(). This protects against:
 * - Reading credentials via devtools
 * - Cross-site data exfiltration
 * - Non-privileged browser extensions
 *
 * @module credential-encryption
 */

// ============================================================================
// Constants
// ============================================================================

const KEY_DB_NAME = 'communique-keystore';
const KEY_STORE_NAME = 'encryption-keys';
const DEVICE_KEY_ID = 'device-credential-key';

/** Current encryption version for migration support */
const ENCRYPTION_VERSION = 1;

// ============================================================================
// Types
// ============================================================================

/**
 * Encrypted credential wrapper
 */
export interface EncryptedCredential {
	/** Base64-encoded ciphertext */
	ciphertext: string;
	/** Base64-encoded IV (initialization vector) */
	iv: string;
	/** Encryption version for future migrations */
	version: number;
}

/**
 * Stored credential wrapper (may be encrypted or plaintext for migration)
 */
export interface StoredCredentialWrapper<T> {
	/** Original credential data (for backward compatibility detection) */
	data?: T;
	/** Encrypted credential (when encryption is used) */
	encrypted?: EncryptedCredential;
	/** Expiration timestamp (kept unencrypted for index queries) */
	expiresAt?: Date | string;
}

// ============================================================================
// Database Management
// ============================================================================

/** Cached database connection */
let keyDBInstance: IDBDatabase | null = null;

/**
 * Open the key storage database
 *
 * Uses a separate database from credential storage for security isolation.
 * The key is stored as a non-extractable CryptoKey object.
 */
async function openKeyDB(): Promise<IDBDatabase> {
	// Return cached connection if available
	if (keyDBInstance) {
		return keyDBInstance;
	}

	return new Promise((resolve, reject) => {
		const request = indexedDB.open(KEY_DB_NAME, 1);

		request.onerror = () => {
			console.error('[CredentialEncryption] Failed to open key database:', request.error);
			reject(request.error);
		};

		request.onsuccess = () => {
			keyDBInstance = request.result;

			// Handle connection close
			keyDBInstance.onclose = () => {
				keyDBInstance = null;
			};

			resolve(keyDBInstance);
		};

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;
			if (!db.objectStoreNames.contains(KEY_STORE_NAME)) {
				db.createObjectStore(KEY_STORE_NAME, { keyPath: 'id' });
				console.debug('[CredentialEncryption] Key store created');
			}
		};
	});
}

// ============================================================================
// Key Management
// ============================================================================

/** Cached device key for performance */
let cachedDeviceKey: CryptoKey | null = null;

/**
 * Get or create the device-bound encryption key
 *
 * Key properties:
 * - Algorithm: AES-GCM with 256-bit key
 * - Non-extractable: Cannot be read by JavaScript after creation
 * - Usage: encrypt and decrypt only
 *
 * The key is persisted in IndexedDB and survives browser restarts.
 * Different devices will have different keys (device-bound).
 *
 * @returns The device encryption key
 */
async function getOrCreateDeviceKey(): Promise<CryptoKey> {
	// Return cached key if available
	if (cachedDeviceKey) {
		return cachedDeviceKey;
	}

	const db = await openKeyDB();

	// Try to get existing key
	const existingKey = await new Promise<CryptoKey | null>((resolve, reject) => {
		const tx = db.transaction(KEY_STORE_NAME, 'readonly');
		const store = tx.objectStore(KEY_STORE_NAME);
		const request = store.get(DEVICE_KEY_ID);

		request.onerror = () => {
			console.error('[CredentialEncryption] Failed to retrieve key:', request.error);
			reject(request.error);
		};

		request.onsuccess = () => {
			const result = request.result;
			resolve(result?.key ?? null);
		};
	});

	if (existingKey) {
		cachedDeviceKey = existingKey;
		console.debug('[CredentialEncryption] Retrieved existing device key');
		return existingKey;
	}

	// Generate new AES-GCM key
	const key = await crypto.subtle.generateKey(
		{
			name: 'AES-GCM',
			length: 256
		},
		false, // NOT extractable - device-bound, cannot be exported
		['encrypt', 'decrypt']
	);

	// Store the key
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(KEY_STORE_NAME, 'readwrite');
		const store = tx.objectStore(KEY_STORE_NAME);
		const request = store.put({
			id: DEVICE_KEY_ID,
			key,
			createdAt: new Date().toISOString()
		});

		request.onerror = () => {
			console.error('[CredentialEncryption] Failed to store key:', request.error);
			reject(request.error);
		};

		request.onsuccess = () => resolve();
	});

	cachedDeviceKey = key;
	console.debug('[CredentialEncryption] Created new device-bound encryption key');
	return key;
}

// ============================================================================
// Encoding Utilities
// ============================================================================

/**
 * Convert ArrayBuffer to base64 string
 *
 * @param buffer - ArrayBuffer to encode
 * @returns Base64-encoded string
 */
function bufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

/**
 * Convert base64 string to ArrayBuffer
 *
 * @param base64 - Base64-encoded string
 * @returns Decoded ArrayBuffer
 */
function base64ToBuffer(base64: string): ArrayBuffer {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes.buffer;
}

// ============================================================================
// Encryption Operations
// ============================================================================

/**
 * Encrypt a credential object for storage
 *
 * Uses AES-GCM authenticated encryption:
 * - 256-bit key (device-bound, non-extractable)
 * - 96-bit random IV (unique per encryption)
 * - Authentication tag (prevents tampering)
 *
 * @param credential - Credential object to encrypt
 * @returns Encrypted credential wrapper
 */
export async function encryptCredential<T>(credential: T): Promise<EncryptedCredential> {
	const key = await getOrCreateDeviceKey();

	// Generate random IV (12 bytes / 96 bits for AES-GCM)
	// NIST recommends 96-bit IV for AES-GCM
	const iv = crypto.getRandomValues(new Uint8Array(12));

	// Serialize credential to JSON
	const plaintext = JSON.stringify(credential);
	const data = new TextEncoder().encode(plaintext);

	// Encrypt with AES-GCM
	const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);

	return {
		ciphertext: bufferToBase64(ciphertext),
		iv: bufferToBase64(iv.buffer),
		version: ENCRYPTION_VERSION
	};
}

/**
 * Decrypt a stored credential
 *
 * @param encrypted - Encrypted credential wrapper
 * @returns Decrypted credential object
 * @throws Error if decryption fails (wrong key, tampered data, etc.)
 */
export async function decryptCredential<T>(encrypted: EncryptedCredential): Promise<T> {
	const key = await getOrCreateDeviceKey();

	// Decode IV and ciphertext
	const ivBuffer = base64ToBuffer(encrypted.iv);
	const iv = new Uint8Array(ivBuffer);
	const ciphertext = base64ToBuffer(encrypted.ciphertext);

	// Decrypt with AES-GCM
	// This will throw if:
	// - Wrong key (different device)
	// - Tampered ciphertext
	// - Invalid IV
	const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBuffer }, key, ciphertext);

	// Parse JSON
	const json = new TextDecoder().decode(plaintext);
	return JSON.parse(json);
}

// ============================================================================
// Capability Detection
// ============================================================================

/**
 * Check if encryption is available (Web Crypto API present)
 *
 * Encryption requires:
 * - Web Crypto API (crypto.subtle)
 * - IndexedDB (for key storage)
 * - Secure context (HTTPS or localhost)
 *
 * @returns True if encryption is available
 */
export function isEncryptionAvailable(): boolean {
	// Check for Web Crypto API
	if (typeof crypto === 'undefined' || typeof crypto.subtle === 'undefined') {
		console.warn('[CredentialEncryption] Web Crypto API not available');
		return false;
	}

	// Check for IndexedDB
	if (typeof indexedDB === 'undefined') {
		console.warn('[CredentialEncryption] IndexedDB not available');
		return false;
	}

	// Check for secure context (required for crypto.subtle in most browsers)
	if (typeof window !== 'undefined' && !window.isSecureContext) {
		console.warn('[CredentialEncryption] Not in secure context (HTTPS required)');
		return false;
	}

	return true;
}

/**
 * Check if a stored object is encrypted
 *
 * @param stored - Stored object to check
 * @returns True if the object contains encrypted data
 */
export function isEncryptedCredential(stored: unknown): stored is { encrypted: EncryptedCredential } {
	if (!stored || typeof stored !== 'object') {
		return false;
	}

	const obj = stored as Record<string, unknown>;

	if (!obj.encrypted || typeof obj.encrypted !== 'object') {
		return false;
	}

	const encrypted = obj.encrypted as Record<string, unknown>;

	return (
		typeof encrypted.ciphertext === 'string' &&
		typeof encrypted.iv === 'string' &&
		typeof encrypted.version === 'number'
	);
}

// ============================================================================
// Key Rotation Support (Future)
// ============================================================================

/**
 * Rotate the device encryption key
 *
 * This will:
 * 1. Generate a new key
 * 2. Return the old and new keys for re-encryption
 *
 * Caller is responsible for re-encrypting all stored credentials.
 *
 * @returns Object containing old and new keys
 */
export async function rotateDeviceKey(): Promise<{
	oldKey: CryptoKey | null;
	newKey: CryptoKey;
}> {
	const db = await openKeyDB();

	// Get existing key (may be null)
	const oldKey = cachedDeviceKey;

	// Generate new key
	const newKey = await crypto.subtle.generateKey(
		{
			name: 'AES-GCM',
			length: 256
		},
		false,
		['encrypt', 'decrypt']
	);

	// Store new key
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(KEY_STORE_NAME, 'readwrite');
		const store = tx.objectStore(KEY_STORE_NAME);
		const request = store.put({
			id: DEVICE_KEY_ID,
			key: newKey,
			createdAt: new Date().toISOString(),
			rotatedFrom: oldKey ? new Date().toISOString() : undefined
		});

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve();
	});

	// Update cache
	cachedDeviceKey = newKey;

	console.debug('[CredentialEncryption] Device key rotated');

	return { oldKey, newKey };
}

/**
 * Clear the device encryption key
 *
 * WARNING: This will make all encrypted credentials unreadable!
 * Only use for complete data wipe (user logout, privacy clear).
 */
export async function clearDeviceKey(): Promise<void> {
	const db = await openKeyDB();

	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(KEY_STORE_NAME, 'readwrite');
		const store = tx.objectStore(KEY_STORE_NAME);
		const request = store.delete(DEVICE_KEY_ID);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve();
	});

	cachedDeviceKey = null;
	console.debug('[CredentialEncryption] Device key cleared');
}
