/**
 * self.xyz Backend Verifier
 *
 * Official SDK integration for verifying zero-knowledge proofs
 * from self.xyz passport verification.
 */

import { SelfBackendVerifier, DefaultConfigStore, AllIds } from '@selfxyz/core';

/**
 * Singleton instance of SelfBackendVerifier
 * Configured with platform-wide verification rules
 */
export const selfVerifier = new SelfBackendVerifier(
	// Scope - must match frontend QR generation
	process.env.NEXT_PUBLIC_SELF_SCOPE || 'communique-congressional',

	// Endpoint - must match frontend QR generation
	process.env.NEXT_PUBLIC_SELF_ENDPOINT || 'https://communi.email/api/identity/verify',

	// Mock passport mode (true = testnet, false = mainnet)
	process.env.SELF_MOCK_PASSPORT === 'true',

	// Allowed attestation types (AllIds = accept all valid ID types)
	AllIds,

	// Verification rules
	new DefaultConfigStore({
		minimumAge: 18, // Must be 18+
		excludedCountries: ['IRN', 'PRK', 'RUS', 'SYR'], // OFAC sanctioned countries
		ofac: true // Enable OFAC compliance checking
	}),

	// User ID type (matches frontend)
	'uuid'
);
