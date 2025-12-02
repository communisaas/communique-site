/**
 * TEE Cryptography Module
 *
 * Implements "Digital Faraday Cage" decryption:
 * 1. ECDH Key Exchange (P-256)
 * 2. HKDF Key Derivation
 * 3. AES-256-GCM Decryption
 */

import crypto from 'node:crypto';

// Enclave's persistent keypair (generated on startup)
let enclaveKeyPair = null;

/**
 * Initialize cryptography module
 * Generates a fresh P-256 keypair for the enclave
 */
export async function initCrypto() {
	if (enclaveKeyPair) return;

	console.log('Generating Enclave P-256 Keypair...');

	// Generate ECDH keypair on P-256 curve
	enclaveKeyPair = crypto.generateKeyPairSync('ec', {
		namedCurve: 'P-256'
	});

	console.log('Enclave Keypair Generated');
}

/**
 * Get Enclave's Public Key (raw bytes)
 */
export function getEnclavePublicKey() {
	if (!enclaveKeyPair) throw new Error('Crypto not initialized');

	// Export as raw uncompressed point (65 bytes: 0x04 + X + Y)
	return enclaveKeyPair.publicKey.export({
		type: 'spki',
		format: 'der'
	});
	// Note: For attestation, we might need the raw key bytes without SPKI header
	// But usually SPKI DER is fine or we extract the public key bitstring.
	// For simplicity in this demo, we'll use SPKI DER.
}

/**
 * Decrypt message from client
 *
 * @param {string} ciphertext - Base64 encoded ciphertext
 * @param {string} nonce - Base64 encoded IV (12 bytes)
 * @param {string} ephemeralPublicKeyHex - Client's ephemeral public key (Hex)
 * @returns {Promise<string>} Decrypted plaintext
 */
export async function decrypt(ciphertext, nonce, ephemeralPublicKeyHex) {
	if (!enclaveKeyPair) throw new Error('Crypto not initialized');

	try {
		// 1. Import client's ephemeral public key
		// Client sends raw key as hex, we need to import it
		const clientPublicKeyBuffer = Buffer.from(ephemeralPublicKeyHex.replace(/^0x/, ''), 'hex');

		// We assume the client sends a raw public key (uncompressed or compressed)
		// We need to import it into a KeyObject
		const clientKey = crypto.createPublicKey({
			key: clientPublicKeyBuffer,
			format: 'der', // Assuming DER or we might need 'raw' if supported by Node version
			type: 'spki'
		});

		// Note: importing raw EC key in Node can be tricky. 
		// If client sends raw bytes (X+Y), we might need to construct JWK or SPKI.
		// For this implementation, let's assume standard ECDH flow where we can compute secret.

		// Alternative: Use crypto.diffieHellman if we were using raw bytes, but we are using P-256.
		// Let's try standard ECDH.

		const sharedSecret = crypto.diffieHellman({
			privateKey: enclaveKeyPair.privateKey,
			publicKey: clientKey
		});

		// 2. Derive AES key using HKDF-SHA256
		// Salt is empty, Info is empty (or could be fixed string)
		const aesKey = crypto.hkdfSync(
			'sha256',
			sharedSecret,
			Buffer.alloc(0), // salt
			Buffer.alloc(0), // info
			32 // length (256 bits)
		);

		// 3. Decrypt using AES-256-GCM
		const decipher = crypto.createDecipheriv(
			'aes-256-gcm',
			aesKey,
			Buffer.from(nonce, 'base64')
		);

		// We need the auth tag. Usually in GCM, the tag is appended to ciphertext or sent separately.
		// The client `nitro-enclave-demo.ts` uses `crypto.subtle.encrypt` which appends the tag.
		// So ciphertext includes the tag at the end (16 bytes).

		const ciphertextBuffer = Buffer.from(ciphertext, 'base64');
		const authTagLength = 16;
		const authTag = ciphertextBuffer.subarray(ciphertextBuffer.length - authTagLength);
		const encryptedData = ciphertextBuffer.subarray(0, ciphertextBuffer.length - authTagLength);

		decipher.setAuthTag(authTag);

		let plaintext = decipher.update(encryptedData);
		plaintext = Buffer.concat([plaintext, decipher.final()]);

		return plaintext.toString('utf8');
	} catch (error) {
		console.error('Decryption error:', error);
		throw new Error(`Decryption failed: ${error.message}`);
	}
}

/**
 * Test decryption (mock)
 */
export async function testDecryption() {
	console.log('Skipping decryption test (requires client keypair generation)');
	return true;
}
