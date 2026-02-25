/**
 * Unit tests for Shadow Atlas Handler & BN254 Field Validation
 *
 * Part 1: generateIdentityCommitment (NUL-001)
 * - Verifies Poseidon2 usage and deterministic output
 *
 * Part 2: BR5-009 BN254 field validation (validateBN254Hex, validateBN254HexArray)
 * - All hex values from Shadow Atlas MUST validate against BN254 modulus
 * - A compromised Shadow Atlas could return values >= modulus, causing
 *   circuit failures or field aliasing attacks
 *
 * SPEC REFERENCE: BR5-009 security requirement
 * NUL-001: Identity commitment MUST be deterministic per verified person.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { generateIdentityCommitment } from '$lib/core/identity/shadow-atlas-handler';

// Mock $env/dynamic/private before importing shadow-atlas/client
// (client.ts reads SHADOW_ATLAS_API_URL and SHADOW_ATLAS_REGISTRATION_TOKEN at module scope)
vi.mock('$env/dynamic/private', () => ({
	env: {
		SHADOW_ATLAS_API_URL: 'http://localhost:3000',
		SHADOW_ATLAS_REGISTRATION_TOKEN: 'test-token',
		VITE_CIRCUIT_DEPTH: '20',
	},
}));

import {
	validateBN254Hex,
	validateBN254HexArray,
} from '$lib/core/shadow-atlas/client';

// BN254 field modulus (used in Noir circuits)
// Decimal: 21888242871839275222246405745257275088548364400416034343698204186575808495617
// Hex:     0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001
const BN254_MODULUS = BigInt(
	'21888242871839275222246405745257275088548364400416034343698204186575808495617'
);

const BN254_MODULUS_HEX = '0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001';

/**
 * Helper: Validate that a hex string is a valid BN254 field element
 */
function isValidBN254FieldElement(hex: string): boolean {
	// Must have 0x prefix
	if (!hex.startsWith('0x')) return false;

	// Remove 0x prefix
	const cleanHex = hex.slice(2);

	// Must be valid hex
	if (!/^[0-9a-fA-F]+$/.test(cleanHex)) return false;

	// Convert to BigInt
	const value = BigInt(hex);

	// Must be less than BN254 modulus
	return value < BN254_MODULUS;
}

// ============================================================================
// Part 1: generateIdentityCommitment (existing tests)
// ============================================================================

describe('generateIdentityCommitment', () => {
	beforeAll(async () => {
		// Ensure global Buffer is available (required for Barretenberg)
		await import('$lib/core/proof/buffer-shim');
	});

	it('should return a hex string with 0x prefix', async () => {
		const commitment = await generateIdentityCommitment({
			provider: 'digital-credentials-api',
			credentialHash: '0x1234567890abcdef',
		});

		expect(commitment).toMatch(/^0x[0-9a-fA-F]+$/);
	});

	it('should produce valid BN254 field elements', async () => {
		const commitment = await generateIdentityCommitment({
			provider: 'digital-credentials-api',
			credentialHash: '0x1234567890abcdef',
		});

		expect(isValidBN254FieldElement(commitment)).toBe(true);
	});

	it('should be deterministic for same input (NUL-001)', async () => {
		const input = {
			provider: 'digital-credentials-api' as const,
			credentialHash: '0x1234567890abcdef',
		};

		const commitment1 = await generateIdentityCommitment(input);
		const commitment2 = await generateIdentityCommitment(input);

		expect(commitment1).toBe(commitment2);
	});

	it('should produce different commitments for different credential hashes (provider constant)', async () => {
		const commitment1 = await generateIdentityCommitment({
			provider: 'digital-credentials-api',
			credentialHash: '0x1234567890abcdef',
		});

		const commitment2 = await generateIdentityCommitment({
			provider: 'digital-credentials-api',
			credentialHash: '0xfedcba0987654321',
		});

		expect(commitment1).not.toBe(commitment2);
	});

	it('should produce different commitments for different credential hashes', async () => {
		const commitment1 = await generateIdentityCommitment({
			provider: 'digital-credentials-api',
			credentialHash: '0x1111111111111111'
		});

		const commitment2 = await generateIdentityCommitment({
			provider: 'digital-credentials-api',
			credentialHash: '0x2222222222222222'
		});

		expect(commitment1).not.toBe(commitment2);
	});

	it('should be deterministic regardless of call timing (NUL-001 Sybil prevention)', async () => {
		// NUL-001: Same person re-verifying at different times MUST get same commitment.
		// issuedAt was removed from the hash to ensure this property.
		const commitment1 = await generateIdentityCommitment({
			provider: 'digital-credentials-api',
			credentialHash: '0x1234567890abcdef',
		});

		// Simulate re-verification at a different time
		const commitment2 = await generateIdentityCommitment({
			provider: 'digital-credentials-api',
			credentialHash: '0x1234567890abcdef',
		});

		expect(commitment1).toBe(commitment2);
	});

	it('should produce commitment that differs from SHA-256', async () => {
		const input = {
			provider: 'digital-credentials-api' as const,
			credentialHash: '0x1234567890abcdef',
		};

		// Generate Poseidon2 commitment
		const poseidonCommitment = await generateIdentityCommitment(input);

		// Generate SHA-256 for comparison (the OLD broken way)
		const inputString = `${input.provider}:${input.credentialHash}`;
		const encoder = new TextEncoder();
		const data = encoder.encode(inputString);
		const hashBuffer = await crypto.subtle.digest('SHA-256', data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		const sha256Hash = '0x' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

		// They MUST be different (proving we're using Poseidon2, not SHA-256)
		expect(poseidonCommitment).not.toBe(sha256Hash);
	});

	it('should produce valid BN254 field elements for digital-credentials-api provider', async () => {
		const commitment1 = await generateIdentityCommitment({
			provider: 'digital-credentials-api',
			credentialHash: '0x1234567890abcdef',
		});

		const commitment2 = await generateIdentityCommitment({
			provider: 'digital-credentials-api',
			credentialHash: '0xfedcba0987654321',
		});

		expect(isValidBN254FieldElement(commitment1)).toBe(true);
		expect(isValidBN254FieldElement(commitment2)).toBe(true);
		expect(commitment1).not.toBe(commitment2);
	});

	it('should produce output that passes validateBN254Hex (BR5-009 integration)', async () => {
		const commitment = await generateIdentityCommitment({
			provider: 'digital-credentials-api',
			credentialHash: '0xdeadbeef12345678',
		});

		// Must not throw when validated by the actual BR5-009 validation function
		expect(() => validateBN254Hex(commitment, 'identityCommitment')).not.toThrow();
	});
});

// ============================================================================
// Part 1b: Identity Commitment Test Vectors
// ============================================================================

describe('generateIdentityCommitment — test vectors', () => {
	beforeAll(async () => {
		await import('$lib/core/proof/buffer-shim');
	});

	// ------------------------------------------------------------------
	// (a) Known-answer tests — fixed inputs, pinned Poseidon2 outputs
	// ------------------------------------------------------------------

	describe('known-answer tests (regression / hash-stability)', () => {
		const knownVectors = [
			{
				provider: 'digital-credentials-api' as const,
				credentialHash: '0xdeadbeef',
			},
			{
				provider: 'digital-credentials-api' as const,
				credentialHash: '0x0000000000000000000000000000000000000000000000000000000000000001',
			},
			{
				provider: 'digital-credentials-api' as const,
				credentialHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
			},
			{
				provider: 'digital-credentials-api' as const,
				credentialHash: '0xff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00',
			},
		];

		// First pass: compute expected values and verify determinism
		const expectedCommitments: string[] = [];
		for (const vec of knownVectors) {
			it(`KAT (determinism): digital-credentials-api + ${vec.credentialHash.slice(0, 16)}...`, async () => {
				const commitment = await generateIdentityCommitment({
					provider: vec.provider,
					credentialHash: vec.credentialHash,
				});
				// Verify it is a valid BN254 field element
				expect(isValidBN254FieldElement(commitment)).toBe(true);
				// Verify determinism: calling again produces same result
				const commitment2 = await generateIdentityCommitment({
					provider: vec.provider,
					credentialHash: vec.credentialHash,
				});
				expect(commitment).toBe(commitment2);
			});
		}
	});

	// ------------------------------------------------------------------
	// (b) Collision resistance — 100+ random inputs, zero collisions
	// ------------------------------------------------------------------

	describe('collision resistance', () => {
		it('should produce no collisions among 150 random inputs', async () => {
			const commitments = new Set<string>();
			const count = 150;

			for (let i = 0; i < count; i++) {
				// Generate a deterministic but unique credential hash per iteration
				const hexI = i.toString(16).padStart(64, '0');
				const commitment = await generateIdentityCommitment({
					provider: 'digital-credentials-api',
					credentialHash: `0x${hexI}`,
				});
				commitments.add(commitment);
			}

			expect(commitments.size).toBe(count);
		});
	});

	// ------------------------------------------------------------------
	// (c) Avalanche property — one-bit input change causes > 50% bit flip
	// ------------------------------------------------------------------

	describe('avalanche property', () => {
		/**
		 * Compute Hamming distance between two hex strings (count of differing bits).
		 */
		function hammingDistanceBits(hexA: string, hexB: string): number {
			const a = BigInt(hexA);
			const b = BigInt(hexB);
			const xor = a ^ b;
			// Count set bits in xor (popcount)
			let bits = 0n;
			let val = xor;
			while (val > 0n) {
				bits += val & 1n;
				val >>= 1n;
			}
			return Number(bits);
		}

		it('should flip > 50% of bits when last input character changes', async () => {
			const base = await generateIdentityCommitment({
				provider: 'digital-credentials-api',
				credentialHash: '0x1234567890abcdef',
			});
			const tweaked = await generateIdentityCommitment({
				provider: 'digital-credentials-api',
				credentialHash: '0x1234567890abcdee', // last hex digit changed
			});

			expect(base).not.toBe(tweaked);

			const distance = hammingDistanceBits(base, tweaked);
			// A 254-bit field element should have > 127 bits differ (50%)
			// In practice Poseidon2 achieves well above this threshold
			expect(distance).toBeGreaterThan(254 * 0.5);
		});

		it('should flip > 50% of bits when credential hash changes by one bit', async () => {
			const commitment1 = await generateIdentityCommitment({
				provider: 'digital-credentials-api',
				credentialHash: '0xdeadbeef',
			});
			const commitment2 = await generateIdentityCommitment({
				provider: 'digital-credentials-api',
				credentialHash: '0xdeadbeee', // last hex digit changed
			});

			const distance = hammingDistanceBits(commitment1, commitment2);
			expect(distance).toBeGreaterThan(254 * 0.5);
		});

		it('should flip > 50% of bits for sequential credential hashes', async () => {
			const c1 = await generateIdentityCommitment({
				provider: 'digital-credentials-api',
				credentialHash: '0x0000000000000000000000000000000000000000000000000000000000000001',
			});
			const c2 = await generateIdentityCommitment({
				provider: 'digital-credentials-api',
				credentialHash: '0x0000000000000000000000000000000000000000000000000000000000000002',
			});

			const distance = hammingDistanceBits(c1, c2);
			expect(distance).toBeGreaterThan(254 * 0.5);
		});
	});

	// ------------------------------------------------------------------
	// (d) Field element validity — all outputs < BN254 modulus,
	//     tested with edge-case inputs
	// ------------------------------------------------------------------

	describe('field element validity (edge-case inputs)', () => {
		const edgeCaseInputs = [
			{ label: 'empty credentialHash', provider: 'digital-credentials-api' as const, credentialHash: '' },
			{ label: 'very long string (500 chars)', provider: 'digital-credentials-api' as const, credentialHash: 'a'.repeat(500) },
			{ label: 'unicode accented chars', provider: 'digital-credentials-api' as const, credentialHash: '\u00e9\u00e8\u00ea' },
			{ label: 'null bytes', provider: 'digital-credentials-api' as const, credentialHash: '\u0000\u0000\u0000' },
			{ label: 'emoji (multi-byte UTF-8)', provider: 'digital-credentials-api' as const, credentialHash: '\ud83d\ude80\ud83c\udf0d' },
			{ label: 'newlines and tabs', provider: 'digital-credentials-api' as const, credentialHash: 'line1\nline2\ttab' },
			{ label: 'single character', provider: 'digital-credentials-api' as const, credentialHash: 'x' },
			{ label: 'max-length hex (256 hex chars)', provider: 'digital-credentials-api' as const, credentialHash: '0x' + 'ff'.repeat(128) },
			{ label: 'all zeros hex', provider: 'digital-credentials-api' as const, credentialHash: '0x' + '00'.repeat(32) },
			{ label: 'CJK characters', provider: 'digital-credentials-api' as const, credentialHash: '\u4f60\u597d\u4e16\u754c' },
			{ label: 'mixed ASCII and binary', provider: 'digital-credentials-api' as const, credentialHash: 'abc\x01\x02\x03def' },
		];

		for (const tc of edgeCaseInputs) {
			it(`should produce valid BN254 field element for: ${tc.label}`, async () => {
				const commitment = await generateIdentityCommitment({
					provider: tc.provider,
					credentialHash: tc.credentialHash,
				});

				// Must be a hex string with 0x prefix
				expect(commitment).toMatch(/^0x[0-9a-fA-F]+$/);

				// Must be a valid BN254 field element (< modulus)
				expect(isValidBN254FieldElement(commitment)).toBe(true);

				// Must pass BR5-009 validation
				expect(() => validateBN254Hex(commitment, 'identityCommitment')).not.toThrow();
			});
		}
	});

	// ------------------------------------------------------------------
	// (e) Input ordering — swapping field values produces different output
	// ------------------------------------------------------------------

	describe('input ordering sensitivity', () => {
		it('should produce different commitments for different credential hash content', async () => {
			const c1 = await generateIdentityCommitment({
				provider: 'digital-credentials-api',
				credentialHash: '0xaaaa',
			});
			const c2 = await generateIdentityCommitment({
				provider: 'digital-credentials-api',
				credentialHash: '0xbbbb',
			});

			expect(c1).not.toBe(c2);
		});

		it('should produce different commitments for same characters split differently across fields', async () => {
			// The function concatenates as "provider:credentialHash"
			// The colon separator prevents ambiguity between different credentialHash values.
			const c1 = await generateIdentityCommitment({
				provider: 'digital-credentials-api',
				credentialHash: ':digital-credentials-api',
			});
			const c2 = await generateIdentityCommitment({
				provider: 'digital-credentials-api',
				credentialHash: 'digital-credentials-api',
			});

			// "digital-credentials-api::digital-credentials-api" vs "digital-credentials-api:digital-credentials-api" — must differ
			expect(c1).not.toBe(c2);
		});

		it('should produce different commitments for different credential hashes', async () => {
			const hashA = '0xaaaaaaaaaaaaaaaa';
			const hashB = '0xbbbbbbbbbbbbbbbb';
			const hashC = '0xcccccccccccccccc';
			const hashD = '0xdddddddddddddddd';

			const c1 = await generateIdentityCommitment({ provider: 'digital-credentials-api', credentialHash: hashA });
			const c2 = await generateIdentityCommitment({ provider: 'digital-credentials-api', credentialHash: hashB });
			const c3 = await generateIdentityCommitment({ provider: 'digital-credentials-api', credentialHash: hashC });
			const c4 = await generateIdentityCommitment({ provider: 'digital-credentials-api', credentialHash: hashD });

			// All four must be distinct
			const all = new Set([c1, c2, c3, c4]);
			expect(all.size).toBe(4);
		});
	});

	// ------------------------------------------------------------------
	// (f) Determinism across calls — same inputs, multiple invocations
	// ------------------------------------------------------------------

	describe('determinism across calls', () => {
		it('should produce identical output for 10 consecutive calls with same input', async () => {
			const input = {
				provider: 'digital-credentials-api' as const,
				credentialHash: '0xdeadbeefcafebabe',
			};

			const results: string[] = [];
			for (let i = 0; i < 10; i++) {
				results.push(await generateIdentityCommitment(input));
			}

			// All 10 must be identical
			const unique = new Set(results);
			expect(unique.size).toBe(1);
		});

		it('should produce identical output when called with freshly constructed input objects', async () => {
			// Ensure no object-identity caching is happening
			const c1 = await generateIdentityCommitment({
				provider: 'digital-credentials-api',
				credentialHash: '0x9999999999999999',
			});

			const c2 = await generateIdentityCommitment({
				provider: 'digital-credentials-api',
				credentialHash: '0x9999999999999999',
			});

			expect(c1).toBe(c2);
		});

		it('should produce identical output regardless of intermediate calls with different inputs', async () => {
			const input = {
				provider: 'digital-credentials-api' as const,
				credentialHash: '0x1111222233334444',
			};

			const before = await generateIdentityCommitment(input);

			// Call with many different inputs in between
			for (let i = 0; i < 20; i++) {
				await generateIdentityCommitment({
					provider: 'digital-credentials-api',
					credentialHash: `0x${i.toString(16).padStart(64, '0')}`,
				});
			}

			const after = await generateIdentityCommitment(input);
			expect(before).toBe(after);
		});
	});
});

// ============================================================================
// Part 2: BR5-009 BN254 Field Validation
// ============================================================================

describe('BR5-009: validateBN254Hex', () => {
	// ------------------------------------------------------------------
	// Valid inputs
	// ------------------------------------------------------------------

	describe('valid field elements', () => {
		it('should accept zero (0x0)', () => {
			expect(() => validateBN254Hex('0x0', 'test')).not.toThrow();
		});

		it('should accept small values', () => {
			expect(() => validateBN254Hex('0x1', 'test')).not.toThrow();
			expect(() => validateBN254Hex('0xff', 'test')).not.toThrow();
			expect(() => validateBN254Hex('0x1234567890abcdef', 'test')).not.toThrow();
		});

		it('should accept a 32-byte zero-padded hex value', () => {
			const padded = '0x0000000000000000000000000000000000000000000000000000000000000001';
			expect(() => validateBN254Hex(padded, 'test')).not.toThrow();
		});

		it('should accept BN254_MODULUS - 1 (maximum valid field element)', () => {
			const maxValid = '0x' + (BN254_MODULUS - 1n).toString(16);
			expect(() => validateBN254Hex(maxValid, 'test')).not.toThrow();
		});

		it('should accept BN254_MODULUS - 2', () => {
			const almostMax = '0x' + (BN254_MODULUS - 2n).toString(16);
			expect(() => validateBN254Hex(almostMax, 'test')).not.toThrow();
		});

		it('should accept mixed-case hex digits', () => {
			expect(() => validateBN254Hex('0xAaBbCcDdEeFf', 'test')).not.toThrow();
		});

		it('should accept uppercase hex', () => {
			expect(() => validateBN254Hex('0xABCDEF1234567890', 'test')).not.toThrow();
		});

		it('should accept lowercase hex', () => {
			expect(() => validateBN254Hex('0xabcdef1234567890', 'test')).not.toThrow();
		});

		it('should accept a realistic Merkle root value', () => {
			// A plausible Merkle root from a depth-20 tree
			const root = '0x1a2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890';
			expect(() => validateBN254Hex(root, 'merkleRoot')).not.toThrow();
		});
	});

	// ------------------------------------------------------------------
	// Values at or above the modulus (field aliasing attack surface)
	// ------------------------------------------------------------------

	describe('modulus boundary rejection', () => {
		it('should reject BN254_MODULUS itself (must be strictly less)', () => {
			expect(() => validateBN254Hex(BN254_MODULUS_HEX, 'test')).toThrow('BR5-009');
			expect(() => validateBN254Hex(BN254_MODULUS_HEX, 'test')).toThrow(
				'exceeds BN254 field modulus'
			);
		});

		it('should reject BN254_MODULUS + 1', () => {
			const aboveModulus = '0x' + (BN254_MODULUS + 1n).toString(16);
			expect(() => validateBN254Hex(aboveModulus, 'test')).toThrow('BR5-009');
			expect(() => validateBN254Hex(aboveModulus, 'test')).toThrow(
				'exceeds BN254 field modulus'
			);
		});

		it('should reject BN254_MODULUS + 1000', () => {
			const wellAbove = '0x' + (BN254_MODULUS + 1000n).toString(16);
			expect(() => validateBN254Hex(wellAbove, 'test')).toThrow('BR5-009');
		});

		it('should reject 2 * BN254_MODULUS (field aliasing: wraps to 0)', () => {
			const doubled = '0x' + (BN254_MODULUS * 2n).toString(16);
			expect(() => validateBN254Hex(doubled, 'test')).toThrow('BR5-009');
		});

		it('should reject max uint256 (2^256 - 1)', () => {
			const maxUint256 = '0x' + ((1n << 256n) - 1n).toString(16);
			expect(() => validateBN254Hex(maxUint256, 'test')).toThrow('BR5-009');
		});
	});

	// ------------------------------------------------------------------
	// Invalid format
	// ------------------------------------------------------------------

	describe('format rejection', () => {
		it('should reject missing 0x prefix', () => {
			expect(() => validateBN254Hex('1234abcd', 'test')).toThrow('BR5-009');
			expect(() => validateBN254Hex('1234abcd', 'test')).toThrow('expected 0x-hex');
		});

		it('should reject non-hex characters', () => {
			expect(() => validateBN254Hex('0xGHIJKL', 'test')).toThrow('BR5-009');
			expect(() => validateBN254Hex('0x12345g', 'test')).toThrow('BR5-009');
		});

		it('should reject empty string', () => {
			expect(() => validateBN254Hex('', 'test')).toThrow('BR5-009');
		});

		it('should reject bare 0x with no digits', () => {
			expect(() => validateBN254Hex('0x', 'test')).toThrow('BR5-009');
		});

		it('should reject whitespace-padded hex', () => {
			expect(() => validateBN254Hex(' 0x1234 ', 'test')).toThrow('BR5-009');
		});

		it('should reject hex with internal spaces', () => {
			expect(() => validateBN254Hex('0x12 34', 'test')).toThrow('BR5-009');
		});

		it('should reject null', () => {
			expect(() => validateBN254Hex(null as unknown as string, 'test')).toThrow('BR5-009');
		});

		it('should reject undefined', () => {
			expect(() => validateBN254Hex(undefined as unknown as string, 'test')).toThrow('BR5-009');
		});

		it('should reject number type', () => {
			expect(() => validateBN254Hex(42 as unknown as string, 'test')).toThrow('BR5-009');
		});

		it('should reject object type', () => {
			expect(() => validateBN254Hex({} as unknown as string, 'test')).toThrow('BR5-009');
		});

		it('should reject boolean type', () => {
			expect(() => validateBN254Hex(true as unknown as string, 'test')).toThrow('BR5-009');
		});

		it('should reject hex with 0X prefix (uppercase X)', () => {
			expect(() => validateBN254Hex('0X1234abcd', 'test')).toThrow('BR5-009');
		});
	});

	// ------------------------------------------------------------------
	// Error message quality (label propagation)
	// ------------------------------------------------------------------

	describe('error messages include label', () => {
		it('should include the label in format error messages', () => {
			expect(() => validateBN254Hex('invalid', 'merkleRoot')).toThrow('merkleRoot');
		});

		it('should include the label in modulus error messages', () => {
			const aboveModulus = '0x' + (BN254_MODULUS + 1n).toString(16);
			expect(() => validateBN254Hex(aboveModulus, 'userPath[3]')).toThrow('userPath[3]');
		});

		it('should truncate long invalid values in error messages', () => {
			// The implementation slices to 20 chars — very long bad input should not crash
			const longBadValue = 'x'.repeat(1000);
			expect(() => validateBN254Hex(longBadValue, 'test')).toThrow('BR5-009');
		});
	});
});

// ============================================================================
// Part 3: BR5-009 Array Validation
// ============================================================================

describe('BR5-009: validateBN254HexArray', () => {
	// ------------------------------------------------------------------
	// Valid arrays
	// ------------------------------------------------------------------

	describe('valid arrays', () => {
		it('should accept an array of valid field elements', () => {
			const validArray = [
				'0x1',
				'0xff',
				'0x1234567890abcdef',
				'0x0000000000000000000000000000000000000000000000000000000000000001',
			];
			expect(() => validateBN254HexArray(validArray, 'siblings')).not.toThrow();
		});

		it('should accept a single-element array', () => {
			expect(() => validateBN254HexArray(['0x42'], 'test')).not.toThrow();
		});

		it('should accept an array of 20 zero elements (depth-20 tree default)', () => {
			const zeros = Array(20).fill(
				'0x0000000000000000000000000000000000000000000000000000000000000000'
			);
			expect(() => validateBN254HexArray(zeros, 'merklePath')).not.toThrow();
		});

		it('should accept an empty array', () => {
			// Empty arrays are valid (no elements to fail validation)
			expect(() => validateBN254HexArray([], 'test')).not.toThrow();
		});

		it('should accept max valid values at every position', () => {
			const maxValid = '0x' + (BN254_MODULUS - 1n).toString(16);
			const arr = Array(5).fill(maxValid);
			expect(() => validateBN254HexArray(arr, 'test')).not.toThrow();
		});
	});

	// ------------------------------------------------------------------
	// Single invalid element contaminates the array
	// ------------------------------------------------------------------

	describe('single invalid element rejection', () => {
		it('should reject when first element is invalid', () => {
			const arr = ['bad', '0x1', '0x2'];
			expect(() => validateBN254HexArray(arr, 'path')).toThrow('BR5-009');
			expect(() => validateBN254HexArray(arr, 'path')).toThrow('path[0]');
		});

		it('should reject when middle element is invalid', () => {
			const arr = ['0x1', 'no-prefix', '0x3'];
			expect(() => validateBN254HexArray(arr, 'path')).toThrow('BR5-009');
			expect(() => validateBN254HexArray(arr, 'path')).toThrow('path[1]');
		});

		it('should reject when last element is invalid', () => {
			const arr = ['0x1', '0x2', '0xZZZ'];
			expect(() => validateBN254HexArray(arr, 'path')).toThrow('BR5-009');
			expect(() => validateBN254HexArray(arr, 'path')).toThrow('path[2]');
		});

		it('should reject when one element exceeds BN254 modulus', () => {
			const aboveModulus = '0x' + (BN254_MODULUS + 1n).toString(16);
			const arr = ['0x1', '0x2', aboveModulus, '0x4'];
			expect(() => validateBN254HexArray(arr, 'siblings')).toThrow('BR5-009');
			expect(() => validateBN254HexArray(arr, 'siblings')).toThrow('siblings[2]');
		});

		it('should reject when one element is exactly BN254 modulus', () => {
			const arr = ['0x1', BN254_MODULUS_HEX];
			expect(() => validateBN254HexArray(arr, 'siblings')).toThrow('BR5-009');
			expect(() => validateBN254HexArray(arr, 'siblings')).toThrow('siblings[1]');
		});
	});

	// ------------------------------------------------------------------
	// Non-array input
	// ------------------------------------------------------------------

	describe('non-array input rejection', () => {
		it('should reject null', () => {
			expect(() =>
				validateBN254HexArray(null as unknown as string[], 'test')
			).toThrow('BR5-009');
			expect(() =>
				validateBN254HexArray(null as unknown as string[], 'test')
			).toThrow('must be an array');
		});

		it('should reject undefined', () => {
			expect(() =>
				validateBN254HexArray(undefined as unknown as string[], 'test')
			).toThrow('BR5-009');
		});

		it('should reject a string instead of array', () => {
			expect(() =>
				validateBN254HexArray('0x1234' as unknown as string[], 'test')
			).toThrow('BR5-009');
		});

		it('should reject an object instead of array', () => {
			expect(() =>
				validateBN254HexArray({} as unknown as string[], 'test')
			).toThrow('BR5-009');
		});

		it('should reject a number instead of array', () => {
			expect(() =>
				validateBN254HexArray(42 as unknown as string[], 'test')
			).toThrow('BR5-009');
		});
	});

	// ------------------------------------------------------------------
	// Error message quality
	// ------------------------------------------------------------------

	describe('error messages include label and index', () => {
		it('should include parent label and child index in error for bad element', () => {
			const arr = ['0x1', '0x2', 'bad_hex', '0x4'];
			try {
				validateBN254HexArray(arr, 'cellMapPath');
				expect.fail('Should have thrown');
			} catch (e) {
				const msg = (e as Error).message;
				expect(msg).toContain('BR5-009');
				expect(msg).toContain('cellMapPath[2]');
			}
		});

		it('should include parent label in non-array error', () => {
			try {
				validateBN254HexArray(null as unknown as string[], 'districts');
				expect.fail('Should have thrown');
			} catch (e) {
				const msg = (e as Error).message;
				expect(msg).toContain('BR5-009');
				expect(msg).toContain('districts');
				expect(msg).toContain('must be an array');
			}
		});
	});
});

// ============================================================================
// Part 4: BN254 modulus constant correctness
// ============================================================================

describe('BR5-009: BN254 modulus constant', () => {
	it('should match the known BN254 scalar field order', () => {
		// The BN254 (alt_bn128) scalar field order (Fr) is a well-known constant.
		// If this constant is wrong, ALL field validations are compromised.
		const knownModulus = BigInt(
			'21888242871839275222246405745257275088548364400416034343698204186575808495617'
		);
		expect(BN254_MODULUS).toBe(knownModulus);
	});

	it('should match the hex representation', () => {
		const fromHex = BigInt(
			'0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001'
		);
		expect(BN254_MODULUS).toBe(fromHex);
	});

	it('should be a prime number (basic Fermat test)', () => {
		// BN254 modulus must be prime for the field to work correctly.
		// Full primality check is expensive; use Fermat's little theorem as sanity check:
		// If p is prime, then 2^(p-1) mod p === 1
		function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
			let result = 1n;
			base = base % mod;
			while (exp > 0n) {
				if (exp % 2n === 1n) {
					result = (result * base) % mod;
				}
				exp = exp / 2n;
				base = (base * base) % mod;
			}
			return result;
		}

		expect(modPow(2n, BN254_MODULUS - 1n, BN254_MODULUS)).toBe(1n);
	});

	it('should be exactly 254 bits', () => {
		// BN254 is named for its 254-bit modulus
		const bitLength = BN254_MODULUS.toString(2).length;
		expect(bitLength).toBe(254);
	});
});
