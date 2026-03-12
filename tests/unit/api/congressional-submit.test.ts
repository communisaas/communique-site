/**
 * Unit Tests: POST /api/congressional/submit
 *
 * Tests the congressional submission endpoint which:
 * 1. Feature-gated behind FEATURES.CONGRESSIONAL
 * 2. Requires authenticated session
 * 3. Validates proof structure (publicInputs length, verifierDepth)
 * 4. Validates districtId format
 * 5. Billing gate: user's org must have Starter+ plan
 * 6. Nullifier uniqueness (409 on duplicate)
 * 7. Delegates to handleSubmission()
 *
 * Security properties tested:
 * - Feature gate enforcement
 * - Session authentication enforcement
 * - Proof structure validation
 * - District format validation
 * - Billing plan gating
 * - Nullifier double-submission prevention
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

const {
	mockOrgMembershipFindFirst,
	mockGetPlanForOrg,
	mockHandleSubmission,
	mockFeatures
} = vi.hoisted(() => ({
	mockOrgMembershipFindFirst: vi.fn(),
	mockGetPlanForOrg: vi.fn(),
	mockHandleSubmission: vi.fn(),
	mockFeatures: {
		DEBATE: true,
		CONGRESSIONAL: true as boolean,
		ADDRESS_SPECIFICITY: 'district' as string,
		STANCE_POSITIONS: false,
		WALLET: false,
		ANALYTICS_EXPANDED: true,
		AB_TESTING: true,
		PUBLIC_API: false
	}
}));

vi.mock('$lib/core/db', () => ({
	prisma: {
		orgMembership: {
			findFirst: (...args: unknown[]) => mockOrgMembershipFindFirst(...args)
		}
	},
	db: {
		orgMembership: {
			findFirst: (...args: unknown[]) => mockOrgMembershipFindFirst(...args)
		}
	}
}));

vi.mock('$lib/config/features', () => ({
	FEATURES: mockFeatures
}));

vi.mock('$lib/server/billing/plans', () => ({
	PLAN_ORDER: ['free', 'starter', 'organization', 'coalition'] as const,
	PLANS: {
		free: { slug: 'free', name: 'Free' },
		starter: { slug: 'starter', name: 'Starter' },
		organization: { slug: 'organization', name: 'Organization' },
		coalition: { slug: 'coalition', name: 'Coalition' }
	},
	getPlanForOrg: (...args: unknown[]) => mockGetPlanForOrg(...args)
}));

vi.mock('$lib/core/congressional/submission-handler', () => ({
	handleSubmission: (...args: unknown[]) => mockHandleSubmission(...args)
}));

// Mock $types
vi.mock('../../../../src/routes/api/congressional/submit/$types', () => ({}));

// Import handler AFTER mocks
const { POST } = await import('../../../src/routes/api/congressional/submit/+server');

// =============================================================================
// HELPERS
// =============================================================================

const VALID_PUBLIC_INPUTS = Array.from({ length: 31 }, (_, i) => `0x${i.toString(16).padStart(64, '0')}`);

const VALID_BODY = {
	proof: '0xdeadbeef',
	publicInputs: VALID_PUBLIC_INPUTS,
	verifierDepth: 20,
	templateId: 'tpl-001',
	districtId: 'CA-12'
};

function createEvent(overrides: {
	session?: { userId: string } | null;
	body?: Record<string, unknown>;
} = {}): any {
	const body = overrides.body ?? VALID_BODY;
	return {
		request: new Request('http://localhost/api/congressional/submit', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		locals: {
			session: overrides.session !== undefined
				? overrides.session
				: { userId: 'user-001' }
		}
	};
}

// =============================================================================
// TESTS
// =============================================================================

describe('POST /api/congressional/submit', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockFeatures.CONGRESSIONAL = true;
		mockOrgMembershipFindFirst.mockResolvedValue({
			org: { subscription: { plan: 'starter' } }
		});
		mockGetPlanForOrg.mockReturnValue({ slug: 'starter', name: 'Starter' });
		mockHandleSubmission.mockResolvedValue({
			submissionId: 'sub-001',
			status: 'pending',
			nullifier: '0xnullifier'
		});
	});

	// =========================================================================
	// Feature Gate
	// =========================================================================

	describe('Feature Gate', () => {
		it('should return 404 when CONGRESSIONAL is disabled', async () => {
			mockFeatures.CONGRESSIONAL = false;
			const event = createEvent();

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(404);
			expect(data.error).toBe('Not found');
		});

		it('should proceed when CONGRESSIONAL is enabled', async () => {
			const event = createEvent();

			const response = await POST(event);

			expect(response.status).toBe(200);
		});
	});

	// =========================================================================
	// Authentication
	// =========================================================================

	describe('Authentication', () => {
		it('should return 401 when session is null', async () => {
			const event = createEvent({ session: null });

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(401);
			expect(data.error).toBe('Unauthorized');
		});

		it('should return 401 when session.userId is missing', async () => {
			const event = createEvent({ session: {} as any });

			const response = await POST(event);

			expect(response.status).toBe(401);
		});

		it('should return 401 when locals.session is undefined', async () => {
			const event = {
				request: new Request('http://localhost/test', {
					method: 'POST',
					body: JSON.stringify(VALID_BODY)
				}),
				locals: {}
			};

			const response = await POST(event as any);

			expect(response.status).toBe(401);
		});
	});

	// =========================================================================
	// Input Validation
	// =========================================================================

	describe('Input Validation', () => {
		it('should return 400 when proof is missing', async () => {
			const event = createEvent({
				body: { ...VALID_BODY, proof: undefined }
			});

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toContain('Missing required fields');
		});

		it('should return 400 when publicInputs is missing', async () => {
			const event = createEvent({
				body: { ...VALID_BODY, publicInputs: undefined }
			});

			const response = await POST(event);

			expect(response.status).toBe(400);
		});

		it('should return 400 when templateId is missing', async () => {
			const event = createEvent({
				body: { ...VALID_BODY, templateId: undefined }
			});

			const response = await POST(event);

			expect(response.status).toBe(400);
		});

		it('should return 400 when publicInputs length is not 31', async () => {
			const event = createEvent({
				body: { ...VALID_BODY, publicInputs: ['0x1', '0x2'] }
			});

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toContain('31');
		});

		it('should return 400 when verifierDepth is missing', async () => {
			const event = createEvent({
				body: { ...VALID_BODY, verifierDepth: undefined }
			});

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toContain('verifierDepth');
		});

		it('should return 400 when verifierDepth is invalid value', async () => {
			for (const depth of [0, 10, 16, 19, 21, 23, 25, 30]) {
				const event = createEvent({
					body: { ...VALID_BODY, verifierDepth: depth }
				});

				const response = await POST(event);

				expect(response.status).toBe(400);
			}
		});

		it('should accept valid verifierDepth values (18, 20, 22, 24)', async () => {
			for (const depth of [18, 20, 22, 24]) {
				const event = createEvent({
					body: { ...VALID_BODY, verifierDepth: depth }
				});

				const response = await POST(event);

				expect(response.status).toBe(200);
			}
		});

		it('should return 400 when districtId is missing', async () => {
			const event = createEvent({
				body: { ...VALID_BODY, districtId: undefined }
			});

			const response = await POST(event);

			expect(response.status).toBe(400);
		});

		it('should return 400 for invalid districtId format', async () => {
			const invalidDistricts = ['ca-12', 'California', '12', 'CA-123', 'C-1', ''];
			for (const districtId of invalidDistricts) {
				const event = createEvent({
					body: { ...VALID_BODY, districtId }
				});

				const response = await POST(event);

				expect(response.status).toBe(400);
			}
		});

		it('should accept valid districtId formats', async () => {
			const validDistricts = ['CA-12', 'NY-1', 'TX', 'VT'];
			for (const districtId of validDistricts) {
				vi.clearAllMocks();
				mockOrgMembershipFindFirst.mockResolvedValue({
					org: { subscription: { plan: 'starter' } }
				});
				mockGetPlanForOrg.mockReturnValue({ slug: 'starter' });
				mockHandleSubmission.mockResolvedValue({
					submissionId: 'sub-001',
					status: 'pending',
					nullifier: '0xnullifier'
				});

				const event = createEvent({
					body: { ...VALID_BODY, districtId }
				});

				const response = await POST(event);

				expect(response.status).toBe(200);
			}
		});
	});

	// =========================================================================
	// Billing Gate
	// =========================================================================

	describe('Billing Gate', () => {
		it('should return 403 when user has no org membership', async () => {
			mockOrgMembershipFindFirst.mockResolvedValue(null);
			const event = createEvent();

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(403);
			expect(data.error).toContain('organization membership');
		});

		it('should return 403 when org is on free plan', async () => {
			mockOrgMembershipFindFirst.mockResolvedValue({
				org: { subscription: { plan: 'free' } }
			});
			mockGetPlanForOrg.mockReturnValue({ slug: 'free', name: 'Free' });
			const event = createEvent();

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(403);
			expect(data.error).toContain('Starter plan');
		});

		it('should allow starter plan', async () => {
			const event = createEvent();

			const response = await POST(event);

			expect(response.status).toBe(200);
		});

		it('should allow organization plan', async () => {
			mockOrgMembershipFindFirst.mockResolvedValue({
				org: { subscription: { plan: 'organization' } }
			});
			mockGetPlanForOrg.mockReturnValue({ slug: 'organization' });
			const event = createEvent();

			const response = await POST(event);

			expect(response.status).toBe(200);
		});
	});

	// =========================================================================
	// Nullifier Uniqueness
	// =========================================================================

	describe('Nullifier Uniqueness', () => {
		it('should return 409 when nullifier already used', async () => {
			mockHandleSubmission.mockRejectedValue(new Error('NULLIFIER_ALREADY_USED'));
			const event = createEvent();

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(409);
			expect(data.error).toContain('already been submitted');
		});
	});

	// =========================================================================
	// Successful Submission
	// =========================================================================

	describe('Successful Submission', () => {
		it('should return success with submissionId, status, and nullifier', async () => {
			const event = createEvent();

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.data.submissionId).toBe('sub-001');
			expect(data.data.status).toBe('pending');
			expect(data.data.nullifier).toBe('0xnullifier');
		});

		it('should pass userId and body to handleSubmission', async () => {
			const event = createEvent();

			await POST(event);

			expect(mockHandleSubmission).toHaveBeenCalledWith(
				'user-001',
				expect.objectContaining({
					proof: '0xdeadbeef',
					publicInputs: VALID_PUBLIC_INPUTS,
					verifierDepth: 20,
					templateId: 'tpl-001',
					districtId: 'CA-12'
				})
			);
		});
	});

	// =========================================================================
	// Error Handling
	// =========================================================================

	describe('Error Handling', () => {
		it('should return 500 on unexpected errors', async () => {
			mockHandleSubmission.mockRejectedValue(new Error('Unexpected DB failure'));
			const event = createEvent();

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(500);
			expect(data.error).toBe('Internal server error');
			// Should not leak internal error details
			expect(data.error).not.toContain('DB failure');
		});
	});
});
