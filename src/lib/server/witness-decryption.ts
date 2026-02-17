/**
 * Server-side Witness Decryption
 *
 * Mirrors client-side encryption (src/lib/core/proof/witness-encryption.ts).
 * Decrypts witness data encrypted to the server's X25519 public key.
 *
 * Crypto: X25519 ECDH -> BLAKE2b KDF -> XChaCha20-Poly1305
 */

import sodium from 'libsodium-wrappers';

export interface EncryptedWitnessPayload {
	/** Base64-encoded ciphertext */
	ciphertext: string;
	/** Base64-encoded nonce (24 bytes) */
	nonce: string;
	/** Hex-encoded ephemeral X25519 public key */
	ephemeralPublicKey: string;
}

/**
 * Decrypt witness data using server's X25519 private key.
 *
 * @param encrypted - Encrypted witness payload from client
 * @param privateKeyHex - Server's X25519 private key (hex-encoded, from env var)
 * @returns Parsed witness data (WitnessData shape, but typed as Record for flexibility)
 */
export async function decryptWitness(
	encrypted: EncryptedWitnessPayload,
	privateKeyHex?: string
): Promise<Record<string, unknown>> {
	await sodium.ready;

	// Get server private key from env or parameter
	const keyHex = privateKeyHex || process.env.WITNESS_ENCRYPTION_PRIVATE_KEY;
	if (!keyHex) {
		throw new Error('WITNESS_ENCRYPTION_PRIVATE_KEY not configured');
	}

	// Parse inputs
	const privateKey = hexToBytes(keyHex);
	const ephemeralPublicKey = hexToBytes(encrypted.ephemeralPublicKey);
	const ciphertext = sodium.from_base64(encrypted.ciphertext, sodium.base64_variants.ORIGINAL);
	const nonce = sodium.from_base64(encrypted.nonce, sodium.base64_variants.ORIGINAL);

	// Step 1: Derive shared secret via X25519 ECDH
	// Same as client: crypto_scalarmult(privateKey, publicKey)
	const sharedSecret = sodium.crypto_scalarmult(privateKey, ephemeralPublicKey);

	// Step 2: Derive encryption key via BLAKE2b
	// MUST use same context string as client
	const encryptionKey = sodium.crypto_generichash(
		32,
		sharedSecret,
		sodium.from_string('communique-witness-encryption')
	);

	// Step 3: Decrypt with XChaCha20-Poly1305
	// Parameter order: secret_nonce, ciphertext, additional_data, public_nonce, key
	const plaintext = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
		null, // no secret nonce
		ciphertext,
		null, // no additional authenticated data
		nonce,
		encryptionKey
	);

	// Step 4: Parse JSON
	const witnessJson = sodium.to_string(plaintext);
	return JSON.parse(witnessJson);
}

function hexToBytes(hex: string): Uint8Array {
	const cleanHex = hex.replace(/^0x/, '');
	const bytes = new Uint8Array(cleanHex.length / 2);
	for (let i = 0; i < cleanHex.length; i += 2) {
		bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
	}
	return bytes;
}
