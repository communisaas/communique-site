/**
 * Delivery Worker Pipeline Security Tests
 *
 * Tests the processSubmissionDelivery() pipeline:
 * decrypt witness -> extract address -> lookup reps -> build payload -> submit -> status update
 *
 * Security properties tested:
 * - Missing encryption metadata rejection (prevents silent decryption bypass)
 * - Address validation (street, city, state, zip required)
 * - Per-representative error isolation (one failure doesn't block others)
 * - Status transitions (processing -> delivered | failed | partial)
 * - Error status persistence (failures are recorded, not swallowed)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock external dependencies
// ---------------------------------------------------------------------------

const mockDecryptWitness = vi.fn();
vi.mock('$lib/server/witness-decryption', () => ({
	decryptWitness: (...args: unknown[]) => mockDecryptWitness(...args)
}));

const mockGetRepresentatives = vi.fn();
vi.mock('$lib/core/congress/address-lookup', () => ({
	getRepresentativesForAddress: (...args: unknown[]) => mockGetRepresentatives(...args)
}));

const mockSubmitToSenate = vi.fn();
const mockSubmitToHouse = vi.fn();
vi.mock('$lib/core/congress/cwc-client', () => ({
	cwcClient: {
		submitToSenate: (...args: unknown[]) => mockSubmitToSenate(...args),
		submitToHouse: (...args: unknown[]) => mockSubmitToHouse(...args)
	}
}));

import { processSubmissionDelivery } from '$lib/server/delivery-worker';

// ---------------------------------------------------------------------------
// Mock PrismaClient
// ---------------------------------------------------------------------------

function createMockDb(submission: Record<string, unknown> | null = null, template: Record<string, unknown> | null = null) {
	const updateCalls: Array<{ where: unknown; data: unknown }> = [];

	return {
		db: {
			submission: {
				update: vi.fn(async (args: { where: unknown; data: unknown }) => {
					updateCalls.push(args);
					return {};
				}),
				findUnique: vi.fn(async () => submission)
			},
			template: {
				findUnique: vi.fn(async () => template)
			}
		// PrismaClient type hack: we only need the subset used by delivery-worker
		} as unknown as import('@prisma/client').PrismaClient,
		updateCalls
	};
}

// ---------------------------------------------------------------------------
// Test data builders
// ---------------------------------------------------------------------------

const DEFAULT_SUBMISSION = {
	id: 'sub-001',
	template_id: 'tmpl-001',
	encrypted_witness: 'encrypted-blob',
	witness_nonce: 'nonce-24-bytes-hex',
	ephemeral_public_key: 'ephemeral-pub-key-hex',
	tee_key_id: 'tee-key-1'
};

const DEFAULT_TEMPLATE = {
	id: 'tmpl-001',
	title: 'Climate Action Now',
	description: 'Support climate legislation',
	message_body: 'Dear Representative, please support climate action.',
	delivery_config: {}
};

const DEFAULT_ADDRESS = {
	name: 'Jane Doe',
	email: 'jane@example.com',
	street: '123 Main St',
	city: 'San Francisco',
	state: 'CA',
	zip: '94110',
	phone: '415-555-0100',
	congressional_district: 'CA-12'
};

const SENATE_REP = {
	bioguide_id: 'F000062',
	name: 'Dianne Feinstein',
	party: 'D',
	state: 'CA',
	district: '00',
	chamber: 'senate' as const,
	office_code: 'F000062'
};

const HOUSE_REP = {
	bioguide_id: 'P000197',
	name: 'Nancy Pelosi',
	party: 'D',
	state: 'CA',
	district: '12',
	chamber: 'house' as const,
	office_code: 'CA12'
};

describe('processSubmissionDelivery', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	// =========================================================================
	// Happy path: full pipeline
	// =========================================================================

	describe('full pipeline', () => {
		it('should decrypt -> lookup -> submit -> update status for each rep', async () => {
			mockDecryptWitness.mockResolvedValue({ deliveryAddress: DEFAULT_ADDRESS });
			mockGetRepresentatives.mockResolvedValue([SENATE_REP, HOUSE_REP]);
			mockSubmitToSenate.mockResolvedValue({ status: 'submitted', messageId: 'msg-senate-1' });
			mockSubmitToHouse.mockResolvedValue({ status: 'submitted', messageId: 'msg-house-1' });

			const { db, updateCalls } = createMockDb(DEFAULT_SUBMISSION, DEFAULT_TEMPLATE);

			const result = await processSubmissionDelivery('sub-001', db);

			expect(result.success).toBe(true);
			expect(result.results).toHaveLength(2);
			expect(result.results[0].office).toBe('Dianne Feinstein');
			expect(result.results[0].status).toBe('submitted');
			expect(result.results[1].office).toBe('Nancy Pelosi');
			expect(result.results[1].status).toBe('submitted');

			// Should have updated status to 'processing' first, then 'delivered'
			expect(updateCalls[0].data).toEqual(
				expect.objectContaining({ delivery_status: 'processing' })
			);

			const finalUpdate = updateCalls[updateCalls.length - 1];
			expect(finalUpdate.data).toEqual(
				expect.objectContaining({ delivery_status: 'delivered' })
			);
		});

		it('should route senate reps to submitToSenate and house reps to submitToHouse', async () => {
			mockDecryptWitness.mockResolvedValue({ deliveryAddress: DEFAULT_ADDRESS });
			mockGetRepresentatives.mockResolvedValue([SENATE_REP, HOUSE_REP]);
			mockSubmitToSenate.mockResolvedValue({ status: 'submitted', messageId: 'msg-s' });
			mockSubmitToHouse.mockResolvedValue({ status: 'submitted', messageId: 'msg-h' });

			const { db } = createMockDb(DEFAULT_SUBMISSION, DEFAULT_TEMPLATE);

			await processSubmissionDelivery('sub-001', db);

			expect(mockSubmitToSenate).toHaveBeenCalledTimes(1);
			expect(mockSubmitToHouse).toHaveBeenCalledTimes(1);
		});
	});

	// =========================================================================
	// Missing encryption metadata
	// =========================================================================

	describe('encryption metadata validation', () => {
		it('should fail when witness_nonce is null', async () => {
			const submission = { ...DEFAULT_SUBMISSION, witness_nonce: null };
			const { db, updateCalls } = createMockDb(submission, DEFAULT_TEMPLATE);

			const result = await processSubmissionDelivery('sub-001', db);

			expect(result.success).toBe(false);
			expect(result.results[0].error).toContain('Missing encryption metadata');

			// Should have updated status to failed
			const failUpdate = updateCalls.find(
				(c) => (c.data as Record<string, unknown>).delivery_status === 'failed'
			);
			expect(failUpdate).toBeDefined();
		});

		it('should fail when ephemeral_public_key is null', async () => {
			const submission = { ...DEFAULT_SUBMISSION, ephemeral_public_key: null };
			const { db } = createMockDb(submission, DEFAULT_TEMPLATE);

			const result = await processSubmissionDelivery('sub-001', db);

			expect(result.success).toBe(false);
			expect(result.results[0].error).toContain('Missing encryption metadata');
		});

		it('should fail when submission is not found', async () => {
			const { db } = createMockDb(null, DEFAULT_TEMPLATE);

			const result = await processSubmissionDelivery('sub-nonexistent', db);

			expect(result.success).toBe(false);
			expect(result.results[0].error).toContain('Submission not found');
		});
	});

	// =========================================================================
	// Address validation
	// =========================================================================

	describe('address validation', () => {
		it('should fail when delivery address is missing from witness', async () => {
			mockDecryptWitness.mockResolvedValue({ deliveryAddress: undefined });
			const { db } = createMockDb(DEFAULT_SUBMISSION, DEFAULT_TEMPLATE);

			const result = await processSubmissionDelivery('sub-001', db);

			expect(result.success).toBe(false);
			expect(result.results[0].error).toContain('No delivery address');
		});

		it('should fail when address is missing required street field', async () => {
			const incompleteAddress = { ...DEFAULT_ADDRESS, street: '' };
			mockDecryptWitness.mockResolvedValue({ deliveryAddress: incompleteAddress });
			const { db } = createMockDb(DEFAULT_SUBMISSION, DEFAULT_TEMPLATE);

			const result = await processSubmissionDelivery('sub-001', db);

			expect(result.success).toBe(false);
			expect(result.results[0].error).toContain('Incomplete delivery address');
		});

		it('should fail when address is missing required zip field', async () => {
			const incompleteAddress = { ...DEFAULT_ADDRESS, zip: '' };
			mockDecryptWitness.mockResolvedValue({ deliveryAddress: incompleteAddress });
			const { db } = createMockDb(DEFAULT_SUBMISSION, DEFAULT_TEMPLATE);

			const result = await processSubmissionDelivery('sub-001', db);

			expect(result.success).toBe(false);
			expect(result.results[0].error).toContain('Incomplete delivery address');
		});
	});

	// =========================================================================
	// Per-representative error isolation
	// =========================================================================

	describe('per-representative error isolation', () => {
		it('should continue submitting to other reps when one fails', async () => {
			mockDecryptWitness.mockResolvedValue({ deliveryAddress: DEFAULT_ADDRESS });
			mockGetRepresentatives.mockResolvedValue([SENATE_REP, HOUSE_REP]);
			// Senate fails, House succeeds
			mockSubmitToSenate.mockRejectedValue(new Error('Senate API timeout'));
			mockSubmitToHouse.mockResolvedValue({ status: 'submitted', messageId: 'msg-h' });

			const { db, updateCalls } = createMockDb(DEFAULT_SUBMISSION, DEFAULT_TEMPLATE);

			const result = await processSubmissionDelivery('sub-001', db);

			// Overall should be partial success (not total failure)
			expect(result.success).toBe(true);
			expect(result.results).toHaveLength(2);
			expect(result.results[0].status).toBe('failed');
			expect(result.results[0].error).toContain('Senate API timeout');
			expect(result.results[1].status).toBe('submitted');

			// Final status should reflect partial delivery
			const finalUpdate = updateCalls[updateCalls.length - 1];
			expect(finalUpdate.data).toEqual(
				expect.objectContaining({ delivery_status: 'delivered' })
			);
		});

		it('should mark as failed when all reps fail', async () => {
			mockDecryptWitness.mockResolvedValue({ deliveryAddress: DEFAULT_ADDRESS });
			mockGetRepresentatives.mockResolvedValue([SENATE_REP, HOUSE_REP]);
			mockSubmitToSenate.mockRejectedValue(new Error('Senate down'));
			mockSubmitToHouse.mockRejectedValue(new Error('House down'));

			const { db, updateCalls } = createMockDb(DEFAULT_SUBMISSION, DEFAULT_TEMPLATE);

			const result = await processSubmissionDelivery('sub-001', db);

			expect(result.success).toBe(false);
			expect(result.results.every((r) => r.status === 'failed')).toBe(true);

			// Final status should be 'failed'
			const finalUpdate = updateCalls[updateCalls.length - 1];
			expect(finalUpdate.data).toEqual(
				expect.objectContaining({ delivery_status: 'failed' })
			);
		});

		it('should treat CWC rejected status as failure', async () => {
			mockDecryptWitness.mockResolvedValue({ deliveryAddress: DEFAULT_ADDRESS });
			mockGetRepresentatives.mockResolvedValue([SENATE_REP]);
			mockSubmitToSenate.mockResolvedValue({ status: 'rejected', error: 'Office not accepting' });

			const { db, updateCalls } = createMockDb(DEFAULT_SUBMISSION, DEFAULT_TEMPLATE);

			const result = await processSubmissionDelivery('sub-001', db);

			expect(result.success).toBe(false);

			const finalUpdate = updateCalls[updateCalls.length - 1];
			expect(finalUpdate.data).toEqual(
				expect.objectContaining({ delivery_status: 'failed' })
			);
		});
	});

	// =========================================================================
	// Template and representative lookup
	// =========================================================================

	describe('template and representative lookup', () => {
		it('should fail when template is not found', async () => {
			mockDecryptWitness.mockResolvedValue({ deliveryAddress: DEFAULT_ADDRESS });
			mockGetRepresentatives.mockResolvedValue([SENATE_REP]);

			const { db } = createMockDb(DEFAULT_SUBMISSION, null);

			const result = await processSubmissionDelivery('sub-001', db);

			expect(result.success).toBe(false);
			expect(result.results[0].error).toContain('Template not found');
		});

		it('should fail when no representatives found for address', async () => {
			mockDecryptWitness.mockResolvedValue({ deliveryAddress: DEFAULT_ADDRESS });
			mockGetRepresentatives.mockResolvedValue([]);

			const { db } = createMockDb(DEFAULT_SUBMISSION, DEFAULT_TEMPLATE);

			const result = await processSubmissionDelivery('sub-001', db);

			expect(result.success).toBe(false);
			expect(result.results[0].error).toContain('No representatives found');
		});
	});

	// =========================================================================
	// Error status persistence
	// =========================================================================

	describe('error status persistence', () => {
		it('should record error message in delivery_error on fatal failure', async () => {
			mockDecryptWitness.mockRejectedValue(new Error('Decryption key not found'));

			const { db, updateCalls } = createMockDb(DEFAULT_SUBMISSION, DEFAULT_TEMPLATE);

			const result = await processSubmissionDelivery('sub-001', db);

			expect(result.success).toBe(false);

			// Should have persisted the error
			const failUpdate = updateCalls.find(
				(c) => (c.data as Record<string, unknown>).delivery_status === 'failed'
			);
			expect(failUpdate).toBeDefined();
			expect((failUpdate!.data as Record<string, unknown>).delivery_error).toContain(
				'Decryption key not found'
			);
		});

		it('should record per-rep error summary on partial failure', async () => {
			mockDecryptWitness.mockResolvedValue({ deliveryAddress: DEFAULT_ADDRESS });
			mockGetRepresentatives.mockResolvedValue([SENATE_REP, HOUSE_REP]);
			mockSubmitToSenate.mockRejectedValue(new Error('Connection refused'));
			mockSubmitToHouse.mockResolvedValue({ status: 'submitted', messageId: 'msg-h' });

			const { db, updateCalls } = createMockDb(DEFAULT_SUBMISSION, DEFAULT_TEMPLATE);

			await processSubmissionDelivery('sub-001', db);

			const finalUpdate = updateCalls[updateCalls.length - 1];
			const errorSummary = (finalUpdate.data as Record<string, unknown>).delivery_error as string;
			expect(errorSummary).toContain('Dianne Feinstein');
			expect(errorSummary).toContain('Connection refused');
		});

		it('should store CWC message IDs on success', async () => {
			mockDecryptWitness.mockResolvedValue({ deliveryAddress: DEFAULT_ADDRESS });
			mockGetRepresentatives.mockResolvedValue([SENATE_REP, HOUSE_REP]);
			mockSubmitToSenate.mockResolvedValue({ status: 'submitted', messageId: 'msg-s-123' });
			mockSubmitToHouse.mockResolvedValue({ status: 'submitted', messageId: 'msg-h-456' });

			const { db, updateCalls } = createMockDb(DEFAULT_SUBMISSION, DEFAULT_TEMPLATE);

			await processSubmissionDelivery('sub-001', db);

			const finalUpdate = updateCalls[updateCalls.length - 1];
			const cwcId = (finalUpdate.data as Record<string, unknown>).cwc_submission_id as string;
			expect(cwcId).toContain('msg-s-123');
			expect(cwcId).toContain('msg-h-456');
		});
	});
});
