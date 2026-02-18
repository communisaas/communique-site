/**
 * Tests for OpenID4VP response processing in mdl-verification.ts
 *
 * Tests the VP token parsing (JWT, SD-JWT, direct claims) and
 * address field extraction logic without hitting the Google Civic API.
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';

// We test processCredentialResponse which dispatches to processOid4vpResponse
// Since processOid4vpResponse is internal, we test through the public API
import { processCredentialResponse } from '$lib/core/identity/mdl-verification';

// Store original fetch to restore later
const originalFetch = globalThis.fetch;

beforeAll(() => {
	process.env.GOOGLE_CIVIC_API_KEY = 'test-api-key';
});

beforeEach(() => {
	// Fresh mock for each test
	globalThis.fetch = vi.fn();
});

afterEach(() => {
	globalThis.fetch = originalFetch;
});

// Helper: encode a string as base64url (no padding)
function base64urlEncode(str: string): string {
	return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Helper: build a JWT from payload claims
function buildJwt(payload: Record<string, unknown>): string {
	const header = base64urlEncode(JSON.stringify({ alg: 'ES256', typ: 'JWT' }));
	const body = base64urlEncode(JSON.stringify(payload));
	const signature = base64urlEncode('fake-signature-not-verified');
	return `${header}.${body}.${signature}`;
}

// Helper: build an SD-JWT disclosure
function buildDisclosure(salt: string, name: string, value: string): string {
	return base64urlEncode(JSON.stringify([salt, name, value]));
}

// Mock a successful Civic API response
function mockCivicApiSuccess(state: string, cd: string) {
	(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
		ok: true,
		json: () =>
			Promise.resolve({
				divisions: {
					[`ocd-division/country:us/state:${state.toLowerCase()}/cd:${cd}`]: {}
				}
			})
	});
}

// Ephemeral key (unused by OpenID4VP path but required by function signature)
let ephemeralKey: CryptoKey;

beforeAll(async () => {
	const keyPair = await crypto.subtle.generateKey(
		{ name: 'ECDH', namedCurve: 'P-256' },
		false,
		['deriveKey', 'deriveBits']
	);
	ephemeralKey = keyPair.privateKey;
});

describe('OpenID4VP response processing', () => {
	it('should extract claims from a JWT vp_token', async () => {
		const nonce = 'test-nonce-123';
		const jwt = buildJwt({
			nonce,
			resident_postal_code: '94110',
			resident_city: 'San Francisco',
			resident_state: 'CA'
		});

		mockCivicApiSuccess('ca', '12');

		const result = await processCredentialResponse(
			{ vp_token: jwt },
			'openid4vp',
			ephemeralKey,
			nonce
		);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.district).toBe('CA-12');
			expect(result.state).toBe('CA');
			expect(result.verificationMethod).toBe('mdl');
			expect(result.credentialHash).toMatch(/^[0-9a-f]{64}$/);
		}
	});

	it('should extract claims from a bare JWT string', async () => {
		const nonce = 'test-nonce-456';
		const jwt = buildJwt({
			nonce,
			resident_postal_code: '10001',
			resident_city: 'New York',
			resident_state: 'NY'
		});

		mockCivicApiSuccess('ny', '10');

		const result = await processCredentialResponse(jwt, 'openid4vp', ephemeralKey, nonce);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.district).toBe('NY-10');
			expect(result.state).toBe('NY');
		}
	});

	it('should extract claims from SD-JWT with disclosures', async () => {
		const nonce = 'test-nonce-789';
		// Base JWT with nonce only; address fields come from disclosures
		const jwt = buildJwt({ nonce });
		const d1 = buildDisclosure('salt1', 'resident_postal_code', '78701');
		const d2 = buildDisclosure('salt2', 'resident_city', 'Austin');
		const d3 = buildDisclosure('salt3', 'resident_state', 'TX');
		const sdJwt = `${jwt}~${d1}~${d2}~${d3}~`;

		mockCivicApiSuccess('tx', '25');

		const result = await processCredentialResponse(sdJwt, 'openid4vp', ephemeralKey, nonce);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.district).toBe('TX-25');
			expect(result.state).toBe('TX');
		}
	});

	it('should extract claims nested under mDL namespace', async () => {
		const nonce = 'test-nonce-ns';
		const jwt = buildJwt({
			nonce,
			'org.iso.18013.5.1': {
				resident_postal_code: '90210',
				resident_city: 'Beverly Hills',
				resident_state: 'CA'
			}
		});

		mockCivicApiSuccess('ca', '36');

		const result = await processCredentialResponse(
			{ vp_token: jwt },
			'openid4vp',
			ephemeralKey,
			nonce
		);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.district).toBe('CA-36');
		}
	});

	it('should extract claims from direct JSON object', async () => {
		const nonce = 'test-nonce-direct';
		const data = {
			nonce,
			resident_postal_code: '60601',
			resident_city: 'Chicago',
			resident_state: 'IL'
		};

		mockCivicApiSuccess('il', '7');

		const result = await processCredentialResponse(data, 'openid4vp', ephemeralKey, nonce);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.district).toBe('IL-7');
		}
	});

	it('should reject when nonce does not match', async () => {
		const jwt = buildJwt({
			nonce: 'wrong-nonce',
			resident_postal_code: '94110',
			resident_state: 'CA'
		});

		const result = await processCredentialResponse(
			{ vp_token: jwt },
			'openid4vp',
			ephemeralKey,
			'correct-nonce'
		);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe('invalid_format');
			expect(result.message).toContain('nonce mismatch');
		}
	});

	it('should reject when required address fields are missing', async () => {
		const nonce = 'test-nonce-missing';
		const jwt = buildJwt({
			nonce,
			resident_city: 'San Francisco'
			// Missing postal_code and state
		});

		const result = await processCredentialResponse(
			{ vp_token: jwt },
			'openid4vp',
			ephemeralKey,
			nonce
		);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe('missing_fields');
		}
	});

	it('should reject malformed JWT', async () => {
		const result = await processCredentialResponse(
			'not-a-jwt',
			'openid4vp',
			ephemeralKey,
			'some-nonce'
		);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe('invalid_format');
		}
	});

	it('should handle district lookup failure gracefully', async () => {
		const nonce = 'test-nonce-fail';
		const jwt = buildJwt({
			nonce,
			resident_postal_code: '00000',
			resident_state: 'XX'
		});

		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			ok: false,
			status: 400
		});

		const result = await processCredentialResponse(
			{ vp_token: jwt },
			'openid4vp',
			ephemeralKey,
			nonce
		);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe('district_lookup_failed');
		}
	});
});
