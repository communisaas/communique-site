/**
 * Unit Tests: POST /api/campaigns/[id]/debate
 *
 * Tests the debate creation endpoint which:
 * 1. Feature-gated behind FEATURES.DEBATE
 * 2. Requires authentication
 * 3. Rate limited: 5/min per user
 * 4. Validates campaign membership and editor+ role
 * 5. Plan-gated: Organization tier or higher
 * 6. Creates on-chain debate with off-chain fallback
 * 7. Links debate to campaign
 *
 * Security properties tested:
 * - Feature gate enforcement
 * - Authentication enforcement
 * - Rate limiting
 * - Role hierarchy (editor+)
 * - Plan gating (Organization+)
 * - Idempotency (existing debate linking)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

const {
	mockCampaignFindUnique,
	mockDebateFindFirst,
	mockDebateCreate,
	mockCampaignUpdate,
	mockRateLimiterCheck,
	mockOrgMeetsPlan,
	mockProposeDebate,
	mockDeriveDomain,
	mockFeatures
} = vi.hoisted(() => ({
	mockCampaignFindUnique: vi.fn(),
	mockDebateFindFirst: vi.fn(),
	mockDebateCreate: vi.fn(),
	mockCampaignUpdate: vi.fn(),
	mockRateLimiterCheck: vi.fn(),
	mockOrgMeetsPlan: vi.fn(),
	mockProposeDebate: vi.fn(),
	mockDeriveDomain: vi.fn(),
	mockFeatures: {
		DEBATE: true as boolean,
		CONGRESSIONAL: true,
		ADDRESS_SPECIFICITY: 'district' as string,
		STANCE_POSITIONS: false,
		WALLET: false,
		ANALYTICS_EXPANDED: true,
		AB_TESTING: true,
		PUBLIC_API: false
	}
}));

vi.mock('$lib/core/db', () => ({
	db: {
		campaign: {
			findUnique: (...args: unknown[]) => mockCampaignFindUnique(...args),
			update: (...args: unknown[]) => mockCampaignUpdate(...args)
		},
		debate: {
			findFirst: (...args: unknown[]) => mockDebateFindFirst(...args),
			create: (...args: unknown[]) => mockDebateCreate(...args)
		}
	},
	prisma: {
		campaign: {
			findUnique: (...args: unknown[]) => mockCampaignFindUnique(...args),
			update: (...args: unknown[]) => mockCampaignUpdate(...args)
		},
		debate: {
			findFirst: (...args: unknown[]) => mockDebateFindFirst(...args),
			create: (...args: unknown[]) => mockDebateCreate(...args)
		}
	}
}));

vi.mock('$lib/core/security/rate-limiter', () => ({
	getRateLimiter: () => ({
		check: (...args: unknown[]) => mockRateLimiterCheck(...args)
	})
}));

vi.mock('$lib/config/features', () => ({
	FEATURES: mockFeatures
}));

vi.mock('$lib/server/org', () => ({
	requireRole: (current: string, minimum: string) => {
		const hierarchy: Record<string, number> = { member: 0, editor: 1, owner: 2 };
		if (hierarchy[current] < hierarchy[minimum]) {
			// Simulate SvelteKit error() throw
			const err = new Error(`Requires ${minimum} role or higher`);
			(err as any).status = 403;
			(err as any).body = { message: `Requires ${minimum} role or higher` };
			throw err;
		}
	}
}));

vi.mock('$lib/server/billing/plan-check', () => ({
	orgMeetsPlan: (...args: unknown[]) => mockOrgMeetsPlan(...args)
}));

vi.mock('$lib/core/blockchain/debate-market-client', () => ({
	proposeDebate: (...args: unknown[]) => mockProposeDebate(...args),
	deriveDomain: (...args: unknown[]) => mockDeriveDomain(...args)
}));

vi.mock('ethers', () => ({
	solidityPackedKeccak256: (_types: string[], _values: unknown[]) =>
		'0x' + 'ab'.repeat(32)
}));

// Mock $types
vi.mock('../../../../src/routes/api/campaigns/[id]/debate/$types', () => ({}));

// Import handler AFTER mocks
const { POST } = await import('../../../src/routes/api/campaigns/[id]/debate/+server');

// =============================================================================
// HELPERS
// =============================================================================

const DEFAULT_CAMPAIGN = {
	id: 'campaign-123',
	orgId: 'org-456',
	templateId: 'template-789',
	title: 'Climate Action Now',
	debateEnabled: false,
	debateId: null,
	org: {
		slug: 'test-org',
		memberships: [{ role: 'editor' }]
	}
};

const DEFAULT_DEBATE = {
	id: 'debate-001',
	debate_id_onchain: '0x' + 'ab'.repeat(32),
	action_domain: '0x' + 'cd'.repeat(32),
	proposition_hash: '0x' + 'ef'.repeat(32),
	proposition_text: 'Should we support: "Climate Action Now"?',
	deadline: new Date('2026-04-01'),
	jurisdiction_size: 100,
	status: 'active',
	proposer_address: '0x0000000000000000000000000000000000000000',
	proposer_bond: 1000000n,
	tx_hash: '0xtxhash123'
};

function createEvent(overrides: {
	id?: string;
	user?: { id: string } | null;
	body?: Record<string, unknown>;
} = {}): any {
	const body = overrides.body ?? {};
	return {
		params: { id: overrides.id ?? 'campaign-123' },
		locals: {
			user: overrides.user !== undefined ? overrides.user : { id: 'user-001' }
		},
		request: new Request('http://localhost/api/campaigns/campaign-123/debate', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		})
	};
}

// =============================================================================
// TESTS
// =============================================================================

describe('POST /api/campaigns/[id]/debate', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockFeatures.DEBATE = true;
		mockRateLimiterCheck.mockResolvedValue({ allowed: true });
		mockCampaignFindUnique.mockResolvedValue(DEFAULT_CAMPAIGN);
		mockOrgMeetsPlan.mockResolvedValue(true);
		mockDebateFindFirst.mockResolvedValue(null);
		mockProposeDebate.mockResolvedValue({
			success: true,
			debateId: '0x' + 'ab'.repeat(32),
			txHash: '0xtxhash123'
		});
		mockDeriveDomain.mockResolvedValue('0x' + 'cd'.repeat(32));
		mockDebateCreate.mockResolvedValue(DEFAULT_DEBATE);
		mockCampaignUpdate.mockResolvedValue({});
	});

	// =========================================================================
	// Feature Gate
	// =========================================================================

	describe('Feature Gate', () => {
		it('should throw 404 when DEBATE is disabled', async () => {
			mockFeatures.DEBATE = false;
			const event = createEvent();

			await expect(POST(event)).rejects.toMatchObject({ status: 404 });
		});

		it('should proceed when DEBATE is enabled', async () => {
			const event = createEvent();

			const response = await POST(event);

			expect(response.status).toBe(201);
		});
	});

	// =========================================================================
	// Authentication
	// =========================================================================

	describe('Authentication', () => {
		it('should throw 401 when user is not authenticated', async () => {
			const event = createEvent({ user: null });

			await expect(POST(event)).rejects.toMatchObject({ status: 401 });
		});

		it('should throw 401 when locals.user is undefined', async () => {
			const event = {
				params: { id: 'campaign-123' },
				locals: {},
				request: new Request('http://localhost/test', {
					method: 'POST',
					body: '{}'
				})
			};

			await expect(POST(event as any)).rejects.toMatchObject({ status: 401 });
		});
	});

	// =========================================================================
	// Rate Limiting
	// =========================================================================

	describe('Rate Limiting', () => {
		it('should throw 429 when rate limit exceeded', async () => {
			mockRateLimiterCheck.mockResolvedValue({ allowed: false });
			const event = createEvent();

			await expect(POST(event)).rejects.toMatchObject({ status: 429 });
		});

		it('should check rate limit with user-specific key', async () => {
			const event = createEvent({ user: { id: 'user-xyz' } });

			await POST(event);

			expect(mockRateLimiterCheck).toHaveBeenCalledWith(
				'ratelimit:debate-create:user-xyz',
				{ maxRequests: 5, windowMs: 60_000 }
			);
		});
	});

	// =========================================================================
	// Campaign Lookup
	// =========================================================================

	describe('Campaign Lookup', () => {
		it('should throw 404 when campaign not found', async () => {
			mockCampaignFindUnique.mockResolvedValue(null);
			const event = createEvent();

			await expect(POST(event)).rejects.toMatchObject({ status: 404 });
		});
	});

	// =========================================================================
	// Membership & Role
	// =========================================================================

	describe('Membership & Role', () => {
		it('should throw 403 when user is not a member of the org', async () => {
			mockCampaignFindUnique.mockResolvedValue({
				...DEFAULT_CAMPAIGN,
				org: { slug: 'test-org', memberships: [] }
			});
			const event = createEvent();

			await expect(POST(event)).rejects.toMatchObject({ status: 403 });
		});

		it('should throw 403 when member role is below editor', async () => {
			mockCampaignFindUnique.mockResolvedValue({
				...DEFAULT_CAMPAIGN,
				org: { slug: 'test-org', memberships: [{ role: 'member' }] }
			});
			const event = createEvent();

			await expect(POST(event)).rejects.toMatchObject({ status: 403 });
		});

		it('should allow editor role', async () => {
			mockCampaignFindUnique.mockResolvedValue({
				...DEFAULT_CAMPAIGN,
				org: { slug: 'test-org', memberships: [{ role: 'editor' }] }
			});
			const event = createEvent();

			const response = await POST(event);

			expect(response.status).toBe(201);
		});

		it('should allow owner role', async () => {
			mockCampaignFindUnique.mockResolvedValue({
				...DEFAULT_CAMPAIGN,
				org: { slug: 'test-org', memberships: [{ role: 'owner' }] }
			});
			const event = createEvent();

			const response = await POST(event);

			expect(response.status).toBe(201);
		});
	});

	// =========================================================================
	// Plan Gating
	// =========================================================================

	describe('Plan Gating', () => {
		it('should throw 403 when org does not meet plan requirement', async () => {
			mockOrgMeetsPlan.mockResolvedValue(false);
			const event = createEvent();

			await expect(POST(event)).rejects.toMatchObject({ status: 403 });
		});

		it('should check for organization plan minimum', async () => {
			const event = createEvent();

			await POST(event);

			expect(mockOrgMeetsPlan).toHaveBeenCalledWith('org-456', 'organization');
		});
	});

	// =========================================================================
	// Template Validation
	// =========================================================================

	describe('Template Validation', () => {
		it('should throw 400 when campaign has no templateId', async () => {
			mockCampaignFindUnique.mockResolvedValue({
				...DEFAULT_CAMPAIGN,
				templateId: null
			});
			const event = createEvent();

			await expect(POST(event)).rejects.toMatchObject({ status: 400 });
		});
	});

	// =========================================================================
	// Existing Debate
	// =========================================================================

	describe('Existing Debate', () => {
		it('should throw 409 when campaign already has a debateId', async () => {
			mockCampaignFindUnique.mockResolvedValue({
				...DEFAULT_CAMPAIGN,
				debateId: 'existing-debate-id'
			});
			const event = createEvent();

			await expect(POST(event)).rejects.toMatchObject({ status: 409 });
		});

		it('should link existing active debate on same template and return linked: true', async () => {
			mockDebateFindFirst.mockResolvedValue({ id: 'existing-debate-on-template' });
			const event = createEvent();

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.debateId).toBe('existing-debate-on-template');
			expect(data.linked).toBe(true);

			expect(mockCampaignUpdate).toHaveBeenCalledWith({
				where: { id: 'campaign-123' },
				data: { debateId: 'existing-debate-on-template', debateEnabled: true }
			});
		});
	});

	// =========================================================================
	// Successful Creation
	// =========================================================================

	describe('Successful Creation', () => {
		it('should return 201 with debateId and debateIdOnchain', async () => {
			const event = createEvent();

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(201);
			expect(data.debateId).toBe('debate-001');
			expect(data.debateIdOnchain).toBeDefined();
			expect(data.propositionText).toBeDefined();
			expect(data.deadline).toBeDefined();
		});

		it('should create debate record with correct data', async () => {
			const event = createEvent();

			await POST(event);

			expect(mockDebateCreate).toHaveBeenCalledTimes(1);
			const createData = mockDebateCreate.mock.calls[0][0].data;
			expect(createData.template_id).toBe('template-789');
			expect(createData.status).toBe('active');
			expect(createData.debate_id_onchain).toBeDefined();
			expect(createData.proposition_text).toContain('Climate Action Now');
		});

		it('should link debate to campaign after creation', async () => {
			const event = createEvent();

			await POST(event);

			expect(mockCampaignUpdate).toHaveBeenCalledWith({
				where: { id: 'campaign-123' },
				data: { debateId: 'debate-001', debateEnabled: true }
			});
		});

		it('should use custom propositionText when provided', async () => {
			const event = createEvent({
				body: { propositionText: 'Should we fund public transit expansion?' }
			});

			await POST(event);

			const createData = mockDebateCreate.mock.calls[0][0].data;
			expect(createData.proposition_text).toBe('Should we fund public transit expansion?');
		});

		it('should throw 400 when propositionText is too short', async () => {
			const event = createEvent({
				body: { propositionText: 'Short' }
			});

			await expect(POST(event)).rejects.toMatchObject({ status: 400 });
		});
	});

	// =========================================================================
	// On-chain Fallback
	// =========================================================================

	describe('On-chain Fallback', () => {
		it('should fall back to off-chain when proposeDebate reports not configured', async () => {
			mockProposeDebate.mockResolvedValue({
				success: false,
				error: 'Blockchain not configured'
			});
			const event = createEvent();

			const response = await POST(event);

			expect(response.status).toBe(201);
			// Debate still created via off-chain ID generation
			expect(mockDebateCreate).toHaveBeenCalledTimes(1);
		});

		it('should throw 502 when on-chain fails with non-config error', async () => {
			mockProposeDebate.mockResolvedValue({
				success: false,
				error: 'Transaction reverted'
			});
			const event = createEvent();

			await expect(POST(event)).rejects.toMatchObject({ status: 502 });
		});

		it('should fall back to local domain computation when deriveDomain fails', async () => {
			mockDeriveDomain.mockRejectedValue(new Error('RPC timeout'));
			const event = createEvent();

			const response = await POST(event);

			// Should still succeed — local computation is the fallback
			expect(response.status).toBe(201);
		});
	});
});
