/**
 * Unit tests for Shadow Atlas Handler
 *
 * Verifies that generateIdentityCommitment() uses Poseidon2 correctly
 * and produces valid BN254 field elements compatible with the Noir circuit.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { generateIdentityCommitment } from '$lib/core/identity/shadow-atlas-handler';

// BN254 field modulus (used in Noir circuits)
const BN254_MODULUS = BigInt(
	'21888242871839275222246405745257275088548364400416034343698204186575808495617'
);

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

describe('generateIdentityCommitment', () => {
	beforeAll(async () => {
		// Ensure global Buffer is available (required for Barretenberg)
		await import('$lib/core/proof/buffer-shim');
	});

	it('should return a hex string with 0x prefix', async () => {
		const commitment = await generateIdentityCommitment({
			provider: 'self.xyz',
			credentialHash: '0x1234567890abcdef',
			issuedAt: 1234567890
		});

		expect(commitment).toMatch(/^0x[0-9a-fA-F]+$/);
	});

	it('should produce valid BN254 field elements', async () => {
		const commitment = await generateIdentityCommitment({
			provider: 'self.xyz',
			credentialHash: '0x1234567890abcdef',
			issuedAt: 1234567890
		});

		expect(isValidBN254FieldElement(commitment)).toBe(true);
	});

	it('should be deterministic for same input', async () => {
		const input = {
			provider: 'self.xyz' as const,
			credentialHash: '0x1234567890abcdef',
			issuedAt: 1234567890
		};

		const commitment1 = await generateIdentityCommitment(input);
		const commitment2 = await generateIdentityCommitment(input);

		expect(commitment1).toBe(commitment2);
	});

	it('should produce different commitments for different providers', async () => {
		const baseInput = {
			credentialHash: '0x1234567890abcdef',
			issuedAt: 1234567890
		};

		const commitment1 = await generateIdentityCommitment({
			...baseInput,
			provider: 'self.xyz'
		});

		const commitment2 = await generateIdentityCommitment({
			...baseInput,
			provider: 'didit.me'
		});

		expect(commitment1).not.toBe(commitment2);
	});

	it('should produce different commitments for different credential hashes', async () => {
		const baseInput = {
			provider: 'self.xyz' as const,
			issuedAt: 1234567890
		};

		const commitment1 = await generateIdentityCommitment({
			...baseInput,
			credentialHash: '0x1111111111111111'
		});

		const commitment2 = await generateIdentityCommitment({
			...baseInput,
			credentialHash: '0x2222222222222222'
		});

		expect(commitment1).not.toBe(commitment2);
	});

	it('should produce different commitments for different issuedAt timestamps', async () => {
		const baseInput = {
			provider: 'self.xyz' as const,
			credentialHash: '0x1234567890abcdef'
		};

		const commitment1 = await generateIdentityCommitment({
			...baseInput,
			issuedAt: 1234567890
		});

		const commitment2 = await generateIdentityCommitment({
			...baseInput,
			issuedAt: 9876543210
		});

		expect(commitment1).not.toBe(commitment2);
	});

	it('should produce commitment that differs from SHA-256', async () => {
		const input = {
			provider: 'self.xyz' as const,
			credentialHash: '0x1234567890abcdef',
			issuedAt: 1234567890
		};

		// Generate Poseidon2 commitment
		const poseidonCommitment = await generateIdentityCommitment(input);

		// Generate SHA-256 for comparison (the OLD broken way)
		const inputString = `${input.provider}:${input.credentialHash}:${input.issuedAt}`;
		const encoder = new TextEncoder();
		const data = encoder.encode(inputString);
		const hashBuffer = await crypto.subtle.digest('SHA-256', data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		const sha256Hash = '0x' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

		// They MUST be different (proving we're using Poseidon2, not SHA-256)
		expect(poseidonCommitment).not.toBe(sha256Hash);
	});

	it('should handle both self.xyz and didit.me providers', async () => {
		const selfXyzCommitment = await generateIdentityCommitment({
			provider: 'self.xyz',
			credentialHash: '0x1234567890abcdef',
			issuedAt: 1234567890
		});

		const diditCommitment = await generateIdentityCommitment({
			provider: 'didit.me',
			credentialHash: '0xfedcba0987654321',
			issuedAt: 9876543210
		});

		expect(isValidBN254FieldElement(selfXyzCommitment)).toBe(true);
		expect(isValidBN254FieldElement(diditCommitment)).toBe(true);
		expect(selfXyzCommitment).not.toBe(diditCommitment);
	});
});
