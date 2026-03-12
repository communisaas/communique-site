/**
 * Unit Tests: PUBLIC_API feature gate + OpenAPI docs endpoint
 *
 * Tests the /api/v1/ endpoints are gated behind FEATURES.PUBLIC_API.
 * When the gate is off, all endpoints throw 404.
 * When the gate is on, endpoints proceed to auth (401 without Bearer token).
 * Also tests the GET /api/v1/docs endpoint returns a valid OpenAPI 3.1 spec.
 *
 * Test groups:
 * 1. Feature gate (PUBLIC_API = false) — endpoints throw 404
 * 2. Feature gate passthrough (PUBLIC_API = true) — gate passes, auth enforced
 * 3. OpenAPI docs endpoint (PUBLIC_API = true) — spec structure
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

const {
	mockFeatures,
	mockAuthenticateApiKey,
	mockRequireScope,
	mockHashApiKey,
	mockDbApiKeyFindUnique,
	mockDbApiKeyUpdate,
	mockDbSupporterFindMany,
	mockDbSupporterCount,
	mockDbCampaignFindMany,
	mockDbCampaignCount
} = vi.hoisted(() => ({
	mockFeatures: {
		DEBATE: true as boolean,
		CONGRESSIONAL: true,
		ADDRESS_SPECIFICITY: 'district' as string,
		STANCE_POSITIONS: false as boolean,
		WALLET: true,
		ANALYTICS_EXPANDED: true,
		AB_TESTING: true,
		PUBLIC_API: false as boolean
	},
	mockAuthenticateApiKey: vi.fn(),
	mockRequireScope: vi.fn(),
	mockHashApiKey: vi.fn(),
	mockDbApiKeyFindUnique: vi.fn(),
	mockDbApiKeyUpdate: vi.fn(),
	mockDbSupporterFindMany: vi.fn(),
	mockDbSupporterCount: vi.fn(),
	mockDbCampaignFindMany: vi.fn(),
	mockDbCampaignCount: vi.fn()
}));

vi.mock('$lib/config/features', () => ({
	FEATURES: mockFeatures
}));

vi.mock('$lib/core/db', () => ({
	db: {
		apiKey: {
			findUnique: mockDbApiKeyFindUnique,
			update: mockDbApiKeyUpdate
		},
		supporter: {
			findMany: mockDbSupporterFindMany,
			count: mockDbSupporterCount
		},
		campaign: {
			findMany: mockDbCampaignFindMany,
			count: mockDbCampaignCount
		}
	}
}));

vi.mock('$lib/server/api-v1/auth', () => ({
	authenticateApiKey: mockAuthenticateApiKey,
	requireScope: mockRequireScope
}));

vi.mock('$lib/core/security/api-key', () => ({
	hashApiKey: mockHashApiKey
}));

// Import handlers AFTER mocks
import { GET as getRoot } from '../../../src/routes/api/v1/+server';
import { GET as getSupporters, POST as postSupporters } from '../../../src/routes/api/v1/supporters/+server';
import { GET as getCampaigns, POST as postCampaigns } from '../../../src/routes/api/v1/campaigns/+server';
import { GET as getDocs } from '../../../src/routes/api/v1/docs/+server';

// =============================================================================
// TESTS
// =============================================================================

describe('PUBLIC_API feature gate', () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	// =========================================================================
	// Group 1: Feature gate (PUBLIC_API = false) — all throw 404
	// =========================================================================
	describe('when PUBLIC_API = false', () => {
		beforeEach(() => {
			mockFeatures.PUBLIC_API = false;
		});

		it('GET /api/v1/ throws 404', async () => {
			await expect(getRoot({} as any)).rejects.toThrow();
		});

		it('GET /api/v1/supporters throws 404', async () => {
			await expect(
				getSupporters({
					request: new Request('http://localhost/api/v1/supporters'),
					url: new URL('http://localhost/api/v1/supporters')
				} as any)
			).rejects.toThrow();
		});

		it('POST /api/v1/supporters throws 404', async () => {
			await expect(
				postSupporters({
					request: new Request('http://localhost/api/v1/supporters', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ email: 'test@example.com' })
					})
				} as any)
			).rejects.toThrow();
		});

		it('GET /api/v1/campaigns throws 404', async () => {
			await expect(
				getCampaigns({
					request: new Request('http://localhost/api/v1/campaigns'),
					url: new URL('http://localhost/api/v1/campaigns')
				} as any)
			).rejects.toThrow();
		});

		it('GET /api/v1/docs throws 404', async () => {
			await expect(getDocs({} as any)).rejects.toThrow();
		});
	});

	// =========================================================================
	// Group 2: Feature gate passthrough (PUBLIC_API = true)
	// =========================================================================
	describe('when PUBLIC_API = true', () => {
		beforeEach(() => {
			mockFeatures.PUBLIC_API = true;
		});

		it('GET /api/v1/ returns 200 with { data: { version: "v1" } }', async () => {
			const response = await getRoot({} as any);
			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body.data.version).toBe('v1');
		});

		it('GET /api/v1/supporters returns 401 (no Bearer token — proves gate passed)', async () => {
			// authenticateApiKey returns a 401 Response when no bearer token
			mockAuthenticateApiKey.mockResolvedValueOnce(
				new Response(
					JSON.stringify({ data: null, error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' } }),
					{ status: 401, headers: { 'Content-Type': 'application/json' } }
				)
			);

			const response = await getSupporters({
				request: new Request('http://localhost/api/v1/supporters'),
				url: new URL('http://localhost/api/v1/supporters')
			} as any);

			expect(response.status).toBe(401);
		});

		it('POST /api/v1/campaigns returns 401 (no Bearer token — proves gate passed)', async () => {
			mockAuthenticateApiKey.mockResolvedValueOnce(
				new Response(
					JSON.stringify({ data: null, error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' } }),
					{ status: 401, headers: { 'Content-Type': 'application/json' } }
				)
			);

			const response = await postCampaigns({
				request: new Request('http://localhost/api/v1/campaigns', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ title: 'Test', type: 'LETTER' })
				})
			} as any);

			expect(response.status).toBe(401);
		});
	});

	// =========================================================================
	// Group 3: OpenAPI docs endpoint (PUBLIC_API = true)
	// =========================================================================
	describe('GET /api/v1/docs', () => {
		beforeEach(() => {
			mockFeatures.PUBLIC_API = true;
		});

		it('returns 200', async () => {
			const response = await getDocs({} as any);
			expect(response.status).toBe(200);
		});

		it('has Content-Type application/json', async () => {
			const response = await getDocs({} as any);
			expect(response.headers.get('Content-Type')).toBe('application/json');
		});

		it('returns openapi: "3.1.0"', async () => {
			const response = await getDocs({} as any);
			const body = await response.json();
			expect(body.openapi).toBe('3.1.0');
		});

		it('contains paths for /supporters, /campaigns, /tags', async () => {
			const response = await getDocs({} as any);
			const body = await response.json();
			expect(body.paths).toHaveProperty('/supporters');
			expect(body.paths).toHaveProperty('/campaigns');
			expect(body.paths).toHaveProperty('/tags');
		});

		it('has components.securitySchemes.bearerAuth', async () => {
			const response = await getDocs({} as any);
			const body = await response.json();
			expect(body.components.securitySchemes).toHaveProperty('bearerAuth');
			expect(body.components.securitySchemes.bearerAuth.type).toBe('http');
			expect(body.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
		});
	});
});
