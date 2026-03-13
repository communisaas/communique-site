/**
 * Unit Tests: API v1 network endpoints
 *
 * Tests the public REST API network endpoints:
 *   GET /api/v1/networks           — list networks for authenticated org
 *   GET /api/v1/networks/[id]      — network detail with members
 *   GET /api/v1/networks/[id]/stats — aggregated coalition stats
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// HOISTED MOCKS
// =============================================================================

const {
	mockAuthenticateApiKey,
	mockRequireScope,
	mockCheckApiPlanRateLimit,
	mockMemberFindMany,
	mockMemberFindFirst,
	mockMemberCount,
	mockNetworkFindUnique,
	mockGetNetworkStats,
	mockFeatures
} = vi.hoisted(() => ({
	mockAuthenticateApiKey: vi.fn(),
	mockRequireScope: vi.fn(),
	mockCheckApiPlanRateLimit: vi.fn(),
	mockMemberFindMany: vi.fn(),
	mockMemberFindFirst: vi.fn(),
	mockMemberCount: vi.fn(),
	mockNetworkFindUnique: vi.fn(),
	mockGetNetworkStats: vi.fn(),
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
		orgNetworkMember: {
			findMany: (...args: unknown[]) => mockMemberFindMany(...args),
			findFirst: (...args: unknown[]) => mockMemberFindFirst(...args),
			count: (...args: unknown[]) => mockMemberCount(...args)
		},
		orgNetwork: {
			findUnique: (...args: unknown[]) => mockNetworkFindUnique(...args)
		}
	}
}));

vi.mock('$lib/server/api-v1/auth', () => ({
	authenticateApiKey: (...args: unknown[]) => mockAuthenticateApiKey(...args),
	requireScope: (...args: unknown[]) => mockRequireScope(...args)
}));

vi.mock('$lib/server/api-v1/gate', () => ({
	requirePublicApi: vi.fn()
}));

vi.mock('$lib/server/api-v1/rate-limit', () => ({
	checkApiPlanRateLimit: (...args: unknown[]) => mockCheckApiPlanRateLimit(...args)
}));

vi.mock('$lib/server/api-v1/response', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/api-v1/response')>(
		'../../../src/lib/server/api-v1/response'
	);
	return actual;
});

vi.mock('$lib/server/networks/aggregation', () => ({
	getNetworkStats: (...args: unknown[]) => mockGetNetworkStats(...args)
}));

// Mock $types
vi.mock('../../src/routes/api/v1/networks/$types', () => ({}));
vi.mock('../../src/routes/api/v1/networks/[id]/$types', () => ({}));
vi.mock('../../src/routes/api/v1/networks/[id]/stats/$types', () => ({}));

// =============================================================================
// IMPORTS (after mocks)
// =============================================================================

const { GET: listNetworks } =
	await import('../../../src/routes/api/v1/networks/+server');

const { GET: getNetworkDetail } =
	await import('../../../src/routes/api/v1/networks/[id]/+server');

const { GET: getNetworkStats } =
	await import('../../../src/routes/api/v1/networks/[id]/stats/+server');

// =============================================================================
// HELPERS
// =============================================================================

const ORG_ID = 'org-api-123';
const KEY_ID = 'key-test-456';
const NETWORK_ID = 'net-api-789';
const NOW = new Date('2026-03-13T00:00:00.000Z');

const VALID_AUTH_CONTEXT = {
	orgId: ORG_ID,
	keyId: KEY_ID,
	scopes: ['read', 'write'],
	planSlug: 'coalition'
};

function setupAuthDefaults() {
	mockAuthenticateApiKey.mockResolvedValue(VALID_AUTH_CONTEXT);
	mockRequireScope.mockReturnValue(null);
	mockCheckApiPlanRateLimit.mockResolvedValue(null);
	mockFeatures.NETWORKS = true;
	mockFeatures.PUBLIC_API = true;
}

function makeRequest(url = 'http://localhost/api/v1/networks') {
	return new Request(url, {
		headers: { Authorization: 'Bearer ck_live_test123' }
	});
}

// =============================================================================
// TESTS: GET /api/v1/networks
// =============================================================================

describe('GET /api/v1/networks — List', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setupAuthDefaults();
	});

	it('should return networks for authenticated org', async () => {
		const memberships = [
			{
				id: 'mem-1',
				role: 'admin',
				joinedAt: NOW,
				network: {
					id: 'net-1',
					name: 'Net One',
					slug: 'net-one',
					description: 'First network',
					status: 'active',
					ownerOrgId: ORG_ID,
					_count: { members: 3 },
					createdAt: NOW,
					updatedAt: NOW
				}
			}
		];
		mockMemberFindMany.mockResolvedValue(memberships);
		mockMemberCount.mockResolvedValue(1);

		const event = {
			request: makeRequest(),
			url: new URL('http://localhost/api/v1/networks')
		};
		const response = await listNetworks(event as any);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.data).toHaveLength(1);
		expect(body.data[0].name).toBe('Net One');
		expect(body.data[0].role).toBe('admin');
	});

	it('should apply correct response envelope { data, meta }', async () => {
		mockMemberFindMany.mockResolvedValue([]);
		mockMemberCount.mockResolvedValue(0);

		const event = {
			request: makeRequest(),
			url: new URL('http://localhost/api/v1/networks')
		};
		const response = await listNetworks(event as any);
		const body = await response.json();

		expect(body).toHaveProperty('data');
		expect(body).toHaveProperty('meta');
		expect(body.meta).toHaveProperty('hasMore');
		expect(body.meta).toHaveProperty('total');
	});

	it('should return empty array for org with no networks', async () => {
		mockMemberFindMany.mockResolvedValue([]);
		mockMemberCount.mockResolvedValue(0);

		const event = {
			request: makeRequest(),
			url: new URL('http://localhost/api/v1/networks')
		};
		const response = await listNetworks(event as any);
		const body = await response.json();

		expect(body.data).toEqual([]);
		expect(body.meta.total).toBe(0);
	});

	it('should require valid API key (401)', async () => {
		mockAuthenticateApiKey.mockResolvedValue(
			new Response(JSON.stringify({
				data: null,
				error: { code: 'UNAUTHORIZED', message: 'Invalid API key' }
			}), { status: 401, headers: { 'Content-Type': 'application/json' } })
		);

		const event = {
			request: makeRequest(),
			url: new URL('http://localhost/api/v1/networks')
		};
		const response = await listNetworks(event as any);

		expect(response.status).toBe(401);
	});
});

// =============================================================================
// TESTS: GET /api/v1/networks/[id]
// =============================================================================

describe('GET /api/v1/networks/[id] — Detail', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setupAuthDefaults();
	});

	it('should return network with members', async () => {
		mockMemberFindFirst.mockResolvedValue({
			id: 'mem-1',
			status: 'active'
		});
		mockNetworkFindUnique.mockResolvedValue({
			id: NETWORK_ID,
			name: 'Test Network',
			slug: 'test-net',
			description: 'A coalition',
			status: 'active',
			ownerOrgId: ORG_ID,
			ownerOrg: { id: ORG_ID, name: 'Test Org', slug: 'test-org' },
			members: [
				{
					role: 'admin',
					joinedAt: NOW,
					org: { id: ORG_ID, name: 'Test Org', slug: 'test-org' }
				},
				{
					role: 'member',
					joinedAt: NOW,
					org: { id: 'org-2', name: 'Org Two', slug: 'org-two' }
				}
			],
			createdAt: NOW,
			updatedAt: NOW
		});

		const event = {
			params: { id: NETWORK_ID },
			request: makeRequest()
		};
		const response = await getNetworkDetail(event as any);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.data.id).toBe(NETWORK_ID);
		expect(body.data.members).toHaveLength(2);
		expect(body.data.memberCount).toBe(2);
	});

	it('should return 403 for non-member org', async () => {
		mockMemberFindFirst.mockResolvedValue(null); // not a member

		const event = {
			params: { id: NETWORK_ID },
			request: makeRequest()
		};
		const response = await getNetworkDetail(event as any);
		const body = await response.json();

		expect(response.status).toBe(403);
		expect(body.error.code).toBe('FORBIDDEN');
	});

	it('should return 404 for non-existent network', async () => {
		mockMemberFindFirst.mockResolvedValue({
			id: 'mem-1',
			status: 'active'
		});
		mockNetworkFindUnique.mockResolvedValue(null);

		const event = {
			params: { id: 'nonexistent' },
			request: makeRequest()
		};
		const response = await getNetworkDetail(event as any);
		const body = await response.json();

		expect(response.status).toBe(404);
		expect(body.error.code).toBe('NOT_FOUND');
	});

	it('should include ownerOrg info', async () => {
		mockMemberFindFirst.mockResolvedValue({
			id: 'mem-1',
			status: 'active'
		});
		mockNetworkFindUnique.mockResolvedValue({
			id: NETWORK_ID,
			name: 'Net',
			slug: 'net',
			description: null,
			status: 'active',
			ownerOrgId: ORG_ID,
			ownerOrg: { id: ORG_ID, name: 'Owner Org', slug: 'owner-org' },
			members: [],
			createdAt: NOW,
			updatedAt: NOW
		});

		const event = {
			params: { id: NETWORK_ID },
			request: makeRequest()
		};
		const response = await getNetworkDetail(event as any);
		const body = await response.json();

		expect(body.data.ownerOrg).toEqual({
			id: ORG_ID,
			name: 'Owner Org',
			slug: 'owner-org'
		});
	});
});

// =============================================================================
// TESTS: GET /api/v1/networks/[id]/stats
// =============================================================================

describe('GET /api/v1/networks/[id]/stats — Stats', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setupAuthDefaults();
	});

	it('should return aggregated stats in correct shape', async () => {
		mockMemberFindFirst.mockResolvedValue({
			id: 'mem-1',
			status: 'active'
		});
		mockGetNetworkStats.mockResolvedValue({
			memberCount: 5,
			totalSupporters: 500,
			uniqueSupporters: 400,
			verifiedSupporters: 200,
			totalCampaignActions: 1500,
			verifiedCampaignActions: 900,
			stateDistribution: { CA: 200, NY: 100, TX: 100 }
		});

		const event = {
			params: { id: NETWORK_ID },
			request: makeRequest()
		};
		const response = await getNetworkStats(event as any);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.data.memberCount).toBe(5);
		expect(body.data.totalSupporters).toBe(500);
		expect(body.data.uniqueSupporters).toBe(400);
		expect(body.data.verifiedSupporters).toBe(200);
		expect(body.data.totalCampaignActions).toBe(1500);
		expect(body.data.verifiedCampaignActions).toBe(900);
		expect(body.data.stateDistribution).toEqual({ CA: 200, NY: 100, TX: 100 });
	});

	it('should return 403 for non-member org', async () => {
		mockMemberFindFirst.mockResolvedValue(null);

		const event = {
			params: { id: NETWORK_ID },
			request: makeRequest()
		};
		const response = await getNetworkStats(event as any);
		const body = await response.json();

		expect(response.status).toBe(403);
		expect(body.error.code).toBe('FORBIDDEN');
	});

	it('should return correct stat fields', async () => {
		mockMemberFindFirst.mockResolvedValue({
			id: 'mem-1',
			status: 'active'
		});
		mockGetNetworkStats.mockResolvedValue({
			memberCount: 2,
			totalSupporters: 100,
			uniqueSupporters: 80,
			verifiedSupporters: 50,
			totalCampaignActions: 200,
			verifiedCampaignActions: 150,
			stateDistribution: {}
		});

		const event = {
			params: { id: NETWORK_ID },
			request: makeRequest()
		};
		const response = await getNetworkStats(event as any);
		const body = await response.json();

		const data = body.data;
		expect(data).toHaveProperty('memberCount');
		expect(data).toHaveProperty('totalSupporters');
		expect(data).toHaveProperty('uniqueSupporters');
		expect(data).toHaveProperty('verifiedSupporters');
		expect(data).toHaveProperty('totalCampaignActions');
		expect(data).toHaveProperty('verifiedCampaignActions');
		expect(data).toHaveProperty('stateDistribution');
	});
});
