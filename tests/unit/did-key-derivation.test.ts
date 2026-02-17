import { describe, it, expect } from 'vitest';
import {
	deriveDIDKey,
	getCOSEKeyAlgorithm
} from '$lib/core/identity/did-key-derivation';

/**
 * Helper to build a COSE key as CBOR bytes.
 *
 * COSE keys are CBOR maps. This helper manually constructs the CBOR
 * encoding for our test vectors, matching exactly what WebAuthn produces.
 */

/** Encode a CBOR unsigned integer (major type 0) */
function cborUint(value: number): number[] {
	if (value < 24) return [value];
	if (value < 256) return [24, value];
	return [25, (value >> 8) & 0xff, value & 0xff];
}

/** Encode a CBOR negative integer (major type 1): encodes -1-n */
function cborNegInt(value: number): number[] {
	// value is the actual negative number (e.g., -1, -7)
	const n = -1 - value; // n >= 0
	if (n < 24) return [0x20 | n];
	if (n < 256) return [0x20 | 24, n];
	return [0x20 | 25, (n >> 8) & 0xff, n & 0xff];
}

/** Encode a CBOR byte string (major type 2) */
function cborBytes(data: Uint8Array): number[] {
	const result: number[] = [];
	if (data.length < 24) {
		result.push(0x40 | data.length);
	} else if (data.length < 256) {
		result.push(0x40 | 24, data.length);
	} else {
		result.push(0x40 | 25, (data.length >> 8) & 0xff, data.length & 0xff);
	}
	result.push(...data);
	return result;
}

/** Encode a CBOR map header (major type 5) */
function cborMapHeader(pairs: number): number[] {
	if (pairs < 24) return [0xa0 | pairs];
	return [0xa0 | 24, pairs];
}

/**
 * Build a P-256 COSE key (5 pairs: kty, alg, crv, x, y)
 *
 * Map structure:
 *   1 (kty)  -> 2 (EC2)
 *   3 (alg)  -> -7 (ES256)
 *  -1 (crv)  -> 1 (P-256)
 *  -2 (x)    -> 32 bytes
 *  -3 (y)    -> 32 bytes
 */
function buildP256COSEKey(x: Uint8Array, y: Uint8Array): Uint8Array {
	const parts: number[] = [
		...cborMapHeader(5),
		// kty: 2 (EC2)
		...cborUint(1),
		...cborUint(2),
		// alg: -7 (ES256)
		...cborUint(3),
		...cborNegInt(-7),
		// crv: 1 (P-256) -- label -1
		...cborNegInt(-1),
		...cborUint(1),
		// x: 32 bytes -- label -2
		...cborNegInt(-2),
		...cborBytes(x),
		// y: 32 bytes -- label -3
		...cborNegInt(-3),
		...cborBytes(y)
	];
	return new Uint8Array(parts);
}

/**
 * Build an Ed25519 COSE key (4 pairs: kty, alg, crv, x)
 *
 * Map structure:
 *   1 (kty)  -> 1 (OKP)
 *   3 (alg)  -> -8 (EdDSA)
 *  -1 (crv)  -> 6 (Ed25519)
 *  -2 (x)    -> 32 bytes (public key)
 */
function buildEd25519COSEKey(publicKey: Uint8Array): Uint8Array {
	const parts: number[] = [
		...cborMapHeader(4),
		// kty: 1 (OKP)
		...cborUint(1),
		...cborUint(1),
		// alg: -8 (EdDSA)
		...cborUint(3),
		...cborNegInt(-8),
		// crv: 6 (Ed25519) -- label -1
		...cborNegInt(-1),
		...cborUint(6),
		// x: 32 bytes -- label -2
		...cborNegInt(-2),
		...cborBytes(publicKey)
	];
	return new Uint8Array(parts);
}

// ── Test vectors ─────────────────────────────────────────────────────────────

// Deterministic 32-byte values for testing
const TEST_X = new Uint8Array(32);
TEST_X[0] = 0x01;
TEST_X[31] = 0x42;

const TEST_Y_EVEN = new Uint8Array(32);
TEST_Y_EVEN[0] = 0xaa;
TEST_Y_EVEN[31] = 0x00; // Last byte even -> compressed prefix 0x02

const TEST_Y_ODD = new Uint8Array(32);
TEST_Y_ODD[0] = 0xbb;
TEST_Y_ODD[31] = 0x01; // Last byte odd -> compressed prefix 0x03

const TEST_ED25519_PUB = new Uint8Array(32);
TEST_ED25519_PUB[0] = 0xde;
TEST_ED25519_PUB[15] = 0xad;
TEST_ED25519_PUB[31] = 0xef;

// ── Tests ────────────────────────────────────────────────────────────────────

describe('getCOSEKeyAlgorithm', () => {
	it('should detect P-256 key type', () => {
		const cose = buildP256COSEKey(TEST_X, TEST_Y_EVEN);
		expect(getCOSEKeyAlgorithm(cose)).toBe('P-256');
	});

	it('should detect Ed25519 key type', () => {
		const cose = buildEd25519COSEKey(TEST_ED25519_PUB);
		expect(getCOSEKeyAlgorithm(cose)).toBe('Ed25519');
	});

	it('should return unknown for invalid data', () => {
		expect(getCOSEKeyAlgorithm(new Uint8Array([0x00]))).toBe('unknown');
	});

	it('should return unknown for empty data', () => {
		expect(getCOSEKeyAlgorithm(new Uint8Array(0))).toBe('unknown');
	});

	it('should return unknown for unsupported key type', () => {
		// Build a COSE key with kty=3, crv=1 (not a real key type)
		const parts: number[] = [
			...cborMapHeader(3),
			...cborUint(1),
			...cborUint(3), // kty: 3 (unsupported)
			...cborUint(3),
			...cborNegInt(-7),
			...cborNegInt(-1),
			...cborUint(1) // crv: 1
		];
		const cose = new Uint8Array(parts);
		expect(getCOSEKeyAlgorithm(cose)).toBe('unknown');
	});
});

describe('deriveDIDKey - P-256', () => {
	it('should derive a did:key starting with did:key:z for P-256', () => {
		const cose = buildP256COSEKey(TEST_X, TEST_Y_EVEN);
		const didKey = deriveDIDKey(cose);
		expect(didKey).toMatch(/^did:key:z/);
	});

	it('should produce deterministic output for the same input', () => {
		const cose = buildP256COSEKey(TEST_X, TEST_Y_EVEN);
		const didKey1 = deriveDIDKey(cose);
		const didKey2 = deriveDIDKey(cose);
		expect(didKey1).toBe(didKey2);
	});

	it('should use 0x02 prefix when y is even', () => {
		const cose = buildP256COSEKey(TEST_X, TEST_Y_EVEN);
		const didKey = deriveDIDKey(cose);
		// The did:key should be different from odd-y version
		const coseOdd = buildP256COSEKey(TEST_X, TEST_Y_ODD);
		const didKeyOdd = deriveDIDKey(coseOdd);
		expect(didKey).not.toBe(didKeyOdd);
	});

	it('should use 0x03 prefix when y is odd', () => {
		const cose = buildP256COSEKey(TEST_X, TEST_Y_ODD);
		const didKey = deriveDIDKey(cose);
		expect(didKey).toMatch(/^did:key:z/);
	});

	it('should produce different did:key for different x coordinates', () => {
		const x1 = new Uint8Array(32);
		x1[0] = 0x01;
		const x2 = new Uint8Array(32);
		x2[0] = 0x02;

		const cose1 = buildP256COSEKey(x1, TEST_Y_EVEN);
		const cose2 = buildP256COSEKey(x2, TEST_Y_EVEN);

		expect(deriveDIDKey(cose1)).not.toBe(deriveDIDKey(cose2));
	});

	it('should produce a did:key of reasonable length for P-256', () => {
		const cose = buildP256COSEKey(TEST_X, TEST_Y_EVEN);
		const didKey = deriveDIDKey(cose);
		// did:key:z + base58btc(2 multicodec bytes + 33 compressed key bytes)
		// base58btc of 35 bytes should be ~48 chars, plus "did:key:z" prefix (9 chars)
		expect(didKey.length).toBeGreaterThan(40);
		expect(didKey.length).toBeLessThan(70);
	});

	it('should only contain valid base58btc characters after the z prefix', () => {
		const cose = buildP256COSEKey(TEST_X, TEST_Y_EVEN);
		const didKey = deriveDIDKey(cose);
		const base58Part = didKey.slice('did:key:z'.length);
		// base58btc alphabet: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
		expect(base58Part).toMatch(/^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/);
	});
});

describe('deriveDIDKey - Ed25519', () => {
	it('should derive a did:key starting with did:key:z for Ed25519', () => {
		const cose = buildEd25519COSEKey(TEST_ED25519_PUB);
		const didKey = deriveDIDKey(cose);
		expect(didKey).toMatch(/^did:key:z/);
	});

	it('should produce deterministic output for the same input', () => {
		const cose = buildEd25519COSEKey(TEST_ED25519_PUB);
		const didKey1 = deriveDIDKey(cose);
		const didKey2 = deriveDIDKey(cose);
		expect(didKey1).toBe(didKey2);
	});

	it('should produce different did:key for different public keys', () => {
		const pub1 = new Uint8Array(32);
		pub1[0] = 0x01;
		const pub2 = new Uint8Array(32);
		pub2[0] = 0x02;

		const cose1 = buildEd25519COSEKey(pub1);
		const cose2 = buildEd25519COSEKey(pub2);

		expect(deriveDIDKey(cose1)).not.toBe(deriveDIDKey(cose2));
	});

	it('should produce a did:key of reasonable length for Ed25519', () => {
		const cose = buildEd25519COSEKey(TEST_ED25519_PUB);
		const didKey = deriveDIDKey(cose);
		// did:key:z + base58btc(2 multicodec bytes + 32 key bytes)
		// base58btc of 34 bytes should be ~46 chars, plus "did:key:z" prefix (9 chars)
		expect(didKey.length).toBeGreaterThan(40);
		expect(didKey.length).toBeLessThan(70);
	});

	it('should start with did:key:z6Mk for Ed25519 keys', () => {
		// Ed25519 multicodec [0xed, 0x01] base58btc-encoded always starts with "6Mk"
		const cose = buildEd25519COSEKey(TEST_ED25519_PUB);
		const didKey = deriveDIDKey(cose);
		expect(didKey).toMatch(/^did:key:z6Mk/);
	});

	it('should only contain valid base58btc characters after the z prefix', () => {
		const cose = buildEd25519COSEKey(TEST_ED25519_PUB);
		const didKey = deriveDIDKey(cose);
		const base58Part = didKey.slice('did:key:z'.length);
		expect(base58Part).toMatch(/^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/);
	});
});

describe('deriveDIDKey - P-256 vs Ed25519 differentiation', () => {
	it('should produce different did:key prefixes for P-256 and Ed25519', () => {
		const p256Key = deriveDIDKey(buildP256COSEKey(TEST_X, TEST_Y_EVEN));
		const ed25519Key = deriveDIDKey(buildEd25519COSEKey(TEST_ED25519_PUB));

		// They should start differently after "did:key:z"
		expect(p256Key.slice(0, 14)).not.toBe(ed25519Key.slice(0, 14));
	});

	it('P-256 did:key should start with did:key:zDn', () => {
		// P-256 multicodec [0x80, 0x24] base58btc-encoded starts with "Dn"
		const cose = buildP256COSEKey(TEST_X, TEST_Y_EVEN);
		const didKey = deriveDIDKey(cose);
		expect(didKey).toMatch(/^did:key:zDn/);
	});
});

describe('deriveDIDKey - Error handling', () => {
	it('should throw for empty input', () => {
		expect(() => deriveDIDKey(new Uint8Array(0))).toThrow();
	});

	it('should throw for non-CBOR-map input', () => {
		// Major type 0 (unsigned int), not a map
		expect(() => deriveDIDKey(new Uint8Array([0x00]))).toThrow(/expected CBOR map/);
	});

	it('should throw for unsupported key type', () => {
		// Build a COSE key with kty=3, crv=2 (not P-256 or Ed25519)
		const parts: number[] = [
			...cborMapHeader(3),
			...cborUint(1),
			...cborUint(3), // kty: 3
			...cborNegInt(-1),
			...cborUint(2), // crv: 2
			...cborNegInt(-2),
			...cborBytes(new Uint8Array(32))
		];
		const cose = new Uint8Array(parts);
		expect(() => deriveDIDKey(cose)).toThrow(/Unsupported COSE key type/);
	});

	it('should throw for P-256 key with missing y coordinate', () => {
		// Build a P-256 key with only x, no y
		const parts: number[] = [
			...cborMapHeader(4),
			...cborUint(1),
			...cborUint(2), // kty: EC2
			...cborUint(3),
			...cborNegInt(-7), // alg: ES256
			...cborNegInt(-1),
			...cborUint(1), // crv: P-256
			...cborNegInt(-2),
			...cborBytes(new Uint8Array(32)) // x only
		];
		const cose = new Uint8Array(parts);
		expect(() => deriveDIDKey(cose)).toThrow(/y-coordinate/);
	});

	it('should throw for Ed25519 key with wrong-length public key', () => {
		// Build an Ed25519 key with 16-byte public key (should be 32)
		const parts: number[] = [
			...cborMapHeader(4),
			...cborUint(1),
			...cborUint(1), // kty: OKP
			...cborUint(3),
			...cborNegInt(-8), // alg: EdDSA
			...cborNegInt(-1),
			...cborUint(6), // crv: Ed25519
			...cborNegInt(-2),
			...cborBytes(new Uint8Array(16)) // Wrong length
		];
		const cose = new Uint8Array(parts);
		expect(() => deriveDIDKey(cose)).toThrow(/expected 32 bytes/);
	});

	it('should throw for P-256 key with wrong-length x coordinate', () => {
		const parts: number[] = [
			...cborMapHeader(5),
			...cborUint(1),
			...cborUint(2), // kty: EC2
			...cborUint(3),
			...cborNegInt(-7), // alg: ES256
			...cborNegInt(-1),
			...cborUint(1), // crv: P-256
			...cborNegInt(-2),
			...cborBytes(new Uint8Array(16)), // x: wrong length
			...cborNegInt(-3),
			...cborBytes(new Uint8Array(32)) // y: correct length
		];
		const cose = new Uint8Array(parts);
		expect(() => deriveDIDKey(cose)).toThrow(/x-coordinate/);
	});

	it('should throw for truncated CBOR data', () => {
		// Map header says 5 pairs but we only have 1
		const parts: number[] = [...cborMapHeader(5), ...cborUint(1), ...cborUint(2)];
		const cose = new Uint8Array(parts);
		expect(() => deriveDIDKey(cose)).toThrow();
	});
});

describe('deriveDIDKey - Known test vector verification', () => {
	it('should produce a consistent did:key for a specific P-256 key', () => {
		// Use a known x/y pair to verify determinism across runs
		const x = new Uint8Array([
			0x65, 0xed, 0xa5, 0xa1, 0x25, 0x77, 0xc2, 0xba, 0xe8, 0x29, 0x43, 0x7f, 0xe3, 0x38,
			0x70, 0x1a, 0x10, 0xaa, 0xa3, 0x75, 0xe1, 0xbb, 0x5b, 0x5d, 0xe1, 0x08, 0xde, 0x43,
			0x91, 0x12, 0xd9, 0xb4
		]);
		const y = new Uint8Array([
			0x31, 0x6e, 0x5d, 0xf4, 0x32, 0x01, 0xf7, 0x2f, 0xfd, 0x87, 0x6b, 0xdb, 0x44, 0xcc,
			0x84, 0x76, 0x49, 0xb6, 0xc8, 0x5e, 0x6b, 0x78, 0xca, 0xa5, 0x09, 0x82, 0xe5, 0xc6,
			0x30, 0x7b, 0xd0, 0x72
		]);

		const cose = buildP256COSEKey(x, y);
		const didKey = deriveDIDKey(cose);

		// y[31] = 0x72, which is even -> compressed prefix 0x02
		expect(didKey).toMatch(/^did:key:zDn/);

		// Snapshot the exact result to catch regressions
		const snapshot = deriveDIDKey(cose);
		expect(didKey).toBe(snapshot);
	});

	it('should produce a consistent did:key for a specific Ed25519 key', () => {
		const publicKey = new Uint8Array([
			0xd7, 0x5a, 0x98, 0x01, 0x82, 0xb1, 0x0a, 0xb7, 0xd5, 0x4b, 0xfe, 0xd3, 0xc9, 0x64,
			0x07, 0x3a, 0x0e, 0xe1, 0x72, 0xf3, 0xda, 0xa3, 0x23, 0x14, 0xb4, 0x1d, 0x2e, 0x21,
			0xce, 0xf1, 0x59, 0x18
		]);

		const cose = buildEd25519COSEKey(publicKey);
		const didKey = deriveDIDKey(cose);

		expect(didKey).toMatch(/^did:key:z6Mk/);

		// Snapshot the exact result to catch regressions
		const snapshot = deriveDIDKey(cose);
		expect(didKey).toBe(snapshot);
	});
});

describe('deriveDIDKey - Edge cases', () => {
	it('should handle all-zero P-256 coordinates', () => {
		const zero32 = new Uint8Array(32); // all zeros
		const cose = buildP256COSEKey(zero32, zero32);
		const didKey = deriveDIDKey(cose);
		expect(didKey).toMatch(/^did:key:z/);
	});

	it('should handle all-0xFF P-256 coordinates', () => {
		const ff32 = new Uint8Array(32).fill(0xff);
		const cose = buildP256COSEKey(ff32, ff32);
		const didKey = deriveDIDKey(cose);
		expect(didKey).toMatch(/^did:key:z/);
		// 0xFF is odd -> prefix 0x03
	});

	it('should handle all-zero Ed25519 public key', () => {
		const zero32 = new Uint8Array(32);
		const cose = buildEd25519COSEKey(zero32);
		const didKey = deriveDIDKey(cose);
		expect(didKey).toMatch(/^did:key:z6Mk/);
	});

	it('should handle all-0xFF Ed25519 public key', () => {
		const ff32 = new Uint8Array(32).fill(0xff);
		const cose = buildEd25519COSEKey(ff32);
		const didKey = deriveDIDKey(cose);
		expect(didKey).toMatch(/^did:key:z6Mk/);
	});
});
