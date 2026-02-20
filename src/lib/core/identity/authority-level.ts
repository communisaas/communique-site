/**
 * Authority Level Derivation
 *
 * Maps verification method and document type to ZK circuit authority level (1-5).
 * Stored on User model and used during proof generation.
 *
 * Authority Levels:
 *   5 — Government credential (mDL / EUDIW via Digital Credentials API)
 *   4 — Passport-verified identity
 *   3 — ID card / drivers license verified
 *   2 — Verified email (trust_score >= 100)
 *   1 — OAuth-only (unverified, default)
 *
 * On-chain enforcement:
 *   Each action domain can require a minimum authority level via
 *   DistrictGate.actionDomainMinAuthority mapping (Wave 14d).
 *
 * Trust Tiers (Graduated Trust - see docs/architecture/graduated-trust.md):
 *   0 — Guest (no account, conceptual — never returned by deriveTrustTier)
 *   1 — Authenticated (OAuth login, any logged-in user)
 *   2 — Address-attested (district verified via civic data)
 *   3 — ZK-verified constituent (cryptographic proof of district)
 *   4 — Government credential (mDL / EUDIW via Digital Credentials API)
 */

export type AuthorityLevel = 1 | 2 | 3 | 4 | 5;
export type TrustTier = 0 | 1 | 2 | 3 | 4;

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
	// Level 5: Government credential (mDL / EUDIW via Digital Credentials API)
	if (user.document_type === 'mdl' && user.identity_commitment) {
		return 5;
	}

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

/**
 * Trust tier labels for UI display
 */
export const TRUST_TIER_LABELS: Record<TrustTier, string> = {
	0: 'Guest',
	1: 'Authenticated',
	2: 'District Verified',
	3: 'Identity Verified',
	4: 'Government Verified'
};

/**
 * Derive trust tier from user verification state.
 *
 * Tiers are cumulative - a user at Tier 3 has achieved all lower tiers.
 * Returns the HIGHEST tier achieved by the user.
 *
 * Wave 1C: Graduated Trust implementation
 *
 * @param user - User verification fields
 * @returns Trust tier (1-4) for authenticated users. Tier 0 (Guest) is conceptual only.
 */
export function deriveTrustTier(user: {
	passkey_credential_id?: string | null;
	district_verified?: boolean;
	address_verified_at?: Date | string | null;
	identity_commitment?: string | null;
	document_type?: string | null;
	trust_score?: number;
}): TrustTier {
	// Tier 4: Government credential (mDL / EUDIW)
	// Future: Will check for government credential metadata
	// For now, this is unreachable (no gov credential flow exists yet)
	if (user.document_type === 'mdl' && user.identity_commitment) {
		return 4;
	}

	// Tier 3: ZK-verified (has identity_commitment from self.xyz or Didit)
	if (user.identity_commitment) {
		return 3;
	}

	// Tier 2: Address-attested (district verified via civic data)
	// Requires BOTH district_verified flag AND address_verified_at timestamp
	if (user.district_verified === true && user.address_verified_at) {
		return 2;
	}

	// Tier 1: Authenticated (any logged-in user)
	// Passkey is an upgrade within this tier, not a separate tier.
	// Tier 0 (Guest) is conceptual — means no user object at all.
	return 1;
}

/**
 * Map trust tier to authority level for backward compatibility.
 *
 * This mapping allows existing code using authority_level to continue working
 * while we transition to the graduated trust tier model.
 *
 * @param tier - Trust tier (0-4)
 * @returns Authority level (1-5)
 */
export function trustTierToAuthorityLevel(tier: TrustTier): AuthorityLevel {
	switch (tier) {
		case 0:
			return 1; // Guest → OAuth-only equivalent (conceptual, no user object)
		case 1:
			return 1; // Authenticated (OAuth) → OAuth-only equivalent
		case 2:
			return 2; // Address-attested → Verified email equivalent
		case 3:
			return 3; // ZK-verified → ID card/license verified
		case 4:
			return 5; // Government credential → Highest authority (government-issued)
		default:
			return 1; // Default to lowest authority level
	}
}
