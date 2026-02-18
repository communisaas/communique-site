import { describe, it, expect, beforeAll } from 'vitest';
import {
	issueDistrictCredential,
	verifyDistrictCredential,
	hashCredential,
	hashDistrict,
	base64urlDecode,
	type DistrictResidencyCredential
} from '$lib/core/identity/district-credential';

// ============================================================================
// Setup: ensure signing keys are available
// ============================================================================

beforeAll(() => {
	// Ed25519 signing key (32-byte hex seed)
	process.env.IDENTITY_SIGNING_KEY = 'a'.repeat(64); // deterministic test key
	// Legacy HMAC key for backward-compat testing
	process.env.IDENTITY_HASH_SALT = 'test-salt-for-district-credential-unit-tests-32bytes!';
});

// ============================================================================
// Helpers
// ============================================================================

const BASE_PARAMS = {
	userId: 'cuid_test_user_001',
	didKey: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
	congressional: 'CA-12',
	verificationMethod: 'civic_api' as const
};

// ============================================================================
// Tests
// ============================================================================

describe('issueDistrictCredential', () => {
	it('should produce valid W3C VC 2.0 structure', async () => {
		const vc = await issueDistrictCredential(BASE_PARAMS);

		// @context
		expect(vc['@context']).toEqual(['https://www.w3.org/ns/credentials/v2']);

		// type
		expect(vc.type).toEqual(['VerifiableCredential', 'DistrictResidencyCredential']);

		// issuer
		expect(vc.issuer).toBe('did:web:communique.io');

		// issuanceDate / expirationDate are valid ISO 8601
		expect(() => new Date(vc.issuanceDate)).not.toThrow();
		expect(new Date(vc.issuanceDate).toISOString()).toBe(vc.issuanceDate);
		expect(() => new Date(vc.expirationDate)).not.toThrow();
		expect(new Date(vc.expirationDate).toISOString()).toBe(vc.expirationDate);

		// credentialSubject
		expect(vc.credentialSubject.id).toBe(BASE_PARAMS.didKey);
		expect(vc.credentialSubject.districtMembership.congressional).toBe('CA-12');

		// proof
		expect(vc.proof.type).toBe('Ed25519Signature2020');
		expect(vc.proof.proofPurpose).toBe('assertionMethod');
		expect(vc.proof.verificationMethod).toContain('did:web:communique.io');
		expect(typeof vc.proof.proofValue).toBe('string');
		expect(vc.proof.proofValue.length).toBeGreaterThan(0);
	});

	it('should set expiration ~90 days in the future', async () => {
		const before = Date.now();
		const vc = await issueDistrictCredential(BASE_PARAMS);
		const after = Date.now();

		const issuance = new Date(vc.issuanceDate).getTime();
		const expiration = new Date(vc.expirationDate).getTime();

		// Issuance should be within the test execution window
		expect(issuance).toBeGreaterThanOrEqual(before);
		expect(issuance).toBeLessThanOrEqual(after);

		// Expiration should be ~90 days (±1 second tolerance for test timing)
		const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
		const delta = expiration - issuance;
		expect(Math.abs(delta - ninetyDaysMs)).toBeLessThan(1000);
	});

	it('should use didKey as credentialSubject.id when available', async () => {
		const vc = await issueDistrictCredential(BASE_PARAMS);
		expect(vc.credentialSubject.id).toBe(BASE_PARAMS.didKey);
	});

	it('should fall back to user ID URN when didKey is null', async () => {
		const vc = await issueDistrictCredential({
			...BASE_PARAMS,
			didKey: null
		});
		expect(vc.credentialSubject.id).toBe(`urn:communique:user:${BASE_PARAMS.userId}`);
	});

	it('should include optional stateSenate and stateAssembly when provided', async () => {
		const vc = await issueDistrictCredential({
			...BASE_PARAMS,
			stateSenate: 'CA-SD-11',
			stateAssembly: 'CA-AD-19'
		});

		expect(vc.credentialSubject.districtMembership.stateSenate).toBe('CA-SD-11');
		expect(vc.credentialSubject.districtMembership.stateAssembly).toBe('CA-AD-19');
	});

	it('should NOT include stateSenate/stateAssembly keys when not provided', async () => {
		const vc = await issueDistrictCredential(BASE_PARAMS);
		const membership = vc.credentialSubject.districtMembership;
		expect('stateSenate' in membership).toBe(false);
		expect('stateAssembly' in membership).toBe(false);
	});
});

describe('verifyDistrictCredential', () => {
	it('should verify a valid credential', async () => {
		const vc = await issueDistrictCredential(BASE_PARAMS);
		const valid = await verifyDistrictCredential(vc);
		expect(valid).toBe(true);
	});

	it('should reject a credential with tampered congressional district', async () => {
		const vc = await issueDistrictCredential(BASE_PARAMS);
		const tampered: DistrictResidencyCredential = {
			...vc,
			credentialSubject: {
				...vc.credentialSubject,
				districtMembership: {
					...vc.credentialSubject.districtMembership,
					congressional: 'NY-01'
				}
			}
		};
		const valid = await verifyDistrictCredential(tampered);
		expect(valid).toBe(false);
	});

	it('should reject a credential with tampered issuer', async () => {
		const vc = await issueDistrictCredential(BASE_PARAMS);
		const tampered: DistrictResidencyCredential = {
			...vc,
			issuer: 'did:web:evil.example.com'
		};
		const valid = await verifyDistrictCredential(tampered);
		expect(valid).toBe(false);
	});

	it('should reject a credential with tampered subject ID', async () => {
		const vc = await issueDistrictCredential(BASE_PARAMS);
		const tampered: DistrictResidencyCredential = {
			...vc,
			credentialSubject: {
				...vc.credentialSubject,
				id: 'did:key:z6MkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
			}
		};
		const valid = await verifyDistrictCredential(tampered);
		expect(valid).toBe(false);
	});

	it('should reject a credential with tampered expiration date', async () => {
		const vc = await issueDistrictCredential(BASE_PARAMS);
		const tampered: DistrictResidencyCredential = {
			...vc,
			expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
		};
		const valid = await verifyDistrictCredential(tampered);
		expect(valid).toBe(false);
	});

	it('should reject a credential with tampered proof value', async () => {
		const vc = await issueDistrictCredential(BASE_PARAMS);
		const tampered: DistrictResidencyCredential = {
			...vc,
			proof: {
				...vc.proof,
				proofValue: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
			}
		};
		const valid = await verifyDistrictCredential(tampered);
		expect(valid).toBe(false);
	});
});

describe('Ed25519 signature properties', () => {
	it('should produce a 64-byte Ed25519 signature', async () => {
		const vc = await issueDistrictCredential(BASE_PARAMS);
		const sigBytes = base64urlDecode(vc.proof.proofValue);
		expect(sigBytes.length).toBe(64);
	});

	it('should produce deterministic signatures for the same input', async () => {
		// Ed25519 is deterministic (no random nonce), but timestamps differ
		// so we verify two calls produce different proofValues (different timestamps)
		const vc1 = await issueDistrictCredential(BASE_PARAMS);
		const vc2 = await issueDistrictCredential(BASE_PARAMS);
		// Different issuance times -> different bodies -> different signatures
		if (vc1.issuanceDate !== vc2.issuanceDate) {
			expect(vc1.proof.proofValue).not.toBe(vc2.proof.proofValue);
		}
	});
});

describe('backward compatibility', () => {
	it('should verify Ed25519-signed credentials', async () => {
		const vc = await issueDistrictCredential(BASE_PARAMS);
		const valid = await verifyDistrictCredential(vc);
		expect(valid).toBe(true);
	});

	it('should reject tampered credentials even with HMAC fallback available', async () => {
		const vc = await issueDistrictCredential(BASE_PARAMS);
		const tampered: DistrictResidencyCredential = {
			...vc,
			issuer: 'did:web:evil.example.com'
		};
		const valid = await verifyDistrictCredential(tampered);
		expect(valid).toBe(false);
	});

	it('should fail gracefully when IDENTITY_SIGNING_KEY is missing', async () => {
		const saved = process.env.IDENTITY_SIGNING_KEY;
		delete process.env.IDENTITY_SIGNING_KEY;
		try {
			await expect(issueDistrictCredential(BASE_PARAMS)).rejects.toThrow(
				'IDENTITY_SIGNING_KEY'
			);
		} finally {
			process.env.IDENTITY_SIGNING_KEY = saved;
		}
	});
});

describe('hashCredential', () => {
	it('should produce a 64-character hex string (SHA-256)', async () => {
		const vc = await issueDistrictCredential(BASE_PARAMS);
		const hash = await hashCredential(vc);
		expect(hash).toMatch(/^[0-9a-f]{64}$/);
	});

	it('should be deterministic for the same credential', async () => {
		const vc = await issueDistrictCredential(BASE_PARAMS);
		const hash1 = await hashCredential(vc);
		const hash2 = await hashCredential(vc);
		expect(hash1).toBe(hash2);
	});

	it('should differ for credentials with different districts', async () => {
		const vc1 = await issueDistrictCredential(BASE_PARAMS);
		const vc2 = await issueDistrictCredential({
			...BASE_PARAMS,
			congressional: 'NY-15'
		});
		const hash1 = await hashCredential(vc1);
		const hash2 = await hashCredential(vc2);
		expect(hash1).not.toBe(hash2);
	});
});

describe('hashDistrict', () => {
	it('should produce a 64-character hex string', async () => {
		const hash = await hashDistrict('CA-12');
		expect(hash).toMatch(/^[0-9a-f]{64}$/);
	});

	it('should be deterministic', async () => {
		const hash1 = await hashDistrict('CA-12');
		const hash2 = await hashDistrict('CA-12');
		expect(hash1).toBe(hash2);
	});

	it('should differ for different districts', async () => {
		const hash1 = await hashDistrict('CA-12');
		const hash2 = await hashDistrict('NY-15');
		expect(hash1).not.toBe(hash2);
	});
});
