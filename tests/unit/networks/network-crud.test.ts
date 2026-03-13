/**
 * Unit Tests: Network management APIs (org-facing CRUD)
 *
 * Tests the org network management endpoints:
 *   POST   /api/org/[slug]/networks                          — create network
 *   GET    /api/org/[slug]/networks                          — list networks
 *   GET    /api/org/[slug]/networks/[networkId]              — network detail
 *   PATCH  /api/org/[slug]/networks/[networkId]              — update network
 *   POST   /api/org/[slug]/networks/[networkId]/invite       — invite org
 *   POST   /api/org/[slug]/networks/[networkId]/accept       — accept invitation
 *   DELETE /api/org/[slug]/networks/[networkId]/members/[id] — remove member
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// HOISTED MOCKS
// =============================================================================

const {
	mockLoadOrgContext,
	mockRequireRole,
	mockOrgMeetsPlan,
	mockNetworkCreate,
	mockNetworkFindUnique,
	mockNetworkUpdate,
	mockMemberFindMany,
	mockMemberFindUnique,
	mockMemberCreate,
	mockMemberUpdate,
	mockOrgFindUnique,
	mockFeatures
} = vi.hoisted(() => ({
	mockLoadOrgContext: vi.fn(),
	mockRequireRole: vi.fn(),
	mockOrgMeetsPlan: vi.fn(),
	mockNetworkCreate: vi.fn(),
	mockNetworkFindUnique: vi.fn(),
	mockNetworkUpdate: vi.fn(),
	mockMemberFindMany: vi.fn(),
	mockMemberFindUnique: vi.fn(),
	mockMemberCreate: vi.fn(),
	mockMemberUpdate: vi.fn(),
	mockOrgFindUnique: vi.fn(),
	mockFeatures: {
		NETWORKS: true,
		PUBLIC_API: true,
		DEBATE: true,
		CONGRESSIONAL: true,
		ADDRESS_SPECIFICITY: 'district' as string,
		STANCE_POSITIONS: true,
		WALLET: true,
		ANALYTICS_EXPANDED: true,
		AB_TESTING: true,
		EVENTS: true,
		FUNDRAISING: true,
		AUTOMATION: true,
		SMS: true
	}
}));

// =============================================================================
// MODULE MOCKS
// =============================================================================

vi.mock('$lib/config/features', () => ({
	FEATURES: mockFeatures
}));

vi.mock('$lib/core/db', () => ({
	db: {
		orgNetwork: {
			create: (...args: unknown[]) => mockNetworkCreate(...args),
			findUnique: (...args: unknown[]) => mockNetworkFindUnique(...args),
			update: (...args: unknown[]) => mockNetworkUpdate(...args)
		},
		orgNetworkMember: {
			findMany: (...args: unknown[]) => mockMemberFindMany(...args),
			findUnique: (...args: unknown[]) => mockMemberFindUnique(...args),
			create: (...args: unknown[]) => mockMemberCreate(...args),
			update: (...args: unknown[]) => mockMemberUpdate(...args)
		},
		organization: {
			findUnique: (...args: unknown[]) => mockOrgFindUnique(...args)
		}
	}
}));

vi.mock('$lib/server/org', () => ({
	loadOrgContext: (...args: unknown[]) => mockLoadOrgContext(...args),
	requireRole: (...args: unknown[]) => mockRequireRole(...args)
}));

vi.mock('$lib/server/billing/plan-check', () => ({
	orgMeetsPlan: (...args: unknown[]) => mockOrgMeetsPlan(...args)
}));

vi.mock('zod', async () => {
	const actual = await vi.importActual<typeof import('zod')>('zod');
	return actual;
});

// Mock $types for each route
vi.mock('../../src/routes/api/org/[slug]/networks/$types', () => ({}));
vi.mock('../../src/routes/api/org/[slug]/networks/[networkId]/$types', () => ({}));
vi.mock('../../src/routes/api/org/[slug]/networks/[networkId]/invite/$types', () => ({}));
vi.mock('../../src/routes/api/org/[slug]/networks/[networkId]/accept/$types', () => ({}));
vi.mock('../../src/routes/api/org/[slug]/networks/[networkId]/members/[orgId]/$types', () => ({}));

// =============================================================================
// IMPORTS (after mocks)
// =============================================================================

const { POST: createNetwork, GET: listNetworks } =
	await import('../../../src/routes/api/org/[slug]/networks/+server');

const { GET: getNetworkDetail, PATCH: updateNetwork } =
	await import('../../../src/routes/api/org/[slug]/networks/[networkId]/+server');

const { POST: inviteOrg } =
	await import('../../../src/routes/api/org/[slug]/networks/[networkId]/invite/+server');

const { POST: acceptInvite } =
	await import('../../../src/routes/api/org/[slug]/networks/[networkId]/accept/+server');

const { DELETE: removeMember } =
	await import('../../../src/routes/api/org/[slug]/networks/[networkId]/members/[orgId]/+server');

// =============================================================================
// HELPERS
// =============================================================================

const ORG_ID = 'org-test-123';
const USER_ID = 'user-test-456';
const NETWORK_ID = 'net-test-789';
const NOW = new Date('2026-03-13T00:00:00.000Z');

function makeEvent(overrides: {
	slug?: string;
	networkId?: string;
	orgId?: string;
	body?: Record<string, unknown>;
	locals?: Record<string, unknown>;
} = {}): any {
	const body = overrides.body ?? {};
	return {
		params: {
			slug: overrides.slug ?? 'test-org',
			networkId: overrides.networkId ?? NETWORK_ID,
			orgId: overrides.orgId ?? 'org-other'
		},
		locals: overrides.locals ?? { user: { id: USER_ID } },
		request: new Request('http://localhost/api/org/test-org/networks', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		})
	};
}

function setupDefaults() {
	mockLoadOrgContext.mockResolvedValue({
		org: { id: ORG_ID, name: 'Test Org', slug: 'test-org' },
		membership: { role: 'owner', joinedAt: NOW }
	});
	mockRequireRole.mockReturnValue(undefined);
	mockOrgMeetsPlan.mockResolvedValue(true);
	mockFeatures.NETWORKS = true;
}

// =============================================================================
// TESTS
// =============================================================================

describe('POST /api/org/[slug]/networks — Create network', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setupDefaults();
	});

	it('should create network and auto-add owner as admin member', async () => {
		const network = {
			id: NETWORK_ID,
			name: 'Climate Coalition',
			slug: 'climate-coalition',
			description: 'Cross-org climate network',
			status: 'active',
			ownerOrgId: ORG_ID,
			createdAt: NOW
		};
		mockNetworkCreate.mockResolvedValue(network);

		const event = makeEvent({
			body: {
				name: 'Climate Coalition',
				slug: 'climate-coalition',
				description: 'Cross-org climate network'
			}
		});

		const response = await createNetwork(event);
		expect(response.status).toBe(201);

		const data = await response.json();
		expect(data.data.id).toBe(NETWORK_ID);
		expect(data.data.name).toBe('Climate Coalition');
		expect(data.data.slug).toBe('climate-coalition');

		// Verify create was called with member auto-creation
		expect(mockNetworkCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					members: {
						create: expect.objectContaining({
							orgId: ORG_ID,
							role: 'admin',
							status: 'active'
						})
					}
				})
			})
		);
	});

	it('should return correct response shape', async () => {
		mockNetworkCreate.mockResolvedValue({
			id: NETWORK_ID,
			name: 'Net',
			slug: 'net',
			description: null,
			status: 'active',
			createdAt: NOW
		});

		const event = makeEvent({ body: { name: 'Network', slug: 'net' } });
		const response = await createNetwork(event);
		const data = await response.json();

		expect(data).toHaveProperty('data');
		expect(data.data).toHaveProperty('id');
		expect(data.data).toHaveProperty('name');
		expect(data.data).toHaveProperty('slug');
		expect(data.data).toHaveProperty('status');
		expect(data.data).toHaveProperty('createdAt');
	});

	it('should reject non-Coalition plan orgs with 403', async () => {
		mockOrgMeetsPlan.mockResolvedValue(false);

		const event = makeEvent({ body: { name: 'Net', slug: 'net' } });

		await expect(createNetwork(event)).rejects.toMatchObject({
			status: 403
		});
	});

	it('should reject non-owner role with 403', async () => {
		mockRequireRole.mockImplementation(() => {
			const err = new Error('Forbidden');
			(err as any).status = 403;
			throw err;
		});

		const event = makeEvent({ body: { name: 'Net', slug: 'net' } });

		await expect(createNetwork(event)).rejects.toMatchObject({
			status: 403
		});
	});

	it('should reject duplicate slug with 409', async () => {
		const prismaError = new Error('Unique constraint failed');
		(prismaError as any).code = 'P2002';
		mockNetworkCreate.mockRejectedValue(prismaError);

		const event = makeEvent({
			body: { name: 'Net', slug: 'existing-slug' }
		});

		await expect(createNetwork(event)).rejects.toMatchObject({
			status: 409
		});
	});

	it('should validate slug format — reject uppercase, spaces, special chars', async () => {
		const invalidSlugs = ['My Network', 'NET', 'net@work', 'net work', 'net_work'];
		for (const slug of invalidSlugs) {
			const event = makeEvent({ body: { name: 'Net', slug } });
			await expect(createNetwork(event)).rejects.toMatchObject({
				status: 400
			});
		}
	});

	it('should validate name length — reject empty and >100 chars', async () => {
		// Too short (min 3)
		const event1 = makeEvent({ body: { name: 'AB', slug: 'valid-slug' } });
		await expect(createNetwork(event1)).rejects.toMatchObject({ status: 400 });

		// Too long
		const event2 = makeEvent({ body: { name: 'A'.repeat(101), slug: 'valid-slug' } });
		await expect(createNetwork(event2)).rejects.toMatchObject({ status: 400 });
	});
});

describe('GET /api/org/[slug]/networks — List networks', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setupDefaults();
	});

	it('should return owned and member networks with correct fields', async () => {
		mockMemberFindMany.mockResolvedValue([
			{
				role: 'admin',
				status: 'active',
				network: {
					id: 'net-1',
					name: 'Network One',
					slug: 'net-one',
					description: 'First',
					status: 'active',
					ownerOrg: { id: ORG_ID, name: 'Test Org', slug: 'test-org' },
					_count: { members: 3 },
					createdAt: NOW
				}
			},
			{
				role: 'member',
				status: 'active',
				network: {
					id: 'net-2',
					name: 'Network Two',
					slug: 'net-two',
					description: null,
					status: 'active',
					ownerOrg: { id: 'org-other', name: 'Other Org', slug: 'other-org' },
					_count: { members: 5 },
					createdAt: NOW
				}
			}
		]);

		const event = { params: { slug: 'test-org' }, locals: { user: { id: USER_ID } } };
		const response = await listNetworks(event as any);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.data).toHaveLength(2);
		expect(body.data[0]).toHaveProperty('id');
		expect(body.data[0]).toHaveProperty('role');
		expect(body.data[0]).toHaveProperty('memberCount');
		expect(body.data[0]).toHaveProperty('ownerOrg');
	});

	it('should return pending invitations', async () => {
		mockMemberFindMany.mockResolvedValue([
			{
				role: 'member',
				status: 'pending',
				network: {
					id: 'net-1',
					name: 'Pending Net',
					slug: 'pending',
					description: null,
					status: 'active',
					ownerOrg: { id: 'org-other', name: 'Other', slug: 'other' },
					_count: { members: 2 },
					createdAt: NOW
				}
			}
		]);

		const event = { params: { slug: 'test-org' }, locals: { user: { id: USER_ID } } };
		const response = await listNetworks(event as any);
		const body = await response.json();

		expect(body.data).toHaveLength(1);
		expect(body.data[0].memberStatus).toBe('pending');
	});

	it('should return empty array for org with no networks', async () => {
		mockMemberFindMany.mockResolvedValue([]);

		const event = { params: { slug: 'test-org' }, locals: { user: { id: USER_ID } } };
		const response = await listNetworks(event as any);
		const body = await response.json();

		expect(body.data).toEqual([]);
	});

	it('should include memberCount for each network', async () => {
		mockMemberFindMany.mockResolvedValue([
			{
				role: 'admin',
				status: 'active',
				network: {
					id: 'net-1',
					name: 'Big Net',
					slug: 'big',
					description: null,
					status: 'active',
					ownerOrg: { id: ORG_ID, name: 'Test', slug: 'test' },
					_count: { members: 42 },
					createdAt: NOW
				}
			}
		]);

		const event = { params: { slug: 'test-org' }, locals: { user: { id: USER_ID } } };
		const response = await listNetworks(event as any);
		const body = await response.json();

		expect(body.data[0].memberCount).toBe(42);
	});
});

describe('GET /api/org/[slug]/networks/[networkId] — Network detail', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setupDefaults();
	});

	it('should return network with member list', async () => {
		mockMemberFindUnique.mockResolvedValue({
			id: 'mem-1',
			status: 'active',
			role: 'admin'
		});
		mockNetworkFindUnique.mockResolvedValue({
			id: NETWORK_ID,
			name: 'Test Net',
			slug: 'test-net',
			description: 'A test network',
			status: 'active',
			ownerOrg: { id: ORG_ID, name: 'Test Org', slug: 'test-org' },
			members: [
				{
					id: 'mem-1',
					role: 'admin',
					joinedAt: NOW,
					org: { id: ORG_ID, name: 'Test Org', slug: 'test-org' }
				},
				{
					id: 'mem-2',
					role: 'member',
					joinedAt: NOW,
					org: { id: 'org-2', name: 'Org Two', slug: 'org-two' }
				}
			],
			createdAt: NOW
		});

		const event = {
			params: { slug: 'test-org', networkId: NETWORK_ID },
			locals: { user: { id: USER_ID } }
		};
		const response = await getNetworkDetail(event as any);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.data.members).toHaveLength(2);
		expect(body.data.memberCount).toBe(2);
		expect(body.data.ownerOrg).toEqual({ id: ORG_ID, name: 'Test Org', slug: 'test-org' });
	});

	it('should return 404 for non-existent network', async () => {
		mockMemberFindUnique.mockResolvedValue({
			id: 'mem-1',
			status: 'active',
			role: 'admin'
		});
		mockNetworkFindUnique.mockResolvedValue(null);

		const event = {
			params: { slug: 'test-org', networkId: 'non-existent' },
			locals: { user: { id: USER_ID } }
		};

		await expect(getNetworkDetail(event as any)).rejects.toMatchObject({
			status: 404
		});
	});

	it('should return 403 for non-member org', async () => {
		mockMemberFindUnique.mockResolvedValue(null);

		const event = {
			params: { slug: 'test-org', networkId: NETWORK_ID },
			locals: { user: { id: USER_ID } }
		};

		await expect(getNetworkDetail(event as any)).rejects.toMatchObject({
			status: 403
		});
	});
});

describe('PATCH /api/org/[slug]/networks/[networkId] — Update', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setupDefaults();
	});

	it('should update name and description', async () => {
		mockMemberFindUnique.mockResolvedValue({
			id: 'mem-1',
			status: 'active',
			role: 'admin'
		});
		mockNetworkUpdate.mockResolvedValue({
			id: NETWORK_ID,
			name: 'New Name',
			description: 'New desc',
			updatedAt: NOW
		});

		const event = {
			params: { slug: 'test-org', networkId: NETWORK_ID },
			locals: { user: { id: USER_ID } },
			request: new Request('http://localhost', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: 'New Name', description: 'New desc' })
			})
		};
		const response = await updateNetwork(event as any);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.data.name).toBe('New Name');
		expect(body.data.description).toBe('New desc');
	});

	it('should reject non-admin with 403', async () => {
		mockMemberFindUnique.mockResolvedValue({
			id: 'mem-1',
			status: 'active',
			role: 'member' // not admin
		});

		const event = {
			params: { slug: 'test-org', networkId: NETWORK_ID },
			locals: { user: { id: USER_ID } },
			request: new Request('http://localhost', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: 'New Name' })
			})
		};

		await expect(updateNetwork(event as any)).rejects.toMatchObject({
			status: 403
		});
	});

	it('should allow partial update (name only)', async () => {
		mockMemberFindUnique.mockResolvedValue({
			id: 'mem-1',
			status: 'active',
			role: 'admin'
		});
		mockNetworkUpdate.mockResolvedValue({
			id: NETWORK_ID,
			name: 'Only Name',
			description: null,
			updatedAt: NOW
		});

		const event = {
			params: { slug: 'test-org', networkId: NETWORK_ID },
			locals: { user: { id: USER_ID } },
			request: new Request('http://localhost', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: 'Only Name' })
			})
		};
		const response = await updateNetwork(event as any);

		expect(response.status).toBe(200);
		expect(mockNetworkUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ name: 'Only Name' })
			})
		);
	});

	it('should allow partial update (description only)', async () => {
		mockMemberFindUnique.mockResolvedValue({
			id: 'mem-1',
			status: 'active',
			role: 'admin'
		});
		mockNetworkUpdate.mockResolvedValue({
			id: NETWORK_ID,
			name: 'Existing',
			description: 'New description only',
			updatedAt: NOW
		});

		const event = {
			params: { slug: 'test-org', networkId: NETWORK_ID },
			locals: { user: { id: USER_ID } },
			request: new Request('http://localhost', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ description: 'New description only' })
			})
		};
		const response = await updateNetwork(event as any);

		expect(response.status).toBe(200);
	});
});

describe('POST .../invite — Invite org', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setupDefaults();
	});

	it('should create pending membership', async () => {
		mockMemberFindUnique
			.mockResolvedValueOnce({ id: 'mem-1', status: 'active', role: 'admin' }) // caller check
			.mockResolvedValueOnce(null); // no existing membership for target
		mockOrgFindUnique.mockResolvedValue({ id: 'target-org-id' });
		mockMemberCreate.mockResolvedValue({
			id: 'mem-new',
			networkId: NETWORK_ID,
			orgId: 'target-org-id',
			status: 'pending',
			joinedAt: NOW
		});

		const event = {
			params: { slug: 'test-org', networkId: NETWORK_ID },
			locals: { user: { id: USER_ID } },
			request: new Request('http://localhost', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ orgSlug: 'target-org' })
			})
		};
		const response = await inviteOrg(event as any);
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(body.data.status).toBe('pending');
		expect(mockMemberCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					status: 'pending',
					role: 'member'
				})
			})
		);
	});

	it('should reject duplicate invite/membership with 409', async () => {
		mockMemberFindUnique
			.mockResolvedValueOnce({ id: 'mem-1', status: 'active', role: 'admin' }) // caller check
			.mockResolvedValueOnce({ id: 'mem-existing', status: 'active' }); // already a member
		mockOrgFindUnique.mockResolvedValue({ id: 'target-org-id' });

		const event = {
			params: { slug: 'test-org', networkId: NETWORK_ID },
			locals: { user: { id: USER_ID } },
			request: new Request('http://localhost', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ orgSlug: 'target-org' })
			})
		};

		await expect(inviteOrg(event as any)).rejects.toMatchObject({
			status: 409
		});
	});

	it('should reject non-admin with 403', async () => {
		mockMemberFindUnique.mockResolvedValueOnce({
			id: 'mem-1',
			status: 'active',
			role: 'member' // not admin
		});

		const event = {
			params: { slug: 'test-org', networkId: NETWORK_ID },
			locals: { user: { id: USER_ID } },
			request: new Request('http://localhost', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ orgSlug: 'target-org' })
			})
		};

		await expect(inviteOrg(event as any)).rejects.toMatchObject({
			status: 403
		});
	});

	it('should return 404 for non-existent target org slug', async () => {
		mockMemberFindUnique.mockResolvedValueOnce({
			id: 'mem-1',
			status: 'active',
			role: 'admin'
		});
		mockOrgFindUnique.mockResolvedValue(null);

		const event = {
			params: { slug: 'test-org', networkId: NETWORK_ID },
			locals: { user: { id: USER_ID } },
			request: new Request('http://localhost', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ orgSlug: 'nonexistent-org' })
			})
		};

		await expect(inviteOrg(event as any)).rejects.toMatchObject({
			status: 404
		});
	});
});

describe('POST .../accept — Accept invitation', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setupDefaults();
	});

	it('should update status from pending to active', async () => {
		mockMemberFindUnique.mockResolvedValue({
			id: 'mem-pending',
			status: 'pending'
		});
		mockMemberUpdate.mockResolvedValue({
			id: 'mem-pending',
			networkId: NETWORK_ID,
			orgId: ORG_ID,
			status: 'active'
		});

		const event = {
			params: { slug: 'test-org', networkId: NETWORK_ID },
			locals: { user: { id: USER_ID } }
		};
		const response = await acceptInvite(event as any);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.data.status).toBe('active');
		expect(mockMemberUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: { status: 'active' }
			})
		);
	});

	it('should return 404 when no pending invite exists', async () => {
		mockMemberFindUnique.mockResolvedValue(null);

		const event = {
			params: { slug: 'test-org', networkId: NETWORK_ID },
			locals: { user: { id: USER_ID } }
		};

		await expect(acceptInvite(event as any)).rejects.toMatchObject({
			status: 404
		});
	});
});

describe('DELETE .../members/[orgId] — Remove member', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setupDefaults();
	});

	it('should remove member successfully', async () => {
		// Caller is admin
		mockMemberFindUnique
			.mockResolvedValueOnce({ id: 'mem-admin', status: 'active', role: 'admin' })
			.mockResolvedValueOnce({ id: 'mem-target', status: 'active', role: 'member' });
		mockNetworkFindUnique.mockResolvedValue({ ownerOrgId: ORG_ID });
		mockMemberUpdate.mockResolvedValue({ id: 'mem-target', status: 'removed' });

		const event = {
			params: { slug: 'test-org', networkId: NETWORK_ID, orgId: 'org-target' },
			locals: { user: { id: USER_ID } }
		};
		const response = await removeMember(event as any);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.data.removed).toBe(true);
	});

	it('should not allow removing owner org (400)', async () => {
		mockMemberFindUnique.mockResolvedValueOnce({
			id: 'mem-admin',
			status: 'active',
			role: 'admin'
		});
		mockNetworkFindUnique.mockResolvedValue({ ownerOrgId: ORG_ID });

		const event = {
			params: { slug: 'test-org', networkId: NETWORK_ID, orgId: ORG_ID },
			locals: { user: { id: USER_ID } }
		};

		await expect(removeMember(event as any)).rejects.toMatchObject({
			status: 400
		});
	});

	it('should reject non-admin with 403', async () => {
		mockMemberFindUnique.mockResolvedValueOnce({
			id: 'mem-1',
			status: 'active',
			role: 'member' // not admin
		});

		const event = {
			params: { slug: 'test-org', networkId: NETWORK_ID, orgId: 'org-target' },
			locals: { user: { id: USER_ID } }
		};

		await expect(removeMember(event as any)).rejects.toMatchObject({
			status: 403
		});
	});
});
