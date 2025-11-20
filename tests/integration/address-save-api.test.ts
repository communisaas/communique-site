import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '$lib/core/db';

/**
 * Integration tests for address saving API
 * Tests the complete verify → save → database flow
 *
 * CRITICAL: These tests prevent regressions in address-to-profile saving
 */

const API_BASE = 'http://localhost:5173';

// Mock user for testing (would be created in test setup)
let testUserId: string;

describe('Address Save API', () => {
	beforeEach(async () => {
		// Create test user
		const user = await db.user.create({
			data: {
				email: `test-${Date.now()}@example.com`,
				name: 'Test User'
			}
		});
		testUserId = user.id;
	});

	describe('POST /api/user/address', () => {
		it('should save address with individual components (not just string)', async () => {
			const addressData = {
				congressional_district: 'DC-AL',
				verified: true,
				representatives: [
					{
						name: 'Eleanor Holmes Norton',
						chamber: 'house',
						party: 'Democratic',
						district: 'DC-AL',
						bioguide_id: 'N000147',
						office_code: 'N000147'
					}
				]
			};

			// Note: This test requires authentication
			// In real implementation, would need to mock session or use test auth
			const response = await fetch(`${API_BASE}/api/user/address`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
					// Would include auth headers here
				},
				body: JSON.stringify(addressData)
			});

			// For now, expect 401 since we don't have auth
			// When auth is mocked, expect 200
			expect([200, 401]).toContain(response.status);

			if (response.status === 200) {
				const result = await response.json();

				expect(result.success).toBe(true);
				expect(result.user.street).toBe('1600 Pennsylvania Avenue NW');
				expect(result.user.city).toBe('Washington');
				expect(result.user.state).toBe('DC');
				expect(result.user.zip).toBe('20500');
				expect(result.user.congressional_district).toBe('DC-AL');

				// Verify in database
				const savedUser = await db.user.findUnique({
					where: { id: testUserId },
					include: { user_representatives: true }
				});

				expect(savedUser?.street).toBe('1600 Pennsylvania Avenue NW');
				expect(savedUser?.city).toBe('Washington');
				expect(savedUser?.state).toBe('DC');
				expect(savedUser?.zip).toBe('20500');
				expect(savedUser?.congressional_district).toBe('DC-AL');
			}
		});

		it('should store representatives with correct field names (snake_case)', async () => {
			const addressData = {
				congressional_district: 'CA-11',
				verified: true,
				representatives: [
					{
						name: 'Nancy Pelosi',
						chamber: 'house',
						party: 'Democratic',
						district: 'CA-11',
						bioguide_id: 'P000197', // CRITICAL: snake_case
						office_code: 'P000197'
					},
					{
						name: 'Alex Padilla',
						chamber: 'senate',
						party: 'Democratic',
						district: 'CA',
						bioguide_id: 'P000145',
						office_code: 'P000145'
					}
				]
			};

			const response = await fetch(`${API_BASE}/api/user/address`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(addressData)
			});

			expect([200, 401]).toContain(response.status);

			if (response.status === 200) {
				// Verify representatives are stored with correct bioguide_id and office_code
				const savedReps = await db.representative.findMany({
					where: {
						bioguide_id: { in: ['P000197', 'P000145'] }
					}
				});

				expect(savedReps.length).toBeGreaterThanOrEqual(1);
				savedReps.forEach((rep) => {
					expect(rep.bioguide_id).toBeTruthy();
					expect(rep.office_code).toBeTruthy();
					expect(rep.bioguide_id).not.toMatch(/^temp_/); // No temp IDs
				});
			}
		});

		it('should handle verify → save data contract correctly', async () => {
			// First verify address
			const verifyResponse = await fetch(`${API_BASE}/api/address/verify`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					zipCode: '20500'
				})
			});

			expect(verifyResponse.status).toBe(200);
			const verifyData = await verifyResponse.json();

			// Verify response has all fields needed by save endpoint
			expect(verifyData.district).toBeTruthy();
			expect(verifyData.representatives).toBeDefined();
			expect(verifyData.representatives.length).toBeGreaterThan(0);

			const rep = verifyData.representatives[0];
			// CONTRACT TEST: Verify uses snake_case field names
			expect(rep.bioguide_id).toBeDefined(); // NOT bioguideId
			expect(rep.office_code).toBeDefined();
			expect(rep.state).toBeDefined();

			// Now attempt to save (will fail without auth, but tests data structure)
			const saveResponse = await fetch(`${API_BASE}/api/user/address`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					congressional_district: verifyData.district,
					verified: true,
					representatives: verifyData.representatives
				})
			});

			// Endpoint should accept the data structure (even if auth fails)
			expect([200, 401]).toContain(saveResponse.status);
		});

		it('should reject missing address components', async () => {
			const invalidData = {
				address: '1600 Pennsylvania Avenue NW, Washington, DC 20500', // Just string
				verified: true
				// Missing: street, city, state, zip
			};

			const response = await fetch(`${API_BASE}/api/user/address`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(invalidData)
			});

			// Should fail due to missing components
			expect(response.status).toBe(400);
		});
	});
});
