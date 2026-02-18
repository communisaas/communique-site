/**
 * Unit tests for COSE_Sign1 verification (ISO 18013-5 mDL issuer auth)
 *
 * Generates synthetic COSE_Sign1 structures using Web Crypto ECDSA P-256
 * and cbor-web, then verifies them through the verifyCoseSign1() pipeline.
 *
 * Tests cover:
 *   - Valid signature verification (happy path)
 *   - Signature verification failure with wrong key
 *   - MSO digest validation
 *   - Structural validation (missing fields, bad formats)
 *   - Trust store matching
 */

import { describe, it, expect } from 'vitest';
import {
	verifyCoseSign1,
	validateMsoDigests,
	extractEcPublicKeyFromDER,
	type MobileSecurityObject
} from '$lib/core/identity/cose-verify';
import type { IACACertificate } from '$lib/core/identity/iaca-roots';
import { encode, decode } from 'cbor-web';

// ---------------------------------------------------------------------------
// Test helpers: build synthetic X.509 certs and COSE_Sign1 structures
// ---------------------------------------------------------------------------

/**
 * Build a minimal self-signed X.509 v3 DER certificate containing an
 * ECDSA P-256 public key. This is NOT a complete X.509 cert — it contains
 * just enough structure for extractEcPublicKeyFromDER() to find the key.
 *
 * The DER structure:
 *   SEQUENCE (Certificate) {
 *     SEQUENCE (TBSCertificate) {
 *       [0] EXPLICIT INTEGER 2 (v3)
 *       INTEGER serialNumber
 *       SEQUENCE (signature algorithm) { OID ecdsaWithSHA256 }
 *       SEQUENCE (issuer) { ... }
 *       SEQUENCE (validity) { ... }
 *       SEQUENCE (subject) { ... }
 *       SEQUENCE (SubjectPublicKeyInfo) {
 *         SEQUENCE (algorithm) {
 *           OID 1.2.840.10045.2.1 (id-ecPublicKey)
 *           OID 1.2.840.10045.3.1.7 (prime256v1)
 *         }
 *         BIT STRING (65 bytes uncompressed point)
 *       }
 *     }
 *     SEQUENCE (signatureAlgorithm) { ... }
 *     BIT STRING (signature - dummy)
 *   }
 */
async function buildMinimalCert(publicKey: CryptoKey): Promise<Uint8Array> {
	// Export the raw public key (65 bytes: 04 || x || y)
	const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', publicKey));

	// OID 1.2.840.10045.2.1 (id-ecPublicKey)
	const ecOid = new Uint8Array([0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01]);
	// OID 1.2.840.10045.3.1.7 (prime256v1 / P-256)
	const curveOid = new Uint8Array([0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07]);

	// AlgorithmIdentifier SEQUENCE
	const algIdContent = concatBytes(ecOid, curveOid);
	const algId = wrapDERSequence(algIdContent);

	// BIT STRING wrapping the public key (prepend 0x00 for unused bits)
	const bitStringContent = concatBytes(new Uint8Array([0x00]), rawKey);
	const bitString = new Uint8Array([0x03, ...encodeDERLength(bitStringContent.length), ...bitStringContent]);

	// SubjectPublicKeyInfo SEQUENCE
	const spki = wrapDERSequence(concatBytes(algId, bitString));

	// Minimal TBSCertificate: version + serial + sigAlg + issuer + validity + subject + spki
	// Version: [0] EXPLICIT INTEGER 2
	const version = new Uint8Array([0xa0, 0x03, 0x02, 0x01, 0x02]);
	// Serial: INTEGER 1
	const serial = new Uint8Array([0x02, 0x01, 0x01]);
	// Signature algorithm (ecdsaWithSHA256): OID 1.2.840.10045.4.3.2
	const sigAlgOid = new Uint8Array([0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x04, 0x03, 0x02]);
	const sigAlg = wrapDERSequence(sigAlgOid);
	// Issuer: SEQUENCE { SET { SEQUENCE { OID cn, UTF8STRING "Test" } } }
	const cnOid = new Uint8Array([0x06, 0x03, 0x55, 0x04, 0x03]); // OID 2.5.4.3 (CN)
	const cnValue = new Uint8Array([0x0c, 0x04, 0x54, 0x65, 0x73, 0x74]); // UTF8STRING "Test"
	const rdnSeq = wrapDERSequence(concatBytes(cnOid, cnValue));
	const rdnSet = new Uint8Array([0x31, ...encodeDERLength(rdnSeq.length), ...rdnSeq]);
	const issuer = wrapDERSequence(rdnSet);
	// Validity: SEQUENCE { UTCTime, UTCTime }
	const notBefore = new Uint8Array([0x17, 0x0d, ...new TextEncoder().encode('250101000000Z')]);
	const notAfter = new Uint8Array([0x17, 0x0d, ...new TextEncoder().encode('351231235959Z')]);
	const validity = wrapDERSequence(concatBytes(notBefore, notAfter));
	// Subject = same as issuer (self-signed)
	const subject = issuer;

	const tbsCert = wrapDERSequence(
		concatBytes(version, serial, sigAlg, issuer, validity, subject, spki)
	);

	// Outer certificate: tbsCert + sigAlg + dummy signature
	const dummySig = new Uint8Array([0x03, 0x03, 0x00, 0x30, 0x00]); // BIT STRING with empty SEQUENCE
	const cert = wrapDERSequence(concatBytes(tbsCert, sigAlg, dummySig));

	return cert;
}

/**
 * Create a COSE_Sign1 structure with a real ECDSA P-256 signature.
 *
 * Returns [protectedHeadersCBOR, unprotectedHeaders, payloadCBOR, signature]
 */
async function buildCoseSign1(
	payload: Uint8Array,
	privateKey: CryptoKey,
	certDER: Uint8Array
): Promise<unknown[]> {
	// Protected headers: { 1: -7 } (alg: ES256)
	const protectedHeaders = new Map<number, number>();
	protectedHeaders.set(1, -7);
	const protectedHeadersCBOR = new Uint8Array(encode(protectedHeaders));

	// Unprotected headers: { 33: certDER } (x5chain)
	const unprotectedHeaders = new Map<number, Uint8Array>();
	unprotectedHeaders.set(33, certDER);

	// Build Sig_structure = ["Signature1", protectedHeadersCBOR, b"", payload]
	const sigStructure = ['Signature1', protectedHeadersCBOR, new Uint8Array(0), payload];
	const sigStructureEncoded = new Uint8Array(encode(sigStructure));

	// Sign with ECDSA P-256 SHA-256
	// Node.js Web Crypto returns raw (IEEE P1363) format: r || s, 64 bytes
	// This matches COSE's expected signature format directly.
	const rawSignature = new Uint8Array(
		await crypto.subtle.sign(
			{ name: 'ECDSA', hash: 'SHA-256' },
			privateKey,
			sigStructureEncoded
		)
	);

	return [protectedHeadersCBOR, unprotectedHeaders, payload, rawSignature];
}

/**
 * Build a test MSO (MobileSecurityObject) CBOR payload.
 */
function buildTestMso(namespaceDigests?: Map<string, Map<number, Uint8Array>>): Uint8Array {
	const mso: Record<string, unknown> = {
		version: '1.0',
		digestAlgorithm: 'SHA-256',
		validityInfo: {
			signed: '2026-01-01T00:00:00Z',
			validFrom: '2026-01-01T00:00:00Z',
			validUntil: '2027-01-01T00:00:00Z'
		}
	};

	if (namespaceDigests) {
		mso.valueDigests = namespaceDigests;
	} else {
		mso.valueDigests = new Map<string, Map<number, Uint8Array>>([
			[
				'org.iso.18013.5.1',
				new Map<number, Uint8Array>([
					[0, new Uint8Array([1, 2, 3, 4])],
					[1, new Uint8Array([5, 6, 7, 8])]
				])
			]
		]);
	}

	return new Uint8Array(encode(mso));
}

/**
 * Generate a fresh ECDSA P-256 key pair.
 */
async function generateKeyPair(): Promise<CryptoKeyPair> {
	return crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
		'sign',
		'verify'
	]);
}

// ---------------------------------------------------------------------------
// DER / byte helpers for tests
// ---------------------------------------------------------------------------

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
	const totalLength = arrays.reduce((sum, a) => sum + a.length, 0);
	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const arr of arrays) {
		result.set(arr, offset);
		offset += arr.length;
	}
	return result;
}

function encodeDERLength(len: number): Uint8Array {
	if (len < 0x80) {
		return new Uint8Array([len]);
	} else if (len < 0x100) {
		return new Uint8Array([0x81, len]);
	} else {
		return new Uint8Array([0x82, (len >> 8) & 0xff, len & 0xff]);
	}
}

function wrapDERSequence(content: Uint8Array): Uint8Array {
	const lenBytes = encodeDERLength(content.length);
	const result = new Uint8Array(1 + lenBytes.length + content.length);
	result[0] = 0x30; // SEQUENCE tag
	result.set(lenBytes, 1);
	result.set(content, 1 + lenBytes.length);
	return result;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('COSE_Sign1 Verification', () => {
	describe('verifyCoseSign1', () => {
		it('should verify a valid COSE_Sign1 signature', async () => {
			const keyPair = await generateKeyPair();
			const certDER = await buildMinimalCert(keyPair.publicKey);
			const msoPayload = buildTestMso();

			const coseSign1 = await buildCoseSign1(msoPayload, keyPair.privateKey, certDER);

			// Build a trust store entry matching this cert
			const trustedRoot: IACACertificate = {
				state: 'XX',
				issuer: 'Test Root',
				certificateB64: uint8ArrayToBase64(certDER),
				derBytes: certDER,
				expiresAt: '2035-12-31T23:59:59Z'
			};

			const result = await verifyCoseSign1(coseSign1, [trustedRoot]);

			expect(result.valid).toBe(true);
			if (result.valid) {
				expect(result.mso.version).toBe('1.0');
				expect(result.mso.digestAlgorithm).toBe('SHA-256');
				expect(result.mso.validityInfo.validFrom).toBeInstanceOf(Date);
				expect(result.mso.validityInfo.validUntil).toBeInstanceOf(Date);
				expect(result.mso.issuerCertificate).toEqual(certDER);
			}
		});

		it('should reject a signature made with a different key', async () => {
			const signingKeyPair = await generateKeyPair();
			const differentKeyPair = await generateKeyPair();

			// Build cert with the DIFFERENT key (not the signing key)
			const certDER = await buildMinimalCert(differentKeyPair.publicKey);
			const msoPayload = buildTestMso();

			// Sign with the SIGNING key (mismatches the cert)
			const coseSign1 = await buildCoseSign1(msoPayload, signingKeyPair.privateKey, certDER);

			const trustedRoot: IACACertificate = {
				state: 'XX',
				issuer: 'Test Root',
				certificateB64: uint8ArrayToBase64(certDER),
				derBytes: certDER,
				expiresAt: '2035-12-31T23:59:59Z'
			};

			const result = await verifyCoseSign1(coseSign1, [trustedRoot]);

			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.reason).toContain('verification failed');
			}
		});

		it('should reject when issuer cert is not in trust store', async () => {
			const keyPair = await generateKeyPair();
			const certDER = await buildMinimalCert(keyPair.publicKey);
			const msoPayload = buildTestMso();

			const coseSign1 = await buildCoseSign1(msoPayload, keyPair.privateKey, certDER);

			// Trust store has a DIFFERENT cert
			const otherKeyPair = await generateKeyPair();
			const otherCertDER = await buildMinimalCert(otherKeyPair.publicKey);

			const trustedRoot: IACACertificate = {
				state: 'CA',
				issuer: 'California Test Root',
				certificateB64: uint8ArrayToBase64(otherCertDER),
				derBytes: otherCertDER,
				expiresAt: '2035-12-31T23:59:59Z'
			};

			const result = await verifyCoseSign1(coseSign1, [trustedRoot]);

			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.reason).toContain('trust store');
			}
		});

		it('should reject a non-array input', async () => {
			const result = await verifyCoseSign1(
				'not an array' as unknown as unknown[],
				[]
			);
			expect(result.valid).toBe(false);
		});

		it('should reject a COSE_Sign1 with wrong array length', async () => {
			const result = await verifyCoseSign1([1, 2, 3], []);
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.reason).toContain('4-element');
			}
		});

		it('should reject unsupported algorithms', async () => {
			// Build protected headers with algorithm -35 (ES384) instead of -7 (ES256)
			const protectedHeaders = new Map<number, number>();
			protectedHeaders.set(1, -35);
			const protectedHeadersCBOR = new Uint8Array(encode(protectedHeaders));

			const result = await verifyCoseSign1(
				[protectedHeadersCBOR, new Map(), new Uint8Array(10), new Uint8Array(64)],
				[]
			);
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.reason).toContain('Unsupported COSE algorithm');
			}
		});

		it('should reject when signature has wrong length', async () => {
			const protectedHeaders = new Map<number, number>();
			protectedHeaders.set(1, -7);
			const protectedHeadersCBOR = new Uint8Array(encode(protectedHeaders));

			const keyPair = await generateKeyPair();
			const certDER = await buildMinimalCert(keyPair.publicKey);

			const unprotectedHeaders = new Map<number, Uint8Array>();
			unprotectedHeaders.set(33, certDER);

			const trustedRoot: IACACertificate = {
				state: 'XX',
				issuer: 'Test',
				certificateB64: uint8ArrayToBase64(certDER),
				derBytes: certDER,
				expiresAt: '2035-12-31T23:59:59Z'
			};

			const result = await verifyCoseSign1(
				[protectedHeadersCBOR, unprotectedHeaders, new Uint8Array(10), new Uint8Array(32)],
				[trustedRoot]
			);
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.reason).toContain('signature length');
			}
		});

		it('should reject detached payload (null)', async () => {
			const protectedHeaders = new Map<number, number>();
			protectedHeaders.set(1, -7);
			const protectedHeadersCBOR = new Uint8Array(encode(protectedHeaders));

			const result = await verifyCoseSign1(
				[protectedHeadersCBOR, new Map(), null, new Uint8Array(64)],
				[]
			);
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.reason).toContain('Detached');
			}
		});
	});

	describe('extractEcPublicKeyFromDER', () => {
		it('should extract the P-256 public key from a minimal DER cert', async () => {
			const keyPair = await generateKeyPair();
			const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey));
			const certDER = await buildMinimalCert(keyPair.publicKey);

			const extracted = extractEcPublicKeyFromDER(certDER);

			expect(extracted.length).toBe(65);
			expect(extracted[0]).toBe(0x04); // Uncompressed point prefix
			expect(extracted).toEqual(rawKey);
		});

		it('should throw if EC OID is not present', () => {
			// Random bytes without the EC OID
			const garbage = new Uint8Array(100);
			crypto.getRandomValues(garbage);

			expect(() => extractEcPublicKeyFromDER(garbage)).toThrow('EC public key OID not found');
		});
	});

	describe('validateMsoDigests', () => {
		it('should validate matching digests', async () => {
			// Build IssuerSignedItem elements
			const item0 = {
				digestID: 0,
				random: new Uint8Array([0xaa, 0xbb]),
				elementIdentifier: 'family_name',
				elementValue: 'Smith'
			};
			const item1 = {
				digestID: 1,
				random: new Uint8Array([0xcc, 0xdd]),
				elementIdentifier: 'given_name',
				elementValue: 'John'
			};

			const item0Bytes = new Uint8Array(encode(item0));
			const item1Bytes = new Uint8Array(encode(item1));

			// Compute SHA-256 digests
			const digest0 = new Uint8Array(await crypto.subtle.digest('SHA-256', item0Bytes));
			const digest1 = new Uint8Array(await crypto.subtle.digest('SHA-256', item1Bytes));

			// Build MSO with these digests
			const valueDigests = new Map<string, Map<number, Uint8Array>>([
				[
					'org.iso.18013.5.1',
					new Map<number, Uint8Array>([
						[0, digest0],
						[1, digest1]
					])
				]
			]);

			const mso: MobileSecurityObject = {
				version: '1.0',
				digestAlgorithm: 'SHA-256',
				valueDigests,
				validityInfo: {
					signed: new Date('2026-01-01'),
					validFrom: new Date('2026-01-01'),
					validUntil: new Date('2027-01-01')
				},
				issuerCertificate: new Uint8Array(0)
			};

			const result = await validateMsoDigests(
				mso,
				{ 'org.iso.18013.5.1': [item0Bytes, item1Bytes] },
				(d: Uint8Array) => decode(d),
				(d: unknown) => new Uint8Array(encode(d))
			);

			expect(result).toBe(true);
		});

		it('should reject tampered element data', async () => {
			const item0 = {
				digestID: 0,
				random: new Uint8Array([0xaa, 0xbb]),
				elementIdentifier: 'family_name',
				elementValue: 'Smith'
			};

			const item0Bytes = new Uint8Array(encode(item0));
			const digest0 = new Uint8Array(await crypto.subtle.digest('SHA-256', item0Bytes));

			const valueDigests = new Map<string, Map<number, Uint8Array>>([
				['org.iso.18013.5.1', new Map<number, Uint8Array>([[0, digest0]])]
			]);

			const mso: MobileSecurityObject = {
				version: '1.0',
				digestAlgorithm: 'SHA-256',
				valueDigests,
				validityInfo: {
					signed: new Date('2026-01-01'),
					validFrom: new Date('2026-01-01'),
					validUntil: new Date('2027-01-01')
				},
				issuerCertificate: new Uint8Array(0)
			};

			// Tamper with the element: change the value
			const tamperedItem = {
				digestID: 0,
				random: new Uint8Array([0xaa, 0xbb]),
				elementIdentifier: 'family_name',
				elementValue: 'Jones' // TAMPERED
			};
			const tamperedBytes = new Uint8Array(encode(tamperedItem));

			const result = await validateMsoDigests(
				mso,
				{ 'org.iso.18013.5.1': [tamperedBytes] },
				(d: Uint8Array) => decode(d),
				(d: unknown) => new Uint8Array(encode(d))
			);

			expect(result).toBe(false);
		});

		it('should reject elements with unknown digest IDs', async () => {
			const item0 = {
				digestID: 99, // Not in MSO
				random: new Uint8Array([0xaa]),
				elementIdentifier: 'test',
				elementValue: 'x'
			};
			const item0Bytes = new Uint8Array(encode(item0));

			const valueDigests = new Map<string, Map<number, Uint8Array>>([
				[
					'org.iso.18013.5.1',
					new Map<number, Uint8Array>([[0, new Uint8Array([1, 2, 3])]])
				]
			]);

			const mso: MobileSecurityObject = {
				version: '1.0',
				digestAlgorithm: 'SHA-256',
				valueDigests,
				validityInfo: {
					signed: new Date('2026-01-01'),
					validFrom: new Date('2026-01-01'),
					validUntil: new Date('2027-01-01')
				},
				issuerCertificate: new Uint8Array(0)
			};

			const result = await validateMsoDigests(
				mso,
				{ 'org.iso.18013.5.1': [item0Bytes] },
				(d: Uint8Array) => decode(d),
				(d: unknown) => new Uint8Array(encode(d))
			);

			expect(result).toBe(false);
		});
	});

	describe('MSO parsing', () => {
		it('should parse validityInfo dates from the MSO', async () => {
			const keyPair = await generateKeyPair();
			const certDER = await buildMinimalCert(keyPair.publicKey);
			const msoPayload = buildTestMso();

			const coseSign1 = await buildCoseSign1(msoPayload, keyPair.privateKey, certDER);

			const trustedRoot: IACACertificate = {
				state: 'XX',
				issuer: 'Test Root',
				certificateB64: uint8ArrayToBase64(certDER),
				derBytes: certDER,
				expiresAt: '2035-12-31T23:59:59Z'
			};

			const result = await verifyCoseSign1(coseSign1, [trustedRoot]);

			expect(result.valid).toBe(true);
			if (result.valid) {
				expect(result.mso.validityInfo.signed.toISOString()).toContain('2026');
				expect(result.mso.validityInfo.validFrom.toISOString()).toContain('2026');
				expect(result.mso.validityInfo.validUntil.toISOString()).toContain('2027');
			}
		});

		it('should parse valueDigests from the MSO', async () => {
			const keyPair = await generateKeyPair();
			const certDER = await buildMinimalCert(keyPair.publicKey);

			const testDigests = new Map<string, Map<number, Uint8Array>>([
				[
					'org.iso.18013.5.1',
					new Map<number, Uint8Array>([
						[0, new Uint8Array([0xde, 0xad])],
						[1, new Uint8Array([0xbe, 0xef])]
					])
				]
			]);
			const msoPayload = buildTestMso(testDigests);
			const coseSign1 = await buildCoseSign1(msoPayload, keyPair.privateKey, certDER);

			const trustedRoot: IACACertificate = {
				state: 'XX',
				issuer: 'Test Root',
				certificateB64: uint8ArrayToBase64(certDER),
				derBytes: certDER,
				expiresAt: '2035-12-31T23:59:59Z'
			};

			const result = await verifyCoseSign1(coseSign1, [trustedRoot]);

			expect(result.valid).toBe(true);
			if (result.valid) {
				const nsDigests = result.mso.valueDigests.get('org.iso.18013.5.1');
				expect(nsDigests).toBeDefined();
				expect(nsDigests?.get(0)).toEqual(new Uint8Array([0xde, 0xad]));
				expect(nsDigests?.get(1)).toEqual(new Uint8Array([0xbe, 0xef]));
			}
		});
	});
});
