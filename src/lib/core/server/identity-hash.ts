/**
 * Identity Hash Utility
 *
 * Generates deterministic, collision-resistant hashes from identity documents.
 * Used for Sybil resistance (one-identity-per-account enforcement).
 *
 * Security properties:
 * - Deterministic: Same identity → same hash (duplicate detection)
 * - Collision-resistant: SHA-256 (cryptographically secure)
 * - Privacy-preserving: Can't reverse-engineer passport number from hash
 * - Salted: Platform secret prevents rainbow table attacks
 */

import { createHash } from 'crypto';

export interface IdentityProof {
	passportNumber: string; // NEVER store plaintext
	nationality: string; // ISO 3166-1 alpha-2 (e.g., "US", "CA", "GB")
	birthYear: number; // Year only (privacy > full DOB)
	documentType: 'passport' | 'drivers_license' | 'national_id' | 'state_id';
}

/**
 * Generate deterministic identity hash
 * @param proof - Identity document data
 * @returns 64-character hex string (SHA-256 output)
 * @throws Error if IDENTITY_HASH_SALT not configured
 */
export function generateIdentityHash(proof: IdentityProof): string {
	const PLATFORM_SALT = process.env.IDENTITY_HASH_SALT;

	if (!PLATFORM_SALT) {
		throw new Error(
			'IDENTITY_HASH_SALT environment variable not configured. ' +
				'Generate with: openssl rand -hex 32'
		);
	}

	// Normalize inputs (prevent case/whitespace variations)
	const normalizedPassport = proof.passportNumber.toUpperCase().replace(/[\s-]/g, ''); // Remove spaces and hyphens

	const normalizedNationality = proof.nationality.toUpperCase();

	// Construct deterministic identity string
	const identityString = [
		normalizedPassport,
		normalizedNationality,
		proof.birthYear.toString(),
		proof.documentType
	].join('::');

	// Hash with platform salt
	const hash = createHash('sha256').update(PLATFORM_SALT).update(identityString).digest('hex');

	return hash; // Returns 64-character hex string
}

/**
 * Generate audit-safe identity fingerprint (first 16 characters)
 * Used for logging without exposing full hash
 */
export function generateIdentityFingerprint(identityHash: string): string {
	return identityHash.substring(0, 16);
}

/**
 * Validate identity proof structure
 * @throws Error if proof is invalid
 */
export function validateIdentityProof(proof: unknown): asserts proof is IdentityProof {
	if (typeof proof !== 'object' || proof === null) {
		throw new Error('Identity proof must be an object');
	}

	const p = proof as Partial<IdentityProof>;

	if (!p.passportNumber || typeof p.passportNumber !== 'string') {
		throw new Error('passportNumber is required and must be a string');
	}

	if (!p.nationality || typeof p.nationality !== 'string') {
		throw new Error('nationality is required and must be a string');
	}

	if (!p.birthYear || typeof p.birthYear !== 'number') {
		throw new Error('birthYear is required and must be a number');
	}

	if (
		!p.documentType ||
		!['passport', 'drivers_license', 'national_id', 'state_id'].includes(p.documentType)
	) {
		throw new Error(
			'documentType must be one of: passport, drivers_license, national_id, state_id'
		);
	}

	// Validate nationality format (ISO 3166-1 alpha-2)
	if (!/^[A-Z]{2}$/.test(p.nationality.toUpperCase())) {
		throw new Error('nationality must be ISO 3166-1 alpha-2 code (e.g., "US", "CA", "GB")');
	}

	// Validate birth year range (reasonable bounds)
	const currentYear = new Date().getFullYear();
	if (p.birthYear < 1900 || p.birthYear > currentYear) {
		throw new Error(`birthYear must be between 1900 and ${currentYear}`);
	}
}

/**
 * Check if user is 18 or older
 * @param birthYear - User's birth year
 * @returns true if 18+, false otherwise
 */
export function isAgeEligible(birthYear: number): boolean {
	const currentYear = new Date().getFullYear();
	const age = currentYear - birthYear;
	return age >= 18;
}
