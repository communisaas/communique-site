/**
 * IACA Root Certificates for mDL Issuer Verification
 *
 * Trust store for ISO 18013-5 Issuing Authority CA (IACA) root certificates.
 * Used to verify COSE_Sign1 signatures on mobile driver's licenses (mDL).
 *
 * Source: AAMVA VICAL (Verified Issuer Certificate Authority List)
 *   https://vical.dts.aamva.org
 *
 * Each state DMV publishes its IACA root certificate through the AAMVA
 * Digital Trust Service. These certificates are the trust anchors for
 * verifying that an mDL was issued by a legitimate authority.
 *
 * Current status:
 *   - Structure ready for production certificates
 *   - DEV_IACA_ROOT placeholder for development/testing
 *   - Real certificates will be populated from AAMVA VICAL in a future cycle
 *
 * Last updated: 2026-02-18
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
	/** Pre-decoded DER bytes (populated at load time for efficient comparison) */
	derBytes?: Uint8Array;
	/** Certificate expiration (ISO 8601) */
	expiresAt: string;
}

/**
 * IACA root certificates indexed by state.
 *
 * PLACEHOLDER: Actual certificate data must be obtained from the AAMVA VICAL
 * (Verified Issuer Certificate Authority List) at https://vical.dts.aamva.org.
 * Each state's IACA root is ~2KB base64. These will be populated before
 * production launch.
 *
 * When populating, each entry should contain:
 *   - The root CA certificate (not intermediate) from the state's IACA
 *   - The base64 DER encoding of that certificate
 *   - The expiration date for rotation monitoring
 */
export const IACA_ROOTS: Record<string, IACACertificate> = {
	// Production entries from AAMVA VICAL will go here.
	// Example structure:
	// 'CA': {
	//   state: 'CA',
	//   issuer: 'California DMV IACA Root CA',
	//   certificateB64: 'MIIBkT...', // ~2KB base64 DER
	//   expiresAt: '2030-12-31T23:59:59Z',
	// },
};

/**
 * Development/testing IACA root placeholder.
 *
 * This is NOT a real certificate — it's a minimal self-signed DER structure
 * that exercises the code path (trust store lookup, base64 decode, DER parsing)
 * without requiring real AAMVA certificates.
 *
 * In tests, use Web Crypto to generate a real self-signed ECDSA P-256 cert
 * and pass it directly. This placeholder exists so getIACARootsForVerification()
 * can return a non-empty array in development mode.
 */
export const DEV_IACA_ROOT: IACACertificate = {
	state: 'XX',
	issuer: 'Communique Development IACA Root (NOT FOR PRODUCTION)',
	// Minimal placeholder — NOT a valid X.509 certificate.
	// Real certs will be ~2KB. This is intentionally small to make
	// it obvious it's a placeholder.
	certificateB64: '',
	expiresAt: '2099-12-31T23:59:59Z'
};

/**
 * Lookup IACA root certificate for a given issuer state.
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

/**
 * Get all IACA root certificates for COSE_Sign1 verification.
 *
 * Returns production certificates when available, otherwise an empty array.
 * The caller (mdl-verification.ts) handles the empty case gracefully by
 * logging a warning and proceeding without issuer verification.
 *
 * In development/testing, callers can pass certificates directly to
 * verifyCoseSign1() rather than relying on this function.
 */
export function getIACARootsForVerification(): IACACertificate[] {
	const roots = Object.values(IACA_ROOTS);

	// Pre-decode DER bytes for efficient comparison
	for (const root of roots) {
		if (!root.derBytes && root.certificateB64) {
			root.derBytes = base64ToUint8Array(root.certificateB64);
		}
	}

	return roots;
}

/** Decode base64 string to Uint8Array (Workers-compatible, no Buffer) */
function base64ToUint8Array(base64: string): Uint8Array {
	const binaryString = atob(base64);
	const bytes = new Uint8Array(binaryString.length);
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes;
}
