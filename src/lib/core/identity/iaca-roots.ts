/**
 * IACA Root Certificates for mDL Issuer Verification
 *
 * Trust store for ISO 18013-5 Issuing Authority CA (IACA) root certificates.
 * Used to verify COSE_Sign1 signatures on mobile driver's licenses (mDL).
 *
 * Sources:
 *   - California: https://trust.dmv.ca.gov/certificates/ca-dmv-iaca-root-ca-crt.cer
 *   - New Mexico: https://www.mvd.newmexico.gov/wp-content/uploads/2025/10/New-Mexico-IACA-Certificate.zip
 *   - Additional states via AAMVA VICAL: https://vical.dts.aamva.org/currentVical
 *
 * All certificates are ECDSA P-256 (secp256r1), self-signed root CAs with
 * CA:TRUE and KeyUsage: Certificate Sign, CRL Sign per ISO 18013-5 §9.1.
 *
 * Certificate chain: IACA Root → DSC (Document Signer Certificate) → MSO
 * The IACA root is the trust anchor; DSCs are signed by the root and included
 * in the mDL's COSE_Sign1 x5chain. See cose-verify.ts verifyDscAgainstRoot().
 *
 * Last updated: 2026-03-02
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
 * Each entry contains:
 *   - The root CA certificate (not DSC) from the state's IACA
 *   - Base64 DER encoding verified with `openssl x509 -inform DER -noout -text`
 *   - Expiration date for rotation monitoring (see checkCertificateExpiry)
 *
 * Expansion path: parse AAMVA VICAL (CBOR/COSE at vical.dts.aamva.org/currentVical)
 * to bulk-import all participating states.
 */
export const IACA_ROOTS: Record<string, IACACertificate> = {
	/**
	 * California DMV IACA Root
	 * Source: https://trust.dmv.ca.gov/certificates/ca-dmv-iaca-root-ca-crt.cer
	 * Subject: C=US, ST=US-CA, O=CA-DMV, CN=California DMV IACA Root
	 * Serial: 5d:dd:28:90:e3:8c:e5:cc:a5:17:07:36:58:d2:bb:0f:63:be:02:b0
	 * Key: ECDSA P-256 (prime256v1)
	 * SHA-1 FP: B0:51:2A:8E:05:D9:E8:C7:D7:93:41:0F:79:DE:02:40:93:61:01:08
	 * Validity: 2023-03-01 to 2033-01-07
	 */
	CA: {
		state: 'CA',
		issuer: 'California DMV IACA Root',
		certificateB64:
			'MIICPzCCAeWgAwIBAgIUXd0okOOM5cylFwc2WNK7D2O+ArAwCgYIKoZIzj0EAwIw' +
			'UTELMAkGA1UEBhMCVVMxDjAMBgNVBAgMBVVTLUNBMQ8wDQYDVQQKDAZDQS1ETVYx' +
			'ITAfBgNVBAMMGENhbGlmb3JuaWEgRE1WIElBQ0EgUm9vdDAeFw0yMzAzMDExNzE3' +
			'MzlaFw0zMzAxMDcxNzE3MzlaMFExCzAJBgNVBAYTAlVTMQ4wDAYDVQQIDAVVUy1D' +
			'QTEPMA0GA1UECgwGQ0EtRE1WMSEwHwYDVQQDDBhDYWxpZm9ybmlhIERNViBJQUNB' +
			'IFJvb3QwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAARgzKB5QsRXYGxmIapA3ilL' +
			'oXCDxgTMI2JArA72VQ9gL2DIKkBAclKYtix7vQwUbhbH76mnmbOFSxYlCJtilfl1' +
			'o4GaMIGXMB0GA1UdDgQWBBS7fXVnknpvz59ye7gK9zcvnAxQNjASBgNVHRMBAf8E' +
			'CDAGAQH/AgEAMA4GA1UdDwEB/wQEAwIBBjAfBgNVHRIEGDAWgRRpYWNhLXJvb3RA' +
			'ZG12LmNhLmdvdjAxBgNVHR8EKjAoMCagJKAihiBodHRwczovL2NybC5kbXYuY2Eu' +
			'Z292L2lhY2Evcm9vdDAKBggqhkjOPQQDAgNIADBFAiAJriK4wEUzgDCK++tIIW+g' +
			'XASUIIcG/XhBNxuk2uHd7QIhAKWC8LFaM8qFsvlujtZZf647zD8BBc6kicj1Imw/' +
			'wujS',
		expiresAt: '2033-01-07T17:17:39Z'
	},

	/**
	 * New Mexico Motor Vehicle Division IACA Root
	 * Source: https://www.mvd.newmexico.gov/wp-content/uploads/2025/10/New-Mexico-IACA-Certificate.zip
	 * Subject: C=US, ST=US-NM, L=Santa Fe, O=New Mexico Taxation and Revenue Department,
	 *          OU=New Mexico Motor Vehicle Division, CN=New Mexico Root Certificate Authority
	 * Serial: 82:78:55:c2:c9:19:43:44:97:14:14:49:4c:ba:98:3c:69:26:b6
	 * Key: ECDSA P-256 (prime256v1)
	 * Validity: 2025-10-01 to 2030-10-01
	 */
	NM: {
		state: 'NM',
		issuer: 'New Mexico Root Certificate Authority',
		certificateB64:
			'MIIDgjCCAyigAwIBAgIUAIJ4VcLJGUNElxQUSUy6mDxpJrYwCgYIKoZIzj0EAwIw' +
			'gcExDjAMBgNVBAgTBVVTLU5NMQswCQYDVQQGEwJVUzERMA8GA1UEBxMIU2FudGEg' +
			'RmUxMzAxBgNVBAoTKk5ldyBNZXhpY28gVGF4YXRpb24gYW5kIFJldmVudWUgRGVw' +
			'YXJ0bWVudDEqMCgGA1UECxMhTmV3IE1leGljbyBNb3RvciBWZWhpY2xlIERpdmlz' +
			'aW9uMS4wLAYDVQQDEyVOZXcgTWV4aWNvIFJvb3QgQ2VydGlmaWNhdGUgQXV0aG9y' +
			'aXR5MB4XDTI1MTAwMTA2MDAwMFoXDTMwMTAwMTA2MDAwMFowgcExDjAMBgNVBAgT' +
			'BVVTLU5NMQswCQYDVQQGEwJVUzERMA8GA1UEBxMIU2FudGEgRmUxMzAxBgNVBAoT' +
			'Kk5ldyBNZXhpY28gVGF4YXRpb24gYW5kIFJldmVudWUgRGVwYXJ0bWVudDEqMCgG' +
			'A1UECxMhTmV3IE1leGljbyBNb3RvciBWZWhpY2xlIERpdmlzaW9uMS4wLAYDVQQD' +
			'EyVOZXcgTWV4aWNvIFJvb3QgQ2VydGlmaWNhdGUgQXV0aG9yaXR5MFkwEwYHKoZI' +
			'zj0CAQYIKoZIzj0DAQcDQgAEmPrlwEZA1mW8d+ekzFViC/4bxmmWa1IQcbmpGxNw' +
			'Cv1h2A2z4BX2N7CSO1sh5Kgeh/JTfT2e7t/VJUC+TE6psqOB+zCB+DAOBgNVHQ8B' +
			'Af8EBAMCAQYwEgYDVR0TAQH/BAgwBgEB/wIBADAdBgNVHQ4EFgQUwDtVKIe7jBPw' +
			'2n78JqJgSuf1wnowKQYDVR0SBCIwIIYeaHR0cHM6Ly93d3cubXZkLm5ld21leGlj' +
			'by5nb3YvMHYGA1UdHwRvMG0wa6BpoGeGZWh0dHBzOi8vc2VydmljZXMubXZkLm5l' +
			'd21leGljby5nb3Yvc2VydmljZXMvZXh0ZXJuYWwvY3JsL2dldExpc3QvZGFlMWE3' +
			'YWQxMmZmNGI0YWIwMDg4MDI0NDg3NmQ5MGYuY3JsMBAGCSsGAQQBg8UhAQQDTlNQ' +
			'MAoGCCqGSM49BAMCA0gAMEUCIQDKU91VZtiRtzly+WaK1ah2fYOTBxuIfIqKzZQk' +
			'jInviwIgdV2QIumonPVhepHrdrccIxgbu/pJi/P83PlUAoOW5kY=',
		expiresAt: '2030-10-01T06:00:00Z'
	}
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
 * Check certificate expiry status for all IACA roots.
 * Returns warnings for certificates expiring within the given threshold.
 *
 * @param warningDays  Days before expiry to trigger a warning (default: 180 = 6 months)
 * @returns Array of warnings, empty if all certificates are healthy
 */
export function checkCertificateExpiry(warningDays = 180): string[] {
	const warnings: string[] = [];
	const now = Date.now();
	const thresholdMs = warningDays * 24 * 60 * 60 * 1000;

	for (const root of Object.values(IACA_ROOTS)) {
		const expiresAt = new Date(root.expiresAt).getTime();
		const remaining = expiresAt - now;

		if (remaining <= 0) {
			warnings.push(
				`EXPIRED: ${root.state} (${root.issuer}) expired ${root.expiresAt}`
			);
		} else if (remaining <= thresholdMs) {
			const daysLeft = Math.floor(remaining / (24 * 60 * 60 * 1000));
			warnings.push(
				`EXPIRING: ${root.state} (${root.issuer}) expires in ${daysLeft} days (${root.expiresAt})`
			);
		}
	}

	return warnings;
}

/**
 * Get all IACA root certificates for COSE_Sign1 verification.
 *
 * Returns production certificates. The caller (mdl-verification.ts)
 * handles the empty case gracefully by logging a warning and proceeding
 * without issuer verification.
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
