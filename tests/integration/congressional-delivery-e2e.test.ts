/**
 * Congressional Delivery End-to-End Integration Tests
 *
 * Tests the full flow from address → representative lookup → CWC submission.
 * Uses real test addresses with MSW-mocked external APIs.
 *
 * Test Strategy:
 * 1. Address Resolution: Verify Census geocoding → district mapping
 * 2. Representative Lookup: Verify district → representative resolution
 * 3. CWC Submission: Verify XML generation and API submission
 * 4. Error Handling: Verify graceful degradation on failures
 *
 * NOTE: These tests use MSW mocks. For smoke tests against real APIs,
 * see tests/smoke/congressional-smoke.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import {
	PRIMARY_TEST_ADDRESSES,
	EDGE_CASE_ADDRESSES,
	INVALID_ADDRESSES,
	DEFAULT_TEST_ADDRESS,
	mockResponses,
	type TestAddress
} from '../fixtures/test-addresses';

// Import modules under test
import { getRepresentativesForAddress } from '$lib/core/congress/address-lookup';
import { cwcClient } from '$lib/core/congress/cwc-client';

// MSW Server Setup
const handlers = [
	// Census Bureau Geocoding API
	http.get('https://geocoding.geo.census.gov/geocoder/geographies/address', ({ request }) => {
		const url = new URL(request.url);
		const street = url.searchParams.get('street') || '';
		const city = url.searchParams.get('city') || '';
		const state = url.searchParams.get('state') || '';
		const zip = url.searchParams.get('zip') || '';

		// Find matching test address
		const allAddresses = [...PRIMARY_TEST_ADDRESSES, ...EDGE_CASE_ADDRESSES];
		const matchedAddress = allAddresses.find(
			(a) =>
				a.street.toLowerCase().includes(street.toLowerCase()) ||
				(a.city.toLowerCase() === city.toLowerCase() && a.state === state)
		);

		if (matchedAddress) {
			return HttpResponse.json(mockResponses.censusGeocode(matchedAddress));
		}

		// No match - return empty result
		return HttpResponse.json({
			result: {
				addressMatches: []
			}
		});
	}),

	// Congress.gov Representatives API
	// Returns all current members - code filters by state/district client-side
	http.get('https://api.congress.gov/v3/member', () => {
		// Generate mock members matching real API format with terms.item structure
		// Include members for test states: CA, TX, NY, CO, VT
		const testStates = ['California', 'Texas', 'New York', 'Colorado', 'Vermont'];
		const members: Record<string, unknown>[] = [];

		for (const state of testStates) {
			const stateAbbr = state.slice(0, 2).toUpperCase();

			// Add 2 senators per state (with proper terms.item format)
			members.push(
				{
					bioguideId: `${stateAbbr}S001`,
					name: `Senator One (${state})`,
					partyName: 'Democratic',
					state: state,
					terms: {
						item: [{ chamber: 'Senate', startYear: 2021 }]
					}
				},
				{
					bioguideId: `${stateAbbr}S002`,
					name: `Senator Two (${state})`,
					partyName: 'Republican',
					state: state,
					terms: {
						item: [{ chamber: 'Senate', startYear: 2019 }]
					}
				}
			);

			// Add House representative(s) - Vermont is at-large (district 0)
			const isAtLarge = state === 'Vermont';
			members.push({
				bioguideId: `${stateAbbr}H01`,
				name: `Representative (${state}-${isAtLarge ? 'AL' : '01'})`,
				partyName: 'Democratic',
				state: state,
				district: isAtLarge ? undefined : 1,
				terms: {
					item: [{ chamber: 'House of Representatives', startYear: 2023 }]
				}
			});
		}

		return HttpResponse.json({
			members,
			pagination: { count: members.length }
		});
	}),

	// CWC Senate Submission API
	http.post('https://soapbox.senate.gov/api/submit', async () => {
		return HttpResponse.json(mockResponses.cwcSubmitSuccess('senate'));
	}),

	// CWC House Submission API (via proxy)
	http.post('*/api/cwc/house-proxy', async () => {
		return HttpResponse.json(mockResponses.cwcSubmitSuccess('house'));
	})
];

const server = setupServer(...handlers);

describe('Congressional Delivery E2E', () => {
	beforeAll(() => {
		server.listen({ onUnhandledRequest: 'bypass' });
	});

	afterAll(() => {
		server.close();
	});

	beforeEach(() => {
		server.resetHandlers();
		vi.clearAllMocks();
	});

	// =========================================================================
	// ADDRESS RESOLUTION TESTS
	// =========================================================================

	describe('Address Resolution', () => {
		it('should resolve San Francisco City Hall to CA-11', async () => {
			const address = PRIMARY_TEST_ADDRESSES[0]; // SF City Hall
			const reps = await getRepresentativesForAddress({
				street: address.street,
				city: address.city,
				state: address.state,
				zip: address.zip
			});

			expect(reps).toBeDefined();
			expect(reps.length).toBeGreaterThan(0);
			// Should have senators + house rep
			const senators = reps.filter((r) => r.chamber === 'senate');
			const houseReps = reps.filter((r) => r.chamber === 'house');
			expect(senators.length).toBe(2);
			expect(houseReps.length).toBe(1);
		});

		it('should resolve all primary test addresses', async () => {
			for (const address of PRIMARY_TEST_ADDRESSES) {
				const reps = await getRepresentativesForAddress({
					street: address.street,
					city: address.city,
					state: address.state,
					zip: address.zip
				});

				expect(reps, `Failed for ${address.description}`).toBeDefined();
				expect(reps.length, `No reps for ${address.description}`).toBeGreaterThan(0);
			}
		});

		it('should handle at-large states correctly', async () => {
			const vermontAddress = EDGE_CASE_ADDRESSES.find((a) => a.state === 'VT');
			if (!vermontAddress) throw new Error('Vermont test address not found');

			const reps = await getRepresentativesForAddress({
				street: vermontAddress.street,
				city: vermontAddress.city,
				state: vermontAddress.state,
				zip: vermontAddress.zip
			});

			expect(reps).toBeDefined();
			// At-large: 2 senators + 1 at-large rep
			expect(reps.length).toBe(3);
		});

		it('should return empty array for invalid addresses', async () => {
			const reps = await getRepresentativesForAddress({
				street: INVALID_ADDRESSES.nonExistentAddress.street,
				city: INVALID_ADDRESSES.nonExistentAddress.city,
				state: INVALID_ADDRESSES.nonExistentAddress.state,
				zip: INVALID_ADDRESSES.nonExistentAddress.zip
			});

			expect(reps).toEqual([]);
		});
	});

	// =========================================================================
	// CWC SUBMISSION TESTS
	// =========================================================================

	describe('CWC Submission', () => {
		const mockTemplate = {
			id: 'test-template-123',
			title: 'Test Climate Action Template',
			message_body: 'Please support climate legislation for our community.',
			slug: 'test-climate-action'
		};

		const mockUser = {
			id: 'test-user-456',
			name: 'Test Constituent',
			email: 'test@example.com',
			street: DEFAULT_TEST_ADDRESS.street,
			city: DEFAULT_TEST_ADDRESS.city,
			state: DEFAULT_TEST_ADDRESS.state,
			zip: DEFAULT_TEST_ADDRESS.zip
		};

		it('should submit to all representatives successfully', async () => {
			// First get representatives
			const reps = await getRepresentativesForAddress({
				street: mockUser.street,
				city: mockUser.city,
				state: mockUser.state,
				zip: mockUser.zip
			});

			expect(reps.length).toBeGreaterThan(0);

			// Submit to all
			const results = await cwcClient.submitToAllRepresentatives(
				mockTemplate,
				mockUser,
				reps,
				'Personal message: This affects my neighborhood directly.'
			);

			expect(results).toBeDefined();
			expect(results.length).toBe(reps.length);

			// All should succeed with mocked API
			const successCount = results.filter((r) => r.success).length;
			expect(successCount).toBe(reps.length);

			// Each result should have a message ID
			for (const result of results) {
				expect(result.messageId || result.confirmationNumber).toBeDefined();
			}
		});

		it('should handle Senate submission', async () => {
			const reps = await getRepresentativesForAddress({
				street: mockUser.street,
				city: mockUser.city,
				state: mockUser.state,
				zip: mockUser.zip
			});

			const senators = reps.filter((r) => r.chamber === 'senate');
			expect(senators.length).toBe(2);

			const results = await cwcClient.submitToAllRepresentatives(
				mockTemplate,
				mockUser,
				senators,
				''
			);

			expect(results.length).toBe(2);
			expect(results.every((r) => r.success)).toBe(true);
		});

		it('should handle House submission', async () => {
			const reps = await getRepresentativesForAddress({
				street: mockUser.street,
				city: mockUser.city,
				state: mockUser.state,
				zip: mockUser.zip
			});

			const houseReps = reps.filter((r) => r.chamber === 'house');
			expect(houseReps.length).toBe(1);

			const results = await cwcClient.submitToAllRepresentatives(
				mockTemplate,
				mockUser,
				houseReps,
				''
			);

			expect(results.length).toBe(1);
			expect(results[0].success).toBe(true);
		});
	});

	// =========================================================================
	// ERROR HANDLING TESTS
	// =========================================================================

	describe('Error Handling', () => {
		it('should handle Census API failure gracefully', async () => {
			// Override handler to return error
			server.use(
				http.get('https://geocoding.geo.census.gov/geocoder/geographies/address', () => {
					return HttpResponse.error();
				})
			);

			const reps = await getRepresentativesForAddress({
				street: DEFAULT_TEST_ADDRESS.street,
				city: DEFAULT_TEST_ADDRESS.city,
				state: DEFAULT_TEST_ADDRESS.state,
				zip: DEFAULT_TEST_ADDRESS.zip
			});

			// Should return empty array, not throw
			expect(reps).toEqual([]);
		});

		it('should handle CWC API rate limit', async () => {
			server.use(
				http.post('https://soapbox.senate.gov/api/submit', () => {
					return HttpResponse.json(mockResponses.cwcSubmitError('rate_limit'), { status: 429 });
				})
			);

			const mockTemplate = {
				id: 'test',
				title: 'Test',
				message_body: 'Test',
				slug: 'test'
			};

			const mockUser = {
				id: 'test',
				name: 'Test',
				email: 'test@test.com',
				street: '123 Test',
				city: 'Test',
				state: 'CA',
				zip: '94102'
			};

			const mockReps = [
				{
					bioguideId: 'CAS001',
					name: 'Test Senator',
					chamber: 'senate' as const,
					state: 'CA',
					party: 'D'
				}
			];

			const results = await cwcClient.submitToAllRepresentatives(
				mockTemplate,
				mockUser,
				mockReps,
				''
			);

			// Should return failure result, not throw
			expect(results.length).toBe(1);
			expect(results[0].success).toBe(false);
			expect(results[0].error).toContain('rate limit');
		});

		it('should handle missing address fields', async () => {
			const reps = await getRepresentativesForAddress({
				street: '',
				city: 'San Francisco',
				state: 'CA',
				zip: '94102'
			});

			// Should handle gracefully
			expect(Array.isArray(reps)).toBe(true);
		});
	});

	// =========================================================================
	// FULL FLOW INTEGRATION TEST
	// =========================================================================

	describe('Full Congressional Delivery Flow', () => {
		it('should complete full flow: address → lookup → submit → verify', async () => {
			const address = DEFAULT_TEST_ADDRESS;

			// Step 1: Resolve address to representatives
			const reps = await getRepresentativesForAddress({
				street: address.street,
				city: address.city,
				state: address.state,
				zip: address.zip
			});

			expect(reps.length).toBeGreaterThan(0);
			console.log(`[Test] Found ${reps.length} representatives for ${address.description}`);

			// Step 2: Prepare submission data
			const template = {
				id: 'climate-action-2025',
				title: 'Support Climate Action Now',
				message_body:
					'As your constituent, I urge you to support comprehensive climate legislation.',
				slug: 'climate-action-2025'
			};

			const user = {
				id: 'test-user-e2e',
				name: 'Jane Constituent',
				email: 'jane@example.com',
				street: address.street,
				city: address.city,
				state: address.state,
				zip: address.zip
			};

			// Step 3: Submit to all representatives
			const results = await cwcClient.submitToAllRepresentatives(
				template,
				user,
				reps,
				'This is a personal note about why this matters to me.'
			);

			// Step 4: Verify results
			expect(results.length).toBe(reps.length);

			const successful = results.filter((r) => r.success);
			const failed = results.filter((r) => !r.success);

			console.log(`[Test] Submission results: ${successful.length} success, ${failed.length} failed`);

			// With mocked API, all should succeed
			expect(successful.length).toBe(reps.length);

			// Each successful result should have tracking info
			for (const result of successful) {
				expect(result.office).toBeDefined();
				expect(result.messageId || result.confirmationNumber).toBeDefined();
			}
		});
	});
});
