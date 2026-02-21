/**
 * Submission Handler Security Tests
 *
 * Tests nullifier deduplication, pseudonymous ID computation,
 * and core submission flow in handleSubmission().
 *
 * Security properties tested:
 * - Duplicate nullifier rejection (prevents double-actions)
 * - Pseudonymous ID computation (identity unlinkability)
 * - Correct field mapping to database (proof data integrity)
 * - Async blockchain queue (doesn't block response)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all external dependencies before importing the module under test.
// These mocks intercept $lib and $env paths resolved by vitest's sveltekit plugin.

const mockFindFirst = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();

vi.mock('$lib/core/db', () => ({
	prisma: {
		submission: {
			findFirst: (...args: unknown[]) => mockFindFirst(...args),
			create: (...args: unknown[]) => mockCreate(...args),
			update: (...args: unknown[]) => mockUpdate(...args)
		}
	}
}));

vi.mock('$lib/core/blockchain/district-gate-client', () => ({
	verifyOnChain: vi.fn().mockResolvedValue({ success: true, txHash: '0xabc123' }),
	PUBLIC_INPUT_INDEX: {
		USER_ROOT: 0,
		CELL_MAP_ROOT: 1,
		NULLIFIER: 26,
		ACTION_DOMAIN: 27,
		AUTHORITY_LEVEL: 28
	},
	THREE_TREE_PUBLIC_INPUT_COUNT: 31
}));

vi.mock('$lib/core/blockchain/submission-retry-queue', () => ({
	queueForRetry: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('$lib/core/privacy/pseudonymous-id', () => ({
	computePseudonymousId: vi.fn((userId: string) => `pseudo-${userId}`)
}));

import { handleSubmission, type SubmissionRequest } from '$lib/core/congressional/submission-handler';
import { computePseudonymousId } from '$lib/core/privacy/pseudonymous-id';

/**
 * Build a valid 31-element public inputs array.
 * Index 26 = nullifier, 27 = actionDomain, 28 = authorityLevel.
 */
function buildPublicInputs(nullifier: string, actionDomain = '0xdomain'): string[] {
	const inputs = new Array(31).fill('0x0');
	inputs[26] = nullifier;
	inputs[27] = actionDomain;
	inputs[28] = '3'; // authority level
	return inputs;
}

function makeRequest(overrides: Partial<SubmissionRequest> = {}): SubmissionRequest {
	return {
		proof: '0xdeadbeef',
		publicInputs: buildPublicInputs('0xnullifier_abc'),
		verifierDepth: 20,
		encryptedMessage: 'encrypted-content',
		templateId: 'template-001',
		districtId: 'CA-12',
		...overrides
	};
}

describe('handleSubmission', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Default: no existing nullifier, successful create
		mockFindFirst.mockResolvedValue(null);
		mockCreate.mockResolvedValue({ id: 'sub-123' });
		mockUpdate.mockResolvedValue({});
	});

	// =========================================================================
	// Nullifier deduplication (security-critical)
	// =========================================================================

	describe('nullifier deduplication', () => {
		it('should reject submission with duplicate nullifier', async () => {
			// Simulate an existing submission with the same nullifier
			mockFindFirst.mockResolvedValue({ id: 'existing-sub', nullifier: '0xnullifier_abc' });

			const request = makeRequest();

			await expect(handleSubmission('user-1', request)).rejects.toThrow('NULLIFIER_ALREADY_USED');

			// Should NOT have attempted to create a new submission
			expect(mockCreate).not.toHaveBeenCalled();
		});

		it('should check the correct nullifier index (26) from public inputs', async () => {
			const request = makeRequest({
				publicInputs: buildPublicInputs('0xspecific_nullifier_value')
			});

			await handleSubmission('user-1', request);

			// findFirst should have been called with the nullifier at index 26
			expect(mockFindFirst).toHaveBeenCalledWith({
				where: { nullifier: '0xspecific_nullifier_value' }
			});
		});

		it('should allow submission with unique nullifier', async () => {
			mockFindFirst.mockResolvedValue(null); // No existing submission

			const request = makeRequest();
			const result = await handleSubmission('user-1', request);

			expect(result.status).toBe('pending');
			expect(result.submissionId).toBe('sub-123');
			expect(result.nullifier).toBe('0xnullifier_abc');
		});

		it('should include the nullifier in the response', async () => {
			const request = makeRequest({
				publicInputs: buildPublicInputs('0xunique_nullifier_xyz')
			});

			const result = await handleSubmission('user-1', request);

			expect(result.nullifier).toBe('0xunique_nullifier_xyz');
		});
	});

	// =========================================================================
	// Pseudonymous ID computation (privacy-critical)
	// =========================================================================

	describe('pseudonymous ID', () => {
		it('should compute pseudonymous ID from userId', async () => {
			const request = makeRequest();

			await handleSubmission('real-user-id-42', request);

			expect(computePseudonymousId).toHaveBeenCalledWith('real-user-id-42');
		});

		it('should store pseudonymous ID (not real userId) in submission', async () => {
			const request = makeRequest();

			await handleSubmission('real-user-id-42', request);

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						pseudonymous_id: 'pseudo-real-user-id-42'
					})
				})
			);
		});

		it('should never store the real userId in the submission record', async () => {
			const request = makeRequest();

			await handleSubmission('secret-user-id', request);

			const createCall = mockCreate.mock.calls[0][0];
			const dataValues = Object.values(createCall.data);

			// The real userId should NOT appear anywhere in the stored data
			expect(dataValues).not.toContain('secret-user-id');
		});
	});

	// =========================================================================
	// Field mapping integrity
	// =========================================================================

	describe('field mapping', () => {
		it('should store proof_hex from request', async () => {
			const request = makeRequest({ proof: '0xfeedface' });

			await handleSubmission('user-1', request);

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						proof_hex: '0xfeedface'
					})
				})
			);
		});

		it('should store all public inputs', async () => {
			const inputs = buildPublicInputs('0xnull');
			const request = makeRequest({ publicInputs: inputs });

			await handleSubmission('user-1', request);

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						public_inputs: inputs
					})
				})
			);
		});

		it('should store encrypted message when provided', async () => {
			const request = makeRequest({ encryptedMessage: 'encrypted-blob' });

			await handleSubmission('user-1', request);

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						encrypted_message: 'encrypted-blob'
					})
				})
			);
		});

		it('should store action domain from public inputs index 27', async () => {
			const inputs = buildPublicInputs('0xnull', '0xaction_domain_value');
			const request = makeRequest({ publicInputs: inputs });

			await handleSubmission('user-1', request);

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						action_id: '0xaction_domain_value'
					})
				})
			);
		});

		it('should set initial delivery_status to pending', async () => {
			const request = makeRequest();

			await handleSubmission('user-1', request);

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						delivery_status: 'pending',
						verification_status: 'pending'
					})
				})
			);
		});
	});

	// =========================================================================
	// Async blockchain queue (non-blocking)
	// =========================================================================

	describe('blockchain queue', () => {
		it('should not block the response on blockchain submission', async () => {
			const request = makeRequest();

			// The function should resolve immediately even though blockchain
			// submission is async
			const result = await handleSubmission('user-1', request);

			expect(result.status).toBe('pending');
			expect(result.submissionId).toBe('sub-123');
		});

		it('should not throw when blockchain queue fails', async () => {
			// The queueBlockchainSubmission catch handler should swallow errors
			mockUpdate.mockRejectedValue(new Error('DB update failed'));

			const request = makeRequest();

			// Should NOT throw even though internal blockchain queue might fail
			const result = await handleSubmission('user-1', request);

			expect(result.status).toBe('pending');
		});
	});
});
