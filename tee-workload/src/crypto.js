/**
 * XChaCha20-Poly1305 Decryption
 *
 * Decrypts messages encrypted by browser
 * Uses @noble/ciphers for cryptography
 */

import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { scrypt } from '@noble/hashes/scrypt';
import { utf8ToBytes } from '@noble/hashes/utils';

/**
 * Decrypt XChaCha20-Poly1305 ciphertext
 *
 * @param {string} ciphertext - Hex-encoded encrypted message
 * @param {string} nonce - Hex-encoded 24-byte nonce
 * @param {string} userId - User identifier for key derivation
 * @returns {Promise<string>} Decrypted plaintext message
 */
export async function decrypt(ciphertext, nonce, userId) {
	try {
		// 1. Derive decryption key from user ID
		const key = await deriveKey(userId);

		// 2. Convert hex to Uint8Array
		const ciphertextBytes = hexToBytes(ciphertext);
		const nonceBytes = hexToBytes(nonce);

		// 3. Verify nonce is 24 bytes (XChaCha20 requirement)
		if (nonceBytes.length !== 24) {
			throw new Error(`Invalid nonce length: ${nonceBytes.length} (expected 24)`);
		}

		// 4. Decrypt with XChaCha20-Poly1305
		const cipher = xchacha20poly1305(key, nonceBytes);
		const plaintextBytes = cipher.decrypt(ciphertextBytes);

		// 5. Convert to UTF-8 string
		const plaintext = new TextDecoder().decode(plaintextBytes);

		return plaintext;
	} catch (error) {
		console.error('Decryption error:', error);
		throw new Error(`Decryption failed: ${error.message}`);
	}
}

/**
 * Derive 32-byte encryption key from user ID
 *
 * Uses scrypt for key derivation (same as @voter-protocol/crypto)
 * TODO: Integrate with @voter-protocol/crypto when available
 */
async function deriveKey(userId) {
	// Get master secret from environment
	const masterSecret = process.env.ENCRYPTION_KEY;

	if (!masterSecret) {
		throw new Error('ENCRYPTION_KEY environment variable not set');
	}

	// Derive key using scrypt (memory-hard, GPU-resistant)
	const password = utf8ToBytes(userId);
	const salt = utf8ToBytes(masterSecret);

	const key = scrypt(password, salt, {
		N: 2 ** 14, // CPU/memory cost (16384)
		r: 8, // Block size
		p: 1, // Parallelization
		dkLen: 32 // Output key length (256 bits)
	});

	return key;
}

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex) {
	if (hex.length % 2 !== 0) {
		throw new Error('Invalid hex string length');
	}

	const bytes = new Uint8Array(hex.length / 2);

	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
	}

	return bytes;
}

/**
 * Test decryption with known plaintext (for development)
 */
export async function testDecryption() {
	// Known plaintext/ciphertext pair for testing
	const testUserId = 'test-user-123';
	const testPlaintext = 'Dear Senator, I support H.R. 1234 for climate action.';

	console.log('Running decryption test...');
	console.log('Plaintext:', testPlaintext);

	// TODO: Generate test ciphertext
	// For now, just verify key derivation works
	const key = await deriveKey(testUserId);
	console.log('Key derived successfully (length:', key.length, 'bytes)');

	return true;
}
