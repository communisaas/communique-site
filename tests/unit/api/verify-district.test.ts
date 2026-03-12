/**
 * Unit Tests: POST /api/c/[slug]/verify-district
 *
 * Tests the public district verification endpoint which:
 * 1. Feature-gated behind FEATURES.ADDRESS_SPECIFICITY === 'district'
 * 2. Rate limited: 5 req/min per IP
 * 3. Validates campaign existence (prevents blind address enumeration)
 * 4. Zod-validates address fields
 * 5. Proxies to Census Bureau geocoder
 * 6. Returns ONLY district code — no PII, no coordinates
 *
 * Security properties tested:
 * - Feature gate enforcement
 * - Rate limiting
 * - Campaign existence validation
 * - Input validation (Zod)
 * - Privacy: response never contains address, coordinates, or PII
 * - At-large district handling (00 -> AL)
 * - Census geocoder error handling (timeout, no matches, service error)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

const { mockFindFirst, mockRateLimiterCheck, mockFeatures } = vi.hoisted(() => ({
	mockFindFirst: vi.fn(),
	mockRateLimiterCheck: vi.fn(),
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

// Mock $types
vi.mock('../../../../src/routes/api/c/[slug]/verify-district/$types', () => ({}));

// Import handler AFTER mocks
const { POST } = await import('../../../src/routes/api/c/[slug]/verify-district/+server');

// =============================================================================
// HELPERS
// =============================================================================

let savedFetch: typeof globalThis.fetch;

beforeEach(() => {
	savedFetch = globalThis.fetch;
});

afterEach(() => {
	globalThis.fetch = savedFetch;
});

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

function mockCensusResponse(data: unknown) {
	globalThis.fetch = vi.fn().mockResolvedValue({
		ok: true,
		json: async () => data
	});
}

const VALID_CENSUS_RESPONSE = {
	result: {
		addressMatches: [
			{
				geographies: {
					'119th Congressional Districts': [{ CD119: '12', GEOID: '0612' }],
					States: [{ STUSAB: 'CA' }]
				}
			}
		]
	}
};

const AT_LARGE_CENSUS_RESPONSE = {
	result: {
		addressMatches: [
			{
				geographies: {
					'119th Congressional Districts': [{ CD119: '0', GEOID: '5000' }],
					States: [{ STUSAB: 'VT' }]
				}
			}
		]
	}
};

// =============================================================================
// TESTS
// =============================================================================

describe('POST /api/c/[slug]/verify-district', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockFeatures.ADDRESS_SPECIFICITY = 'district';
		mockRateLimiterCheck.mockResolvedValue({ allowed: true });
		mockFindFirst.mockResolvedValue({ id: 'campaign-123' });
		mockCensusResponse(VALID_CENSUS_RESPONSE);
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
	// Census Bureau Geocoder
	// =========================================================================

	describe('Census Bureau Geocoder', () => {
		it('should return district code for valid address', async () => {
			const event = createEvent();

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.resolved).toBe(true);
			expect(data.district.code).toBe('CA-12');
			expect(data.district.state).toBe('CA');
		});

		it('should handle at-large districts (00 -> AL)', async () => {
			mockCensusResponse(AT_LARGE_CENSUS_RESPONSE);
			const event = createEvent();

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.resolved).toBe(true);
			expect(data.district.code).toBe('VT-AL');
		});

		it('should handle district code 98 as at-large', async () => {
			mockCensusResponse({
				result: {
					addressMatches: [
						{
							geographies: {
								'119th Congressional Districts': [{ CD119: '98' }],
								States: [{ STUSAB: 'DC' }]
							}
						}
					]
				}
			});
			const event = createEvent();

			const response = await POST(event);
			const data = await response.json();

			expect(data.district.code).toBe('DC-AL');
		});

		it('should return error when no address matches found', async () => {
			mockCensusResponse({ result: { addressMatches: [] } });
			const event = createEvent();

			const response = await POST(event);
			const data = await response.json();

			expect(data.resolved).toBe(false);
			expect(data.error).toContain('Address not found');
		});

		it('should return 502 when Census API returns non-ok response', async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 503
			});
			const event = createEvent();

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(502);
			expect(data.error).toContain('service unavailable');
		});

		it('should return 500 when Census geocoder times out', async () => {
			globalThis.fetch = vi.fn().mockRejectedValue(new DOMException('The operation was aborted', 'AbortError'));
			const event = createEvent();

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(500);
			expect(data.resolved).toBe(false);
		});

		it('should return error when district cannot be determined (no district data)', async () => {
			mockCensusResponse({
				result: {
					addressMatches: [
						{
							geographies: {
								States: [{ STUSAB: 'CA' }]
							}
						}
					]
				}
			});
			const event = createEvent();

			const response = await POST(event);
			const data = await response.json();

			expect(data.resolved).toBe(false);
			expect(data.error).toContain('could not be determined');
		});

		it('should return error when stateCode is missing', async () => {
			mockCensusResponse({
				result: {
					addressMatches: [
						{
							geographies: {
								'119th Congressional Districts': [{ CD119: '12' }],
								States: []
							}
						}
					]
				}
			});
			const event = createEvent();

			const response = await POST(event);
			const data = await response.json();

			expect(data.resolved).toBe(false);
			expect(data.error).toContain('could not be determined');
		});

		it('should call Census API with correct parameters', async () => {
			const event = createEvent({
				body: { street: '1600 Pennsylvania Ave', city: 'Washington', state: 'DC', zip: '20500' }
			});

			await POST(event);

			const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
			expect(fetchMock).toHaveBeenCalledTimes(1);

			const calledUrl = new URL(fetchMock.mock.calls[0][0]);
			expect(calledUrl.origin).toBe('https://geocoding.geo.census.gov');
			expect(calledUrl.searchParams.get('street')).toBe('1600 Pennsylvania Ave');
			expect(calledUrl.searchParams.get('city')).toBe('Washington');
			expect(calledUrl.searchParams.get('state')).toBe('DC');
			expect(calledUrl.searchParams.get('zip')).toBe('20500');
			expect(calledUrl.searchParams.get('benchmark')).toBe('4');
			expect(calledUrl.searchParams.get('vintage')).toBe('4');
			expect(calledUrl.searchParams.get('format')).toBe('json');
		});

		it('should pass AbortSignal with timeout to fetch', async () => {
			const event = createEvent();

			await POST(event);

			const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
			const options = fetchMock.mock.calls[0][1];
			expect(options).toHaveProperty('signal');
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
			mockCensusResponse({
				result: {
					addressMatches: [
						{
							coordinates: { x: -122.4194, y: 37.7749 },
							geographies: {
								'119th Congressional Districts': [{ CD119: '12' }],
								States: [{ STUSAB: 'CA' }]
							}
						}
					]
				}
			});
			const event = createEvent();

			const response = await POST(event);
			const text = await response.clone().text();

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
