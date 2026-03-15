/**
 * TEE Constituent Resolver Tests
 *
 * Tests the LocalConstituentResolver which decrypts encrypted witness
 * data and extracts constituent PII for CWC delivery.
 *
 * Security properties tested:
 * - Successful decryption returns structured ConstituentData
 * - Missing delivery address returns clear error
 * - Incomplete address (missing required fields) returns clear error
 * - Decryption failure returns clear error (no throw)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDecryptWitness = vi.fn();
vi.mock('$lib/server/witness-decryption', () => ({
	decryptWitness: (...args: unknown[]) => mockDecryptWitness(...args)
}));

import { LocalConstituentResolver } from '$lib/server/tee/local-resolver';

describe('LocalConstituentResolver', () => {
	let resolver: LocalConstituentResolver;

	beforeEach(() => {
		vi.clearAllMocks();
		resolver = new LocalConstituentResolver();
	});

	const ENCRYPTED_REF = {
		ciphertext: 'base64-encrypted-data',
		nonce: 'base64-nonce',
		ephemeralPublicKey: '0xephemeral-public-key'
	};

	const FULL_ADDRESS = {
		name: 'Jane Doe',
		email: 'jane@example.com',
		street: '123 Main St',
		city: 'San Francisco',
		state: 'CA',
		zip: '94102',
		phone: '555-123-4567',
		congressional_district: 'CA-12'
	};

	it('should resolve constituent data from encrypted witness', async () => {
		mockDecryptWitness.mockResolvedValue({ deliveryAddress: FULL_ADDRESS });

		const result = await resolver.resolve(ENCRYPTED_REF);

		expect(result.success).toBe(true);
		expect(result.constituent).toEqual({
			name: 'Jane Doe',
			email: 'jane@example.com',
			phone: '555-123-4567',
			address: {
				street: '123 Main St',
				city: 'San Francisco',
				state: 'CA',
				zip: '94102'
			},
			congressionalDistrict: 'CA-12'
		});
	});

	it('should pass encrypted ref to decryptWitness', async () => {
		mockDecryptWitness.mockResolvedValue({ deliveryAddress: FULL_ADDRESS });

		await resolver.resolve(ENCRYPTED_REF);

		expect(mockDecryptWitness).toHaveBeenCalledWith({
			ciphertext: 'base64-encrypted-data',
			nonce: 'base64-nonce',
			ephemeralPublicKey: '0xephemeral-public-key'
		});
	});

	it('should default name to Constituent when missing', async () => {
		const addr = { ...FULL_ADDRESS, name: undefined };
		mockDecryptWitness.mockResolvedValue({ deliveryAddress: addr });

		const result = await resolver.resolve(ENCRYPTED_REF);

		expect(result.success).toBe(true);
		expect(result.constituent!.name).toBe('Constituent');
	});

	it('should handle optional phone and district', async () => {
		const addr = { ...FULL_ADDRESS, phone: undefined, congressional_district: undefined };
		mockDecryptWitness.mockResolvedValue({ deliveryAddress: addr });

		const result = await resolver.resolve(ENCRYPTED_REF);

		expect(result.success).toBe(true);
		expect(result.constituent!.phone).toBeUndefined();
		expect(result.constituent!.congressionalDistrict).toBeUndefined();
	});

	it('should fail when delivery address is missing', async () => {
		mockDecryptWitness.mockResolvedValue({ deliveryAddress: undefined });

		const result = await resolver.resolve(ENCRYPTED_REF);

		expect(result.success).toBe(false);
		expect(result.error).toContain('No delivery address');
		expect(result.constituent).toBeUndefined();
	});

	it('should fail when street is missing', async () => {
		const addr = { ...FULL_ADDRESS, street: '' };
		mockDecryptWitness.mockResolvedValue({ deliveryAddress: addr });

		const result = await resolver.resolve(ENCRYPTED_REF);

		expect(result.success).toBe(false);
		expect(result.error).toContain('Incomplete delivery address');
	});

	it('should fail when zip is missing', async () => {
		const addr = { ...FULL_ADDRESS, zip: '' };
		mockDecryptWitness.mockResolvedValue({ deliveryAddress: addr });

		const result = await resolver.resolve(ENCRYPTED_REF);

		expect(result.success).toBe(false);
		expect(result.error).toContain('Incomplete delivery address');
	});

	it('should fail when city is missing', async () => {
		const addr = { ...FULL_ADDRESS, city: '' };
		mockDecryptWitness.mockResolvedValue({ deliveryAddress: addr });

		const result = await resolver.resolve(ENCRYPTED_REF);

		expect(result.success).toBe(false);
		expect(result.error).toContain('Incomplete delivery address');
	});

	it('should fail when state is missing', async () => {
		const addr = { ...FULL_ADDRESS, state: '' };
		mockDecryptWitness.mockResolvedValue({ deliveryAddress: addr });

		const result = await resolver.resolve(ENCRYPTED_REF);

		expect(result.success).toBe(false);
		expect(result.error).toContain('Incomplete delivery address');
	});

	it('should catch decryption errors and return failure', async () => {
		mockDecryptWitness.mockRejectedValue(new Error('WITNESS_ENCRYPTION_PRIVATE_KEY not configured'));

		const result = await resolver.resolve(ENCRYPTED_REF);

		expect(result.success).toBe(false);
		expect(result.error).toContain('WITNESS_ENCRYPTION_PRIVATE_KEY');
		expect(result.constituent).toBeUndefined();
	});

	it('should catch non-Error throws and return generic message', async () => {
		mockDecryptWitness.mockRejectedValue('string error');

		const result = await resolver.resolve(ENCRYPTED_REF);

		expect(result.success).toBe(false);
		expect(result.error).toBe('Witness decryption failed');
	});
});
