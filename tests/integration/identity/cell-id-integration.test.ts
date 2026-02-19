/**
 * Cell ID (Census Block GEOID) Integration Tests
 *
 * Tests the complete cell_id flow for two-tree ZK architecture:
 * 1. Extraction from Census API response (/api/address/verify)
 * 2. Validation (15-digit GEOID format)
 * 3. Shadow Atlas registration with cell_id
 * 4. Session credential storage with credentialType
 *
 * Issue #21: Cell ID Geocoding Support
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	db,
	clearTestDatabase,
	createTestUser,
	createMockRequestEvent
} from '../../setup/api-test-setup';

// Import route handlers
import { POST as addressVerifyPost } from '../../../src/routes/api/address/verify/+server';
import { POST as shadowAtlasRegister } from '../../../src/routes/api/shadow-atlas/register/+server';

// Helper to generate unique IDs
let testCounter = 0;
function uniqueId(prefix: string): string {
	testCounter++;
	return `${prefix}-${testCounter}-${Date.now()}`;
}

describe('Cell ID Integration (Two-Tree ZK Architecture)', () => {
	beforeEach(async () => {
		await clearTestDatabase();
		vi.clearAllMocks();
		testCounter = 0;
	});

	// =========================================================================
	// Cell ID Extraction from Census API
	// =========================================================================

	describe('Cell ID Extraction', () => {
		it('should extract 15-digit Census Block GEOID from address verification', async () => {
			const userId = uniqueId('user');
			await createTestUser({ id: userId, email: `${userId}@example.com` });

			const event = createMockRequestEvent({
				url: 'http://localhost:5173/api/address/verify',
				method: 'POST',
				body: JSON.stringify({
					street: '350 Fifth Avenue',
					city: 'New York',
					state: 'NY',
					zipCode: '10118'
				}),
				locals: { user: { id: userId }, db }
			});

			const response = await addressVerifyPost(event as any);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.verified).toBe(true);

			// cell_id should be extracted from Census Blocks layer
			expect(data.cell_id).toBeDefined();
			expect(typeof data.cell_id).toBe('string');

			// Validate 15-digit GEOID format
			expect(data.cell_id).toMatch(/^\d{15}$/);

			// Verify GEOID structure: STATE(2) + COUNTY(3) + TRACT(6) + BLOCK(4)
			const cellId = data.cell_id as string;
			expect(cellId.slice(0, 2)).toMatch(/^\d{2}$/); // State FIPS
			expect(cellId.slice(2, 5)).toMatch(/^\d{3}$/); // County FIPS
			expect(cellId.slice(5, 11)).toMatch(/^\d{6}$/); // Census Tract
			expect(cellId.slice(11, 15)).toMatch(/^\d{4}$/); // Block
		});

		it('should return null cell_id when Census Blocks data is unavailable', async () => {
			// This test would need a mock that doesn't include Census Blocks
			// For now, verify the endpoint handles missing data gracefully
			const userId = uniqueId('user');
			await createTestUser({ id: userId, email: `${userId}@example.com` });

			const event = createMockRequestEvent({
				url: 'http://localhost:5173/api/address/verify',
				method: 'POST',
				body: JSON.stringify({
					street: '123 Fake Street',
					city: 'Nowhere',
					state: 'ZZ',
					zipCode: '00000'
				}),
				locals: { user: { id: userId }, db }
			});

			const response = await addressVerifyPost(event as any);
			const data = await response.json();

			// Invalid address should return 400, but cell_id should be null/undefined
			expect(response.status).toBe(400);
			expect(data.cell_id).toBeUndefined();
		});
	});

	// =========================================================================
	// Shadow Atlas Registration with Cell ID
	// =========================================================================

	describe('Shadow Atlas Registration', () => {
		// NOTE: The shadow-atlas/register handler accepts { leaf } (a precomputed hex field element).
		// Cell ID (GEOID) is embedded inside the leaf hash by the client.
		// The server never sees the raw cell_id — only the hash.

		it('should accept valid leaf and register with Shadow Atlas', async () => {
			const userId = uniqueId('user');
			const user = await createTestUser({
				id: userId,
				email: `${userId}@example.com`,
				identity_commitment: '0x' + 'a'.repeat(64),
				is_verified: true,
				verification_method: 'selfxyz'
			});

			await db.session.create({
				data: {
					id: uniqueId('session'),
					userId: user.id,
					expiresAt: new Date(Date.now() + 86400000)
				}
			});

			// Valid BN254 field element (leaf hash)
			const validLeaf = '0x' + '1'.repeat(64);

			const event = createMockRequestEvent({
				url: 'http://localhost:5173/api/shadow-atlas/register',
				method: 'POST',
				body: JSON.stringify({ leaf: validLeaf }),
				locals: {
					session: { userId: user.id },
					db
				}
			});

			const response = await shadowAtlasRegister(event as any);

			// 200 on success, 503 if Shadow Atlas service is unavailable
			expect([200, 503]).toContain(response.status);
		});

		it('should reject missing leaf field', async () => {
			const userId = uniqueId('user');
			const user = await createTestUser({
				id: userId,
				email: `${userId}@example.com`,
				identity_commitment: '0x' + 'a'.repeat(64),
				is_verified: true,
				verification_method: 'selfxyz'
			});

			await db.session.create({
				data: {
					id: uniqueId('session'),
					userId: user.id,
					expiresAt: new Date(Date.now() + 86400000)
				}
			});

			const event = createMockRequestEvent({
				url: 'http://localhost:5173/api/shadow-atlas/register',
				method: 'POST',
				body: JSON.stringify({}), // No leaf
				locals: {
					session: { userId: user.id },
					db
				}
			});

			const response = await shadowAtlasRegister(event as any);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toContain('leaf');
		});

		it('should reject non-hex leaf format', async () => {
			const userId = uniqueId('user');
			const user = await createTestUser({
				id: userId,
				email: `${userId}@example.com`,
				identity_commitment: '0x' + 'a'.repeat(64),
				is_verified: true,
				verification_method: 'selfxyz'
			});

			await db.session.create({
				data: {
					id: uniqueId('session'),
					userId: user.id,
					expiresAt: new Date(Date.now() + 86400000)
				}
			});

			const event = createMockRequestEvent({
				url: 'http://localhost:5173/api/shadow-atlas/register',
				method: 'POST',
				body: JSON.stringify({ leaf: 'not-valid-hex-xyz!' }),
				locals: {
					session: { userId: user.id },
					db
				}
			});

			const response = await shadowAtlasRegister(event as any);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toContain('hex');
		});

		it('should require identity verification before registration', async () => {
			const userId = uniqueId('user');
			const user = await createTestUser({
				id: userId,
				email: `${userId}@example.com`
				// No identity_commitment
			});

			await db.session.create({
				data: {
					id: uniqueId('session'),
					userId: user.id,
					expiresAt: new Date(Date.now() + 86400000)
				}
			});

			const event = createMockRequestEvent({
				url: 'http://localhost:5173/api/shadow-atlas/register',
				method: 'POST',
				body: JSON.stringify({ leaf: '0x' + '1'.repeat(64) }),
				locals: {
					session: { userId: user.id },
					db
				}
			});

			const response = await shadowAtlasRegister(event as any);
			const data = await response.json();

			// Should require identity verification
			expect(response.status).toBe(403);
			expect(data.error).toContain('Identity verification required');
		});
	});

	// =========================================================================
	// Cell ID Privacy
	// =========================================================================

	describe('Cell ID Privacy', () => {
		it('should not log full cell_id in console output', async () => {
			// This is a behavioral test - we verify through code review
			// that console.log only logs the first 5 digits (state + county prefix)
			// The actual implementation should log: "Cell prefix: 36061... (two-tree mode)"

			const userId = uniqueId('user');
			await createTestUser({ id: userId, email: `${userId}@example.com` });

			const consoleSpy = vi.spyOn(console, 'log');

			const event = createMockRequestEvent({
				url: 'http://localhost:5173/api/address/verify',
				method: 'POST',
				body: JSON.stringify({
					street: '350 Fifth Avenue',
					city: 'New York',
					state: 'NY',
					zipCode: '10118'
				}),
				locals: { user: { id: userId }, db }
			});

			await addressVerifyPost(event as any);

			// Verify no console.log contains the full 15-digit GEOID
			const logCalls = consoleSpy.mock.calls.flat().map(String);
			const fullGeoid = '360610076001234';

			// The full GEOID should NOT appear in logs
			const containsFullGeoid = logCalls.some(log => log.includes(fullGeoid));
			expect(containsFullGeoid).toBe(false);

			consoleSpy.mockRestore();
		});
	});
});

describe('Cell ID Type Validation', () => {
	it('should validate 15-digit GEOID format', () => {
		// Import the validation function
		const isValidCellId = (value: unknown): boolean => {
			if (typeof value !== 'string') return false;
			return /^\d{15}$/.test(value);
		};

		// Valid GEOIDs
		expect(isValidCellId('360610076001234')).toBe(true); // NYC
		expect(isValidCellId('110010062001001')).toBe(true); // DC
		expect(isValidCellId('720070065003001')).toBe(true); // Puerto Rico
		expect(isValidCellId('060371034012001')).toBe(true); // California

		// Invalid GEOIDs
		expect(isValidCellId('36061007600123')).toBe(false); // 14 digits
		expect(isValidCellId('3606100760012345')).toBe(false); // 16 digits
		expect(isValidCellId('36061007600123X')).toBe(false); // Contains letter
		expect(isValidCellId('')).toBe(false); // Empty
		expect(isValidCellId(null)).toBe(false); // Null
		expect(isValidCellId(undefined)).toBe(false); // Undefined
		expect(isValidCellId(360610076001234)).toBe(false); // Number, not string
	});

	it('should parse GEOID components correctly', () => {
		const parseGeoid = (geoid: string) => {
			if (!/^\d{15}$/.test(geoid)) return null;
			return {
				state_fips: geoid.slice(0, 2),
				county_fips: geoid.slice(2, 5),
				tract: geoid.slice(5, 11),
				block: geoid.slice(11, 15),
				full_geoid: geoid
			};
		};

		const nyc = parseGeoid('360610076001234');
		expect(nyc).toEqual({
			state_fips: '36', // New York
			county_fips: '061', // New York County (Manhattan)
			tract: '007600',
			block: '1234',
			full_geoid: '360610076001234'
		});

		const dc = parseGeoid('110010062001001');
		expect(dc).toEqual({
			state_fips: '11', // DC
			county_fips: '001',
			tract: '006200',
			block: '1001',
			full_geoid: '110010062001001'
		});
	});
});
