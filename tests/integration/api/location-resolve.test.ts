/**
 * Location Resolve API Integration Tests
 *
 * Tests for POST /api/location/resolve endpoint.
 * This endpoint resolves lat/lng coordinates to congressional districts
 * and officials using Shadow Atlas — never accepts address data.
 *
 * Test Coverage:
 * - Authentication (2 tests)
 * - Validation (6 tests)
 * - Privacy Guard (5 tests)
 * - Happy Path — Client Census (2 tests)
 * - Happy Path — Shadow Atlas (1 test)
 * - Happy Path — Composite Resolve (3 tests)
 * - Degradation (2 tests)
 * - ZK Eligibility (3 tests)
 * - No Database Writes (1 test)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../../../src/routes/api/location/resolve/+server';

// Mock Shadow Atlas client — must be before import
vi.mock('$lib/core/shadow-atlas/client', () => ({
	lookupDistrict: vi.fn(),
	getOfficials: vi.fn(),
	resolveLocation: vi.fn()
}));

import { lookupDistrict, getOfficials, resolveLocation } from '$lib/core/shadow-atlas/client';

const mockedLookupDistrict = vi.mocked(lookupDistrict);
const mockedGetOfficials = vi.mocked(getOfficials);
const mockedResolveLocation = vi.mocked(resolveLocation);

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function createMockEvent(
	body: Record<string, unknown>,
	user: { id: string } | null = { id: 'test-user' }
) {
	return {
		request: new Request('http://localhost/api/location/resolve', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		locals: { user },
		url: new URL('http://localhost/api/location/resolve'),
		params: {},
		platform: undefined,
		route: { id: '/api/location/resolve' }
	} as any;
}

/** Standard valid body for tests that only care about one field */
function validBody(overrides: Record<string, unknown> = {}) {
	return {
		lat: 40.7128,
		lng: -74.006,
		signal_type: 'browser',
		confidence: 0.8,
		...overrides
	};
}

/** Build a mock OfficialsResponse for getOfficials */
function mockOfficialsResponse(count: number, districtCode = 'CA-12') {
	const officials = Array.from({ length: count }, (_, i) => ({
		bioguide_id: `B00000${i + 1}`,
		name: `Official ${i + 1}`,
		party: i === 0 ? 'Democratic' : 'Republican',
		chamber: i === 0 ? ('house' as const) : ('senate' as const),
		state: districtCode.split('-')[0],
		district: i === 0 ? districtCode.split('-')[1] : null,
		office: `Office ${i + 1}`,
		phone: '202-555-0100',
		contact_form_url: null,
		website_url: null,
		cwc_code: null,
		is_voting: true,
		delegate_type: null
	}));

	return {
		officials,
		district_code: districtCode,
		state: districtCode.split('-')[0],
		special_status: null,
		source: 'congress-legislators' as const,
		cached: false
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/location/resolve', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	// ========================================================================
	// Authentication
	// ========================================================================

	describe('Authentication', () => {
		it('returns 401 when not authenticated', async () => {
			const event = createMockEvent(validBody(), null);
			const response = await POST(event);

			expect(response.status).toBe(401);
		});

		it('returns 401 with correct error shape', async () => {
			const event = createMockEvent(validBody(), null);
			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(401);
			expect(data).toEqual({ resolved: false, error: 'Authentication required' });
		});
	});

	// ========================================================================
	// Validation
	// ========================================================================

	describe('Validation', () => {
		it('returns 400 for missing lat/lng', async () => {
			const event = createMockEvent({ signal_type: 'browser', confidence: 0.5 });
			const response = await POST(event);

			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.resolved).toBe(false);
		});

		it('returns 400 for out-of-range latitude', async () => {
			const event = createMockEvent({
				lat: 95,
				lng: 0,
				signal_type: 'browser',
				confidence: 0.5
			});
			const response = await POST(event);

			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.resolved).toBe(false);
		});

		it('returns 400 for out-of-range longitude', async () => {
			const event = createMockEvent({
				lat: 0,
				lng: 200,
				signal_type: 'browser',
				confidence: 0.5
			});
			const response = await POST(event);

			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.resolved).toBe(false);
		});

		it('returns 400 for invalid signal_type', async () => {
			const event = createMockEvent({
				lat: 40,
				lng: -74,
				signal_type: 'invalid',
				confidence: 0.5
			});
			const response = await POST(event);

			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.resolved).toBe(false);
		});

		it('returns 400 for invalid cell_id format', async () => {
			const event = createMockEvent({
				lat: 40,
				lng: -74,
				signal_type: 'browser',
				confidence: 0.5,
				cell_id: '123' // must be exactly 15 digits
			});
			const response = await POST(event);

			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.resolved).toBe(false);
		});

		it('returns 400 for invalid district_code format', async () => {
			const event = createMockEvent({
				lat: 40,
				lng: -74,
				signal_type: 'browser',
				confidence: 0.5,
				district_code: 'invalid' // must match /^[A-Z]{2}-(\d{2}|AL)$/
			});
			const response = await POST(event);

			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.resolved).toBe(false);
		});
	});

	// ========================================================================
	// Privacy Guard
	// ========================================================================

	describe('Privacy Guard', () => {
		it('rejects requests with street field', async () => {
			const event = createMockEvent({
				...validBody(),
				street: '123 Main St'
			});
			const response = await POST(event);

			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.resolved).toBe(false);
		});

		it('rejects requests with city field', async () => {
			const event = createMockEvent({
				...validBody(),
				city: 'Springfield'
			});
			const response = await POST(event);

			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.resolved).toBe(false);
		});

		it('rejects requests with address field', async () => {
			const event = createMockEvent({
				...validBody(),
				address: '123 Main St'
			});
			const response = await POST(event);

			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.resolved).toBe(false);
		});

		it('rejects requests with zipCode field', async () => {
			const event = createMockEvent({
				...validBody(),
				zipCode: '12345'
			});
			const response = await POST(event);

			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.resolved).toBe(false);
		});

		it('returns correct error message for address leak', async () => {
			const event = createMockEvent({
				...validBody(),
				street: '123 Main St'
			});
			const response = await POST(event);
			const data = await response.json();

			expect(data.error).toContain('Address fields must not be sent');
		});
	});

	// ========================================================================
	// Happy Path — Client Census
	// ========================================================================

	describe('Happy Path — Client Census', () => {
		it('resolves district from client-provided district_code', async () => {
			mockedGetOfficials.mockResolvedValue(mockOfficialsResponse(3, 'CA-12'));

			const event = createMockEvent(validBody({ district_code: 'CA-12' }));
			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.resolved).toBe(true);
			expect(data.district.code).toBe('CA-12');
			expect(data.district_source).toBe('client_census');
		});

		it('returns officials from Shadow Atlas', async () => {
			mockedGetOfficials.mockResolvedValue(mockOfficialsResponse(3, 'CA-12'));

			const event = createMockEvent(validBody({ district_code: 'CA-12' }));
			const response = await POST(event);
			const data = await response.json();

			expect(data.officials).toHaveLength(3);
			for (const official of data.officials) {
				expect(official).toHaveProperty('name');
				expect(official).toHaveProperty('bioguide_id');
				expect(official).toHaveProperty('chamber');
				expect(official).toHaveProperty('party');
				expect(official).toHaveProperty('state');
			}
		});

		it('normalizes at-large district_code 00 → AL', async () => {
			mockedGetOfficials.mockResolvedValue(mockOfficialsResponse(3, 'WY-AL'));

			const event = createMockEvent(validBody({ district_code: 'WY-00' }));
			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.resolved).toBe(true);
			expect(data.district.code).toBe('WY-AL');
			expect(data.district_source).toBe('client_census');
			// getOfficials must receive the normalized code, not the raw 00
			expect(mockedGetOfficials).toHaveBeenCalledWith('WY-AL');
		});
	});

	// ========================================================================
	// Happy Path — Shadow Atlas
	// ========================================================================

	describe('Happy Path — Shadow Atlas', () => {
		it('resolves district via Shadow Atlas lookup', async () => {
			mockedLookupDistrict.mockResolvedValue({
				district: {
					id: 'NY-10',
					name: 'New York 10th',
					jurisdiction: 'federal',
					districtType: 'congressional'
				},
				merkleProof: {
					root: '0x1234',
					leaf: '0x5678',
					siblings: Array(20).fill('0x0000'),
					pathIndices: Array(20).fill(0),
					depth: 20
				}
			});
			mockedGetOfficials.mockResolvedValue(mockOfficialsResponse(3, 'NY-10'));

			const event = createMockEvent(validBody());
			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.resolved).toBe(true);
			expect(data.district_source).toBe('shadow_atlas');
		});
	});

	// ========================================================================
	// Happy Path — Composite Resolve
	// ========================================================================

	describe('Happy Path — Composite Resolve', () => {
		const mockMerkleProof = {
			root: '0x1234',
			leaf: '0x5678',
			siblings: Array(20).fill('0x0000'),
			pathIndices: Array(20).fill(0),
			depth: 20
		};

		it('resolves district + officials via composite call', async () => {
			const officialsData = mockOfficialsResponse(3, 'NY-10');
			mockedResolveLocation.mockResolvedValue({
				district: {
					district: { id: 'NY-10', name: 'New York 10th', jurisdiction: 'congressional', districtType: 'congressional' },
					merkleProof: mockMerkleProof
				},
				officials: {
					officials: officialsData.officials,
					district_code: 'NY-10',
					state: 'NY',
					special_status: null,
					source: 'congress-legislators' as const,
					cached: false
				}
			});

			// No district_code — forces Shadow Atlas composite path
			const event = createMockEvent(validBody());
			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.resolved).toBe(true);
			expect(data.district.code).toBe('NY-10');
			expect(data.district_source).toBe('shadow_atlas');
			expect(data.officials).toHaveLength(3);
			for (const official of data.officials) {
				expect(official).toHaveProperty('name');
				expect(official).toHaveProperty('bioguide_id');
				expect(official).toHaveProperty('chamber');
			}
			// Composite path should NOT call the separate lookup or officials endpoints
			expect(mockedLookupDistrict).not.toHaveBeenCalled();
			expect(mockedGetOfficials).not.toHaveBeenCalled();
		});

		it('resolves district only when composite returns null officials', async () => {
			mockedResolveLocation.mockResolvedValue({
				district: {
					district: { id: 'NY-10', name: 'New York 10th', jurisdiction: 'congressional', districtType: 'congressional' },
					merkleProof: mockMerkleProof
				},
				officials: null
			});
			mockedGetOfficials.mockResolvedValue(mockOfficialsResponse(3, 'NY-10'));

			const event = createMockEvent(validBody());
			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.resolved).toBe(true);
			expect(data.district.code).toBe('NY-10');
			expect(data.district_source).toBe('shadow_atlas');
			// Officials resolved via separate getOfficials call
			expect(data.officials).toHaveLength(3);
			expect(mockedGetOfficials).toHaveBeenCalledWith('NY-10');
			// lookupDistrict should NOT be called — district came from composite
			expect(mockedLookupDistrict).not.toHaveBeenCalled();
		});

		it('falls back to lookupDistrict when composite call fails', async () => {
			mockedResolveLocation.mockRejectedValue(new Error('Composite endpoint unavailable'));
			mockedLookupDistrict.mockResolvedValue({
				district: {
					id: 'NY-10',
					name: 'New York 10th',
					jurisdiction: 'federal',
					districtType: 'congressional'
				},
				merkleProof: mockMerkleProof
			});
			mockedGetOfficials.mockResolvedValue(mockOfficialsResponse(3, 'NY-10'));

			const event = createMockEvent(validBody());
			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.resolved).toBe(true);
			expect(data.district.code).toBe('NY-10');
			expect(data.district_source).toBe('shadow_atlas');
			// Fallback should use lookupDistrict + getOfficials
			expect(mockedLookupDistrict).toHaveBeenCalledWith(40.7128, -74.006);
			expect(mockedGetOfficials).toHaveBeenCalledWith('NY-10');
		});
	});

	// ========================================================================
	// Degradation
	// ========================================================================

	describe('Degradation', () => {
		it('returns resolved: false when Shadow Atlas lookup fails', async () => {
			mockedLookupDistrict.mockRejectedValue(new Error('Shadow Atlas unreachable'));

			// No district_code — forces Shadow Atlas path
			const event = createMockEvent(validBody());
			const response = await POST(event);
			const data = await response.json();

			expect(data.resolved).toBe(false);
		});

		it('returns empty officials when getOfficials fails', async () => {
			mockedGetOfficials.mockRejectedValue(new Error('Officials service down'));

			// Provide district_code so resolution succeeds but officials fail
			const event = createMockEvent(validBody({ district_code: 'CA-12' }));
			const response = await POST(event);
			const data = await response.json();

			expect(data.resolved).toBe(true);
			expect(data.officials).toEqual([]);
		});
	});

	// ========================================================================
	// ZK Eligibility
	// ========================================================================

	describe('ZK Eligibility', () => {
		it('zk_eligible is true when cell_id provided', async () => {
			mockedGetOfficials.mockResolvedValue(mockOfficialsResponse(1, 'CA-12'));

			const event = createMockEvent(
				validBody({ district_code: 'CA-12', cell_id: '123456789012345' })
			);
			const response = await POST(event);
			const data = await response.json();

			expect(data.zk_eligible).toBe(true);
		});

		it('zk_eligible is false when cell_id not provided', async () => {
			mockedGetOfficials.mockResolvedValue(mockOfficialsResponse(1, 'CA-12'));

			const event = createMockEvent(validBody({ district_code: 'CA-12' }));
			const response = await POST(event);
			const data = await response.json();

			expect(data.zk_eligible).toBe(false);
		});

		it('cell_id is returned in response when provided', async () => {
			mockedGetOfficials.mockResolvedValue(mockOfficialsResponse(1, 'CA-12'));

			const event = createMockEvent(
				validBody({ district_code: 'CA-12', cell_id: '123456789012345' })
			);
			const response = await POST(event);
			const data = await response.json();

			expect(data.cell_id).toBe('123456789012345');
		});
	});

	// ========================================================================
	// No Database Writes
	// ========================================================================

	describe('No Database Writes', () => {
		it('does not import or use prisma', async () => {
			// Read the endpoint source to verify no database imports
			const { readFileSync } = await import('node:fs');
			const { fileURLToPath } = await import('node:url');
			const { resolve, dirname } = await import('node:path');

			const thisDir = dirname(fileURLToPath(import.meta.url));
			const endpointPath = resolve(
				thisDir,
				'../../../src/routes/api/location/resolve/+server.ts'
			);
			const source = readFileSync(endpointPath, 'utf-8');

			expect(source).not.toContain('prisma');
			expect(source).not.toContain("from '$lib/core/db'");
			expect(source).not.toContain('from "$lib/core/db"');
			expect(source).not.toContain('.create(');
			expect(source).not.toContain('.update(');
			expect(source).not.toContain('.upsert(');
		});
	});
});
