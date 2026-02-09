/**
 * Authority Level Derivation
 *
 * Maps verification method and document type to ZK circuit authority level (1-5).
 * Stored on User model and used during proof generation.
 *
 * Authority Levels:
 *   5 — Reserved for future (e.g., biometric + passport + address)
 *   4 — Passport-verified identity (highest current tier)
 *   3 — ID card / drivers license verified
 *   2 — Verified email (trust_score >= 100)
 *   1 — OAuth-only (unverified, default)
 *
 * On-chain enforcement:
 *   Each action domain can require a minimum authority level via
 *   DistrictGate.actionDomainMinAuthority mapping (Wave 14d).
 */

export type AuthorityLevel = 1 | 2 | 3 | 4 | 5;

/**
 * Derive authority level from user verification state.
 *
 * Wave 14R fix: Now uses document_type to differentiate passport (L4) from ID card/license (L3).
 * Previously all Didit verifications were L4, which was inaccurate for non-passport documents.
 *
 * @param user - User verification fields
 * @returns Authority level (1-5)
 */
export function deriveAuthorityLevel(user: {
	identity_commitment?: string | null;
	trust_score: number;
	verification_method?: string | null;
	document_type?: string | null;
}): AuthorityLevel {
	// Level 4: Passport-verified via Didit or self.xyz
	if (
		user.identity_commitment &&
		(user.verification_method === 'didit' || user.verification_method === 'self.xyz') &&
		user.document_type === 'passport'
	) {
		return 4;
	}

	// Level 3: ID card / drivers license (verified identity but not passport)
	if (user.identity_commitment) {
		return 3;
	}

	// Level 2: Verified email (trust_score >= 100)
	if (user.trust_score >= 100) {
		return 2;
	}

	// Level 1: OAuth-only (default)
	return 1;
}
