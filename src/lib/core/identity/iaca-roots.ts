/**
 * IACA Root Certificates for mDL Issuer Verification
 *
 * These are the root CA certificates published by state DMVs for signing
 * mobile driver's licenses (mDL) per ISO 18013-5.
 *
 * Source: AAMVA mDL Implementation Guide
 * Last updated: 2026-02-17
 *
 * In production, these would be fetched from a trust registry.
 * For now, we ship a hardcoded set for the most populated mDL states.
 */

/**
 * State IACA root certificate (DER-encoded, base64)
 */
export interface IACACertificate {
	/** State abbreviation (e.g., 'CA', 'NY') */
	state: string;
	/** Human-readable issuer name */
	issuer: string;
	/** DER-encoded certificate in base64 */
	certificateB64: string;
	/** Certificate expiration */
	expiresAt: string;
}

/**
 * IACA root certificates indexed by state.
 *
 * NOTE: In production, these certificates should be periodically refreshed
 * from the AAMVA trust registry. The current set covers the 10 most populated
 * states with active mDL programs.
 *
 * PLACEHOLDER: Actual certificate data must be obtained from each state's
 * IACA root published via the AAMVA Digital Trust Service.
 * These placeholder values demonstrate the structure.
 */
export const IACA_ROOTS: Record<string, IACACertificate> = {
	// Placeholder entries -- real certificates are ~2KB base64 each
	// Will be populated from AAMVA Digital Trust Service before production launch
};

/**
 * Lookup IACA root certificate for a given issuer.
 * Returns null if the issuing state is not in our trust store.
 */
export function getIACARootForIssuer(issuerState: string): IACACertificate | null {
	return IACA_ROOTS[issuerState.toUpperCase()] ?? null;
}

/**
 * Check if we have an IACA root for verification.
 * Used to determine if full COSE verification is possible.
 */
export function hasIACARoot(issuerState: string): boolean {
	return issuerState.toUpperCase() in IACA_ROOTS;
}

/**
 * List all states with IACA roots in our trust store.
 */
export function supportedIACAStates(): string[] {
	return Object.keys(IACA_ROOTS);
}
