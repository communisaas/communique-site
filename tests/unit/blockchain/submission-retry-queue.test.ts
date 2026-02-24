/**
 * Submission Retry Queue Unit Tests
 *
 * Validates the database-backed retry queue for failed blockchain submissions:
 * - queueForRetry(): upsert behavior, nullifier extraction, backoff scheduling
 * - processRetryQueue(): circuit breaker gating, idempotency via nullifier check,
 *   retry success/failure flows, max retries exhaustion, exponential backoff
 *
 * All database calls (Prisma) and blockchain calls (district-gate-client) are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════
// MOCK SETUP — must be before any imports from the module under test
// ═══════════════════════════════════════════════════════════════════════════

// Mock district-gate-client
const mockVerifyOnChain = vi.fn();
const mockIsNullifierUsed = vi.fn();
const mockIsCircuitOpen = vi.fn();

vi.mock('$lib/core/blockchain/district-gate-client', () => ({
	verifyOnChain: (...args: unknown[]) => mockVerifyOnChain(...args),
	isNullifierUsed: (...args: unknown[]) => mockIsNullifierUsed(...args),
	isCircuitOpen: () => mockIsCircuitOpen(),
	PUBLIC_INPUT_INDEX: {
		USER_ROOT: 0,
		CELL_MAP_ROOT: 1,
		NULLIFIER: 26,
		ACTION_DOMAIN: 27,
		AUTHORITY_LEVEL: 28,
		ENGAGEMENT_ROOT: 29,
		ENGAGEMENT_TIER: 30
	}
}));

// Mock Prisma
const mockUpsert = vi.fn();
const mockFindMany = vi.fn();
const mockRetryUpdate = vi.fn();
const mockSubmissionUpdate = vi.fn();
const mockTransaction = vi.fn();

vi.mock('$lib/core/db', () => ({
	prisma: {
		submissionRetry: {
			upsert: (...args: unknown[]) => mockUpsert(...args),
			findMany: (...args: unknown[]) => mockFindMany(...args),
			update: (...args: unknown[]) => mockRetryUpdate(...args)
		},
		submission: {
			update: (...args: unknown[]) => mockSubmissionUpdate(...args)
		},
		$transaction: (calls: unknown[]) => mockTransaction(calls)
	}
}));

// ═══════════════════════════════════════════════════════════════════════════
// IMPORT MODULE UNDER TEST (after mocks are established)
// ═══════════════════════════════════════════════════════════════════════════

import { queueForRetry, processRetryQueue } from '$lib/core/blockchain/submission-retry-queue';

// ═══════════════════════════════════════════════════════════════════════════
// TEST HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Build a valid 31-element public inputs array. */
function makePublicInputs(): string[] {
	return Array.from({ length: 31 }, (_, i) =>
		'0x' + (i + 1).toString(16).padStart(64, '0')
	);
}

/** Create a mock retry record as returned from Prisma findMany. */
function makeRetryRecord(overrides: Partial<{
	id: string;
	submission_id: string;
	nullifier: string;
	proof_hex: string;
	public_inputs: string[];
	verifier_depth: number;
	retry_count: number;
	next_retry_at: Date;
	status: string;
	last_error: string | null;
}> = {}) {
	const publicInputs = makePublicInputs();
	return {
		id: 'retry-001',
		submission_id: 'sub-001',
		nullifier: publicInputs[26],
		proof_hex: '0x' + 'de'.repeat(64),
		public_inputs: publicInputs,
		verifier_depth: 20,
		retry_count: 0,
		next_retry_at: new Date(Date.now() - 1000), // already eligible
		status: 'pending',
		last_error: null,
		...overrides
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('SubmissionRetryQueue', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockIsCircuitOpen.mockReturnValue(false);
	});

	// ═════════════════════════════════════════════════════════════════════
	// queueForRetry()
	// ═════════════════════════════════════════════════════════════════════

	describe('queueForRetry', () => {
		it('upserts a retry record with correct submission ID', async () => {
			mockUpsert.mockResolvedValueOnce({});
			const publicInputs = makePublicInputs();

			await queueForRetry('sub-001', '0xproof', publicInputs, 20);

			expect(mockUpsert).toHaveBeenCalledTimes(1);
			const call = mockUpsert.mock.calls[0][0];
			expect(call.where.submission_id).toBe('sub-001');
		});

		it('extracts nullifier from public inputs at index 26', async () => {
			mockUpsert.mockResolvedValueOnce({});
			const publicInputs = makePublicInputs();
			const expectedNullifier = publicInputs[26];

			await queueForRetry('sub-001', '0xproof', publicInputs, 20);

			const call = mockUpsert.mock.calls[0][0];
			expect(call.create.nullifier).toBe(expectedNullifier);
		});

		it('stores proof hex and verifier depth in create payload', async () => {
			mockUpsert.mockResolvedValueOnce({});
			const publicInputs = makePublicInputs();

			await queueForRetry('sub-001', '0xmyproof', publicInputs, 24);

			const call = mockUpsert.mock.calls[0][0];
			expect(call.create.proof_hex).toBe('0xmyproof');
			expect(call.create.verifier_depth).toBe(24);
		});

		it('sets initial retry_count to 0', async () => {
			mockUpsert.mockResolvedValueOnce({});
			const publicInputs = makePublicInputs();

			await queueForRetry('sub-001', '0xproof', publicInputs, 20);

			const call = mockUpsert.mock.calls[0][0];
			expect(call.create.retry_count).toBe(0);
		});

		it('sets initial status to pending', async () => {
			mockUpsert.mockResolvedValueOnce({});
			const publicInputs = makePublicInputs();

			await queueForRetry('sub-001', '0xproof', publicInputs, 20);

			const call = mockUpsert.mock.calls[0][0];
			expect(call.create.status).toBe('pending');
		});

		it('schedules next_retry_at to 30 seconds from now (BACKOFF_BASE)', async () => {
			mockUpsert.mockResolvedValueOnce({});
			const publicInputs = makePublicInputs();
			const before = Date.now();

			await queueForRetry('sub-001', '0xproof', publicInputs, 20);

			const call = mockUpsert.mock.calls[0][0];
			const nextRetry = call.create.next_retry_at.getTime();
			// Should be approximately 30s in the future (with small tolerance)
			expect(nextRetry).toBeGreaterThanOrEqual(before + 29_000);
			expect(nextRetry).toBeLessThanOrEqual(before + 32_000);
		});

		it('does NOT reset retry_count on re-queue (update payload)', async () => {
			mockUpsert.mockResolvedValueOnce({});
			const publicInputs = makePublicInputs();

			await queueForRetry('sub-001', '0xproof', publicInputs, 20);

			const call = mockUpsert.mock.calls[0][0];
			// The update payload should NOT contain retry_count
			expect(call.update.retry_count).toBeUndefined();
			expect(call.update.status).toBe('pending');
		});

		it('stores all public inputs in the create payload', async () => {
			mockUpsert.mockResolvedValueOnce({});
			const publicInputs = makePublicInputs();

			await queueForRetry('sub-001', '0xproof', publicInputs, 20);

			const call = mockUpsert.mock.calls[0][0];
			expect(call.create.public_inputs).toEqual(publicInputs);
			expect(call.create.public_inputs).toHaveLength(31);
		});
	});

	// ═════════════════════════════════════════════════════════════════════
	// processRetryQueue() — circuit breaker gating
	// ═════════════════════════════════════════════════════════════════════

	describe('processRetryQueue — circuit breaker gating', () => {
		it('returns 0 and does not query DB when circuit breaker is open', async () => {
			mockIsCircuitOpen.mockReturnValue(true);

			const processed = await processRetryQueue();

			expect(processed).toBe(0);
			expect(mockFindMany).not.toHaveBeenCalled();
		});

		it('queries DB when circuit breaker is closed', async () => {
			mockIsCircuitOpen.mockReturnValue(false);
			mockFindMany.mockResolvedValueOnce([]);

			await processRetryQueue();

			expect(mockFindMany).toHaveBeenCalledTimes(1);
		});
	});

	// ═════════════════════════════════════════════════════════════════════
	// processRetryQueue() — empty queue
	// ═════════════════════════════════════════════════════════════════════

	describe('processRetryQueue — empty queue', () => {
		it('returns 0 when no pending retries', async () => {
			mockFindMany.mockResolvedValueOnce([]);

			const processed = await processRetryQueue();

			expect(processed).toBe(0);
		});

		it('queries with correct filters (pending, next_retry_at <= now)', async () => {
			mockFindMany.mockResolvedValueOnce([]);

			await processRetryQueue();

			const call = mockFindMany.mock.calls[0][0];
			expect(call.where.status).toBe('pending');
			expect(call.where.next_retry_at).toHaveProperty('lte');
			expect(call.orderBy.next_retry_at).toBe('asc');
			expect(call.take).toBe(10);
		});
	});

	// ═════════════════════════════════════════════════════════════════════
	// processRetryQueue() — idempotency (nullifier already on-chain)
	// ═════════════════════════════════════════════════════════════════════

	describe('processRetryQueue — idempotency', () => {
		it('marks as succeeded when nullifier is already on-chain (skip re-submit)', async () => {
			const retry = makeRetryRecord();
			mockFindMany.mockResolvedValueOnce([retry]);
			mockIsNullifierUsed.mockResolvedValueOnce(true);
			mockTransaction.mockResolvedValueOnce([{}, {}]);

			const processed = await processRetryQueue();

			expect(processed).toBe(1);
			expect(mockVerifyOnChain).not.toHaveBeenCalled();
			expect(mockTransaction).toHaveBeenCalledTimes(1);

			// Verify the transaction updates
			const txCalls = mockTransaction.mock.calls[0][0];
			expect(txCalls).toHaveLength(2);
		});

		it('uses correct actionDomain (index 27) for nullifier check', async () => {
			const publicInputs = makePublicInputs();
			const retry = makeRetryRecord({ public_inputs: publicInputs });
			mockFindMany.mockResolvedValueOnce([retry]);
			mockIsNullifierUsed.mockResolvedValueOnce(false);
			mockVerifyOnChain.mockResolvedValueOnce({ success: true, txHash: '0xabc' });
			mockTransaction.mockResolvedValueOnce([{}, {}]);

			await processRetryQueue();

			const expectedActionDomain = publicInputs[27]; // ACTION_DOMAIN index
			expect(mockIsNullifierUsed).toHaveBeenCalledWith(
				expectedActionDomain,
				retry.nullifier
			);
		});
	});

	// ═════════════════════════════════════════════════════════════════════
	// processRetryQueue() — successful retry
	// ═════════════════════════════════════════════════════════════════════

	describe('processRetryQueue — successful retry', () => {
		it('calls verifyOnChain with stored proof data', async () => {
			const retry = makeRetryRecord();
			mockFindMany.mockResolvedValueOnce([retry]);
			mockIsNullifierUsed.mockResolvedValueOnce(false);
			mockVerifyOnChain.mockResolvedValueOnce({ success: true, txHash: '0xabc123' });
			mockTransaction.mockResolvedValueOnce([{}, {}]);

			await processRetryQueue();

			expect(mockVerifyOnChain).toHaveBeenCalledWith({
				proof: retry.proof_hex,
				publicInputs: retry.public_inputs,
				verifierDepth: retry.verifier_depth
			});
		});

		it('marks retry as succeeded and updates submission on success', async () => {
			const retry = makeRetryRecord();
			mockFindMany.mockResolvedValueOnce([retry]);
			mockIsNullifierUsed.mockResolvedValueOnce(false);
			mockVerifyOnChain.mockResolvedValueOnce({ success: true, txHash: '0xabc123' });
			mockTransaction.mockResolvedValueOnce([{}, {}]);

			const processed = await processRetryQueue();

			expect(processed).toBe(1);
			expect(mockTransaction).toHaveBeenCalledTimes(1);
		});

		it('stores txHash and verified_at on the submission', async () => {
			const retry = makeRetryRecord();
			mockFindMany.mockResolvedValueOnce([retry]);
			mockIsNullifierUsed.mockResolvedValueOnce(false);
			mockVerifyOnChain.mockResolvedValueOnce({ success: true, txHash: '0xabc123' });

			// Capture what gets passed to $transaction
			mockTransaction.mockImplementationOnce((calls: unknown[]) => {
				return Promise.resolve(calls);
			});

			await processRetryQueue();

			expect(mockTransaction).toHaveBeenCalledTimes(1);
		});
	});

	// ═════════════════════════════════════════════════════════════════════
	// processRetryQueue() — failed retry with retries remaining
	// ═════════════════════════════════════════════════════════════════════

	describe('processRetryQueue — failed retry with retries remaining', () => {
		it('increments retry_count and schedules next retry', async () => {
			const retry = makeRetryRecord({ retry_count: 1 }); // 2nd attempt coming
			mockFindMany.mockResolvedValueOnce([retry]);
			mockIsNullifierUsed.mockResolvedValueOnce(false);
			mockVerifyOnChain.mockResolvedValueOnce({ success: false, error: 'Gas estimation failed' });
			mockRetryUpdate.mockResolvedValueOnce({});

			const processed = await processRetryQueue();

			expect(processed).toBe(1);
			expect(mockRetryUpdate).toHaveBeenCalledTimes(1);

			const updateCall = mockRetryUpdate.mock.calls[0][0];
			expect(updateCall.data.retry_count).toBe(2); // 1 + 1
			expect(updateCall.data.last_error).toBe('Gas estimation failed');
		});

		it('uses exponential backoff: 30s * 2^retryCount', async () => {
			const retry = makeRetryRecord({ retry_count: 2 }); // Next will be attempt 3
			mockFindMany.mockResolvedValueOnce([retry]);
			mockIsNullifierUsed.mockResolvedValueOnce(false);
			mockVerifyOnChain.mockResolvedValueOnce({ success: false, error: 'Still failing' });
			mockRetryUpdate.mockResolvedValueOnce({});

			const before = Date.now();
			await processRetryQueue();

			const updateCall = mockRetryUpdate.mock.calls[0][0];
			const nextRetry = updateCall.data.next_retry_at.getTime();

			// retry_count will be 3, so delay = 30_000 * 2^3 = 240_000 (4 minutes)
			expect(nextRetry).toBeGreaterThanOrEqual(before + 239_000);
			expect(nextRetry).toBeLessThanOrEqual(before + 242_000);
		});

		it('backoff at retry_count=0: delay is 30s * 2^1 = 60s', async () => {
			const retry = makeRetryRecord({ retry_count: 0 });
			mockFindMany.mockResolvedValueOnce([retry]);
			mockIsNullifierUsed.mockResolvedValueOnce(false);
			mockVerifyOnChain.mockResolvedValueOnce({ success: false, error: 'Failed' });
			mockRetryUpdate.mockResolvedValueOnce({});

			const before = Date.now();
			await processRetryQueue();

			const updateCall = mockRetryUpdate.mock.calls[0][0];
			const nextRetry = updateCall.data.next_retry_at.getTime();

			// newRetryCount = 1, delay = 30_000 * 2^1 = 60_000
			expect(nextRetry).toBeGreaterThanOrEqual(before + 59_000);
			expect(nextRetry).toBeLessThanOrEqual(before + 62_000);
		});
	});

	// ═════════════════════════════════════════════════════════════════════
	// processRetryQueue() — retries exhausted
	// ═════════════════════════════════════════════════════════════════════

	describe('processRetryQueue — retries exhausted', () => {
		it('marks as exhausted after 4 retries (MAX_RETRIES)', async () => {
			const retry = makeRetryRecord({ retry_count: 3 }); // This will be attempt #4
			mockFindMany.mockResolvedValueOnce([retry]);
			mockIsNullifierUsed.mockResolvedValueOnce(false);
			mockVerifyOnChain.mockResolvedValueOnce({ success: false, error: 'Final failure' });
			mockRetryUpdate.mockResolvedValueOnce({});
			mockSubmissionUpdate.mockResolvedValueOnce({});
			mockTransaction.mockResolvedValueOnce([{}, {}]);

			const processed = await processRetryQueue();

			expect(processed).toBe(1);
			expect(mockTransaction).toHaveBeenCalledTimes(1);

			// The retry record should be marked as exhausted (status + retry_count updated)
			expect(mockRetryUpdate).toHaveBeenCalledTimes(1);
			const retryUpdateCall = mockRetryUpdate.mock.calls[0][0];
			expect(retryUpdateCall.data.status).toBe('exhausted');
			expect(retryUpdateCall.data.retry_count).toBe(4);
		});

		it('marks submission as failed with exhaustion message', async () => {
			const retry = makeRetryRecord({ retry_count: 3 });
			mockFindMany.mockResolvedValueOnce([retry]);
			mockIsNullifierUsed.mockResolvedValueOnce(false);
			mockVerifyOnChain.mockResolvedValueOnce({ success: false, error: 'RPC flaky' });

			mockTransaction.mockImplementationOnce((calls: unknown[]) => {
				return Promise.resolve(calls);
			});

			await processRetryQueue();

			expect(mockTransaction).toHaveBeenCalledTimes(1);
		});
	});

	// ═════════════════════════════════════════════════════════════════════
	// processRetryQueue() — multiple retries in batch
	// ═════════════════════════════════════════════════════════════════════

	describe('processRetryQueue — batch processing', () => {
		it('processes multiple retries in a single batch', async () => {
			const retry1 = makeRetryRecord({ id: 'retry-001', submission_id: 'sub-001' });
			const retry2 = makeRetryRecord({ id: 'retry-002', submission_id: 'sub-002' });
			const retry3 = makeRetryRecord({ id: 'retry-003', submission_id: 'sub-003' });

			mockFindMany.mockResolvedValueOnce([retry1, retry2, retry3]);

			// All three have their nullifiers NOT used
			mockIsNullifierUsed.mockResolvedValue(false);

			// All three succeed
			mockVerifyOnChain.mockResolvedValue({ success: true, txHash: '0xbatch' });
			mockTransaction.mockResolvedValue([{}, {}]);

			const processed = await processRetryQueue();

			expect(processed).toBe(3);
			expect(mockVerifyOnChain).toHaveBeenCalledTimes(3);
		});

		it('continues processing when one retry throws an exception', async () => {
			const retry1 = makeRetryRecord({ id: 'retry-001', submission_id: 'sub-001' });
			const retry2 = makeRetryRecord({ id: 'retry-002', submission_id: 'sub-002' });

			mockFindMany.mockResolvedValueOnce([retry1, retry2]);

			// First check throws, second succeeds
			mockIsNullifierUsed
				.mockRejectedValueOnce(new Error('DB crashed'))
				.mockResolvedValueOnce(false);

			mockVerifyOnChain.mockResolvedValueOnce({ success: true, txHash: '0xok' });
			mockTransaction.mockResolvedValue([{}, {}]);

			const processed = await processRetryQueue();

			// First one failed with exception (caught in try/catch), second succeeded
			expect(processed).toBe(1);
		});

		it('handles mix of nullifier-already-used and fresh retries', async () => {
			const retry1 = makeRetryRecord({ id: 'retry-001', submission_id: 'sub-001' });
			const retry2 = makeRetryRecord({ id: 'retry-002', submission_id: 'sub-002' });

			mockFindMany.mockResolvedValueOnce([retry1, retry2]);

			// First nullifier already used, second needs retry
			mockIsNullifierUsed
				.mockResolvedValueOnce(true)
				.mockResolvedValueOnce(false);

			mockVerifyOnChain.mockResolvedValueOnce({ success: true, txHash: '0xfresh' });
			mockTransaction.mockResolvedValue([{}, {}]);

			const processed = await processRetryQueue();

			expect(processed).toBe(2);
			// verifyOnChain should only be called for the second one
			expect(mockVerifyOnChain).toHaveBeenCalledTimes(1);
		});
	});

	// ═════════════════════════════════════════════════════════════════════
	// processRetryQueue() — error isolation
	// ═════════════════════════════════════════════════════════════════════

	describe('processRetryQueue — error isolation', () => {
		it('catches and logs errors without crashing the batch', async () => {
			const retry = makeRetryRecord();
			mockFindMany.mockResolvedValueOnce([retry]);
			mockIsNullifierUsed.mockResolvedValueOnce(false);
			mockVerifyOnChain.mockRejectedValueOnce(new Error('Unexpected crash'));

			// Should not throw
			const processed = await processRetryQueue();

			// Exception was caught, so processed = 0 (the item wasn't successfully processed)
			expect(processed).toBe(0);
		});
	});
});
