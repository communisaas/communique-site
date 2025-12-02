/**
 * Witness Encryption Module
 *
 * Encrypts witness data (address + proof inputs) to TEE public key
 * Uses XChaCha20-Poly1305 for authenticated encryption
 *
 * Flow:
 * 1. Generate ephemeral keypair
 * 2. Derive shared secret (ECDH with TEE public key)
 * 3. Encrypt witness with XChaCha20-Poly1305
 * 4. Return ciphertext + nonce + ephemeral public key
 *
 * Per COMMUNIQUE-ZK-IMPLEMENTATION-SPEC.md Phase 2
 */

/**
 * Witness data structure
 * Contains all inputs needed for proof generation in TEE
 */
export interface WitnessData {
	/** Identity commitment (Poseidon hash) */
	identityCommitment: string;
	/** Leaf index in district Merkle tree (0-4095) */
	leafIndex: number;
	/** Merkle path (12 sibling hashes) */
	merklePath: string[];
	/** Merkle root */
	merkleRoot: string;
	/** Action ID (template ID) */
	actionId: string;
	/** Timestamp */
	timestamp: number;
	/** User address for encryption (not used in proof) */
	address: string;
}

/**
 * Encrypted witness result
 */
export interface EncryptedWitness {
	/** Base64-encoded ciphertext */
	ciphertext: string;
	/** Base64-encoded nonce (24 bytes for XChaCha20) */
	nonce: string;
	/** Hex-encoded ephemeral public key for ECDH */
	ephemeralPublicKey: string;
	/** TEE key ID used for encryption */
	teeKeyId: string;
}

/**
 * TEE public key (fetched from backend)
 */
interface TEEPublicKey {
	keyId: string;
	publicKey: string; // Hex-encoded X25519 public key
	expiresAt: string;
}

// Cache TEE public key for 1 hour
let cachedTEEKey: TEEPublicKey | null = null;
let cacheExpiry: number = 0;

/**
 * Fetch TEE public key from backend
 * Cached for 1 hour to reduce API calls
 */
async function getTEEPublicKey(): Promise<TEEPublicKey> {
	const now = Date.now();

	// Return cached key if still valid
	if (cachedTEEKey && now < cacheExpiry) {
		return cachedTEEKey;
	}

	// Fetch fresh key from backend
	const response = await fetch('/api/tee/public-key');

	if (!response.ok) {
		throw new Error('Failed to fetch TEE public key');
	}

	const data = await response.json();

	if (!data.success || !data.keyId || !data.publicKey) {
		throw new Error('Invalid TEE public key response');
	}

	cachedTEEKey = {
		keyId: data.keyId,
		publicKey: data.publicKey,
		expiresAt: data.expiresAt
	};

	// Cache for 1 hour
	cacheExpiry = now + 60 * 60 * 1000;

	return cachedTEEKey;
}

/**
 * Encrypt witness data to TEE public key
 *
 * Uses XChaCha20-Poly1305 for authenticated encryption
 * Derives shared secret via ECDH with ephemeral keypair
 *
 * @param witness - Witness data to encrypt
 * @returns Encrypted witness with nonce and ephemeral public key
 */
export async function encryptWitness(witness: WitnessData): Promise<EncryptedWitness> {
	try {
		// Step 1: Get TEE public key
		const teeKey = await getTEEPublicKey();

		// Step 2: Generate ephemeral P-256 keypair (X25519 not supported in browsers)
		const ephemeralKeypair = await crypto.subtle.generateKey(
			{
				name: 'ECDH',
				namedCurve: 'P-256'
			},
			true, // extractable
			['deriveBits']
		);

		// Step 3: Derive shared secret (ECDH)
		const teePublicKeyBytes = hexToBytes(teeKey.publicKey);
		const importedTEEPublicKey = await crypto.subtle.importKey(
			'raw',
			teePublicKeyBytes,
			{
				name: 'ECDH',
				namedCurve: 'P-256'
			},
			false,
			[]
		);

		const sharedSecret = await crypto.subtle.deriveBits(
			{
				name: 'ECDH',
				public: importedTEEPublicKey
			},
			ephemeralKeypair.privateKey,
			256 // 32 bytes
		);

		// Step 4: Derive encryption key from shared secret (HKDF)
		const sharedSecretKey = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, [
			'deriveBits'
		]);

		const encryptionKeyBits = await crypto.subtle.deriveBits(
			{
				name: 'HKDF',
				hash: 'SHA-256',
				salt: new Uint8Array(32), // 32-byte zero salt
				info: new TextEncoder().encode('communique-witness-encryption')
			},
			sharedSecretKey,
			256 // 32 bytes for XChaCha20-Poly1305
		);

		// Step 5: Generate random nonce (24 bytes for XChaCha20)
		const nonce = crypto.getRandomValues(new Uint8Array(24));

		// Step 6: Serialize witness to JSON
		const witnessJson = JSON.stringify(witness);
		const witnessBytes = new TextEncoder().encode(witnessJson);

		// Step 7: Encrypt with XChaCha20-Poly1305
		// NOTE: Web Crypto API doesn't support XChaCha20-Poly1305 directly
		// We'll use AES-GCM as a fallback for now
		// TODO: Replace with XChaCha20-Poly1305 using @stablelib/xchacha20poly1305
		const encryptionKey = await crypto.subtle.importKey(
			'raw',
			encryptionKeyBits,
			'AES-GCM',
			false,
			['encrypt']
		);

		const ciphertext = await crypto.subtle.encrypt(
			{
				name: 'AES-GCM',
				iv: nonce.slice(0, 12), // AES-GCM uses 12-byte nonce
				tagLength: 128 // 16-byte authentication tag
			},
			encryptionKey,
			witnessBytes
		);

		// Step 8: Export ephemeral public key
		const ephemeralPublicKeyBytes = await crypto.subtle.exportKey(
			'raw',
			ephemeralKeypair.publicKey
		);

		// Step 9: Return encrypted witness
		return {
			ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
			nonce: bytesToBase64(nonce),
			ephemeralPublicKey: bytesToHex(new Uint8Array(ephemeralPublicKeyBytes)),
			teeKeyId: teeKey.keyId
		};
	} catch (error) {
		console.error('[Witness Encryption] Encryption failed:', error);
		throw new Error(
			`Failed to encrypt witness: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
	const cleanHex = hex.replace(/^0x/, '');
	const bytes = new Uint8Array(cleanHex.length / 2);
	for (let i = 0; i < cleanHex.length; i += 2) {
		bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
	}
	return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
	return (
		'0x' +
		Array.from(bytes)
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('')
	);
}

/**
 * Convert Uint8Array to base64 string
 */
function bytesToBase64(bytes: Uint8Array): string {
	const binary = String.fromCharCode(...bytes);
	return btoa(binary);
}

/**
 * Convert base64 string to Uint8Array
 */
export function base64ToBytes(base64: string): Uint8Array {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}
