/**
 * Security Utilities
 *
 * Privacy-preserving fraud detection and cryptographic utilities.
 */

import { createHash, randomBytes } from 'crypto';

/**
 * Hash IP address with daily salt (privacy-preserving fraud detection)
 * @param ipAddress - Client IP address
 * @returns SHA-256 hash (64-character hex)
 */
export function hashIPAddress(ipAddress: string): string {
	const IP_HASH_SALT = process.env.IP_HASH_SALT;

	if (!IP_HASH_SALT) {
		throw new Error(
			'IP_HASH_SALT environment variable not configured. ' + 'Generate with: openssl rand -hex 32'
		);
	}

	// Add daily rotation (prevents long-term tracking)
	const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
	const dailySalt = `${IP_HASH_SALT}:${today}`;

	return createHash('sha256').update(dailySalt).update(ipAddress).digest('hex');
}

/**
 * Generate cryptographic nonce (for session challenges)
 * @returns 32-character hex string (128 bits of entropy)
 */
export function generateNonce(): string {
	// Use crypto.randomBytes for cryptographically secure randomness
	return randomBytes(16).toString('hex'); // 16 bytes = 128 bits = 32 hex chars
}

/**
 * Generate verification session challenge (QR code data)
 * @returns Unique challenge string
 */
export function generateChallenge(): string {
	return randomBytes(32).toString('hex'); // 64-character hex string
}

/**
 * Validate that a timestamp is within acceptable window
 * @param timestamp - ISO timestamp string
 * @param maxAgeMs - Maximum age in milliseconds (default: 5 minutes)
 * @returns true if timestamp is fresh, false if expired
 */
export function isTimestampFresh(timestamp: string, maxAgeMs: number = 5 * 60 * 1000): boolean {
	const timestampDate = new Date(timestamp);
	const now = new Date();
	const ageMs = now.getTime() - timestampDate.getTime();

	return ageMs >= 0 && ageMs <= maxAgeMs;
}

/**
 * Sanitize SDK response metadata (remove PII before storing)
 * @param metadata - Raw SDK response
 * @returns Sanitized metadata safe for audit logging
 */
export function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
	// Allowlist of safe fields (no PII)
	const safeFields = [
		'sdk_version',
		'verification_method',
		'timestamp',
		'success',
		'error_code',
		'challenge_id'
	];

	const sanitized: Record<string, unknown> = {};

	for (const field of safeFields) {
		if (field in metadata) {
			sanitized[field] = metadata[field];
		}
	}

	return sanitized;
}
