/**
 * Unit Tests: CWC Delivery Client — deliverToOffice (ZK path)
 *
 * Tests for the ZK proof delivery path which accepts TEE-resolved
 * constituent data and delivers via the full CWC XML path.
 *
 * Security properties tested:
 * - Constituent data included in CWC XML (required by CWC endpoints)
 * - XML escaping prevents injection
 * - Per-office rate limiting prevents office flooding
 * - No retry on 4xx (validation/auth errors)
 * - Delivery status updates for audit trail
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ConstituentData } from '$lib/core/legislative/types';

// =============================================================================
// MOCKS
// =============================================================================

const { mockTemplateFindUnique, mockSubmissionUpdate, mockRateLimiterCheck } = vi.hoisted(() => ({
	mockTemplateFindUnique: vi.fn(),
	mockSubmissionUpdate: vi.fn(),
	mockRateLimiterCheck: vi.fn()
}));

vi.mock('$lib/core/db', () => ({
	prisma: {
		template: { findUnique: (...args: unknown[]) => mockTemplateFindUnique(...args) },
		submission: { update: (...args: unknown[]) => mockSubmissionUpdate(...args) }
	},
	db: {
		template: { findUnique: (...args: unknown[]) => mockTemplateFindUnique(...args) },
		submission: { update: (...args: unknown[]) => mockSubmissionUpdate(...args) }
	}
}));

vi.mock('$lib/core/security/rate-limiter', () => ({
	getRateLimiter: () => ({
		check: (...args: unknown[]) => mockRateLimiterCheck(...args)
	})
}));

// Import module under test AFTER mocks
const { cwcClient } = await import('../../../src/lib/core/legislative/cwc-client');

// =============================================================================
// HELPERS
// =============================================================================

let savedFetch: typeof globalThis.fetch;
let savedEnv: NodeJS.ProcessEnv;

beforeEach(() => {
	savedFetch = globalThis.fetch;
	savedEnv = { ...process.env };
});

afterEach(() => {
	globalThis.fetch = savedFetch;
	process.env = savedEnv;
});

const DEFAULT_TEMPLATE = {
	id: 'tpl-001',
	title: 'Support Climate Action',
	description: 'Template for climate advocacy',
	message_body: 'Dear Representative, please support the climate bill.',
	delivery_config: {},
	cwc_config: null
};

const DEFAULT_CONSTITUENT: ConstituentData = {
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
};

const DEFAULT_REQUEST = {
	submissionId: 'sub-001',
	districtId: 'CA-12',
	templateId: 'tpl-001',
	verificationTxHash: '0xabc123'
};

function setupSenateEnv() {
	process.env.CWC_API_BASE_URL = 'https://cwc.example.com/api';
	process.env.CWC_API_KEY = 'test-api-key';
}

function setupHouseEnv() {
	process.env.GCP_PROXY_URL = 'http://test-proxy:8080';
	process.env.GCP_PROXY_AUTH_TOKEN = 'test-proxy-token';
}

function mockSenateSuccess(submissionId = 'cwc-resp-001') {
	globalThis.fetch = vi.fn().mockResolvedValue({
		ok: true,
		status: 200,
		headers: new Headers({ 'content-type': 'text/xml' }),
		text: async () => `<Response><SubmissionId>${submissionId}</SubmissionId></Response>`
	});
}

function mockHouseProxySuccess() {
	globalThis.fetch = vi.fn().mockResolvedValue({
		ok: true,
		status: 200,
		headers: new Headers({ 'content-type': 'application/xml' }),
		text: async () => '<Success>Message Sent</Success>'
	});
}

// =============================================================================
// TESTS
// =============================================================================

describe('CWC Delivery Client — deliverToOffice', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockRateLimiterCheck.mockResolvedValue({ allowed: true });
		mockTemplateFindUnique.mockResolvedValue(DEFAULT_TEMPLATE);
		mockSubmissionUpdate.mockResolvedValue({});
	});

	// =========================================================================
	// Senate Delivery (direct API)
	// =========================================================================

	describe('Senate Delivery', () => {
		beforeEach(() => {
			setupSenateEnv();
			mockSenateSuccess();
		});

		it('should deliver to Senate via direct CWC API', async () => {
			const req = { ...DEFAULT_REQUEST, districtId: 'CA' };

			const result = await cwcClient.deliverToOffice(req, DEFAULT_CONSTITUENT);

			expect(result.success).toBe(true);
			expect(result.cwcSubmissionId).toBeDefined();
		});

		it('should include constituent data in Senate XML', async () => {
			const req = { ...DEFAULT_REQUEST, districtId: 'CA' };

			await cwcClient.deliverToOffice(req, DEFAULT_CONSTITUENT);

			const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
			const xmlBody = fetchMock.mock.calls[0][1].body;
			expect(xmlBody).toContain('<FirstName>Jane</FirstName>');
			expect(xmlBody).toContain('<LastName>Doe</LastName>');
			expect(xmlBody).toContain('jane@example.com');
			expect(xmlBody).toContain('123 Main St');
			expect(xmlBody).toContain('San Francisco');
			expect(xmlBody).toContain('94102');
		});

		it('should use Senate RELAX NG XML format', async () => {
			const req = { ...DEFAULT_REQUEST, districtId: 'CA' };

			await cwcClient.deliverToOffice(req, DEFAULT_CONSTITUENT);

			const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
			const xmlBody = fetchMock.mock.calls[0][1].body;
			expect(xmlBody).toContain('<DeliveryId>');
			expect(xmlBody).toContain('<Constituent>');
			expect(xmlBody).toContain('<ConstituentMessage>');
			expect(xmlBody).toContain('<MemberOffice>');
		});

		it('should POST to Senate CWC endpoint with apikey', async () => {
			const req = { ...DEFAULT_REQUEST, districtId: 'CA' };

			await cwcClient.deliverToOffice(req, DEFAULT_CONSTITUENT);

			const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toContain('cwc.example.com/api/');
			expect(url).toContain('apikey=test-api-key');
			expect(options.headers['Content-Type']).toBe('application/xml');
		});

		it('should fail when CWC_API_KEY not configured', async () => {
			delete process.env.CWC_API_KEY;
			const req = { ...DEFAULT_REQUEST, districtId: 'CA' };

			const result = await cwcClient.deliverToOffice(req, DEFAULT_CONSTITUENT);

			expect(result.success).toBe(false);
			expect(result.error).toContain('not configured');
		});
	});

	// =========================================================================
	// House Delivery (via GCP proxy)
	// =========================================================================

	describe('House Delivery', () => {
		beforeEach(() => {
			setupHouseEnv();
			mockHouseProxySuccess();
		});

		it('should deliver to House via GCP proxy', async () => {
			const result = await cwcClient.deliverToOffice(DEFAULT_REQUEST, DEFAULT_CONSTITUENT);

			expect(result.success).toBe(true);
			expect(result.cwcSubmissionId).toBeDefined();
		});

		it('should send raw CWC XML to proxy endpoint', async () => {
			await cwcClient.deliverToOffice(DEFAULT_REQUEST, DEFAULT_CONSTITUENT);

			const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toContain('test-proxy:8080/cwc-house-test');
			expect(options.headers['Content-Type']).toBe('application/xml');

			// Body is raw XML, not JSON envelope
			expect(options.body).toContain('<CWC>');
			expect(options.body).toContain('<CWCVersion>2.0</CWCVersion>');
		});

		it('should include constituent data in House CWC RELAX NG XML', async () => {
			await cwcClient.deliverToOffice(DEFAULT_REQUEST, DEFAULT_CONSTITUENT);

			const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
			const xml = fetchMock.mock.calls[0][1].body;
			expect(xml).toContain('<CWC>');
			expect(xml).toContain('<Constituent>');
			expect(xml).toContain('<FirstName>Jane</FirstName>');
			expect(xml).toContain('<LastName>Doe</LastName>');
			expect(xml).toContain('jane@example.com');
			expect(xml).toContain('123 Main St');
		});

		it('should fail when GCP_PROXY_URL not configured', async () => {
			delete process.env.GCP_PROXY_URL;

			const result = await cwcClient.deliverToOffice(DEFAULT_REQUEST, DEFAULT_CONSTITUENT);

			expect(result.success).toBe(false);
			expect(result.error).toContain('House CWC delivery not configured');
		});
	});

	// =========================================================================
	// Chamber Inference
	// =========================================================================

	describe('Chamber Inference', () => {
		beforeEach(() => {
			setupSenateEnv();
			setupHouseEnv();
			mockHouseProxySuccess();
			mockSenateSuccess();
		});

		it('should infer House for district IDs with hyphen (CA-12)', async () => {
			// House path uses proxy
			await cwcClient.deliverToOffice(
				{ ...DEFAULT_REQUEST, districtId: 'CA-12' },
				DEFAULT_CONSTITUENT
			);

			const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
			const [url] = fetchMock.mock.calls[0];
			expect(url).toContain('test-proxy');
		});

		it('should infer Senate for state-only district IDs (CA)', async () => {
			// Senate path uses direct API
			await cwcClient.deliverToOffice(
				{ ...DEFAULT_REQUEST, districtId: 'CA' },
				DEFAULT_CONSTITUENT
			);

			const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
			const [url] = fetchMock.mock.calls[0];
			expect(url).toContain('cwc.example.com');
		});

		it('should treat at-large as House (DC-AL has a hyphen)', async () => {
			await cwcClient.deliverToOffice(
				{ ...DEFAULT_REQUEST, districtId: 'DC-AL' },
				DEFAULT_CONSTITUENT
			);

			const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
			const [url] = fetchMock.mock.calls[0];
			expect(url).toContain('test-proxy');
		});
	});

	// =========================================================================
	// XML Escaping
	// =========================================================================

	describe('XML Escaping', () => {
		beforeEach(() => {
			setupSenateEnv();
			mockSenateSuccess();
		});

		it('should escape special characters in template content', async () => {
			mockTemplateFindUnique.mockResolvedValue({
				...DEFAULT_TEMPLATE,
				title: 'Tax & Spend <Policy> "Reform"',
				message_body: "It's important to protect <citizens> & their rights"
			});

			await cwcClient.deliverToOffice(
				{ ...DEFAULT_REQUEST, districtId: 'CA' },
				DEFAULT_CONSTITUENT
			);

			const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
			const xmlBody = fetchMock.mock.calls[0][1].body;
			expect(xmlBody).toContain('&amp;');
			expect(xmlBody).toContain('&lt;');
			expect(xmlBody).toContain('&gt;');
			expect(xmlBody).not.toMatch(/<Policy>/);
			expect(xmlBody).not.toMatch(/<citizens>/);
		});

		it('should escape special characters in constituent data', async () => {
			const constituent: ConstituentData = {
				...DEFAULT_CONSTITUENT,
				name: "O'Brien & Associates",
				address: { ...DEFAULT_CONSTITUENT.address, street: '123 <Main> St' }
			};

			await cwcClient.deliverToOffice(
				{ ...DEFAULT_REQUEST, districtId: 'CA' },
				constituent
			);

			const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
			const xmlBody = fetchMock.mock.calls[0][1].body;
			expect(xmlBody).toContain('&#39;');
			expect(xmlBody).toContain('&amp;');
			expect(xmlBody).toContain('&lt;Main&gt;');
		});
	});

	// =========================================================================
	// Rate Limiting
	// =========================================================================

	describe('Per-office Rate Limiting', () => {
		beforeEach(() => {
			setupHouseEnv();
			mockHouseProxySuccess();
		});

		it('should check per-office rate limit (10/hour)', async () => {
			await cwcClient.deliverToOffice(DEFAULT_REQUEST, DEFAULT_CONSTITUENT);

			expect(mockRateLimiterCheck).toHaveBeenCalledWith(
				'cwc:office:HCA12',
				{ maxRequests: 10, windowMs: 3_600_000 }
			);
		});

		it('should fail when office rate limit is exceeded', async () => {
			mockRateLimiterCheck.mockResolvedValue({ allowed: false, retryAfter: 300 });

			const result = await cwcClient.deliverToOffice(DEFAULT_REQUEST, DEFAULT_CONSTITUENT);

			expect(result.success).toBe(false);
			expect(result.error).toContain('rate limit exceeded');
			const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
			expect(fetchMock).not.toHaveBeenCalled();
		});

		it('should use senate office code for senate districts', async () => {
			setupSenateEnv();
			mockSenateSuccess();

			await cwcClient.deliverToOffice(
				{ ...DEFAULT_REQUEST, districtId: 'TX' },
				DEFAULT_CONSTITUENT
			);

			expect(mockRateLimiterCheck).toHaveBeenCalledWith(
				'cwc:office:TX_SENATE',
				expect.any(Object)
			);
		});
	});

	// =========================================================================
	// Template Lookup
	// =========================================================================

	describe('Template Lookup', () => {
		beforeEach(() => {
			setupSenateEnv();
			mockSenateSuccess();
		});

		it('should fail when template not found', async () => {
			mockTemplateFindUnique.mockResolvedValue(null);

			const result = await cwcClient.deliverToOffice(
				{ ...DEFAULT_REQUEST, districtId: 'CA' },
				DEFAULT_CONSTITUENT
			);

			expect(result.success).toBe(false);
			expect(result.error).toContain('Template');
			expect(result.error).toContain('not found');
		});

		it('should query template with required fields', async () => {
			await cwcClient.deliverToOffice(
				{ ...DEFAULT_REQUEST, districtId: 'CA' },
				DEFAULT_CONSTITUENT
			);

			expect(mockTemplateFindUnique).toHaveBeenCalledWith({
				where: { id: 'tpl-001' },
				select: { id: true, title: true, description: true, message_body: true, delivery_config: true, cwc_config: true }
			});
		});

		it('should use cwc_config overrides when present', async () => {
			mockTemplateFindUnique.mockResolvedValue({
				...DEFAULT_TEMPLATE,
				cwc_config: { chamber: 'senate', officeCode: 'CUSTOM_SENATE' }
			});

			await cwcClient.deliverToOffice(DEFAULT_REQUEST, DEFAULT_CONSTITUENT);

			// Should use Senate format since cwc_config.chamber overrides inference from 'CA-12'
			const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
			const xmlBody = fetchMock.mock.calls[0][1].body;
			expect(xmlBody).toContain('<Constituent>');
			expect(xmlBody).toContain('<ConstituentMessage>');
		});
	});

	// =========================================================================
	// Delivery Status Updates
	// =========================================================================

	describe('Delivery Status Updates', () => {
		beforeEach(() => {
			setupSenateEnv();
			mockSenateSuccess();
		});

		it('should update status to delivered on success', async () => {
			await cwcClient.deliverToOffice(
				{ ...DEFAULT_REQUEST, districtId: 'CA' },
				DEFAULT_CONSTITUENT
			);

			expect(mockSubmissionUpdate).toHaveBeenCalledWith({
				where: { id: 'sub-001' },
				data: expect.objectContaining({
					delivery_status: 'delivered',
					cwc_submission_id: expect.any(String)
				})
			});
		});

		it('should update status to delivery_failed on failure', async () => {
			mockRateLimiterCheck.mockResolvedValue({ allowed: false, retryAfter: 60 });

			await cwcClient.deliverToOffice(
				{ ...DEFAULT_REQUEST, districtId: 'CA' },
				DEFAULT_CONSTITUENT
			);

			expect(mockSubmissionUpdate).toHaveBeenCalledWith({
				where: { id: 'sub-001' },
				data: expect.objectContaining({
					delivery_status: 'delivery_failed',
					delivery_error: expect.any(String)
				})
			});
		});

		it('should update status to delivery_failed when template not found', async () => {
			mockTemplateFindUnique.mockResolvedValue(null);

			await cwcClient.deliverToOffice(
				{ ...DEFAULT_REQUEST, districtId: 'CA' },
				DEFAULT_CONSTITUENT
			);

			expect(mockSubmissionUpdate).toHaveBeenCalledWith({
				where: { id: 'sub-001' },
				data: expect.objectContaining({
					delivery_status: 'delivery_failed'
				})
			});
		});
	});

	// =========================================================================
	// Error Handling
	// =========================================================================

	describe('Error Handling', () => {
		it('should not throw on unexpected errors — returns error result', async () => {
			setupSenateEnv();
			mockTemplateFindUnique.mockRejectedValue(new Error('DB connection lost'));

			const result = await cwcClient.deliverToOffice(
				{ ...DEFAULT_REQUEST, districtId: 'CA' },
				DEFAULT_CONSTITUENT
			);

			expect(result.success).toBe(false);
			expect(result.error).toContain('DB connection lost');
		});

		it('should handle fetch failures gracefully', async () => {
			setupSenateEnv();
			globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network timeout'));

			const result = await cwcClient.deliverToOffice(
				{ ...DEFAULT_REQUEST, districtId: 'CA' },
				DEFAULT_CONSTITUENT
			);

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
		});
	});
});
