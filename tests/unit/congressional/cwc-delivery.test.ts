/**
 * Unit Tests: CWC Delivery Client
 *
 * Tests for src/lib/core/congressional/cwc-delivery.ts which:
 * 1. Delivers verified constituent messages to Congress via CWC API
 * 2. Builds XML payloads (House CWC 2.0 and Senate simplified)
 * 3. Handles retry with exponential backoff on server errors
 * 4. Per-office rate limiting (10/hour)
 * 5. Updates submission delivery status
 *
 * Security properties tested:
 * - XML escaping prevents injection
 * - Per-office rate limiting prevents office flooding
 * - No retry on 4xx (validation/auth errors)
 * - Delivery status updates for audit trail
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
		template: {
			findUnique: (...args: unknown[]) => mockTemplateFindUnique(...args)
		},
		submission: {
			update: (...args: unknown[]) => mockSubmissionUpdate(...args)
		}
	},
	db: {
		template: {
			findUnique: (...args: unknown[]) => mockTemplateFindUnique(...args)
		},
		submission: {
			update: (...args: unknown[]) => mockSubmissionUpdate(...args)
		}
	}
}));

vi.mock('$lib/core/security/rate-limiter', () => ({
	getRateLimiter: () => ({
		check: (...args: unknown[]) => mockRateLimiterCheck(...args)
	})
}));

// Import module under test AFTER mocks
const { deliverToCWC } = await import('../../../src/lib/core/congressional/cwc-delivery');

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
	title: 'Support Climate Action',
	message_body: 'Dear Representative, please support the climate bill.',
	cwc_config: null
};

const DEFAULT_REQUEST = {
	submissionId: 'sub-001',
	districtId: 'CA-12',
	templateId: 'tpl-001',
	verificationTxHash: '0xabc123'
};

function setupCWCEnv() {
	process.env.CWC_API_URL = 'https://cwc.example.com/api/submit';
	process.env.CWC_API_KEY = 'test-api-key';
}

function mockCWCSuccess(cwcSubmissionId = 'cwc-resp-001') {
	globalThis.fetch = vi.fn().mockResolvedValue({
		ok: true,
		text: async () => `<Response><SubmissionId>${cwcSubmissionId}</SubmissionId></Response>`
	});
}

// =============================================================================
// TESTS — Exported functions
// =============================================================================

// We can only test deliverToCWC directly since other functions are module-private.
// We test those indirectly through deliverToCWC behavior.

describe('CWC Delivery Client', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockRateLimiterCheck.mockResolvedValue({ allowed: true });
		mockTemplateFindUnique.mockResolvedValue(DEFAULT_TEMPLATE);
		mockSubmissionUpdate.mockResolvedValue({});
		setupCWCEnv();
		mockCWCSuccess();
	});

	// =========================================================================
	// Chamber Inference (tested via deliverToCWC behavior)
	// =========================================================================

	describe('Chamber Inference', () => {
		it('should use House format for district IDs with hyphen (e.g., CA-12)', async () => {
			const req = { ...DEFAULT_REQUEST, districtId: 'CA-12' };

			const result = await deliverToCWC(req);

			expect(result.success).toBe(true);
			const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
			const xmlBody = fetchMock.mock.calls[0][1].body;
			expect(xmlBody).toContain('<CWC version="2.0">');
		});

		it('should use Senate format for state-only district IDs (e.g., CA)', async () => {
			const req = { ...DEFAULT_REQUEST, districtId: 'CA' };

			const result = await deliverToCWC(req);

			expect(result.success).toBe(true);
			const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
			const xmlBody = fetchMock.mock.calls[0][1].body;
			expect(xmlBody).not.toContain('version="2.0"');
			expect(xmlBody).toContain('<DeliveryId>');
			expect(xmlBody).toContain('<ConstituentMessage>');
		});

		it('should treat at-large districts as House (DC-AL has a hyphen)', async () => {
			const req = { ...DEFAULT_REQUEST, districtId: 'DC-AL' };

			const result = await deliverToCWC(req);

			expect(result.success).toBe(true);
			const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
			const xmlBody = fetchMock.mock.calls[0][1].body;
			expect(xmlBody).toContain('<CWC version="2.0">');
		});
	});

	// =========================================================================
	// XML Escaping
	// =========================================================================

	describe('XML Escaping', () => {
		it('should escape special characters in subject and body', async () => {
			mockTemplateFindUnique.mockResolvedValue({
				title: 'Tax & Spend <Policy> "Reform"',
				message_body: "It's important to protect <citizens> & their rights",
				cwc_config: null
			});

			await deliverToCWC(DEFAULT_REQUEST);

			const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
			const xmlBody = fetchMock.mock.calls[0][1].body;
			expect(xmlBody).toContain('&amp;');
			expect(xmlBody).toContain('&lt;');
			expect(xmlBody).toContain('&gt;');
			expect(xmlBody).toContain('&quot;');
			expect(xmlBody).toContain('&apos;');
			// Raw special chars should not appear unescaped
			expect(xmlBody).not.toMatch(/<Policy>/);
			expect(xmlBody).not.toMatch(/<citizens>/);
		});

		it('should prevent XML injection via malicious input', async () => {
			mockTemplateFindUnique.mockResolvedValue({
				title: '</Subject><Malicious>injected</Malicious><Subject>',
				message_body: 'Normal body',
				cwc_config: null
			});

			await deliverToCWC(DEFAULT_REQUEST);

			const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
			const xmlBody = fetchMock.mock.calls[0][1].body;
			// The malicious tags should be escaped, not parsed as XML
			expect(xmlBody).not.toContain('<Malicious>');
			expect(xmlBody).toContain('&lt;/Subject&gt;');
		});
	});

	// =========================================================================
	// XML Structure
	// =========================================================================

	describe('XML Structure', () => {
		it('should build valid House CWC 2.0 XML', async () => {
			await deliverToCWC(DEFAULT_REQUEST);

			const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
			const xmlBody = fetchMock.mock.calls[0][1].body;
			expect(xmlBody).toContain('<?xml version="1.0" encoding="UTF-8"?>');
			expect(xmlBody).toContain('<CWC version="2.0">');
			expect(xmlBody).toContain('<MessageHeader>');
			expect(xmlBody).toContain('<MessageId>');
			expect(xmlBody).toContain('<DeliveryAgent>');
			expect(xmlBody).toContain('<OfficeCode>CA12_HOUSE</OfficeCode>');
			expect(xmlBody).toContain('<Subject>');
			expect(xmlBody).toContain('<Body>');
			expect(xmlBody).toContain('<IntegrityHash>scroll:0xabc123</IntegrityHash>');
			expect(xmlBody).toContain('</CWC>');
		});

		it('should build valid Senate XML', async () => {
			const req = { ...DEFAULT_REQUEST, districtId: 'CA' };

			await deliverToCWC(req);

			const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
			const xmlBody = fetchMock.mock.calls[0][1].body;
			expect(xmlBody).toContain('<?xml version="1.0" encoding="UTF-8"?>');
			expect(xmlBody).toContain('<CWC>');
			expect(xmlBody).toContain('<DeliveryId>');
			expect(xmlBody).toContain('<OfficeCode>CA_SENATE</OfficeCode>');
			expect(xmlBody).toContain('<ConstituentMessage>');
			expect(xmlBody).toContain('<IntegrityHash>scroll:0xabc123</IntegrityHash>');
		});

		it('should include Commons platform name in DeliveryAgent', async () => {
			await deliverToCWC(DEFAULT_REQUEST);

			const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
			const xmlBody = fetchMock.mock.calls[0][1].body;
			expect(xmlBody).toContain('<Name>Commons Advocacy Platform</Name>');
		});
	});

	// =========================================================================
	// CWC API Posting
	// =========================================================================

	describe('CWC API Posting', () => {
		it('should POST XML to CWC_API_URL with correct headers', async () => {
			await deliverToCWC(DEFAULT_REQUEST);

			const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
			expect(fetchMock).toHaveBeenCalledTimes(1);

			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toBe('https://cwc.example.com/api/submit');
			expect(options.method).toBe('POST');
			expect(options.headers['Content-Type']).toBe('application/xml');
			expect(options.headers['Authorization']).toBe('Bearer test-api-key');
			expect(options.headers['Accept']).toBe('application/xml');
		});

		it('should return success with cwcSubmissionId from response', async () => {
			mockCWCSuccess('cwc-12345');

			const result = await deliverToCWC(DEFAULT_REQUEST);

			expect(result.success).toBe(true);
			expect(result.cwcSubmissionId).toBe('cwc-12345');
		});

		it('should fail when CWC_API_URL is not configured', async () => {
			delete process.env.CWC_API_URL;

			const result = await deliverToCWC(DEFAULT_REQUEST);

			expect(result.success).toBe(false);
			expect(result.error).toContain('not configured');
		});

		it('should fail when CWC_API_KEY is not configured', async () => {
			delete process.env.CWC_API_KEY;

			const result = await deliverToCWC(DEFAULT_REQUEST);

			expect(result.success).toBe(false);
			expect(result.error).toContain('not configured');
		});
	});

	// =========================================================================
	// Retry Behavior
	// =========================================================================

	describe('Retry Behavior', () => {
		it('should retry on 5xx errors with exponential backoff', async () => {
			let callCount = 0;
			globalThis.fetch = vi.fn().mockImplementation(async () => {
				callCount++;
				if (callCount < 3) {
					return { ok: false, status: 500, text: async () => 'Internal Server Error' };
				}
				return {
					ok: true,
					text: async () => '<Response><SubmissionId>cwc-retry-ok</SubmissionId></Response>'
				};
			});

			const result = await deliverToCWC(DEFAULT_REQUEST);

			expect(result.success).toBe(true);
			expect(result.cwcSubmissionId).toBe('cwc-retry-ok');
			expect(callCount).toBe(3);
		});

		it('should NOT retry on 4xx errors', async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 400,
				text: async () => 'Bad Request: Invalid XML'
			});

			const result = await deliverToCWC(DEFAULT_REQUEST);

			expect(result.success).toBe(false);
			expect(result.error).toContain('400');
			// Only called once — no retry
			expect(globalThis.fetch).toHaveBeenCalledTimes(1);
		});

		it('should give up after max retries on persistent server errors', async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 503,
				text: async () => 'Service Unavailable'
			});

			const result = await deliverToCWC(DEFAULT_REQUEST);

			expect(result.success).toBe(false);
			expect(result.error).toContain('server error');
			expect(result.error).toContain('3 attempts');
			// Default maxRetries = 3
			expect(globalThis.fetch).toHaveBeenCalledTimes(3);
		});

		it('should retry on network errors', async () => {
			let callCount = 0;
			globalThis.fetch = vi.fn().mockImplementation(async () => {
				callCount++;
				if (callCount < 3) {
					throw new Error('Network timeout');
				}
				return {
					ok: true,
					text: async () => '<Response><SubmissionId>cwc-net-ok</SubmissionId></Response>'
				};
			});

			const result = await deliverToCWC(DEFAULT_REQUEST);

			expect(result.success).toBe(true);
			expect(callCount).toBe(3);
		});
	});

	// =========================================================================
	// Rate Limiting
	// =========================================================================

	describe('Per-office Rate Limiting', () => {
		it('should check per-office rate limit (10/hour)', async () => {
			await deliverToCWC(DEFAULT_REQUEST);

			expect(mockRateLimiterCheck).toHaveBeenCalledWith(
				'cwc:office:CA12_HOUSE',
				{ maxRequests: 10, windowMs: 3_600_000 }
			);
		});

		it('should fail when office rate limit is exceeded', async () => {
			mockRateLimiterCheck.mockResolvedValue({ allowed: false, retryAfter: 300 });

			const result = await deliverToCWC(DEFAULT_REQUEST);

			expect(result.success).toBe(false);
			expect(result.error).toContain('rate limit exceeded');
			// Should not call fetch when rate limited
			const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
			expect(fetchMock).not.toHaveBeenCalled();
		});

		it('should use senate office code for senate districts', async () => {
			const req = { ...DEFAULT_REQUEST, districtId: 'TX' };

			await deliverToCWC(req);

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
		it('should fail when template not found', async () => {
			mockTemplateFindUnique.mockResolvedValue(null);

			const result = await deliverToCWC(DEFAULT_REQUEST);

			expect(result.success).toBe(false);
			expect(result.error).toContain('Template');
			expect(result.error).toContain('not found');
		});

		it('should query template with correct fields', async () => {
			await deliverToCWC(DEFAULT_REQUEST);

			expect(mockTemplateFindUnique).toHaveBeenCalledWith({
				where: { id: 'tpl-001' },
				select: { title: true, message_body: true, cwc_config: true }
			});
		});

		it('should use cwc_config overrides when present', async () => {
			mockTemplateFindUnique.mockResolvedValue({
				...DEFAULT_TEMPLATE,
				cwc_config: { chamber: 'senate', officeCode: 'CUSTOM_SENATE' }
			});

			await deliverToCWC(DEFAULT_REQUEST);

			const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
			const xmlBody = fetchMock.mock.calls[0][1].body;
			// Should use Senate format since cwc_config.chamber overrides inference
			expect(xmlBody).toContain('<ConstituentMessage>');
			expect(xmlBody).toContain('<OfficeCode>CUSTOM_SENATE</OfficeCode>');
		});
	});

	// =========================================================================
	// Delivery Status Updates
	// =========================================================================

	describe('Delivery Status Updates', () => {
		it('should update status to delivered on success', async () => {
			await deliverToCWC(DEFAULT_REQUEST);

			expect(mockSubmissionUpdate).toHaveBeenCalledWith({
				where: { id: 'sub-001' },
				data: expect.objectContaining({
					delivery_status: 'delivered',
					delivery_error: null,
					cwc_submission_id: expect.any(String),
					delivered_at: expect.any(Date)
				})
			});
		});

		it('should update status to delivery_failed on failure', async () => {
			mockRateLimiterCheck.mockResolvedValue({ allowed: false, retryAfter: 60 });

			await deliverToCWC(DEFAULT_REQUEST);

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

			await deliverToCWC(DEFAULT_REQUEST);

			expect(mockSubmissionUpdate).toHaveBeenCalledWith({
				where: { id: 'sub-001' },
				data: expect.objectContaining({
					delivery_status: 'delivery_failed'
				})
			});
		});
	});

	// =========================================================================
	// Full Flow
	// =========================================================================

	describe('Full Delivery Flow', () => {
		it('should complete full House delivery: template -> XML -> post -> update', async () => {
			const result = await deliverToCWC(DEFAULT_REQUEST);

			expect(result.success).toBe(true);
			expect(result.cwcSubmissionId).toBeDefined();

			// Template was fetched
			expect(mockTemplateFindUnique).toHaveBeenCalledTimes(1);
			// Rate limit was checked
			expect(mockRateLimiterCheck).toHaveBeenCalledTimes(1);
			// CWC API was called
			const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
			expect(fetchMock).toHaveBeenCalledTimes(1);
			// Status was updated
			expect(mockSubmissionUpdate).toHaveBeenCalledTimes(1);
		});

		it('should complete full Senate delivery flow', async () => {
			const req = { ...DEFAULT_REQUEST, districtId: 'NY' };

			const result = await deliverToCWC(req);

			expect(result.success).toBe(true);

			const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
			const xmlBody = fetchMock.mock.calls[0][1].body;
			expect(xmlBody).toContain('<OfficeCode>NY_SENATE</OfficeCode>');
		});

		it('should not throw on unexpected errors — returns error result instead', async () => {
			mockTemplateFindUnique.mockRejectedValue(new Error('DB connection lost'));

			const result = await deliverToCWC(DEFAULT_REQUEST);

			expect(result.success).toBe(false);
			expect(result.error).toContain('DB connection lost');
		});
	});
});
