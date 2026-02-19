import { describe, it, expect, vi } from 'vitest';

vi.mock('$lib/core/crypto/poseidon', () => ({
	poseidon2Hash2: vi.fn(async (a: string, b: string) => {
		// Deterministic mock: hash both inputs to produce stable output
		const combined = a + b;
		// Simple deterministic hash for testing
		let hash = 0;
		for (let i = 0; i < combined.length; i++) {
			hash = ((hash << 5) - hash + combined.charCodeAt(i)) & 0xffffffff;
		}
		return '0x' + Math.abs(hash).toString(16).padStart(64, '0');
	})
}));

import { deriveUserSecret, generateUserEntropy } from '$lib/core/identity/user-secret-derivation';
import { poseidon2Hash2 } from '$lib/core/crypto/poseidon';

describe('deriveUserSecret', () => {
	it('should return a hex string', async () => {
		const result = await deriveUserSecret('0xabc123', '0xdef456');
		expect(result).toMatch(/^0x[0-9a-f]+$/);
	});

	it('should be deterministic (same inputs produce same output)', async () => {
		const result1 = await deriveUserSecret('0xabc123', '0xdef456');
		const result2 = await deriveUserSecret('0xabc123', '0xdef456');
		expect(result1).toBe(result2);
	});

	it('should normalize hex inputs by adding 0x prefix', async () => {
		const result1 = await deriveUserSecret('abc', 'def');
		const result2 = await deriveUserSecret('0xabc', '0xdef');

		// Both should call poseidon2Hash2 with 0x-prefixed versions
		expect(result1).toBe(result2);

		// Verify poseidon2Hash2 was called with normalized inputs
		const calls = vi.mocked(poseidon2Hash2).mock.calls;
		const lastTwo = calls.slice(-2);
		// Both calls should have received '0xabc' and '0xdef'
		expect(lastTwo[0]).toEqual(['0xabc', '0xdef']);
		expect(lastTwo[1]).toEqual(['0xabc', '0xdef']);
	});

	it('should throw if identityCommitment is empty string', async () => {
		await expect(deriveUserSecret('', '0xdef456')).rejects.toThrow(
			'Both identityCommitment and userEntropy are required'
		);
	});

	it('should throw if userEntropy is empty string', async () => {
		await expect(deriveUserSecret('0xabc123', '')).rejects.toThrow(
			'Both identityCommitment and userEntropy are required'
		);
	});
});

describe('generateUserEntropy', () => {
	it('should return a string starting with 0x', () => {
		const result = generateUserEntropy();
		expect(result.startsWith('0x')).toBe(true);
	});

	it('should return a 66-character string (0x + 64 hex chars)', () => {
		const result = generateUserEntropy();
		expect(result).toHaveLength(66);
		expect(result).toMatch(/^0x[0-9a-f]{64}$/);
	});

	it('should return unique values per call', () => {
		const result1 = generateUserEntropy();
		const result2 = generateUserEntropy();
		expect(result1).not.toBe(result2);
	});
});
