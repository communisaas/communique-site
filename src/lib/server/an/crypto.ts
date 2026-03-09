import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '$env/dynamic/private';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV for GCM
const TAG_LENGTH = 16; // 128-bit auth tag

/**
 * Get the 32-byte encryption key from environment.
 * ENCRYPTION_KEY must be a 64-char hex string (32 bytes).
 */
function getKey(): Buffer {
	const hex = env.ENCRYPTION_KEY;
	if (!hex) throw new Error('ENCRYPTION_KEY env var is required');
	if (hex.length !== 64) throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
	return Buffer.from(hex, 'hex');
}

/**
 * Encrypt an API key at rest.
 * Returns `iv:ciphertext:tag` as hex-encoded segments.
 */
export function encryptApiKey(plaintext: string): string {
	const key = getKey();
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, key, iv);
	const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return `${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`;
}

/**
 * Decrypt an API key from stored format.
 * Expects `iv:ciphertext:tag` as hex-encoded segments.
 */
export function decryptApiKey(encrypted: string): string {
	const key = getKey();
	const parts = encrypted.split(':');
	if (parts.length !== 3) throw new Error('Invalid encrypted format');

	const iv = Buffer.from(parts[0], 'hex');
	const ciphertext = Buffer.from(parts[1], 'hex');
	const tag = Buffer.from(parts[2], 'hex');

	if (iv.length !== IV_LENGTH) throw new Error('Invalid IV length');
	if (tag.length !== TAG_LENGTH) throw new Error('Invalid auth tag length');

	const decipher = createDecipheriv(ALGORITHM, key, iv);
	decipher.setAuthTag(tag);
	const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
	return decrypted.toString('utf8');
}
