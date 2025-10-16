import { describe, it, expect, beforeAll } from 'vitest';

/**
 * Integration tests for address verification API
 * Tests Census Bureau geocoding + Congress.gov representative lookup
 */

const API_BASE = 'http://localhost:5173';

describe('Address Verification API', () => {
	describe('POST /api/address/verify', () => {
		it('should verify a valid DC address and return Eleanor Holmes Norton with correct field names', async () => {
			const response = await fetch(`${API_BASE}/api/address/verify`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					street: '1600 Pennsylvania Avenue NW',
					city: 'Washington',
					state: 'DC',
					zipCode: '20500'
				})
			});

			expect(response.status).toBe(200);
			const data = await response.json();

			expect(data.verified).toBe(true);
			expect(data.district).toBe('DC-AL'); // DC is at-large

			// DC has 1 delegate (Eleanor Holmes Norton), not senators
			expect(data.representatives).toHaveLength(3); // 1 house + 2 senate placeholders

			const houseRep = data.representatives.find((r: { chamber: string }) => r.chamber === 'house');
			expect(houseRep).toBeDefined();
			expect(houseRep.name).toBe('Eleanor Holmes Norton');
			expect(houseRep.party).toBe('Democratic');

			// CRITICAL: Verify snake_case field names (not camelCase)
			expect(houseRep.bioguide_id).toBeTruthy();
			expect(houseRep.bioguide_id).toBe('N000147');
			expect(houseRep.office_code).toBeTruthy();
			expect(houseRep.office_code).toBe('N000147');
			expect(houseRep.state).toBeTruthy();
			expect(houseRep.district).toMatch(/DC/);
		});

		it('should verify a valid CA address and return real representatives with all required fields', async () => {
			const response = await fetch(`${API_BASE}/api/address/verify`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					street: '1 Dr Carlton B Goodlett Pl',
					city: 'San Francisco',
					state: 'CA',
					zipCode: '94102'
				})
			});

			expect(response.status).toBe(200);
			const data = await response.json();

			expect(data.verified).toBe(true);
			expect(data.district).toMatch(/CA-\d{2}/); // CA district format

			// Should have at least 1 house rep + senators
			expect(data.representatives.length).toBeGreaterThanOrEqual(1);

			const houseRep = data.representatives.find((r: { chamber: string }) => r.chamber === 'house');
			expect(houseRep).toBeDefined();
			expect(houseRep.party).toBeTruthy();

			// CRITICAL: Verify ALL required fields with correct naming
			expect(houseRep.bioguide_id).toBeTruthy();
			expect(houseRep.office_code).toBeTruthy();
			expect(houseRep.state).toBeTruthy();
			expect(houseRep.name).toBeTruthy();
			expect(houseRep.chamber).toBe('house');

			// Verify bioguide_id and office_code match (they should be the same)
			expect(houseRep.bioguide_id).toBe(houseRep.office_code);

			const senators = data.representatives.filter((r: { chamber: string }) => r.chamber === 'senate');
			senators.forEach((senator: { name: string; party: string; bioguide_id: string; office_code: string; state: string }) => {
				expect(senator.name).toBeTruthy();
				expect(senator.party).toBeTruthy();
				expect(senator.bioguide_id).toBeTruthy();
				expect(senator.office_code).toBeTruthy();
				expect(senator.state).toBeTruthy();
				expect(senator.bioguide_id).toBe(senator.office_code);
			});
		});

		it('should handle at-large states (Vermont, Wyoming, Alaska, etc.)', async () => {
			// Vermont is an at-large state (entire state is one district)
			const response = await fetch(`${API_BASE}/api/address/verify`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					street: '109 State St',
					city: 'Montpelier',
					state: 'VT',
					zipCode: '05602'
				})
			});

			expect(response.status).toBe(200);
			const data = await response.json();

			expect(data.verified).toBe(true);
			expect(data.district).toMatch(/VT-(AL|00)/); // At-large district

			const houseRep = data.representatives.find((r: { chamber: string }) => r.chamber === 'house');
			expect(houseRep).toBeDefined();
			expect(houseRep.bioguide_id).toBeTruthy(); // snake_case
			expect(houseRep.office_code).toBeTruthy();
			expect(houseRep.name).not.toMatch(/undefined|NaN/); // Should not have parsing errors
		});

		it('should reject missing required fields', async () => {
			const response = await fetch(`${API_BASE}/api/address/verify`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					street: '123 Main St',
					city: 'Springfield'
					// Missing state and zipCode
				})
			});

			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.verified).toBe(false);
			expect(data.error).toContain('required');
		});

		it('should reject invalid ZIP code format', async () => {
			const response = await fetch(`${API_BASE}/api/address/verify`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					street: '123 Main St',
					city: 'Springfield',
					state: 'IL',
					zipCode: 'INVALID'
				})
			});

			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.verified).toBe(false);
			expect(data.error).toContain('ZIP code');
		});

		it('should handle addresses not found by Census API', async () => {
			const response = await fetch(`${API_BASE}/api/address/verify`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					street: '999999 Nonexistent Street',
					city: 'Faketown',
					state: 'CA',
					zipCode: '99999'
				})
			});

			// Should return 400 with error message
			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.verified).toBe(false);
			expect(data.error).toBeTruthy();
		});

		it('should handle corrected addresses from Census API', async () => {
			// Deliberately use incorrect casing/abbreviation
			const response = await fetch(`${API_BASE}/api/address/verify`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					street: '1600 pennsylvania ave nw', // lowercase
					city: 'washington',
					state: 'DC',
					zipCode: '20500'
				})
			});

			expect(response.status).toBe(200);
			const data = await response.json();

			expect(data.verified).toBe(true);
			expect(data.corrected).toBe(true);
			expect(data.correctedAddress).not.toBe(data.originalAddress);
			expect(data.correctedAddress).toMatch(/PENNSYLVANIA/); // Should be uppercase from Census
		});

		it('[CONTRACT TEST] should return data structure compatible with save endpoint', async () => {
			// This test ensures the verify → save data pipeline doesn't break
			const response = await fetch(`${API_BASE}/api/address/verify`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					street: '1600 Pennsylvania Avenue NW',
					city: 'Washington',
					state: 'DC',
					zipCode: '20500'
				})
			});

			expect(response.status).toBe(200);
			const data = await response.json();

			// Verify all fields that /api/user/address expects
			expect(data.verified).toBeDefined();
			expect(data.district).toBeDefined();
			expect(data.representatives).toBeDefined();
			expect(Array.isArray(data.representatives)).toBe(true);

			// Each representative MUST have these fields with EXACT naming (snake_case)
			data.representatives.forEach((rep: Record<string, unknown>) => {
				expect(rep.name).toBeDefined();
				expect(rep.chamber).toBeDefined();
				expect(rep.party).toBeDefined();
				expect(rep.state).toBeDefined();
				expect(rep.bioguide_id).toBeDefined(); // CRITICAL: snake_case, not bioguideId
				expect(rep.office_code).toBeDefined(); // CRITICAL: must be present
				expect(rep.district).toBeDefined();

				// Field naming validation - these should NOT exist
				expect(rep.bioguideId).toBeUndefined(); // Wrong casing
				expect(rep.officeCode).toBeUndefined(); // Wrong casing
			});
		});
	});
});
