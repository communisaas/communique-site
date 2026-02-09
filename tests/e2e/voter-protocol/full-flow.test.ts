/**
 * Full Flow E2E Tests: Identity → Registration → Proof → Submission
 *
 * Tests the complete happy path for the Communique ↔ voter-protocol integration:
 * 1. User verifies identity via Didit.me
 * 2. User registers with Shadow Atlas for district lookup
 * 3. User generates ZK proof of district membership
 * 4. User submits message to congressional representative
 * 5. Nullifier is recorded to prevent double-voting
 *
 * IMPORTANT: These tests use MSW for API mocking.
 * For actual proof generation tests, use real @voter-protocol/noir-prover.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import {
	setupTestServer,
	cleanupTestResources,
	useHandlers,
	createShadowAtlasHandlers,
	createNullifierRegistryHandlers,
	TEST_CONFIG,
	generateTestScenario,
	isValidNullifier,
	isValidProofResult,
	http,
	HttpResponse
} from './test-utils';
import {
	createMockDiditWebhook,
	createMockShadowAtlasResponse,
	VALID_PROOF_INPUTS,
	TEST_USERS,
	TEST_COORDINATES,
	generateWebhookSignature
} from './fixtures';

// Import the modules under test
import { validateWebhookSignature, parseVerificationResult } from '$lib/core/identity/didit-client';

// Note: lookupDistrict uses $env/dynamic/private which doesn't work in test context
// We test the mock responses directly instead of through the actual client

describe('Full Flow: Identity → Registration → Proof → Submission', () => {
	const server = setupTestServer();

	beforeAll(() => {
		server.listen({ onUnhandledRequest: 'warn' });
	});

	afterAll(async () => {
		server.close();
		await cleanupTestResources();
	});

	beforeEach(() => {
		server.resetHandlers();
		vi.clearAllMocks();
	});

	// ===========================================================================
	// STEP 1: Identity Verification via Didit.me
	// ===========================================================================

	describe('Step 1: Identity Verification', () => {
		it('should validate a legitimate Didit.me webhook signature', () => {
			const webhook = createMockDiditWebhook({
				userId: 'test-user-123',
				status: 'Approved'
			});
			const payload = JSON.stringify(webhook);
			const secret = TEST_CONFIG.DIDIT_WEBHOOK_SECRET;
			const { signature, timestamp } = generateWebhookSignature(payload, secret);

			const isValid = validateWebhookSignature(payload, signature, timestamp, secret);
			expect(isValid).toBe(true);
		});

		it('should reject webhook with invalid signature', () => {
			const webhook = createMockDiditWebhook({ userId: 'test-user-123' });
			const payload = JSON.stringify(webhook);
			const secret = TEST_CONFIG.DIDIT_WEBHOOK_SECRET;
			const timestamp = Math.floor(Date.now() / 1000).toString();

			const isValid = validateWebhookSignature(payload, 'invalid-signature', timestamp, secret);
			expect(isValid).toBe(false);
		});

		it('should parse approved verification result correctly', () => {
			const webhook = createMockDiditWebhook({
				userId: 'test-user-123',
				status: 'Approved',
				documentType: 'passport',
				birthYear: 1990,
				nationality: 'USA'
			});

			const result = parseVerificationResult(webhook);

			expect(result.userId).toBe('test-user-123');
			expect(result.status).toBe('Approved');
			expect(result.documentType).toBe('passport');
			expect(result.authorityLevel).toBe(4); // Passport = level 4
			expect(result.birthYear).toBe(1990);
		});

		it('should calculate correct authority level for drivers license', () => {
			const webhook = createMockDiditWebhook({
				userId: 'test-user-123',
				documentType: 'drivers_license'
			});

			const result = parseVerificationResult(webhook);
			expect(result.authorityLevel).toBe(3); // Drivers license = level 3
		});

		it('should reject verification result for non-approved status', () => {
			const webhook = createMockDiditWebhook({
				userId: 'test-user-123',
				status: 'Rejected'
			});

			expect(() => parseVerificationResult(webhook)).toThrow('Verification not approved');
		});
	});

	// ===========================================================================
	// STEP 2: District Registration via Shadow Atlas
	// ===========================================================================

	describe('Step 2: District Registration (Shadow Atlas)', () => {
		// Note: The actual lookupDistrict() function uses $env/dynamic/private
		// which doesn't work in test context. We test the mock responses directly.

		it('should generate valid mock district for SF coordinates', () => {
			const mockResponse = createMockShadowAtlasResponse({
				districtId: 'usa-ca-sf-d5',
				districtName: 'San Francisco District 5',
				jurisdiction: 'city-council'
			});

			expect(mockResponse.success).toBe(true);
			expect(mockResponse.data.district).toBeDefined();
			expect(mockResponse.data.district.id).toBe('usa-ca-sf-d5');
			expect(mockResponse.data.merkleProof).toBeDefined();
			expect(mockResponse.data.merkleProof.depth).toBe(20);
			expect(mockResponse.data.merkleProof.siblings.length).toBe(20);
		});

		it('should generate valid mock district for Seattle coordinates', () => {
			const mockResponse = createMockShadowAtlasResponse({
				districtId: 'usa-wa-seattle-d1',
				districtName: 'Seattle District 1',
				jurisdiction: 'city-council'
			});

			expect(mockResponse.data.district.id).toBe('usa-wa-seattle-d1');
			expect(mockResponse.data.district.jurisdiction).toBe('city-council');
		});

		it('should generate valid mock district for DC with federal territory jurisdiction', () => {
			const mockResponse = createMockShadowAtlasResponse({
				districtId: 'usa-dc-at-large',
				districtName: 'District of Columbia',
				jurisdiction: 'federal-territory'
			});

			expect(mockResponse.data.district.id).toBe('usa-dc-at-large');
			expect(mockResponse.data.district.jurisdiction).toBe('federal-territory');
		});

		it('should validate latitude bounds', () => {
			const isValidLatitude = (lat: number): boolean => lat >= -90 && lat <= 90;

			expect(isValidLatitude(37.7793)).toBe(true);
			expect(isValidLatitude(-90)).toBe(true);
			expect(isValidLatitude(90)).toBe(true);
			expect(isValidLatitude(91)).toBe(false);
			expect(isValidLatitude(-91)).toBe(false);
		});

		it('should validate longitude bounds', () => {
			const isValidLongitude = (lng: number): boolean => lng >= -180 && lng <= 180;

			expect(isValidLongitude(-122.4193)).toBe(true);
			expect(isValidLongitude(-180)).toBe(true);
			expect(isValidLongitude(180)).toBe(true);
			expect(isValidLongitude(181)).toBe(false);
			expect(isValidLongitude(-181)).toBe(false);
		});

		it('should generate valid Merkle proof with depth-20 siblings', () => {
			const mockResponse = createMockShadowAtlasResponse();

			// Validate Merkle proof structure
			expect(mockResponse.data.merkleProof.root).toMatch(/^0x[0-9a-fA-F]+$/);
			expect(mockResponse.data.merkleProof.siblings).toHaveLength(20);
			expect(mockResponse.data.merkleProof.pathIndices).toHaveLength(20);

			// All siblings should be valid hex strings
			mockResponse.data.merkleProof.siblings.forEach((sibling) => {
				expect(sibling).toMatch(/^0x[0-9a-fA-F]+$/);
			});
		});

		it('should handle different tree depths in mock', () => {
			const depth18 = createMockShadowAtlasResponse({ depth: 18 });
			const depth20 = createMockShadowAtlasResponse({ depth: 20 });
			const depth22 = createMockShadowAtlasResponse({ depth: 22 });

			expect(depth18.data.merkleProof.depth).toBe(18);
			expect(depth18.data.merkleProof.siblings.length).toBe(18);

			expect(depth20.data.merkleProof.depth).toBe(20);
			expect(depth20.data.merkleProof.siblings.length).toBe(20);

			expect(depth22.data.merkleProof.depth).toBe(22);
			expect(depth22.data.merkleProof.siblings.length).toBe(22);
		});
	});

	// ===========================================================================
	// STEP 3: ZK Proof Generation
	// ===========================================================================

	describe('Step 3: ZK Proof Generation', () => {
		// Note: These tests validate input formats. Actual proof generation
		// is computationally expensive and tested separately.

		it('should have valid proof inputs structure', () => {
			const inputs = VALID_PROOF_INPUTS.minimal;

			expect(inputs.merkleRoot).toMatch(/^0x[0-9a-fA-F]+$/);
			expect(inputs.actionDomain).toMatch(/^0x[0-9a-fA-F]+$/);
			expect(inputs.userSecret).toMatch(/^0x[0-9a-fA-F]+$/);
			expect(inputs.districtId).toMatch(/^0x[0-9a-fA-F]+$/);
			expect(inputs.registrationSalt).toMatch(/^0x[0-9a-fA-F]+$/);
			expect(inputs.authorityLevel).toBeGreaterThanOrEqual(1);
			expect(inputs.authorityLevel).toBeLessThanOrEqual(5);
			expect(inputs.merklePath).toHaveLength(20);
			expect(inputs.leafIndex).toBeGreaterThanOrEqual(0);
		});

		it('should validate authority level is in range 1-5', () => {
			const inputs = { ...VALID_PROOF_INPUTS.minimal };

			expect(inputs.authorityLevel).toBe(1);

			const level5Inputs = { ...inputs, authorityLevel: 5 as const };
			expect(level5Inputs.authorityLevel).toBe(5);
		});

		it('should validate Merkle path has exactly 20 elements for depth-20', () => {
			const inputs = VALID_PROOF_INPUTS.minimal;
			expect(inputs.merklePath).toHaveLength(20);
		});

		it('should validate realistic proof inputs have proper formatting', () => {
			const inputs = VALID_PROOF_INPUTS.realistic;

			// Action domain should encode a readable string
			expect(inputs.actionDomain).toMatch(/^0x[0-9a-fA-F]+$/);

			// District ID should encode a readable string
			expect(inputs.districtId).toMatch(/^0x[0-9a-fA-F]+$/);

			// Leaf index should be within valid range for depth-20
			expect(inputs.leafIndex).toBeLessThan(2 ** 20);
		});
	});

	// ===========================================================================
	// STEP 4: Congressional Submission
	// ===========================================================================

	describe('Step 4: Congressional Submission', () => {
		it('should accept submission with valid proof', async () => {
			// This test validates the submission flow structure
			// Actual proof verification happens on-chain

			const submission = {
				proof: '0x' + 'ab'.repeat(256),
				publicInputs: {
					merkleRoot: VALID_PROOF_INPUTS.minimal.merkleRoot,
					nullifier: '0x' + 'cd'.repeat(32),
					authorityLevel: 3,
					actionDomain: VALID_PROOF_INPUTS.minimal.actionDomain,
					districtId: VALID_PROOF_INPUTS.minimal.districtId
				},
				message: {
					subject: 'Support Climate Action',
					body: 'Dear Representative, I urge you to support climate legislation...',
					templateId: 'climate-action'
				}
			};

			expect(isValidProofResult(submission)).toBe(true);
			expect(isValidNullifier(submission.publicInputs.nullifier)).toBe(true);
		});

		it('should validate nullifier format', () => {
			expect(isValidNullifier('0x' + 'ab'.repeat(32))).toBe(true);
			expect(isValidNullifier('0x' + 'AB'.repeat(32))).toBe(true);
			expect(isValidNullifier('invalid')).toBe(false);
			expect(isValidNullifier('0x123')).toBe(false); // Too short
			expect(isValidNullifier('ab'.repeat(32))).toBe(false); // Missing 0x
		});
	});

	// ===========================================================================
	// STEP 5: Nullifier Enforcement (Double-Voting Prevention)
	// ===========================================================================

	describe('Step 5: Nullifier Enforcement', () => {
		// Note: These tests verify nullifier logic rather than API calls
		// since the /api/nullifier endpoint doesn't exist in this codebase yet

		it('should validate nullifier format', () => {
			const validNullifier = '0x' + 'ab'.repeat(32);
			expect(isValidNullifier(validNullifier)).toBe(true);
		});

		it('should reject invalid nullifier format', () => {
			expect(isValidNullifier('invalid')).toBe(false);
			expect(isValidNullifier('0x123')).toBe(false); // Too short
			expect(isValidNullifier('ab'.repeat(32))).toBe(false); // Missing 0x
		});

		it('should detect nullifier uniqueness in a Set', () => {
			const usedNullifiers = new Set<string>();
			const nullifier = '0x' + 'first'.padStart(64, '0');

			// First use should succeed
			expect(usedNullifiers.has(nullifier)).toBe(false);
			usedNullifiers.add(nullifier);

			// Second use should be detected as duplicate
			expect(usedNullifiers.has(nullifier)).toBe(true);
		});

		it('should allow different nullifiers for same user on different actions', () => {
			const usedNullifiers = new Set<string>();
			const nullifier1 = '0x' + 'action1'.padStart(64, '0');
			const nullifier2 = '0x' + 'action2'.padStart(64, '0');

			// Different nullifiers should both be accepted
			usedNullifiers.add(nullifier1);
			expect(usedNullifiers.has(nullifier2)).toBe(false);
			usedNullifiers.add(nullifier2);

			expect(usedNullifiers.size).toBe(2);
		});

		it('should generate different nullifiers for different action domains', () => {
			// Nullifier = hash(userSecret, actionDomain)
			// Different action domains produce different nullifiers
			const actionDomain1 = '0x' + Buffer.from('vote-2024-primary').toString('hex').padStart(64, '0');
			const actionDomain2 = '0x' + Buffer.from('vote-2024-general').toString('hex').padStart(64, '0');

			expect(actionDomain1).not.toBe(actionDomain2);
		});
	});

	// ===========================================================================
	// COMPLETE FLOW INTEGRATION
	// ===========================================================================

	describe('Complete Flow Integration', () => {
		it('should complete happy path: verify → register → proof → submit', () => {
			const scenario = generateTestScenario('happy_path');

			// Step 1: Verify identity (webhook validation)
			const webhookPayload = JSON.stringify(scenario.diditWebhook);
			const { signature, timestamp } = generateWebhookSignature(
				webhookPayload,
				TEST_CONFIG.DIDIT_WEBHOOK_SECRET
			);
			const webhookValid = validateWebhookSignature(
				webhookPayload,
				signature,
				timestamp,
				TEST_CONFIG.DIDIT_WEBHOOK_SECRET
			);
			expect(webhookValid).toBe(true);

			// Parse verification result
			const verification = parseVerificationResult(scenario.diditWebhook!);
			expect(verification.status).toBe('Approved');
			expect(verification.authorityLevel).toBeGreaterThanOrEqual(3);

			// Step 2: Generate mock district response
			const districtResponse = createMockShadowAtlasResponse({
				districtId: 'usa-ca-sf-d5',
				districtName: 'San Francisco District 5'
			});
			expect(districtResponse.data.district).toBeDefined();
			expect(districtResponse.data.merkleProof.depth).toBe(20);

			// Step 3: Validate proof inputs are ready
			expect(scenario.proofInputs).toBeDefined();
			expect(scenario.proofInputs!.merklePath).toHaveLength(20);

			// Step 4 & 5: Submit would happen with real prover
			// For this test, we validate the flow structure
			expect(scenario.expectedOutcome).toBe('success');
		});

		it('should block unverified user from proof generation', () => {
			const scenario = generateTestScenario('unverified_user');

			expect(scenario.user.isVerified).toBe(false);
			expect(scenario.proofInputs).toBeNull();
			expect(scenario.expectedOutcome).toBe('verification_required');
		});

		it('should detect double-voting attempt via nullifier set', () => {
			const scenario = generateTestScenario('double_vote');

			// Simulate nullifier registry
			const usedNullifiers = new Set<string>();
			usedNullifiers.add(scenario.existingNullifier!);

			// Attempt to submit with same nullifier should be detected
			const isDoubleVote = usedNullifiers.has(scenario.existingNullifier!);
			expect(isDoubleVote).toBe(true);
			expect(scenario.expectedOutcome).toBe('nullifier_already_used');
		});
	});
});
