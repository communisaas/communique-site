/**
 * Unit Tests: POST /api/c/[slug]/verify-district
 *
 * Tests the public district verification endpoint which:
 * 1. Feature-gated behind FEATURES.ADDRESS_SPECIFICITY === 'district'
 * 2. Rate limited: 5 req/min per IP
 * 3. Validates campaign existence (prevents blind address enumeration)
 * 4. Zod-validates address fields
 * 5. Resolves district via Shadow Atlas resolveAddress()
 * 6. Returns ONLY district code — no PII, no coordinates
 *
 * Security properties tested:
 * - Feature gate enforcement
 * - Rate limiting
 * - Campaign existence validation
 * - Input validation (Zod)
 * - Privacy: response never contains address, coordinates, or PII
 * - At-large district handling
 * - Shadow Atlas error handling (timeout, no matches, service error)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

const { mockFindFirst, mockRateLimiterCheck, mockFeatures, mockResolveAddress } = vi.hoisted(() => ({
	mockFindFirst: vi.fn(),
	mockRateLimiterCheck: vi.fn(),
	mockResolveAddress: vi.fn(),
	mockFeatures: {
		DEBATE: true,
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
			findFirst: (...args: unknown[]) => mockFindFirst(...args)
		}
	},
	prisma: {
		campaign: {
			findFirst: (...args: unknown[]) => mockFindFirst(...args)
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

vi.mock('$lib/core/shadow-atlas/client', () => ({
	resolveAddress: (...args: unknown[]) => mockResolveAddress(...args)
}));

// Mock $types
vi.mock('../../../../src/routes/api/c/[slug]/verify-district/$types', () => ({}));

// Import handler AFTER mocks
const { POST } = await import('../../../src/routes/api/c/[slug]/verify-district/+server');

// =============================================================================
// HELPERS
// =============================================================================

function createEvent(overrides: {
	slug?: string;
	body?: Record<string, unknown>;
	ip?: string;
} = {}): any {
	const body = overrides.body ?? {
		street: '123 Main St',
		city: 'San Francisco',
		state: 'CA',
		zip: '94102'
	};
	return {
		request: new Request('http://localhost/api/c/test-campaign/verify-district', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		params: { slug: overrides.slug ?? 'campaign-123' },
		getClientAddress: () => overrides.ip ?? '127.0.0.1'
	};
}

/** Build a mock Shadow Atlas resolveAddress() response */
function mockShadowAtlasSuccess(districtCode: string, state: string) {
	mockResolveAddress.mockResolvedValue({
		geocode: { lat: 37.7749, lng: -122.4194, matched_address: 'MATCHED ADDRESS', confidence: 0.95, country: 'US' },
		district: { id: districtCode, name: `District ${districtCode}`, jurisdiction: 'congressional', district_type: 'congressional' },
		officials: { district_code: districtCode, state, officials: [], special_status: null, source: 'congress-legislators', cached: true },
		cell_id: '872830828ffffff',
		vintage: 'shadow-atlas-nominatim'
	});
}

// =============================================================================
// TESTS
// =============================================================================

describe('POST /api/c/[slug]/verify-district', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockFeatures.ADDRESS_SPECIFICITY = 'district';
		mockRateLimiterCheck.mockResolvedValue({ allowed: true });
		mockFindFirst.mockResolvedValue({ id: 'campaign-123' });
		mockShadowAtlasSuccess('CA-12', 'CA');
	});

	// =========================================================================
	// Feature Gate
	// =========================================================================

	describe('Feature Gate', () => {
		it('should return 404 when ADDRESS_SPECIFICITY is not district', async () => {
			mockFeatures.ADDRESS_SPECIFICITY = 'off';
			const event = createEvent();

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(404);
			expect(data.error).toContain('not enabled');
		});

		it('should return 404 when ADDRESS_SPECIFICITY is region', async () => {
			mockFeatures.ADDRESS_SPECIFICITY = 'region';
			const event = createEvent();

			const response = await POST(event);

			expect(response.status).toBe(404);
		});

		it('should proceed when ADDRESS_SPECIFICITY is district', async () => {
			const event = createEvent();

			const response = await POST(event);

			expect(response.status).toBe(200);
		});
	});

	// =========================================================================
	// Rate Limiting
	// =========================================================================

	describe('Rate Limiting', () => {
		it('should return 429 when rate limit exceeded', async () => {
			mockRateLimiterCheck.mockResolvedValue({ allowed: false });
			const event = createEvent();

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(429);
			expect(data.error).toContain('Too many requests');
		});

		it('should check rate limit with correct key based on IP', async () => {
			const event = createEvent({ ip: '10.0.0.1' });

			await POST(event);

			expect(mockRateLimiterCheck).toHaveBeenCalledWith(
				'ratelimit:campaign-verify-district:10.0.0.1',
				{ maxRequests: 5, windowMs: 60_000 }
			);
		});
	});

	// =========================================================================
	// Campaign Validation
	// =========================================================================

	describe('Campaign Validation', () => {
		it('should return 404 when campaign not found', async () => {
			mockFindFirst.mockResolvedValue(null);
			const event = createEvent();

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(404);
			expect(data.error).toContain('Campaign not found');
		});

		it('should query campaign by slug with ACTIVE status', async () => {
			const event = createEvent({ slug: 'my-campaign' });

			await POST(event);

			expect(mockFindFirst).toHaveBeenCalledWith({
				where: { id: 'my-campaign', status: 'ACTIVE' },
				select: { id: true }
			});
		});
	});

	// =========================================================================
	// Input Validation
	// =========================================================================

	describe('Input Validation', () => {
		it('should return 400 when street is missing', async () => {
			const event = createEvent({
				body: { city: 'SF', state: 'CA', zip: '94102' }
			});

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toBe('Invalid address');
			expect(data.details).toBeDefined();
		});

		it('should return 400 when city is missing', async () => {
			const event = createEvent({
				body: { street: '123 Main St', state: 'CA', zip: '94102' }
			});

			const response = await POST(event);

			expect(response.status).toBe(400);
		});

		it('should return 400 when state is not 2 characters', async () => {
			const event = createEvent({
				body: { street: '123 Main', city: 'SF', state: 'California', zip: '94102' }
			});

			const response = await POST(event);

			expect(response.status).toBe(400);
		});

		it('should return 400 for invalid zip code format', async () => {
			const event = createEvent({
				body: { street: '123 Main', city: 'SF', state: 'CA', zip: 'ABCDE' }
			});

			const response = await POST(event);

			expect(response.status).toBe(400);
		});

		it('should accept valid 5-digit zip', async () => {
			const event = createEvent({
				body: { street: '123 Main', city: 'SF', state: 'CA', zip: '94102' }
			});

			const response = await POST(event);

			expect(response.status).toBe(200);
		});

		it('should accept valid zip+4 format', async () => {
			const event = createEvent({
				body: { street: '123 Main', city: 'SF', state: 'CA', zip: '94102-1234' }
			});

			const response = await POST(event);

			expect(response.status).toBe(200);
		});

		it('should return 400 when street exceeds 200 chars', async () => {
			const event = createEvent({
				body: { street: 'A'.repeat(201), city: 'SF', state: 'CA', zip: '94102' }
			});

			const response = await POST(event);

			expect(response.status).toBe(400);
		});

		it('should return 400 when city exceeds 100 chars', async () => {
			const event = createEvent({
				body: { street: '123 Main', city: 'A'.repeat(101), state: 'CA', zip: '94102' }
			});

			const response = await POST(event);

			expect(response.status).toBe(400);
		});
	});

	// =========================================================================
	// Shadow Atlas District Resolution
	// =========================================================================

	describe('Shadow Atlas District Resolution', () => {
		it('should return district code for valid address', async () => {
			const event = createEvent();

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.resolved).toBe(true);
			expect(data.district.code).toBe('CA-12');
			expect(data.district.state).toBe('CA');
		});

		it('should handle at-large districts', async () => {
			mockShadowAtlasSuccess('VT-AL', 'VT');
			const event = createEvent();

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.resolved).toBe(true);
			expect(data.district.code).toBe('VT-AL');
		});

		it('should handle DC at-large district', async () => {
			mockShadowAtlasSuccess('DC-AL', 'DC');
			const event = createEvent();

			const response = await POST(event);
			const data = await response.json();

			expect(data.district.code).toBe('DC-AL');
		});

		it('should return error when district cannot be determined (no officials)', async () => {
			mockResolveAddress.mockResolvedValue({
				geocode: { lat: 37.7749, lng: -122.4194, matched_address: 'MATCHED', confidence: 0.9, country: 'US' },
				district: null,
				officials: null,
				cell_id: null,
				vintage: 'shadow-atlas-nominatim'
			});
			const event = createEvent();

			const response = await POST(event);
			const data = await response.json();

			expect(data.resolved).toBe(false);
			expect(data.error).toContain('could not be determined');
		});

		it('should return error when officials exist but district_code is null', async () => {
			mockResolveAddress.mockResolvedValue({
				geocode: { lat: 37.7749, lng: -122.4194, matched_address: 'MATCHED', confidence: 0.9, country: 'US' },
				district: { id: 'CA-12', name: 'District', jurisdiction: 'congressional', district_type: 'congressional' },
				officials: { district_code: null, state: 'CA', officials: [], special_status: null, source: 'congress-legislators', cached: true },
				cell_id: null,
				vintage: 'shadow-atlas-nominatim'
			});
			const event = createEvent();

			const response = await POST(event);
			const data = await response.json();

			expect(data.resolved).toBe(false);
			expect(data.error).toContain('could not be determined');
		});

		it('should return 500 when Shadow Atlas throws (service unavailable)', async () => {
			mockResolveAddress.mockRejectedValue(new Error('Nominatim geocoding returned 503'));
			const event = createEvent();

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(500);
			expect(data.resolved).toBe(false);
		});

		it('should return 500 when Shadow Atlas times out', async () => {
			mockResolveAddress.mockRejectedValue(new DOMException('The operation was aborted', 'AbortError'));
			const event = createEvent();

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(500);
			expect(data.resolved).toBe(false);
		});

		it('should call resolveAddress with correct parameters', async () => {
			const event = createEvent({
				body: { street: '1600 Pennsylvania Ave', city: 'Washington', state: 'DC', zip: '20500' }
			});

			await POST(event);

			expect(mockResolveAddress).toHaveBeenCalledTimes(1);
			expect(mockResolveAddress).toHaveBeenCalledWith({
				street: '1600 Pennsylvania Ave',
				city: 'Washington',
				state: 'DC',
				zip: '20500'
			});
		});

		it('should use state from input when officials.state is missing', async () => {
			mockResolveAddress.mockResolvedValue({
				geocode: { lat: 37.7749, lng: -122.4194, matched_address: 'MATCHED', confidence: 0.9, country: 'US' },
				district: { id: 'CA-12', name: 'District', jurisdiction: 'congressional', district_type: 'congressional' },
				officials: { district_code: 'CA-12', state: undefined, officials: [], special_status: null, source: 'congress-legislators', cached: true },
				cell_id: null,
				vintage: 'shadow-atlas-nominatim'
			});
			const event = createEvent();

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.district.state).toBe('CA');
		});
	});

	// =========================================================================
	// Privacy
	// =========================================================================

	describe('Privacy', () => {
		it('should never return address in the response', async () => {
			const event = createEvent({
				body: { street: '123 Main St', city: 'San Francisco', state: 'CA', zip: '94102' }
			});

			const response = await POST(event);
			const text = await response.clone().text();

			expect(text).not.toContain('123 Main St');
			expect(text).not.toContain('San Francisco');
			expect(text).not.toContain('94102');
		});

		it('should never return coordinates in the response', async () => {
			const event = createEvent();

			const response = await POST(event);
			const text = await response.clone().text();

			// Shadow Atlas returns coordinates internally but endpoint must strip them
			expect(text).not.toContain('-122.4194');
			expect(text).not.toContain('37.7749');
			expect(text).not.toContain('coordinates');
		});

		it('should only return district code and state in successful response', async () => {
			const event = createEvent();

			const response = await POST(event);
			const data = await response.json();

			expect(Object.keys(data)).toEqual(['resolved', 'district']);
			expect(Object.keys(data.district)).toEqual(['code', 'state']);
		});
	});
});
