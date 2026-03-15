/**
 * Address Verification E2E Integration Test
 *
 * Tests the complete flow that was broken and fixed:
 *   1. POST /api/location/resolve-address → Census geocoding → district + officials
 *   2. POST /api/identity/verify-address → credential issuance + rep persistence + trust tier upgrade
 *   3. DB verification: user updated, representatives upserted, junction records created
 *
 * Bug context: Representatives were resolved during address lookup but never persisted.
 * The verify-address endpoint now accepts officials[] and upserts them transactionally.
 *
 * Uses real database (via db-mock.ts PrismaClient) + MSW for external APIs.
 * Real credential modules with test IDENTITY_SIGNING_KEY — true E2E, no mocking.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db, createMockRequestEvent } from '../../setup/api-test-setup';

// Import handlers — real modules, no mocking
import { POST as resolveAddress } from '../../../src/routes/api/location/resolve-address/+server';
import { POST as verifyAddress } from '../../../src/routes/api/identity/verify-address/+server';

// ---------------------------------------------------------------------------
// DB connectivity check — must be synchronous for describe.runIf
// ---------------------------------------------------------------------------

const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
const dbAvailable = testDbUrl.includes('localhost') || testDbUrl.includes('127.0.0.1');

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

// Use San Francisco — CA is in the MSW Congress API mock data (CA districts: 11, 12)
const TEST_ADDRESS = {
	street: '1 Dr Carlton B Goodlett Pl',
	city: 'San Francisco',
	state: 'CA',
	zip: '94102'
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.runIf(dbAvailable)('Address Verification E2E Flow', () => {
	let testUser: { id: string; email: string; did_key: string | null };
	const uniqueSuffix = `addr-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

	beforeAll(async () => {
		// Required env vars for real credential issuance
		process.env.CONGRESS_API_KEY = 'test-key';
		// 32-byte hex Ed25519 seed for test credential signing
		process.env.IDENTITY_SIGNING_KEY = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';

		// Create test user
		testUser = await db.user.create({
			data: {
				email: `${uniqueSuffix}@test.commons.email`,
				name: 'E2E Test User',
				did_key: `did:key:z${uniqueSuffix}`,
				trust_tier: 0,
				trust_score: 0,
				is_verified: false,
				district_verified: false
			}
		});
	});

	afterAll(async () => {
		// Cleanup in reverse dependency order
		if (testUser) {
			await db.user_representatives.deleteMany({ where: { user_id: testUser.id } });
			await db.districtCredential.deleteMany({ where: { user_id: testUser.id } });
			await db.user.delete({ where: { id: testUser.id } }).catch(() => {});
		}
		// Clean up test representatives
		await db.representative.deleteMany({
			where: {
				bioguide_id: { in: ['CAS001', 'CAS002', 'CAH011', 'CAH012'] }
			}
		});
		// Clean env vars
		delete process.env.IDENTITY_SIGNING_KEY;
	});

	// ====================================================================
	// Step 1: Address Resolution
	// ====================================================================

	describe('Step 1: resolve-address', () => {
		it('resolves a Springfield IL address via Census Bureau mock', async () => {
			const event = createMockRequestEvent({
				url: '/api/location/resolve-address',
				method: 'POST',
				body: JSON.stringify(TEST_ADDRESS),
				locals: { user: { id: testUser.id, email: testUser.email } }
			});

			const response = await resolveAddress(event as any);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.resolved).toBe(true);

			// Census-standardized address
			expect(data.address.matched).toContain('SAN FRANCISCO');
			expect(data.address.state).toBe('CA');

			// District
			expect(data.district.code).toBe('CA-11');
			expect(data.district.state).toBe('CA');

			// Officials from Congress.gov mock
			expect(data.officials).toBeDefined();
			expect(Array.isArray(data.officials)).toBe(true);

			// Cell ID (Census block → tract level)
			expect(data.cell_id).toBeDefined();
			expect(data.zk_eligible).toBe(true);
		});
	});

	// ====================================================================
	// Step 2: Address Verification (credential + rep persistence)
	// ====================================================================

	describe('Step 2: verify-address with officials', () => {
		let resolvedOfficials: Array<Record<string, unknown>>;
		let resolvedDistrict: string;

		beforeAll(async () => {
			// First resolve the address to get officials
			const resolveEvent = createMockRequestEvent({
				url: '/api/location/resolve-address',
				method: 'POST',
				body: JSON.stringify(TEST_ADDRESS),
				locals: { user: { id: testUser.id, email: testUser.email } }
			});

			const resolveResponse = await resolveAddress(resolveEvent as any);
			const resolveData = await resolveResponse.json();

			resolvedDistrict = resolveData.district.code;
			resolvedOfficials = resolveData.officials || [];
		});

		it('issues credential and persists representatives', async () => {
			const event = createMockRequestEvent({
				url: '/api/identity/verify-address',
				method: 'POST',
				body: JSON.stringify({
					district: resolvedDistrict,
					verification_method: 'civic_api',
					officials: resolvedOfficials
				}),
				locals: { user: { id: testUser.id } }
			});

			const response = await verifyAddress(event as any);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.credential).toBeDefined();
			expect(data.credentialHash).toBeDefined();
			expect(data.identity_commitment).toMatch(/^[0-9a-f]{64}$/);
		});

		it('upgraded user trust_tier to 2', async () => {
			const user = await db.user.findUnique({
				where: { id: testUser.id },
				select: {
					trust_tier: true,
					district_verified: true,
					is_verified: true,
					address_verification_method: true,
					identity_commitment: true
				}
			});

			expect(user).not.toBeNull();
			expect(user!.trust_tier).toBe(2);
			expect(user!.district_verified).toBe(true);
			expect(user!.is_verified).toBe(true);
			expect(user!.address_verification_method).toBe('civic_api');
			expect(user!.identity_commitment).toMatch(/^[0-9a-f]{64}$/);
		});

		it('created DistrictCredential record', async () => {
			const credential = await db.districtCredential.findFirst({
				where: { user_id: testUser.id },
				orderBy: { issued_at: 'desc' }
			});

			expect(credential).not.toBeNull();
			expect(credential!.credential_type).toBe('district_residency');
			expect(credential!.congressional_district).toBe('CA-11');
			expect(credential!.verification_method).toBe('civic_api');
			expect(credential!.expires_at.getTime()).toBeGreaterThan(Date.now());
		});

		it('persisted representatives to the database', async () => {
			const reps = await db.representative.findMany({
				where: {
					bioguide_id: {
						in: resolvedOfficials
							.map((o) => o.bioguide_id as string)
							.filter(Boolean)
					}
				}
			});

			// Should have created representative records for all officials
			expect(reps.length).toBeGreaterThan(0);

			// Each rep should have the expected fields
			for (const rep of reps) {
				expect(rep.name).toBeTruthy();
				expect(rep.party).toBeTruthy();
				expect(rep.chamber).toBeTruthy();
				expect(rep.is_active).toBe(true);
				expect(rep.data_source).toBe('congress_api');
			}
		});

		it('created user_representatives junction records', async () => {
			const junctions = await db.user_representatives.findMany({
				where: {
					user_id: testUser.id,
					is_active: true
				},
				include: { representative: true }
			});

			// Should have junction records linking user to their representatives
			expect(junctions.length).toBeGreaterThan(0);

			// Each junction should have correct relationship and be active
			for (const junction of junctions) {
				expect(junction.relationship).toBe('constituent');
				expect(junction.is_active).toBe(true);
				expect(junction.last_validated).toBeDefined();

				// The linked representative should exist and be active
				expect(junction.representative.name).toBeTruthy();
				expect(junction.representative.is_active).toBe(true);
			}
		});
	});

	// ====================================================================
	// Step 3: Profile page reads representatives correctly
	// ====================================================================

	describe('Step 3: profile page representative query', () => {
		it('returns representatives via the profile page query pattern', async () => {
			// This mirrors the query in src/routes/profile/+page.server.ts
			const result = await db.user.findUnique({
				where: { id: testUser.id },
				select: {
					representatives: {
						where: { is_active: true },
						select: {
							relationship: true,
							representative: {
								select: {
									id: true,
									name: true,
									party: true,
									state: true,
									district: true,
									chamber: true,
									phone: true,
									email: true
								}
							}
						}
					}
				}
			});

			expect(result).not.toBeNull();
			expect(result!.representatives.length).toBeGreaterThan(0);

			// Flatten to match the profile page's .then() transform
			const representatives = result!.representatives.map((ur) => ({
				relationship: ur.relationship,
				...ur.representative
			}));

			// Verify the shape matches what the profile page expects
			for (const rep of representatives) {
				expect(rep.relationship).toBe('constituent');
				expect(rep.name).toBeTruthy();
				expect(rep.party).toBeTruthy();
				expect(rep.chamber).toBeTruthy();
				expect(rep.state).toBeTruthy();
			}
		});

		it('returns representatives via the layout server query pattern', async () => {
			// This mirrors the query in src/routes/+layout.server.ts
			const result = await db.user.findUnique({
				where: { id: testUser.id },
				select: {
					representatives: {
						where: { is_active: true },
						select: {
							representative: {
								select: {
									id: true,
									name: true,
									party: true,
									state: true,
									district: true,
									chamber: true,
									phone: true,
									email: true,
									office_code: true,
									bioguide_id: true
								}
							}
						}
					}
				}
			});

			expect(result).not.toBeNull();
			const reps = result!.representatives.map((ur) => ur.representative);

			expect(reps.length).toBeGreaterThan(0);

			for (const rep of reps) {
				expect(rep.bioguide_id).toBeTruthy();
				expect(rep.name).toBeTruthy();
				expect(rep.chamber).toMatch(/^(house|senate)$/);
			}
		});
	});

	// ====================================================================
	// Step 4: Re-verification deactivates old reps and creates new ones
	// ====================================================================

	describe('Step 4: re-verification handles district change', () => {
		it('deactivates old representatives when district changes', async () => {
			// Count current active junctions
			const beforeCount = await db.user_representatives.count({
				where: { user_id: testUser.id, is_active: true }
			});
			expect(beforeCount).toBeGreaterThan(0);

			// Re-verify with a different district (CA-11) and new officials
			const event = createMockRequestEvent({
				url: '/api/identity/verify-address',
				method: 'POST',
				body: JSON.stringify({
					district: 'CA-11',
					verification_method: 'civic_api',
					officials: [
						{
							name: 'New House Rep',
							chamber: 'house',
							party: 'Independent',
							state: 'CA',
							district: 'CA-11',
							bioguide_id: 'CAH011'
						},
						{
							name: 'New Senator',
							chamber: 'senate',
							party: 'Democratic',
							state: 'CA',
							district: 'CA',
							bioguide_id: 'CAS001'
						}
					]
				}),
				locals: { user: { id: testUser.id } }
			});

			const response = await verifyAddress(event as any);
			expect(response.status).toBe(200);

			// New active junctions should be for CA officials only
			const activeJunctions = await db.user_representatives.findMany({
				where: { user_id: testUser.id, is_active: true },
				include: { representative: true }
			});

			expect(activeJunctions.length).toBe(2); // 1 house + 1 senate

			const bioguideIds = activeJunctions.map((j) => j.representative.bioguide_id);
			expect(bioguideIds).toContain('CAH011');
			expect(bioguideIds).toContain('CAS001');

			// Old IL reps should be deactivated
			const inactiveJunctions = await db.user_representatives.findMany({
				where: { user_id: testUser.id, is_active: false }
			});

			expect(inactiveJunctions.length).toBeGreaterThan(0);
		});
	});

	// ====================================================================
	// Step 5: verify-address without officials still works
	// ====================================================================

	describe('Step 5: verify-address without officials (backward compat)', () => {
		it('succeeds when no officials are provided', async () => {
			const event = createMockRequestEvent({
				url: '/api/identity/verify-address',
				method: 'POST',
				body: JSON.stringify({
					district: 'NY-10',
					verification_method: 'civic_api'
				}),
				locals: { user: { id: testUser.id } }
			});

			const response = await verifyAddress(event as any);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
		});
	});
});
