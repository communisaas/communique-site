/**
 * IACA Root Certificates for mDL Issuer Verification
 *
 * Trust store for ISO 18013-5 Issuing Authority CA (IACA) root certificates.
 * Used to verify COSE_Sign1 signatures on mobile driver's licenses (mDL).
 *
 * Sources:
 *   - California: https://trust.dmv.ca.gov/certificates/ca-dmv-iaca-root-ca-crt.cer
 *   - New Mexico: https://www.mvd.newmexico.gov/wp-content/uploads/2025/10/New-Mexico-IACA-Certificate.zip
 *   - All other states: AAMVA VICAL (https://vical.dts.aamva.org/currentVical)
 *     Parsed via scripts/parse-vical.ts from VICAL version vc-2026-03-04-1772661350906
 *
 * All certificates are ECDSA P-256 (secp256r1), self-signed root CAs with
 * CA:TRUE and KeyUsage: Certificate Sign, CRL Sign per ISO 18013-5 §9.1.
 *
 * Certificate chain: IACA Root → DSC (Document Signer Certificate) → MSO
 * The IACA root is the trust anchor; DSCs are signed by the root and included
 * in the mDL's COSE_Sign1 x5chain. See cose-verify.ts verifyDscAgainstRoot().
 *
 * States with multiple IACA roots: Some states issue different roots for
 * different wallet providers (e.g., AZ has separate roots for Samsung, Google,
 * AzWallet, Avocet). All are included to verify mDLs from any wallet.
 *
 * Skipped: Alaska (P-384 — not currently supported by our P-256-only verifier).
 *
 * Coverage: 11 states (AZ, CA, CO, GA, IL, MD, MT, ND, NM, UT, VA)
 * Last updated: 2026-03-04
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
 * Each state maps to an array of IACACertificates — states may have multiple
 * IACA roots (different wallet providers, key rotation, etc.).
 *
 * Verification iterates all roots (getIACARootsForVerification) to find one
 * that signed the DSC. The key is used only for state-level presence checks.
 *
 * To update: run `npx tsx scripts/parse-vical.ts` to extract the latest
 * AAMVA VICAL certificates.
 */
export const IACA_ROOTS: Record<string, IACACertificate[]> = {
	// =========================================================================
	// Arizona — 7 IACA roots (3 MVMProdCA rotations + per-wallet-provider roots)
	// Source: AAMVA VICAL
	// =========================================================================
	AZ: [
		{
			state: 'AZ',
			issuer: 'MVMProdCA',
			certificateB64:
				'MIIDBzCCAqygAwIBAgIUdBfQKZnHSlxQkyUoTuucN+EQXOMwCgYIKoZIzj0EAwIw' +
				'fzESMBAGA1UEAwwJTVZNUHJvZENBMS0wKwYDVQQKDCRBcml6b25hIERlcGFydG1l' +
				'bnQgb2YgVHJhbnNwb3J0YXRpb24xCzAJBgNVBAsMAklUMQswCQYDVQQGEwJVUzEO' +
				'MAwGA1UECAwFVVMtQVoxEDAOBgNVBAcMB1Bob2VuaXgwHhcNMjQwODE2MTc0ODE3' +
				'WhcNMzQwODE2MTc0ODE3WjB/MRIwEAYDVQQDDAlNVk1Qcm9kQ0ExLTArBgNVBAoM' +
				'JEFyaXpvbmEgRGVwYXJ0bWVudCBvZiBUcmFuc3BvcnRhdGlvbjELMAkGA1UECwwC' +
				'SVQxCzAJBgNVBAYTAlVTMQ4wDAYDVQQIDAVVUy1BWjEQMA4GA1UEBwwHUGhvZW5p' +
				'eDBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABCyuq/xwpmVAcoeIObjy1vvsWzMc' +
				'ivIIpfF6CxVyYoOQ7Dnu+dUEhqRKVrLMnzhoqDgKetzVHS4JQLCatOyus0CjggEE' +
				'MIIBADAdBgNVHQ4EFgQUM0IsGLh/yqQ73mhM6h25/AsFp30wHwYDVR0jBBgwFoAU' +
				'M0IsGLh/yqQ73mhM6h25/AsFp30wEgYDVR0TAQH/BAgwBgEB/wIBADAOBgNVHQ8B' +
				'Af8EBAMCAQYwLAYDVR0SBCUwI4YhaHR0cHM6Ly9hemRvdC5nb3YvbXZkL2NvbnRh' +
				'Y3QtbXZkMGwGA1UdHwRlMGMwYaBfoF2GW2h0dHBzOi8vbXZtcHVibGljLmJsb2Iu' +
				'Y29yZS51c2dvdmNsb3VkYXBpLm5ldC9jZXJ0aWZpY2F0ZS1yZXZvY2F0aW9uLWxp' +
				'c3QvTVZNUHJvZENBLmNybC5wZW0wCgYIKoZIzj0EAwIDSQAwRgIhANuxS8uit1Hq' +
				'j75A8J8RYSVFVLFIBHkqDvePviN8ZrwWAiEAwnolRQsC2bnEbVD2fCacCsnb58Hz' +
				'+5RDm49N0aEhIv8=',
			expiresAt: '2034-08-16T17:48:17Z'
		},
		{
			state: 'AZ',
			issuer: 'MVMProdCA',
			certificateB64:
				'MIIDBzCCAqygAwIBAgIUE/iacpb/xR1hy0KQHlHoHjKGzRMwCgYIKoZIzj0EAwIw' +
				'fzESMBAGA1UEAwwJTVZNUHJvZENBMS0wKwYDVQQKDCRBcml6b25hIERlcGFydG1l' +
				'bnQgb2YgVHJhbnNwb3J0YXRpb24xCzAJBgNVBAsMAklUMQswCQYDVQQGEwJVUzEO' +
				'MAwGA1UECAwFVVMtQVoxEDAOBgNVBAcMB1Bob2VuaXgwHhcNMjQwODE2MTc0NTIz' +
				'WhcNMzQwODE2MTc0NTIzWjB/MRIwEAYDVQQDDAlNVk1Qcm9kQ0ExLTArBgNVBAoM' +
				'JEFyaXpvbmEgRGVwYXJ0bWVudCBvZiBUcmFuc3BvcnRhdGlvbjELMAkGA1UECwwC' +
				'SVQxCzAJBgNVBAYTAlVTMQ4wDAYDVQQIDAVVUy1BWjEQMA4GA1UEBwwHUGhvZW5p' +
				'eDBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABNUGhfC9l3WzXL+idfZ51dzwz4ie' +
				'YigtGiJCGYT3CNHF9BYOWZxYPSCNgJvDKTC3B7q3Vs0pSJ6k1/EgzwooG4OjggEE' +
				'MIIBADAdBgNVHQ4EFgQUrFA+KDiO+qv3pK27Wn8IQWsmzxUwHwYDVR0jBBgwFoAU' +
				'rFA+KDiO+qv3pK27Wn8IQWsmzxUwEgYDVR0TAQH/BAgwBgEB/wIBADAOBgNVHQ8B' +
				'Af8EBAMCAQYwLAYDVR0SBCUwI4YhaHR0cHM6Ly9hemRvdC5nb3YvbXZkL2NvbnRh' +
				'Y3QtbXZkMGwGA1UdHwRlMGMwYaBfoF2GW2h0dHBzOi8vbXZtcHVibGljLmJsb2Iu' +
				'Y29yZS51c2dvdmNsb3VkYXBpLm5ldC9jZXJ0aWZpY2F0ZS1yZXZvY2F0aW9uLWxp' +
				'c3QvTVZNUHJvZENBLmNybC5wZW0wCgYIKoZIzj0EAwIDSQAwRgIhAMVvoqGUY5A4' +
				'SLEkCpA+MTksCbKigfTEReO+44c88W+zAiEAwEMFKoWm4nD4h7bs3XoTmWxwbllG' +
				'0nOh1tAVKRvyzM0=',
			expiresAt: '2034-08-16T17:45:23Z'
		},
		{
			state: 'AZ',
			issuer: 'MVMProdCA',
			certificateB64:
				'MIIDBzCCAqygAwIBAgIUO/uWVmabBSV9o4SeYj6ioDz+HSYwCgYIKoZIzj0EAwIw' +
				'fzESMBAGA1UEAwwJTVZNUHJvZENBMS0wKwYDVQQKDCRBcml6b25hIERlcGFydG1l' +
				'bnQgb2YgVHJhbnNwb3J0YXRpb24xCzAJBgNVBAsMAklUMQswCQYDVQQGEwJVUzEO' +
				'MAwGA1UECAwFVVMtQVoxEDAOBgNVBAcMB1Bob2VuaXgwHhcNMjQwODE2MTc0MDE5' +
				'WhcNMzQwODE2MTc0MDE5WjB/MRIwEAYDVQQDDAlNVk1Qcm9kQ0ExLTArBgNVBAoM' +
				'JEFyaXpvbmEgRGVwYXJ0bWVudCBvZiBUcmFuc3BvcnRhdGlvbjELMAkGA1UECwwC' +
				'SVQxCzAJBgNVBAYTAlVTMQ4wDAYDVQQIDAVVUy1BWjEQMA4GA1UEBwwHUGhvZW5p' +
				'eDBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABFJpz6RkzZWqyVQ8CemsHjvLKY5J' +
				'nInhby/1RHU6EErW04tvKjUSOpidfc1xcYG1pzJeCDGQPsju/LJue0vEKQKjggEE' +
				'MIIBADAdBgNVHQ4EFgQUJkHD1SkBjqmWg4Z2gwJ8RxDI/vEwHwYDVR0jBBgwFoAU' +
				'JkHD1SkBjqmWg4Z2gwJ8RxDI/vEwEgYDVR0TAQH/BAgwBgEB/wIBADAOBgNVHQ8B' +
				'Af8EBAMCAQYwLAYDVR0SBCUwI4YhaHR0cHM6Ly9hemRvdC5nb3YvbXZkL2NvbnRh' +
				'Y3QtbXZkMGwGA1UdHwRlMGMwYaBfoF2GW2h0dHBzOi8vbXZtcHVibGljLmJsb2Iu' +
				'Y29yZS51c2dvdmNsb3VkYXBpLm5ldC9jZXJ0aWZpY2F0ZS1yZXZvY2F0aW9uLWxp' +
				'c3QvTVZNUHJvZENBLmNybC5wZW0wCgYIKoZIzj0EAwIDSQAwRgIhAI1/E8XQ/v4S' +
				'Q92sPRivZLWK9hUYz3ZCdMBvMqQX322JAiEA8Nta7T9167ux1weIgBy+66L7G5ji' +
				'mCxjO1ECnai4Kl8=',
			expiresAt: '2034-08-16T17:40:19Z'
		},
		{
			state: 'AZ',
			issuer: 'SamsungIACA',
			certificateB64:
				'MIIDDjCCArSgAwIBAgIUbS0DYiTGz1IeMDHWoLivaokxT4wwCgYIKoZIzj0EAwIw' +
				'gYExFDASBgNVBAMMC1NhbXN1bmdJQUNBMS0wKwYDVQQKDCRBcml6b25hIERlcGFy' +
				'dG1lbnQgb2YgVHJhbnNwb3J0YXRpb24xCzAJBgNVBAsMAklUMQswCQYDVQQGEwJV' +
				'UzEOMAwGA1UECAwFVVMtQVoxEDAOBgNVBAcMB1Bob2VuaXgwHhcNMjUxMjE1MTgy' +
				'NzExWhcNMzUxMjE1MTgyNzExWjCBgTEUMBIGA1UEAwwLU2Ftc3VuZ0lBQ0ExLTAr' +
				'BgNVBAoMJEFyaXpvbmEgRGVwYXJ0bWVudCBvZiBUcmFuc3BvcnRhdGlvbjELMAkG' +
				'A1UECwwCSVQxCzAJBgNVBAYTAlVTMQ4wDAYDVQQIDAVVUy1BWjEQMA4GA1UEBwwH' +
				'UGhvZW5peDBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABKi2u7sSRIIQ5YoltS+a' +
				't5Wls9VtEwG9dRxcAEvMZ1YKMug445cCikpFE61SCQ3jIcMJDxElPjhfra5B5xBB' +
				'2OOjggEGMIIBAjAdBgNVHQ4EFgQUlqF+v0cL+HjSp/mVDWPmvHC7j5YwHwYDVR0j' +
				'BBgwFoAUlqF+v0cL+HjSp/mVDWPmvHC7j5YwEgYDVR0TAQH/BAgwBgEB/wIBADAO' +
				'BgNVHQ8BAf8EBAMCAQYwLAYDVR0SBCUwI4YhaHR0cHM6Ly9hemRvdC5nb3YvbXZk' +
				'L2NvbnRhY3QtbXZkMG4GA1UdHwRnMGUwY6BhoF+GXWh0dHBzOi8vbXZtcHVibGlj' +
				'LmJsb2IuY29yZS51c2dvdmNsb3VkYXBpLm5ldC9jZXJ0aWZpY2F0ZS1yZXZvY2F0' +
				'aW9uLWxpc3QvMy9NVk1Qcm9kQ0EuY3JsLnBlbTAKBggqhkjOPQQDAgNIADBFAiAY' +
				'+OLsMj5NHFFRrAy43grEAitSvuoA+tMgY2y12bWA9AIhALFLgHY+1Hie1360C0gf' +
				'rLh/tIsPU3eedMQUAssm6Dhe',
			expiresAt: '2035-12-15T18:27:11Z'
		},
		{
			state: 'AZ',
			issuer: 'GoogleIACA',
			certificateB64:
				'MIIDDTCCArKgAwIBAgIUbh0WpHxXGCJJnLQ4CNAfO4xOetUwCgYIKoZIzj0EAwIw' +
				'gYAxEzARBgNVBAMMCkdvb2dsZUlBQ0ExLTArBgNVBAoMJEFyaXpvbmEgRGVwYXJ0' +
				'bWVudCBvZiBUcmFuc3BvcnRhdGlvbjELMAkGA1UECwwCSVQxCzAJBgNVBAYTAlVT' +
				'MQ4wDAYDVQQIDAVVUy1BWjEQMA4GA1UEBwwHUGhvZW5peDAeFw0yNTEyMTUxODI1' +
				'MzdaFw0zNTEyMTUxODI1MzdaMIGAMRMwEQYDVQQDDApHb29nbGVJQUNBMS0wKwYD' +
				'VQQKDCRBcml6b25hIERlcGFydG1lbnQgb2YgVHJhbnNwb3J0YXRpb24xCzAJBgNV' +
				'BAsMAklUMQswCQYDVQQGEwJVUzEOMAwGA1UECAwFVVMtQVoxEDAOBgNVBAcMB1Bo' +
				'b2VuaXgwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAAQpPSXjZG/enrGvVGkdG5OU' +
				'uw0MKbv83S5YGUG6T8E6nWxSHVBv/WZuT7d9zcQ7+P+A0QsUO9NcF1rkeZwlIiAo' +
				'o4IBBjCCAQIwHQYDVR0OBBYEFI5FIMbEqJMJrkDYob+Tww9On+o1MB8GA1UdIwQY' +
				'MBaAFI5FIMbEqJMJrkDYob+Tww9On+o1MBIGA1UdEwEB/wQIMAYBAf8CAQAwDgYD' +
				'VR0PAQH/BAQDAgEGMCwGA1UdEgQlMCOGIWh0dHBzOi8vYXpkb3QuZ292L212ZC9j' +
				'b250YWN0LW12ZDBuBgNVHR8EZzBlMGOgYaBfhl1odHRwczovL212bXB1YmxpYy5i' +
				'bG9iLmNvcmUudXNnb3ZjbG91ZGFwaS5uZXQvY2VydGlmaWNhdGUtcmV2b2NhdGlv' +
				'bi1saXN0LzIvTVZNUHJvZENBLmNybC5wZW0wCgYIKoZIzj0EAwIDSQAwRgIhAKML' +
				'tbOTIDtPupTiIk3+4mqA0UNTWHKQZnuluQQwF7tkAiEAogYKBobaThxeZDOXQCWS' +
				'EEF43za4oQMD3+jmvTD6c3M=',
			expiresAt: '2035-12-15T18:25:37Z'
		},
		{
			state: 'AZ',
			issuer: 'AzWalletIACA',
			certificateB64:
				'MIIDETCCAragAwIBAgIUSNAJ0bZiqfgXuhhD4AIJlZjs66UwCgYIKoZIzj0EAwIw' +
				'gYIxFTATBgNVBAMMDEF6V2FsbGV0SUFDQTEtMCsGA1UECgwkQXJpem9uYSBEZXBh' +
				'cnRtZW50IG9mIFRyYW5zcG9ydGF0aW9uMQswCQYDVQQLDAJJVDELMAkGA1UEBhMC' +
				'VVMxDjAMBgNVBAgMBVVTLUFaMRAwDgYDVQQHDAdQaG9lbml4MB4XDTI1MTIxNTE4' +
				'MjEyMloXDTM1MTIxNTE4MjEyMlowgYIxFTATBgNVBAMMDEF6V2FsbGV0SUFDQTEt' +
				'MCsGA1UECgwkQXJpem9uYSBEZXBhcnRtZW50IG9mIFRyYW5zcG9ydGF0aW9uMQsw' +
				'CQYDVQQLDAJJVDELMAkGA1UEBhMCVVMxDjAMBgNVBAgMBVVTLUFaMRAwDgYDVQQH' +
				'DAdQaG9lbml4MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEE4sYOLSdMehpJnRu' +
				'GOaHJGtjXbNFaPdakUDXM5/VOq6eNoONgLXILnywZXHb5QNoK+imK99Yv6bsEqFO' +
				'LtF3EaOCAQYwggECMB0GA1UdDgQWBBTf4EnyDX5fbTQNkSj6L0wVO02HRTAfBgNV' +
				'HSMEGDAWgBTf4EnyDX5fbTQNkSj6L0wVO02HRTASBgNVHRMBAf8ECDAGAQH/AgEA' +
				'MA4GA1UdDwEB/wQEAwIBBjAsBgNVHRIEJTAjhiFodHRwczovL2F6ZG90Lmdvdi9t' +
				'dmQvY29udGFjdC1tdmQwbgYDVR0fBGcwZTBjoGGgX4ZdaHR0cHM6Ly9tdm1wdWJs' +
				'aWMuYmxvYi5jb3JlLnVzZ292Y2xvdWRhcGkubmV0L2NlcnRpZmljYXRlLXJldm9j' +
				'YXRpb24tbGlzdC80L01WTVByb2RDQS5jcmwucGVtMAoGCCqGSM49BAMCA0kAMEYC' +
				'IQDN42PoINqCgCe/dmvnSDpPQ/xvzC2B9P2LEoUY1OVrrwIhAMMJyZSVB9d6sgou' +
				'Sx7Ix8bnMCe9sMNEH88Z8eGK35n9',
			expiresAt: '2035-12-15T18:21:22Z'
		},
		{
			state: 'AZ',
			issuer: 'AvocetIACA',
			certificateB64:
				'MIIDDDCCArKgAwIBAgIUZsrctHYnbX11Hba7eSabGGo1mUwwCgYIKoZIzj0EAwIw' +
				'gYAxEzARBgNVBAMMCkF2b2NldElBQ0ExLTArBgNVBAoMJEFyaXpvbmEgRGVwYXJ0' +
				'bWVudCBvZiBUcmFuc3BvcnRhdGlvbjELMAkGA1UECwwCSVQxCzAJBgNVBAYTAlVT' +
				'MQ4wDAYDVQQIDAVVUy1BWjEQMA4GA1UEBwwHUGhvZW5peDAeFw0yNTEyMTUxODIz' +
				'NThaFw0zNTEyMTUxODIzNThaMIGAMRMwEQYDVQQDDApBdm9jZXRJQUNBMS0wKwYD' +
				'VQQKDCRBcml6b25hIERlcGFydG1lbnQgb2YgVHJhbnNwb3J0YXRpb24xCzAJBgNV' +
				'BAsMAklUMQswCQYDVQQGEwJVUzEOMAwGA1UECAwFVVMtQVoxEDAOBgNVBAcMB1Bo' +
				'b2VuaXgwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAAS8JnTTjt2sd2lOhldGkLYk' +
				'tiaf5BeAR5IDWvNhNtZaWNee5EuKeSb7zKFMo7cOJ6Mf1jaEeNh3KncQKd2O4/Px' +
				'o4IBBjCCAQIwHQYDVR0OBBYEFII5tVvpzF/qpp4bdaxon2/qEUQ4MB8GA1UdIwQY' +
				'MBaAFII5tVvpzF/qpp4bdaxon2/qEUQ4MBIGA1UdEwEB/wQIMAYBAf8CAQAwDgYD' +
				'VR0PAQH/BAQDAgEGMCwGA1UdEgQlMCOGIWh0dHBzOi8vYXpkb3QuZ292L212ZC9j' +
				'b250YWN0LW12ZDBuBgNVHR8EZzBlMGOgYaBfhl1odHRwczovL212bXB1YmxpYy5i' +
				'bG9iLmNvcmUudXNnb3ZjbG91ZGFwaS5uZXQvY2VydGlmaWNhdGUtcmV2b2NhdGlv' +
				'bi1saXN0LzEvTVZNUHJvZENBLmNybC5wZW0wCgYIKoZIzj0EAwIDSAAwRQIhAPNT' +
				'aHC5OEKZHwu/FIBYPJ9LmnmBUs7U7N/KTQ1ZI0cGAiAsE8kqyIpXVRfczTEgHxK4' +
				'hw//tT4AAgN6x37GgUmbKQ==',
			expiresAt: '2035-12-15T18:23:58Z'
		},
	],

	// =========================================================================
	// California — manually sourced (not in VICAL)
	// =========================================================================
	CA: [
		{
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
	],

	// =========================================================================
	// Colorado — 2 IACA roots (key rotation)
	// Source: AAMVA VICAL
	// =========================================================================
	CO: [
		{
			state: 'CO',
			issuer: 'Colorado Root Certificate',
			certificateB64:
				'MIIC/jCCAqWgAwIBAgIUAMLBrrtl/kiPRa3nJEt18F/kojAwCgYIKoZIzj0EAwIw' +
				'gY8xDjAMBgNVBAgTBVVTLUNPMQswCQYDVQQGEwJVUzEPMA0GA1UEBxMGRGVudmVy' +
				'MScwJQYDVQQKEx5Db2xvcmFkbyBEZXBhcnRtZW50IG9mIFJldmVudWUxEjAQBgNV' +
				'BAsTCUNPIERSSVZFUzEiMCAGA1UEAxMZQ29sb3JhZG8gUm9vdCBDZXJ0aWZpY2F0' +
				'ZTAeFw0yNDEwMjkwNjAwMDBaFw0yOTEwMjkwNjAwMDBaMIGPMQ4wDAYDVQQIEwVV' +
				'Uy1DTzELMAkGA1UEBhMCVVMxDzANBgNVBAcTBkRlbnZlcjEnMCUGA1UEChMeQ29s' +
				'b3JhZG8gRGVwYXJ0bWVudCBvZiBSZXZlbnVlMRIwEAYDVQQLEwlDTyBEUklWRVMx' +
				'IjAgBgNVBAMTGUNvbG9yYWRvIFJvb3QgQ2VydGlmaWNhdGUwWTATBgcqhkjOPQIB' +
				'BggqhkjOPQMBBwNCAARuuLSkdRJ4QPEFqbPHmZP8Hbu8waHHJ6wKofZgHg7fOTUT' +
				'4r+jV+jFpM5dNCbW/mdJyJwRCEsdOs3cvGtolt5No4HcMIHZMA4GA1UdDwEB/wQE' +
				'AwIBBjASBgNVHRMBAf8ECDAGAQH/AgEAMB0GA1UdDgQWBBRuHjVnGUTr6tI5nEkf' +
				'nK/3EFyP2DAkBgNVHRIEHTAbhhlodHRwczovL2Rtdi5jb2xvcmFkby5nb3YvMFwG' +
				'A1UdHwRVMFMwUaBPoE2GS2h0dHBzOi8vZGV2Lm1vYmlsZWRsLmNvbS81MHB3cy9D' +
				'UkwvbURMLzMxOTE0YzI5OWMxMTRhMWQ4ZjE4MTRlZTExOWU1NTdhLmNybDAQBgkr' +
				'BgEEAYPFIQEEAzUwUDAKBggqhkjOPQQDAgNHADBEAiBr2FEgBjcMyt1WPtiV1tSY' +
				'AAcP1OxcBofI6NNZbBEXcQIgRWFaTIFbsVXVyouuTnsNCB6JykHPP03sxjkyA/Wd' +
				'5RE=',
			expiresAt: '2029-10-29T06:00:00Z'
		},
		{
			state: 'CO',
			issuer: 'Colorado Root Certificate',
			certificateB64:
				'MIIDBTCCAqqgAwIBAgIUAOugsa1Q/HPTqJH2JzwqYc+xIiwwCgYIKoZIzj0EAwIw' +
				'gY8xDjAMBgNVBAgTBVVTLUNPMQswCQYDVQQGEwJVUzEPMA0GA1UEBxMGRGVudmVy' +
				'MScwJQYDVQQKEx5Db2xvcmFkbyBEZXBhcnRtZW50IG9mIFJldmVudWUxEjAQBgNV' +
				'BAsTCUNPIERSSVZFUzEiMCAGA1UEAxMZQ29sb3JhZG8gUm9vdCBDZXJ0aWZpY2F0' +
				'ZTAeFw0yNjAxMTIwNzAwMDBaFw0zMTAxMTIwNzAwMDBaMIGPMQ4wDAYDVQQIEwVV' +
				'Uy1DTzELMAkGA1UEBhMCVVMxDzANBgNVBAcTBkRlbnZlcjEnMCUGA1UEChMeQ29s' +
				'b3JhZG8gRGVwYXJ0bWVudCBvZiBSZXZlbnVlMRIwEAYDVQQLEwlDTyBEUklWRVMx' +
				'IjAgBgNVBAMTGUNvbG9yYWRvIFJvb3QgQ2VydGlmaWNhdGUwWTATBgcqhkjOPQIB' +
				'BggqhkjOPQMBBwNCAARpmJDBqJ1T2ymnCdge5BUvG9FH8+3LLXKZ1K/o0fiB2+g0' +
				'ZXitRtgi4krPZfCzB3DjHbXKzRIhvM/RTTZVuieSo4HhMIHeMA4GA1UdDwEB/wQE' +
				'AwIBBjASBgNVHRMBAf8ECDAGAQH/AgEAMB0GA1UdDgQWBBSvH8DaOrSu7F+2Vj5z' +
				'rnthUGGxEjAkBgNVHRIEHTAbhhlodHRwczovL2R3cy5jb2xvcmFkby5nb3YvMGEG' +
				'A1UdHwRaMFgwVqBUoFKGUGh0dHBzOi8vRFdTLkNvbG9yYWRvLkdvdi9Nb2JpbGUv' +
				'UmV2b2NhdGlvbnMvNGQyZjFhZDQ2ODA3NDJkMTk2Njk2MmFkOGUzMjAxYWYuY3Js' +
				'MBAGCSsGAQQBg8UhAQQDUkRTMAoGCCqGSM49BAMCA0kAMEYCIQD1pIzuOHob/oxO' +
				'Czq3tywAbfROldmjAgj0J0r2s/WUGgIhALDx9lxbW62VEksSGKCszl/tviLxZApQ' +
				'IBIOwwJGa0Lv',
			expiresAt: '2031-01-12T07:00:00Z'
		},
	],

	// =========================================================================
	// Georgia
	// Source: AAMVA VICAL
	// =========================================================================
	GA: [
		{
			state: 'GA',
			issuer: 'Georgia Root Certificate Authority',
			certificateB64:
				'MIIDRzCCAu2gAwIBAgITVgO3G2afw4UBNWRnxbpYWrG5uTAKBggqhkjOPQQDAjCB' +
				'nTEOMAwGA1UECBMFVVMtR0ExCzAJBgNVBAYTAlVTMRAwDgYDVQQHEwdDb255ZXJz' +
				'MS4wLAYDVQQKEyVHZW9yZ2lhIERlcGFydG1lbnQgb2YgRHJpdmVyIFNlcnZpY2Vz' +
				'MQ8wDQYDVQQLEwZEUklWRVMxKzApBgNVBAMTIkdlb3JnaWEgUm9vdCBDZXJ0aWZp' +
				'Y2F0ZSBBdXRob3JpdHkwHhcNMjQwMzIwMDQwMDAwWhcNMjkwMzIwMDQwMDAwWjCB' +
				'nTEOMAwGA1UECBMFVVMtR0ExCzAJBgNVBAYTAlVTMRAwDgYDVQQHEwdDb255ZXJz' +
				'MS4wLAYDVQQKEyVHZW9yZ2lhIERlcGFydG1lbnQgb2YgRHJpdmVyIFNlcnZpY2Vz' +
				'MQ8wDQYDVQQLEwZEUklWRVMxKzApBgNVBAMTIkdlb3JnaWEgUm9vdCBDZXJ0aWZp' +
				'Y2F0ZSBBdXRob3JpdHkwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAASsRp10nCFK' +
				'tW6sJL0xMPMKDCkeKFccLdRGKl2gN9tnzGi9aEee3z9S+vOH2EKTxFVmiqEmCS1u' +
				'5LXCKkLIq+D+o4IBCDCCAQQwDgYDVR0PAQH/BAQDAgEGMBIGA1UdEwEB/wQIMAYB' +
				'Af8CAQAwHQYDVR0OBBYEFK/NJTZCADkKrAM2Djwlii+UBPk1MEgGA1UdEgRBMD+B' +
				'I2dyb3VwaXRwcm9kdWN0aW9uc3VwcG9ydEBkZHMuZ2EuZ292hhhodHRwczovL2Rk' +
				'cy5nZW9yZ2lhLmdvdi8wYwYDVR0fBFwwWjBYoFagVIZSaHR0cHM6Ly93cy5kcml2' +
				'ZXMuZ2EuZ292L1dlYlNlcnZpY2VzL05BL0dTUC9jZXJ0aWZpY2F0ZS9yZXZvY2F0' +
				'aW9uL3Jldm9jYXRpb25zLmNybDAQBgkrBgEEAYPFIQEEA0dTUDAKBggqhkjOPQQD' +
				'AgNIADBFAiBsNDY02UQq8xatSFHgcdQY64lL0EaaYKsDQ3AvZGjPgAIhAJtOn2wk' +
				'um9vlccuEFL8XIgL6XHl2jEQSNKadqLoOk+T',
			expiresAt: '2029-03-20T04:00:00Z'
		},
	],

	// =========================================================================
	// Illinois
	// Source: AAMVA VICAL
	// =========================================================================
	IL: [
		{
			state: 'IL',
			issuer: 'Prod IACA Root',
			certificateB64:
				'MIIDETCCArigAwIBAgITALbJtbNSF44XF4jwh5Hu4WVzbzAKBggqhkjOPQQDAjB/' +
				'MQswCQYDVQQGEwJVUzEOMAwGA1UECAwFVVMtSUwxFDASBgNVBAcMC1NwcmluZ2Zp' +
				'ZWxkMSQwIgYDVQQKDBtJbGxpbm9pcyBTZWNyZXRhcnkgb2YgU3RhdGUxCzAJBgNV' +
				'BAsMAklUMRcwFQYDVQQDDA5Qcm9kIElBQ0EgUm9vdDAeFw0yNTA5MTgxOTQ2NDZa' +
				'Fw00NDA5MTgxOTQ2NDZaMH8xCzAJBgNVBAYTAlVTMQ4wDAYDVQQIDAVVUy1JTDEU' +
				'MBIGA1UEBwwLU3ByaW5nZmllbGQxJDAiBgNVBAoMG0lsbGlub2lzIFNlY3JldGFy' +
				'eSBvZiBTdGF0ZTELMAkGA1UECwwCSVQxFzAVBgNVBAMMDlByb2QgSUFDQSBSb290' +
				'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEAxgmbxoF1QKsStQfKR5rZp+d3Es2' +
				'BcuslyGNaDDg+MGyM43A25E6V+faSmgz5vxu8P13k8tAX6cmV2YuXOge/aOCAREw' +
				'ggENMB0GA1UdDgQWBBT187yTvijqjLqSso9N3EA0fPoc5DAOBgNVHQ8BAf8EBAMC' +
				'AQYwJgYDVR0lBB8wHQYIKwYBBQUHAwIGCCsGAQUFBwMBBgcogYxdBQECMBgGA1Ud' +
				'EQQRMA+BDXBraUBpbHNvcy5nb3YwGAYDVR0SBBEwD4ENcGtpQGlsc29zLmdvdjBs' +
				'BgNVHR8EZTBjMGGgX6BdhltodHRwOi8vY3JsLmlsc29zLm5ldC9kb2l0a2Nzc2Fw' +
				'Y3VzY3JsL2Y2Mjk3YTdmLTE3NDUtNDYzYy05ODM1LTUzMDFiY2M0MGNiMC9Qcm9k' +
				'SUFDQVJvb3QuY3JsMBIGA1UdEwEB/wQIMAYBAf8CAQAwCgYIKoZIzj0EAwIDRwAw' +
				'RAIgVCQ2uqxVJQeXADbA575VMJyhgSrav40QlOQ8vux7aO4CICLWYhj6gPS0XNJp' +
				'Lhg4rb35oNHkDj9v25TU31FtwPl6',
			expiresAt: '2044-09-18T19:46:46Z'
		},
	],

	// =========================================================================
	// Maryland — 2 IACA roots (vendor migration)
	// Source: AAMVA VICAL
	// =========================================================================
	MD: [
		{
			state: 'MD',
			issuer: 'Fast Enterprises Root',
			certificateB64:
				'MIICxjCCAmygAwIBAgITJkV7El8K11IXqY7mz96n/EhiITAKBggqhkjOPQQDAjBq' +
				'MQ4wDAYDVQQIEwVVUy1NRDELMAkGA1UEBhMCVVMxFDASBgNVBAcTC0dsZW4gQnVy' +
				'bmllMRUwEwYDVQQKEwxNYXJ5bGFuZCBNVkExHjAcBgNVBAMTFUZhc3QgRW50ZXJw' +
				'cmlzZXMgUm9vdDAeFw0yNDAxMDUwNTAwMDBaFw0yOTAxMDQwNTAwMDBaMGoxDjAM' +
				'BgNVBAgTBVVTLU1EMQswCQYDVQQGEwJVUzEUMBIGA1UEBxMLR2xlbiBCdXJuaWUx' +
				'FTATBgNVBAoTDE1hcnlsYW5kIE1WQTEeMBwGA1UEAxMVRmFzdCBFbnRlcnByaXNl' +
				'cyBSb290MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEaWcKIqlAWboV93RAa5ad' +
				'0LJBn8W0/yYwtOyUlxuTxoo4SPkorKmOz3EhThC+U4WRrt13aSnCsJtK+waBFghX' +
				'u6OB8DCB7TAOBgNVHQ8BAf8EBAMCAQYwEgYDVR0TAQH/BAgwBgEB/wIBADAdBgNV' +
				'HQ4EFgQUTprRzaFBJ1SLjJsO01tlLCQ4YF0wPAYDVR0SBDUwM4EWbXZhY3NAbWRv' +
				'dC5zdGF0ZS5tZC51c4YZaHR0cHM6Ly9tdmEubWFyeWxhbmQuZ292LzBYBgNVHR8E' +
				'UTBPME2gS6BJhkdodHRwczovL215bXZhLm1hcnlsYW5kLmdvdjo1NDQzL01EUC9X' +
				'ZWJTZXJ2aWNlcy9DUkwvbURML3Jldm9jYXRpb25zLmNybDAQBgkrBgEEAYPFIQEE' +
				'A01EUDAKBggqhkjOPQQDAgNIADBFAiEAnX3+E4E5dQ+5G1rmStJTW79ZAiDTabyL' +
				'8lJuYL/nDxMCIHHkAyIJcQlQmKDUVkBr3heUd5N9Y8GWdbWnbHuwe7Om',
			expiresAt: '2029-01-04T05:00:00Z'
		},
		{
			state: 'MD',
			issuer: 'MDOT MVA mDL Root',
			certificateB64:
				'MIIC7jCCApWgAwIBAgIUAIlZVGm+MFztWeqnzmHC1Liq1DAwCgYIKoZIzj0EAwIw' +
				'ZjEOMAwGA1UECBMFVVMtTUQxCzAJBgNVBAYTAlVTMRQwEgYDVQQHEwtHbGVuIEJ1' +
				'cm5pZTEVMBMGA1UEChMMTWFyeWxhbmQgTVZBMRowGAYDVQQDExFNRE9UIE1WQSBt' +
				'REwgUm9vdDAeFw0yNTA2MTgwNjAwMDBaFw0zMDA2MTgwNjAwMDBaMGYxDjAMBgNV' +
				'BAgTBVVTLU1EMQswCQYDVQQGEwJVUzEUMBIGA1UEBxMLR2xlbiBCdXJuaWUxFTAT' +
				'BgNVBAoTDE1hcnlsYW5kIE1WQTEaMBgGA1UEAxMRTURPVCBNVkEgbURMIFJvb3Qw' +
				'WTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAATSFdDeo2zV3GjlWdICLEyVygkyiM35' +
				'79U/WAtsibXSWXpXeAkENed6fs8a4lPCm3ScBa/GHQsc/xPWG5brrf/vo4IBHzCC' +
				'ARswDgYDVR0PAQH/BAQDAgEGMBIGA1UdEwEB/wQIMAYBAf8CAQAwHQYDVR0OBBYE' +
				'FLSwEXEzIOHS6lueN/d0ga94nZ3dMFUGA1UdEgROMEyBHG12YXByaXZhY3lAbWRv' +
				'dC5tYXJ5bGFuZC5nb3aGLGh0dHBzOi8vbXltdmEubWFyeWxhbmQuZ292L2dvL3dl' +
				'Yi9Db250YWN0TVZBMG0GA1UdHwRmMGQwYqBgoF6GXGh0dHBzOi8vbXltdmEubWFy' +
				'eWxhbmQuZ292OjU0NDMvTURQL1dlYlNlcnZpY2VzL0NSTC9tREwvNmVlMDdkMjE0' +
				'MGYwNDJhMGE2ZTk5YTc4ZTQwNzlhYzAuY3JsMBAGCSsGAQQBg8UhAQQDTURQMAoG' +
				'CCqGSM49BAMCA0cAMEQCIEOzO/2dCcx5yn8Hx6AdqCqgTNps18RrB0QGoHrwkFnx' +
				'AiBApe5NXVdvg2yEhQylijYaUKTpJKNTiOx0CRPusfR5SQ==',
			expiresAt: '2030-06-18T06:00:00Z'
		},
	],

	// =========================================================================
	// Montana
	// Source: AAMVA VICAL
	// =========================================================================
	MT: [
		{
			state: 'MT',
			issuer: 'Montana Motor Vehicle Division',
			certificateB64:
				'MIIDTzCCAvagAwIBAgIUALz9VunJbM8WsRyc10+waZ7TncgwCgYIKoZIzj0EAwIw' +
				'gZwxDjAMBgNVBAgTBVVTLU1UMQswCQYDVQQGEwJVUzEPMA0GA1UEBxMGSGVsZW5h' +
				'MSYwJAYDVQQKEx1Nb250YW5hIERlcGFydG1lbnQgb2YgSnVzdGljZTEnMCUGA1UE' +
				'CxMeTW9udGFuYSBNb3RvciBWZWhpY2xlIERpdmlzaW9uMRswGQYDVQQDExJjYXJz' +
				'd3NucC5kb2ptdC5nb3YwHhcNMjUwNTAyMDYwMDAwWhcNMzAwNTAyMDYwMDAwWjCB' +
				'nDEOMAwGA1UECBMFVVMtTVQxCzAJBgNVBAYTAlVTMQ8wDQYDVQQHEwZIZWxlbmEx' +
				'JjAkBgNVBAoTHU1vbnRhbmEgRGVwYXJ0bWVudCBvZiBKdXN0aWNlMScwJQYDVQQL' +
				'Ex5Nb250YW5hIE1vdG9yIFZlaGljbGUgRGl2aXNpb24xGzAZBgNVBAMTEmNhcnN3' +
				'c25wLmRvam10LmdvdjBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABBdxLVV8czFF' +
				'ucq2cRy7ZLkvMScwfq4SgtTu2vhilCFy8BsjSt1QbefFoV+KpPqpCZJLQSWrhSop' +
				'cS7GkDAgYe6jggESMIIBDjAOBgNVHQ8BAf8EBAMCAQYwEgYDVR0TAQH/BAgwBgEB' +
				'/wIBADAdBgNVHQ4EFgQUI0+hpnnb+Y53pVjpRENxe7Xvdc8wOQYDVR0SBDIwMIEa' +
				'Y2Fyc2ludGVyZmFjZXRpY2tldEBtdC5nb3aGEmh0dHBzOi8vbXZkbXQuZ292LzB8' +
				'BgNVHR8EdTBzMHGgb6BthmtodHRwczovL2NhcnMuZG9qbXQuZ292L2d3cHViL01v' +
				'YmlsZUNyZWRlbnRpYWwvQ2VydGlmaWNhdGVzL1Jldm9jYXRpb25zLzMyNTk2ZGQy' +
				'ZDIwZjQ4M2M5NzRhMzhjYTEwN2Q1NDNlLmNybDAQBgkrBgEEAYPFIQEEA01KUDAK' +
				'BggqhkjOPQQDAgNHADBEAiBzw8qDQXADtdQz8KZopvLZZ15G9CD64accLrUYYehk' +
				'XAIgQiCPWmy2wdDP22dNUnbFRqblP+1K2TYlEV2A789ZOBI=',
			expiresAt: '2030-05-02T06:00:00Z'
		},
	],

	// =========================================================================
	// North Dakota
	// Source: AAMVA VICAL
	// =========================================================================
	ND: [
		{
			state: 'ND',
			issuer: 'North Dakota DOT',
			certificateB64:
				'MIIDQjCCAuegAwIBAgIUALj0FeW5Es6+r08rWsHsIA1igMAwCgYIKoZIzj0EAwIw' +
				'gZ8xDjAMBgNVBAgTBVVTLU5EMQswCQYDVQQGEwJVUzERMA8GA1UEBxMIQmlzbWFy' +
				'Y2sxMjAwBgNVBAoTKU5vcnRoIERha290YSBEZXBhcnRtZW50IG9mIFRyYW5zcG9y' +
				'dGF0aW9uMQ8wDQYDVQQLEwZMRUdFTkQxKDAmBgNVBAMTH2h0dHBzOi8vcGFydG5l' +
				'ci5tZGwuZG90Lm5kLmdvdi8wHhcNMjUwNjEwMDYwMDAwWhcNMzAwNjEwMDYwMDAw' +
				'WjCBnzEOMAwGA1UECBMFVVMtTkQxCzAJBgNVBAYTAlVTMREwDwYDVQQHEwhCaXNt' +
				'YXJjazEyMDAGA1UEChMpTm9ydGggRGFrb3RhIERlcGFydG1lbnQgb2YgVHJhbnNw' +
				'b3J0YXRpb24xDzANBgNVBAsTBkxFR0VORDEoMCYGA1UEAxMfaHR0cHM6Ly9wYXJ0' +
				'bmVyLm1kbC5kb3QubmQuZ292LzBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABH7E' +
				'tk/9zy7wqAwn8Qb1vzhMsx7H7JOYuTUbirPu26Q766Bndw8yyjZTRJp3pZeWWs4T' +
				'bS668mcI1IUB+0e3gnqjgf4wgfswDgYDVR0PAQH/BAQDAgEGMBIGA1UdEwEB/wQI' +
				'MAYBAf8CAQAwHQYDVR0OBBYEFGgohKo4OSffuHWBD5zP+1RjMCEGMDAGA1UdEgQp' +
				'MCeBEGRvdG12dGVjaEBuZC5nb3aGE2h0dHBzOi8vZG90Lm5kLmdvdi8wcgYDVR0f' +
				'BGswaTBnoGWgY4ZhaHR0cHM6Ly9kb3QubmQuZ292L0xFR0VOREVYVC9ETVAvRFNW' +
				'Uy9XZWJTZXJ2aWNlcy9tZGwvdjEvY3JsLzQ5ZDNmOTliMGQwNDQyMDY4ZDVlNzY0' +
				'NWM0Njc5ZTk4LmNybDAQBgkrBgEEAYPFIQEEA0RNUDAKBggqhkjOPQQDAgNJADBG' +
				'AiEA8ieW8neYho+hsu4hB2c9rekEh1+GopZ7r8Sz4JU1ctECIQDUGD/4QFHseFdQ' +
				'b/lLDjD6/xUfLfvrPD5my+wMSy8AIA==',
			expiresAt: '2030-06-10T06:00:00Z'
		},
	],

	// =========================================================================
	// New Mexico — manually sourced (not in VICAL)
	// =========================================================================
	NM: [
		{
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
		},
	],

	// =========================================================================
	// Utah — 2 IACA roots (key rotation)
	// Source: AAMVA VICAL
	// =========================================================================
	UT: [
		{
			state: 'UT',
			issuer: 'IACA-UTAH-USA',
			certificateB64:
				'MIICeDCCAh+gAwIBAgIQWluwShGaNXltKtR32ToazDAKBggqhkjOPQQDAjBIMRYw' +
				'FAYDVQQDDA1JQUNBLVVUQUgtVVNBMREwDwYDVQQKDAhVdGFoIERMRDEOMAwGA1UE' +
				'CAwFVVMtVVQxCzAJBgNVBAYTAlVTMB4XDTIzMTIxODEyMjU0N1oXDTMyMTIxNTEy' +
				'MjU0NlowSDEWMBQGA1UEAwwNSUFDQS1VVEFILVVTQTERMA8GA1UECgwIVXRhaCBE' +
				'TEQxDjAMBgNVBAgMBVVTLVVUMQswCQYDVQQGEwJVUzBZMBMGByqGSM49AgEGCCqG' +
				'SM49AwEHA0IABGHwBQyjlOERffLUFurAF9F0gyRuD34FkPK8RfVuySJrooUnBi86' +
				'jfKAEIFGzhAiR48EUe6YK2YcqfUqrEOX3uajgeowgecwEgYDVR0TAQH/BAgwBgEB' +
				'/wIBADAfBgNVHSMEGDAWgBQ8TGzf54I0LuEU5s6tEgo5/Qg0azAnBgNVHRIEIDAe' +
				'hhxodHRwczovL21vYmlsZWRsLnVzL2lhY2EtdXQvMBEGA1UdIAQKMAgwBgYEVR0g' +
				'ADBFBgNVHR8EPjA8MDqgOKA2hjRodHRwOi8vd3d3Lm1vYmlsZWRsLnVzL3V0LWlh' +
				'Y2EvbWRsRFMtVVRBSC1VU0EwMDIuY3JsMB0GA1UdDgQWBBQ8TGzf54I0LuEU5s6t' +
				'Ego5/Qg0azAOBgNVHQ8BAf8EBAMCAQYwCgYIKoZIzj0EAwIDRwAwRAIgdzrANru5' +
				'rEm8T4qsYoPEo5YqJ6wyZstAfMfkp9/BtjcCIEez933eeyubFUfqjd3hXIoRcl1E' +
				'0UTdnk/UOBLQCG10',
			expiresAt: '2032-12-15T12:25:46Z'
		},
		{
			state: 'UT',
			issuer: 'IACA-UTAH-USA',
			certificateB64:
				'MIICejCCAh+gAwIBAgIQP1fWX6bK5IWafQpOzL3JyjAKBggqhkjOPQQDAjBIMRYw' +
				'FAYDVQQDDA1JQUNBLVVUQUgtVVNBMREwDwYDVQQKDAhVdGFoIERMRDEOMAwGA1UE' +
				'CAwFVVMtVVQxCzAJBgNVBAYTAlVTMB4XDTI1MDMxMTEyNDkyNVoXDTM0MDYwNzEy' +
				'NDkyNFowSDEWMBQGA1UEAwwNSUFDQS1VVEFILVVTQTERMA8GA1UECgwIVXRhaCBE' +
				'TEQxDjAMBgNVBAgMBVVTLVVUMQswCQYDVQQGEwJVUzBZMBMGByqGSM49AgEGCCqG' +
				'SM49AwEHA0IABA9gsjBB4V6FtUGvCF/ZuQu65dfWIK87Yr1r4KzBM6LFvwxTB5Mo' +
				'WuS/JjyTZO3fENEFm3TtG+Js7KxIZMDClKyjgeowgecwEgYDVR0TAQH/BAgwBgEB' +
				'/wIBADAfBgNVHSMEGDAWgBR9Bklm+FL6KtqQNeKXdsOkEUNg3TAnBgNVHRIEIDAe' +
				'hhxodHRwczovL21vYmlsZWRsLnVzL2lhY2EtdXQvMBEGA1UdIAQKMAgwBgYEVR0g' +
				'ADBFBgNVHR8EPjA8MDqgOKA2hjRodHRwOi8vd3d3Lm1vYmlsZWRsLnVzL3V0LWlh' +
				'Y2EvbWRsRFMtVVRBSC1VU0EwMDMuY3JsMB0GA1UdDgQWBBR9Bklm+FL6KtqQNeKX' +
				'dsOkEUNg3TAOBgNVHQ8BAf8EBAMCAQYwCgYIKoZIzj0EAwIDSQAwRgIhAP2roq3h' +
				'wjl7IQ9j52KMANKn9L9ornH31k42AAUjYALYAiEAhla2itEIdVuVipPO2JorLhEg' +
				'kF1FzMIw0ggETTzLmGo=',
			expiresAt: '2034-06-07T12:49:24Z'
		},
	],

	// =========================================================================
	// Virginia — 1 IACA root (IACA-A, replacing expired VA mID IACA)
	// Source: AAMVA VICAL
	// =========================================================================
	VA: [
		{
			state: 'VA',
			issuer: 'VA mID IACA-A',
			certificateB64:
				'MIICWDCCAf+gAwIBAgIUSDXJYXPM1GzzndPu7U7uQQpoOU4wCgYIKoZIzj0EAwIw' +
				'NTEWMBQGA1UEAwwNVkEgbUlEIElBQ0EtQTEOMAwGA1UECAwFVVMtVkExCzAJBgNV' +
				'BAYTAlVTMB4XDTI1MDcyMjEzMjYwMloXDTI3MDcyMjEzMjYwMVowNTEWMBQGA1UE' +
				'AwwNVkEgbUlEIElBQ0EtQTEOMAwGA1UECAwFVVMtVkExCzAJBgNVBAYTAlVTMFkw' +
				'EwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEZ96O6yAnVSQogBLxplgoWuEQbJGeNwki' +
				'C1Hx2MEKM6Jnpq4Wls+GU9IWImlUWWTaY0fgf+51Wkq1dguB8cVme6OB7DCB6TAS' +
				'BgNVHRMBAf8ECDAGAQH/AgEAMB8GA1UdIwQYMBaAFJYUvOtd2fu7Ag6feF/TB+YJ' +
				'9+FNMCMGA1UdEgQcMBqGGGh0dHBzOi8vZG12LnZpcmdpbmlhLmdvdjAjBgNVHREE' +
				'HDAahhhodHRwczovL2Rtdi52aXJnaW5pYS5nb3YwOQYDVR0fBDIwMDAuoCygKoYo' +
				'aHR0cHM6Ly93d3cubW9iaWxlZGwubmV0L21vYmlsZUlEL1ZBLmNybDAdBgNVHQ4E' +
				'FgQUlhS8613Z+7sCDp94X9MH5gn34U0wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49' +
				'BAMCA0cAMEQCIAZyBOjZrupvH9PqbgZNZFtgwVs+fXZVqgJKckP6FAbrAiAQdjxr' +
				'6xA4VRVp/yjS9CKGoMw7tPkUrcfofZTv2AvPCA==',
			expiresAt: '2027-07-22T13:26:01Z'
		},
	],
};

/**
 * Development/testing IACA root placeholder.
 */
export const DEV_IACA_ROOT: IACACertificate = {
	state: 'XX',
	issuer: 'Communique Development IACA Root (NOT FOR PRODUCTION)',
	certificateB64: '',
	expiresAt: '2099-12-31T23:59:59Z'
};

/**
 * Lookup IACA root certificates for a given issuer state.
 * Returns the first certificate or null if the issuing state is not in our trust store.
 */
export function getIACARootForIssuer(issuerState: string): IACACertificate | null {
	const roots = IACA_ROOTS[issuerState.toUpperCase()];
	return roots?.[0] ?? null;
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

	for (const roots of Object.values(IACA_ROOTS)) {
		for (const root of roots) {
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
	}

	return warnings;
}

/**
 * Get all IACA root certificates for COSE_Sign1 verification.
 *
 * Returns all production certificates (flattened from per-state arrays).
 * The caller (mdl-verification.ts) handles the empty case gracefully by
 * logging a warning and proceeding without issuer verification.
 *
 * In development/testing, callers can pass certificates directly to
 * verifyCoseSign1() rather than relying on this function.
 */
export function getIACARootsForVerification(): IACACertificate[] {
	const allRoots: IACACertificate[] = [];

	for (const roots of Object.values(IACA_ROOTS)) {
		for (const root of roots) {
			if (!root.derBytes && root.certificateB64) {
				root.derBytes = base64ToUint8Array(root.certificateB64);
			}
			allRoots.push(root);
		}
	}

	return allRoots;
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
