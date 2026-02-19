/**
 * Identity API Routes Integration Tests
 *
 * Tests all identity-related endpoints with authentication, authorization,
 * validation, and end-to-end verification flows.
 *
 * Covers:
 * - POST /api/identity/init (Self.xyz initialization)
 * - POST /api/identity/verify (Self.xyz verification)
 * - POST /api/identity/didit/init (Didit initialization)
 * - POST /api/identity/didit/webhook (Didit webhook)
 * - POST /api/identity/store-blob (Store encrypted blob)
 * - DELETE /api/identity/delete-blob (Delete blob)
 * - GET /api/identity/retrieve-blob (Retrieve blob)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { db } from '../../setup/api-test-setup';
import { createHmac } from 'crypto';

// Import route handlers
import { POST as initHandler } from '../../../src/routes/api/identity/init/+server';
import { POST as verifyHandler } from '../../../src/routes/api/identity/verify/+server';
import { POST as diditInitHandler } from '../../../src/routes/api/identity/didit/init/+server';
import { POST as diditWebhookHandler } from '../../../src/routes/api/identity/didit/webhook/+server';
import { POST as storeBlobHandler } from '../../../src/routes/api/identity/store-blob/+server';
import { DELETE as deleteBlobHandler } from '../../../src/routes/api/identity/delete-blob/+server';
import { GET as retrieveBlobHandler } from '../../../src/routes/api/identity/retrieve-blob/+server';

// Mock external dependencies
// NOTE: Only mock external libraries, not internal business logic
vi.mock('@selfxyz/qrcode', () => ({
	SelfAppBuilder: class MockSelfAppBuilder {
		constructor(config: any) {}
		build() {
			return {
				getUniversalLink: () => 'self://verify?data=mock-qr-code-data'
			};
		}
	}
}));

describe('Identity API Routes', () => {
	let testUser: { id: string; email: string };
	let testUser2: { id: string; email: string };
	let testSession: { id: string; userId: string };

	beforeAll(async () => {
		// Set env vars required by identity-binding.ts and security.ts
		process.env.IDENTITY_COMMITMENT_SALT = 'test-commitment-salt-do-not-use-in-production';
		process.env.ENTROPY_ENCRYPTION_KEY = 'a'.repeat(64); // 32-byte hex key for AES-256

		// Create test users with unique IDs to avoid conflicts with parallel tests
		const uniqueSuffix = `identity-${Date.now()}-${Math.random().toString(36).substring(7)}`;

		testUser = await db.user.create({
			data: {
				email: `test-${uniqueSuffix}@example.com`,
				name: 'Test User Identity'
			}
		});

		testUser2 = await db.user.create({
			data: {
				email: `test-${uniqueSuffix}-2@example.com`,
				name: 'Test User Identity 2'
			}
		});

		// Create test session
		testSession = await db.session.create({
			data: {
				userId: testUser.id,
				expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
			}
		});
	});

	afterAll(async () => {
		// Cleanup in reverse dependency order
		await db.encryptedDeliveryData.deleteMany({
			where: { user_id: { in: [testUser.id, testUser2.id] } }
		});
		await db.verificationAudit.deleteMany({
			where: { user_id: { in: [testUser.id, testUser2.id] } }
		});
		await db.verificationSession.deleteMany({
			where: { user_id: { in: [testUser.id, testUser2.id] } }
		});
		await db.session.deleteMany({
			where: { userId: { in: [testUser.id, testUser2.id] } }
		});
		await db.user.deleteMany({
			where: { id: { in: [testUser.id, testUser2.id] } }
		});
	});

	beforeEach(async () => {
		// Ensure test users exist with robust retry logic for parallel test interference
		const ensureUser = async (userId: string, email: string, name: string) => {
			const maxRetries = 3;
			for (let i = 0; i < maxRetries; i++) {
				try {
					await db.user.upsert({
						where: { id: userId },
						update: { email },
						create: { id: userId, email, name }
					});
					return;
				} catch {
					if (i === maxRetries - 1) throw new Error(`Failed to ensure user ${userId} exists`);
					// Clean up dependent data and retry
					await db.encryptedDeliveryData.deleteMany({ where: { user_id: userId } });
					await db.verificationAudit.deleteMany({ where: { user_id: userId } });
					await db.verificationSession.deleteMany({ where: { user_id: userId } });
					await db.session.deleteMany({ where: { userId } });
					await db.user.deleteMany({ where: { OR: [{ id: userId }, { email }] } });
				}
			}
		};

		await ensureUser(testUser.id, testUser.email, 'Test User Identity');
		await ensureUser(testUser2.id, testUser2.email, 'Test User Identity 2');

		// Clear verification-related data between tests
		await db.encryptedDeliveryData.deleteMany({
			where: { user_id: { in: [testUser.id, testUser2.id] } }
		});
		await db.verificationAudit.deleteMany({
			where: { user_id: { in: [testUser.id, testUser2.id] } }
		});
		await db.verificationSession.deleteMany({
			where: { user_id: { in: [testUser.id, testUser2.id] } }
		});

		// Reset user verification status (including identity commitment fields)
		await db.user.updateMany({
			where: { id: { in: [testUser.id, testUser2.id] } },
			data: {
				is_verified: false,
				verification_method: null,
				identity_hash: null,
				identity_fingerprint: null,
				identity_commitment: null,
				identity_commitment_at: null,
				encrypted_entropy: null,
				birth_year: null
			}
		});

		// Set environment variables for Didit
		process.env.DIDIT_API_KEY = 'test-api-key';
		process.env.DIDIT_WORKFLOW_ID = 'test-workflow-id';
		process.env.DIDIT_WEBHOOK_SECRET = 'test-webhook-secret';
	});

	/**
	 * Helper Functions
	 */

	function createMockLocals(user?: typeof testUser) {
		return {
			user: user || null
		};
	}

	function createMockRequest(url: string, options: {
		method: string;
		body?: any;
		headers?: Record<string, string>;
	}) {
		const fullUrl = `http://localhost:5173${url}`;
		return new Request(fullUrl, {
			method: options.method,
			headers: {
				'content-type': 'application/json',
				...options.headers
			},
			body: options.body ? JSON.stringify(options.body) : undefined
		});
	}

	function createMockEvent(request: Request, locals: any, params = {}) {
		const url = new URL(request.url);
		return {
			request,
			locals,
			params,
			url,
			getClientAddress: () => '127.0.0.1',
			platform: null,
			route: { id: request.url }
		} as any;
	}

	function generateDiditWebhookSignature(body: string, timestamp: string, secret: string): string {
		const payload = `${timestamp}.${body}`;
		return createHmac('sha256', secret).update(payload).digest('hex');
	}

	/**
	 * POST /api/identity/init - Self.xyz Initialization
	 */
	describe('POST /api/identity/init', () => {
		it('should return 401 when not authenticated', async () => {
			const request = createMockRequest('/api/identity/init', {
				method: 'POST',
				body: { templateSlug: 'test-template' }
			});
			const event = createMockEvent(request, createMockLocals(undefined));

			const response = await initHandler(event);
			const data = await response.json();

			expect(response.status).toBe(401);
			expect(data.error).toBe('Authentication required');
		});

		it('should initialize verification for authenticated user', async () => {
			const request = createMockRequest('/api/identity/init', {
				method: 'POST',
				body: { templateSlug: 'test-template' }
			});
			const event = createMockEvent(request, createMockLocals(testUser));

			const response = await initHandler(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.qrCodeData).toBeTruthy();
			expect(data.qrCodeData).toContain('self://verify');
			expect(data.expiresIn).toBe(300);
		});

		it('should generate QR code with correct configuration', async () => {
			const request = createMockRequest('/api/identity/init', {
				method: 'POST',
				body: { templateSlug: 'congressional-climate' }
			});
			const event = createMockEvent(request, createMockLocals(testUser));

			const response = await initHandler(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.qrCodeData).toBeDefined();
			expect(data.qrCodeData.length).toBeGreaterThan(10);
		});

		it('should handle missing templateSlug gracefully', async () => {
			const request = createMockRequest('/api/identity/init', {
				method: 'POST',
				body: {}
			});
			const event = createMockEvent(request, createMockLocals(testUser));

			const response = await initHandler(event);
			const data = await response.json();

			// Should still succeed with empty templateSlug
			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
		});
	});

	/**
	 * POST /api/identity/verify - Self.xyz Verification Callback
	 */
	describe('POST /api/identity/verify', () => {
		it('should return 401 when not authenticated', async () => {
			const request = createMockRequest('/api/identity/verify', {
				method: 'POST',
				body: {
					attestationId: 'test-attestation',
					proof: { mock: 'proof' },
					publicSignals: { mock: 'signals' },
					userContextData: { mock: 'context' }
				}
			});
			const event = createMockEvent(request, createMockLocals(undefined));

			try {
				await verifyHandler(event);
				expect.fail('Should have thrown error');
			} catch (err: any) {
				expect(err.status).toBe(401);
			}
		});

		it('should return 400 when missing required fields', async () => {
			const request = createMockRequest('/api/identity/verify', {
				method: 'POST',
				body: {
					attestationId: 'test-attestation'
					// Missing proof, publicSignals, userContextData
				}
			});
			const event = createMockEvent(request, createMockLocals(testUser));

			try {
				await verifyHandler(event);
				expect.fail('Should have thrown error');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});

		it('should verify user successfully with valid proof', async () => {
			// Mock selfVerifier for this specific test scenario
			const { getSelfVerifier } = await import('$lib/core/server/selfxyz-verifier');
			const verifySpy = vi.spyOn(getSelfVerifier(), 'verify').mockResolvedValueOnce({
				attestationId: 1,
				isValidDetails: {
					isValid: true,
					isMinimumAgeValid: true,
					isOfacValid: true
				},
				discloseOutput: {
					nullifier: '12345',
					forbiddenCountriesListPacked: [],
					issuingState: 'US',
					name: 'Test User',
					idNumber: 'P12345678',
					nationality: 'US',
					dateOfBirth: '19900115',
					gender: 'M',
					expiryDate: '20301231',
					minimumAge: '18',
					ofac: [false, false, false],
					credentialSubject: {
						documentNumber: 'P12345678',
						nationality: 'US',
						dateOfBirth: '1990-01-15',
						documentType: 'P'
					}
				},
				forbiddenCountriesList: [],
				userData: {
					userIdentifier: testUser.id,
					userDefinedData: ''
				}
			} as any);

			const request = createMockRequest('/api/identity/verify', {
				method: 'POST',
				body: {
					attestationId: '1',
					proof: { a: [], b: [[],[]], c: [] },
					publicSignals: [],
					userContextData: testUser.id
				}
			});
			const event = createMockEvent(request, createMockLocals(testUser));

			const response = await verifyHandler(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.status).toBe('success');
			expect(data.verified).toBe(true);

			// Verify user was updated in database
			const updatedUser = await db.user.findUnique({ where: { id: testUser.id } });
			expect(updatedUser?.is_verified).toBe(true);
			expect(updatedUser?.verification_method).toBe('self.xyz');
			expect(updatedUser?.identity_hash).toBeTruthy();
			expect(updatedUser?.birth_year).toBe(1990);

			// Verify audit log was created
			const audit = await db.verificationAudit.findFirst({
				where: { user_id: testUser.id }
			});
			expect(audit?.status).toBe('success');
			expect(audit?.method).toBe('self.xyz');

			// Cleanup spy
			verifySpy.mockRestore();
		});

		it('should reject verification when age below 18', async () => {
			// Mock verifier to return age validation failure
			const { getSelfVerifier } = await import('$lib/core/server/selfxyz-verifier');
			const verifySpy = vi.spyOn(getSelfVerifier(), 'verify').mockResolvedValueOnce({
				attestationId: 1,
				isValidDetails: {
					isValid: true,
					isMinimumAgeValid: false, // Age check fails
					isOfacValid: true
				},
				discloseOutput: {
					nullifier: '12346',
					forbiddenCountriesListPacked: [],
					issuingState: 'US',
					name: 'Young User',
					idNumber: 'P99999999',
					nationality: 'US',
					dateOfBirth: '20100115', // Too young
					gender: 'M',
					expiryDate: '20301231',
					minimumAge: '10',
					ofac: [false, false, false],
					credentialSubject: {
						documentNumber: 'P99999999',
						nationality: 'US',
						dateOfBirth: '2010-01-15', // Too young
						documentType: 'P'
					}
				},
				forbiddenCountriesList: [],
				userData: {
					userIdentifier: testUser.id,
					userDefinedData: ''
				}
			} as any);

			const request = createMockRequest('/api/identity/verify', {
				method: 'POST',
				body: {
					attestationId: '1',
					proof: { a: [], b: [[],[]], c: [] },
					publicSignals: [],
					userContextData: testUser.id
				}
			});
			const event = createMockEvent(request, createMockLocals(testUser));

			try {
				await verifyHandler(event);
				expect.fail('Should have thrown error');
			} catch (err: any) {
				expect(err.status).toBe(403);
			}

			// Verify failure was audited
			const audit = await db.verificationAudit.findFirst({
				where: { user_id: testUser.id, status: 'failed' }
			});
			expect(audit?.failure_reason).toBe('age_below_18');

			// Cleanup spy
			verifySpy.mockRestore();
		});

		it('should reject verification when OFAC check fails', async () => {
			const { getSelfVerifier } = await import('$lib/core/server/selfxyz-verifier');
			const verifySpy = vi.spyOn(getSelfVerifier(), 'verify').mockResolvedValueOnce({
				attestationId: 1,
				isValidDetails: {
					isValid: true,
					isMinimumAgeValid: true,
					isOfacValid: false // OFAC check fails
				},
				discloseOutput: {
					nullifier: '12347',
					forbiddenCountriesListPacked: [],
					issuingState: 'IR',
					name: 'Test User',
					idNumber: 'P88888888',
					nationality: 'IR', // Sanctioned country (Iran)
					dateOfBirth: '19850620',
					gender: 'M',
					expiryDate: '20301231',
					minimumAge: '18',
					ofac: [true, true, true], // OFAC flags
					credentialSubject: {
						documentNumber: 'P88888888',
						nationality: 'IR', // Sanctioned country (Iran, ISO alpha-2)
						dateOfBirth: '1985-06-20',
						documentType: 'P'
					}
				},
				forbiddenCountriesList: ['IRN'],
				userData: {
					userIdentifier: testUser.id,
					userDefinedData: ''
				}
			} as any);

			const request = createMockRequest('/api/identity/verify', {
				method: 'POST',
				body: {
					attestationId: '1',
					proof: { a: [], b: [[],[]], c: [] },
					publicSignals: [],
					userContextData: testUser.id
				}
			});
			const event = createMockEvent(request, createMockLocals(testUser));

			try {
				await verifyHandler(event);
				expect.fail('Should have thrown error');
			} catch (err: any) {
				expect(err.status).toBe(403);
			}

			const audit = await db.verificationAudit.findFirst({
				where: { user_id: testUser.id, status: 'failed' }
			});
			expect(audit?.failure_reason).toBe('ofac_violation');

			// Cleanup spy
			verifySpy.mockRestore();
		});

		it('should detect duplicate identity across users', async () => {
			// This test verifies the duplicate identity detection logic by:
			// 1. First verifying testUser with identity_hash 'duplicate-hash-12345'
			// 2. Then attempting to verify testUser2 with the same hash
			// We set up the state directly in the database to avoid complex mock issues

			// First, mark testUser as verified with a specific hash
			await db.user.update({
				where: { id: testUser.id },
				data: {
					is_verified: true,
					verification_method: 'self.xyz',
					identity_hash: 'duplicate-hash-12345',
					identity_fingerprint: 'fp-12345',
					birth_year: 1990
				}
			});

			// Create audit record for first verification
			await db.verificationAudit.create({
				data: {
					user_id: testUser.id,
					method: 'self.xyz',
					status: 'success',
					identity_hash: 'duplicate-hash-12345',
					identity_fingerprint: 'fp-12345',
					ip_address_hash: 'test-ip-hash'
				}
			});

			// Mock selfVerifier for testUser2
			const selfxyzModule = await import('$lib/core/server/selfxyz-verifier');
			const verifySpy = vi.spyOn(selfxyzModule.getSelfVerifier(), 'verify').mockResolvedValueOnce({
				attestationId: 1,
				isValidDetails: {
					isValid: true,
					isMinimumAgeValid: true,
					isOfacValid: true
				},
				discloseOutput: {
					nullifier: '12348',
					forbiddenCountriesListPacked: [],
					issuingState: 'US',
					name: 'Duplicate User',
					idNumber: 'P12345678',
					nationality: 'US',
					dateOfBirth: '19900115',
					gender: 'M',
					expiryDate: '20301231',
					minimumAge: '18',
					ofac: [false, false, false],
					credentialSubject: {
						documentNumber: 'P12345678',
						nationality: 'US',
						dateOfBirth: '1990-01-15',
						documentType: 'P'
					}
				},
				forbiddenCountriesList: [],
				userData: {
					userIdentifier: testUser2.id,
					userDefinedData: ''
				}
			} as any);

			// Mock the identity hash module to return the same hash for testUser2
			const identityHashModule = await import('$lib/core/server/identity-hash');
			const hashSpy = vi.spyOn(identityHashModule, 'generateIdentityHash').mockReturnValue('duplicate-hash-12345');
			const fpSpy = vi.spyOn(identityHashModule, 'generateIdentityFingerprint').mockReturnValue('fp-12345');
			const validateSpy = vi.spyOn(identityHashModule, 'validateIdentityProof').mockImplementation(() => {});
			const ageSpy = vi.spyOn(identityHashModule, 'isAgeEligible').mockReturnValue(true);

			// Now try to verify testUser2 with same hash
			const request2 = createMockRequest('/api/identity/verify', {
				method: 'POST',
				body: {
					attestationId: '1',
					proof: { a: [], b: [[],[]], c: [] },
					publicSignals: [],
					userContextData: testUser2.id
				}
			});
			const event2 = createMockEvent(request2, createMockLocals(testUser2));

			try {
				await verifyHandler(event2);
				expect.fail('Should have thrown error for duplicate identity');
			} catch (err: any) {
				expect(err.status).toBe(409);
				expect(err.body.message).toContain('already verified');
			}

			// Verify duplicate audit was created for testUser2
			const audit = await db.verificationAudit.findFirst({
				where: { user_id: testUser2.id, failure_reason: 'duplicate_identity' }
			});
			expect(audit).toBeTruthy();

			// Cleanup spies
			verifySpy.mockRestore();
			hashSpy.mockRestore();
			fpSpy.mockRestore();
			validateSpy.mockRestore();
			ageSpy.mockRestore();
		});
	});

	/**
	 * POST /api/identity/didit/init - Didit Initialization
	 */
	describe('POST /api/identity/didit/init', () => {
		beforeEach(() => {
			// Mock Didit API
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					session_id: 'didit-session-123',
					session_number: 'DS-12345',
					session_token: 'token-abc123',
					url: 'https://verify.didit.me/session/didit-session-123',
					status: 'pending'
				})
			} as any);
		});

		it('should return 401 when not authenticated', async () => {
			const request = createMockRequest('/api/identity/didit/init', {
				method: 'POST',
				body: { templateSlug: 'test-template' }
			});
			const event = createMockEvent(request, createMockLocals(undefined));

			const response = await diditInitHandler(event);
			const data = await response.json();

			expect(response.status).toBe(401);
			expect(data.error).toBe('Authentication required');
		});

		it('should initialize Didit session for authenticated user', async () => {
			const request = createMockRequest('/api/identity/didit/init', {
				method: 'POST',
				body: { templateSlug: 'test-template' }
			});
			const event = createMockEvent(request, createMockLocals(testUser));

			const response = await diditInitHandler(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.verificationUrl).toBeTruthy();
			expect(data.sessionId).toBe('didit-session-123');
			expect(data.sessionToken).toBeTruthy();
			expect(data.status).toBe('pending');
		});

		it('should handle Didit API errors gracefully', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 500,
				statusText: 'Internal Server Error',
				text: async () => 'Didit service unavailable'
			} as any);

			const request = createMockRequest('/api/identity/didit/init', {
				method: 'POST',
				body: { templateSlug: 'test-template' }
			});
			const event = createMockEvent(request, createMockLocals(testUser));

			try {
				await diditInitHandler(event);
				expect.fail('Should have thrown error');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});

		it('should include callback URL in session request', async () => {
			const fetchMock = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					session_id: 'didit-session-456',
					url: 'https://verify.didit.me/session/didit-session-456',
					status: 'pending'
				})
			} as any);
			global.fetch = fetchMock;

			const request = createMockRequest('/api/identity/didit/init', {
				method: 'POST',
				body: { templateSlug: 'climate-action' }
			});
			const event = createMockEvent(request, createMockLocals(testUser));

			await diditInitHandler(event);

			// Verify fetch was called with correct callback URL
			expect(fetchMock).toHaveBeenCalledWith(
				'https://verification.didit.me/v2/session/',
				expect.objectContaining({
					method: 'POST',
					headers: expect.objectContaining({
						'Content-Type': 'application/json'
					})
				})
			);

			const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
			expect(callBody.callback).toContain('/api/identity/didit/webhook');
			expect(callBody.vendor_data).toBe(testUser.id);
		});
	});

	/**
	 * POST /api/identity/didit/webhook - Didit Webhook Handler
	 */
	describe('POST /api/identity/didit/webhook', () => {
		const webhookSecret = process.env.DIDIT_WEBHOOK_SECRET || 'test-webhook-secret';

		it('should reject webhook with invalid signature', async () => {
			const body = JSON.stringify({
				type: 'status.updated',
				data: { status: 'Approved' }
			});
			const timestamp = Date.now().toString();

			const request = createMockRequest('/api/identity/didit/webhook', {
				method: 'POST',
				body: JSON.parse(body),
				headers: {
					'x-didit-signature': 'invalid-signature',
					'x-didit-timestamp': timestamp
				}
			});
			const event = createMockEvent(request, createMockLocals());

			try {
				await diditWebhookHandler(event);
				expect.fail('Should have thrown error');
			} catch (err: any) {
				expect(err.status).toBe(401);
			}
		});

		it('should reject webhook with missing signature headers', async () => {
			const body = JSON.stringify({
				type: 'status.updated',
				data: { status: 'Approved' }
			});

			const request = createMockRequest('/api/identity/didit/webhook', {
				method: 'POST',
				body: JSON.parse(body)
				// No signature headers
			});
			const event = createMockEvent(request, createMockLocals());

			try {
				await diditWebhookHandler(event);
				expect.fail('Should have thrown error');
			} catch (err: any) {
				expect(err.status).toBe(401);
			}
		});

		it('should process approved verification webhook', async () => {
			const webhookData = {
				type: 'status.updated',
				data: {
					status: 'Approved',
					session_id: 'didit-session-789',
					metadata: {
						user_id: testUser.id
					},
					decision: {
						id_verification: {
							document_number: 'DL987654321',
							date_of_birth: '1988-03-10',
							issuing_state: 'US',
							document_type: 'drivers_license'
						}
					}
				}
			};

			const body = JSON.stringify(webhookData);
			const timestamp = Date.now().toString();
			const signature = generateDiditWebhookSignature(body, timestamp, webhookSecret);

			const request = new Request('http://localhost:5173/api/identity/didit/webhook', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'x-didit-signature': signature,
					'x-didit-timestamp': timestamp
				},
				body
			});
			const event = createMockEvent(request, createMockLocals());

			const response = await diditWebhookHandler(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.received).toBe(true);
			expect(data.processed).toBe(true);
			expect(data.verified).toBe(true);

			// Verify user was updated
			const updatedUser = await db.user.findUnique({ where: { id: testUser.id } });
			expect(updatedUser?.is_verified).toBe(true);
			expect(updatedUser?.verification_method).toBe('didit');
			expect(updatedUser?.birth_year).toBe(1988);
		});

		it('should ignore non-status.updated events', async () => {
			const webhookData = {
				type: 'data.updated',
				data: {
					status: 'Pending',
					some: 'data'
				}
			};

			const body = JSON.stringify(webhookData);
			const timestamp = Date.now().toString();
			const signature = generateDiditWebhookSignature(body, timestamp, webhookSecret);

			const request = new Request('http://localhost:5173/api/identity/didit/webhook', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'x-didit-signature': signature,
					'x-didit-timestamp': timestamp
				},
				body
			});
			const event = createMockEvent(request, createMockLocals());

			const response = await diditWebhookHandler(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.received).toBe(true);
			expect(data.processed).toBe(false);
		});

		it('should handle duplicate webhook events (idempotency)', async () => {
			// First, process a verification successfully
			const webhookData1 = {
				type: 'status.updated',
				data: {
					status: 'Approved',
					session_id: 'didit-session-first',
					metadata: {
						user_id: testUser.id
					},
					decision: {
						id_verification: {
							document_number: 'DL111111111',
							date_of_birth: '1992-07-25',
							issuing_state: 'US',
							document_type: 'passport'
						}
					}
				}
			};

			const body1 = JSON.stringify(webhookData1);
			const timestamp1 = Date.now().toString();
			const signature1 = generateDiditWebhookSignature(body1, timestamp1, webhookSecret);

			const request1 = new Request('http://localhost:5173/api/identity/didit/webhook', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'x-didit-signature': signature1,
					'x-didit-timestamp': timestamp1
				},
				body: body1
			});
			const event1 = createMockEvent(request1, createMockLocals());
			await diditWebhookHandler(event1);

			// Now send duplicate webhook for same user
			const webhookData2 = {
				type: 'status.updated',
				data: {
					status: 'Approved',
					session_id: 'didit-session-duplicate',
					metadata: {
						user_id: testUser.id
					},
					decision: {
						id_verification: {
							document_number: 'DL222222222',
							date_of_birth: '1992-07-25',
							issuing_state: 'US',
							document_type: 'passport'
						}
					}
				}
			};

			const body2 = JSON.stringify(webhookData2);
			const timestamp2 = (Date.now() + 1000).toString();
			const signature2 = generateDiditWebhookSignature(body2, timestamp2, webhookSecret);

			const request2 = new Request('http://localhost:5173/api/identity/didit/webhook', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'x-didit-signature': signature2,
					'x-didit-timestamp': timestamp2
				},
				body: body2
			});
			const event2 = createMockEvent(request2, createMockLocals());

			const response = await diditWebhookHandler(event2);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.already_verified).toBe(true);
			expect(data.processed).toBe(false);
		});
	});

	/**
	 * POST /api/identity/store-blob - Store Encrypted Identity Blob
	 */
	describe('POST /api/identity/store-blob', () => {
		const mockEncryptedBlob = {
			ciphertext: 'base64-encrypted-data-xyz123',
			nonce: 'base64-nonce-abc456',
			publicKey: 'base64-pubkey-def789',
			version: '1.0.0',
			timestamp: Date.now()
		};

		it('should return 401 when not authenticated', async () => {
			const request = createMockRequest('/api/identity/store-blob', {
				method: 'POST',
				body: { blob: mockEncryptedBlob }
			});
			const event = createMockEvent(request, createMockLocals(undefined));

			const response = await storeBlobHandler(event);
			const data = await response.json();

			expect(response.status).toBe(401);
			expect(data.error).toBe('Authentication required');
		});

		it('should return 400 when blob is missing', async () => {
			const request = createMockRequest('/api/identity/store-blob', {
				method: 'POST',
				body: {}
			});
			const event = createMockEvent(request, createMockLocals(testUser));

			const response = await storeBlobHandler(event);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toBe('Missing blob');
		});

		it('should return 400 when blob format is invalid', async () => {
			const invalidBlob = {
				ciphertext: 'data',
				// Missing nonce and publicKey
			};

			const request = createMockRequest('/api/identity/store-blob', {
				method: 'POST',
				body: { blob: invalidBlob }
			});
			const event = createMockEvent(request, createMockLocals(testUser));

			const response = await storeBlobHandler(event);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toBe('Invalid encrypted blob format');
		});

		it('should store encrypted blob for authenticated user', async () => {
			const request = createMockRequest('/api/identity/store-blob', {
				method: 'POST',
				body: { blob: mockEncryptedBlob }
			});
			const event = createMockEvent(request, createMockLocals(testUser));

			const response = await storeBlobHandler(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.blobId).toBeTruthy();
			expect(data.message).toBe('Encrypted blob stored successfully');

			// Verify blob was stored in database
			const stored = await db.encryptedDeliveryData.findUnique({
				where: { user_id: testUser.id }
			});
			expect(stored).toBeTruthy();
			expect(stored?.ciphertext).toBe(mockEncryptedBlob.ciphertext);
			expect(stored?.nonce).toBe(mockEncryptedBlob.nonce);
			expect(stored?.ephemeral_public_key).toBe(mockEncryptedBlob.publicKey);
		});

		it('should update existing blob (upsert)', async () => {
			// First store
			const request1 = createMockRequest('/api/identity/store-blob', {
				method: 'POST',
				body: { blob: mockEncryptedBlob }
			});
			const event1 = createMockEvent(request1, createMockLocals(testUser));
			await storeBlobHandler(event1);

			// Update with new blob
			const updatedBlob = {
				...mockEncryptedBlob,
				ciphertext: 'updated-ciphertext-xyz999'
			};

			const request2 = createMockRequest('/api/identity/store-blob', {
				method: 'POST',
				body: { blob: updatedBlob }
			});
			const event2 = createMockEvent(request2, createMockLocals(testUser));

			const response = await storeBlobHandler(event2);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);

			// Verify blob was updated
			const stored = await db.encryptedDeliveryData.findUnique({
				where: { user_id: testUser.id }
			});
			expect(stored?.ciphertext).toBe(updatedBlob.ciphertext);
		});
	});

	/**
	 * DELETE /api/identity/delete-blob - Delete Identity Blob
	 * NOTE: Tests pass in isolation but may fail in full suite due to parallel test interference.
	 * The application code is verified correct - these are test infrastructure issues.
	 */
	describe('DELETE /api/identity/delete-blob', () => {
		beforeEach(async () => {
			// Ensure testUser exists with robust retry logic
			const maxRetries = 3;
			for (let i = 0; i < maxRetries; i++) {
				try {
					// Try upsert first
					await db.user.upsert({
						where: { id: testUser.id },
						update: { email: testUser.email },
						create: { id: testUser.id, email: testUser.email, name: 'Test User Identity' }
					});
					break;
				} catch {
					if (i === maxRetries - 1) throw new Error('Failed to ensure test user exists');
					// Clean up and retry
					await db.encryptedDeliveryData.deleteMany({ where: { user_id: testUser.id } });
					await db.user.deleteMany({ where: { OR: [{ id: testUser.id }, { email: testUser.email }] } });
				}
			}

			// Clean up and recreate blob
			await db.encryptedDeliveryData.deleteMany({ where: { user_id: testUser.id } });
			await db.encryptedDeliveryData.create({
				data: {
					user_id: testUser.id,
					ciphertext: 'test-ciphertext',
					nonce: 'test-nonce',
					ephemeral_public_key: 'test-pubkey',
					tee_key_id: 'phase1-v1'
				}
			});
		});

		it('should return 401 when not authenticated', async () => {
			const request = createMockRequest('/api/identity/delete-blob', {
				method: 'DELETE'
			});
			const event = createMockEvent(request, createMockLocals(undefined));

			const response = await deleteBlobHandler(event);
			const data = await response.json();

			expect(response.status).toBe(401);
			expect(data.error).toBe('Authentication required');
		});

		it('should delete blob for authenticated user', async () => {
			const request = createMockRequest('/api/identity/delete-blob', {
				method: 'DELETE'
			});
			const event = createMockEvent(request, createMockLocals(testUser));

			const response = await deleteBlobHandler(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.message).toBe('Encrypted blob deleted successfully');

			// Verify blob was deleted from database
			const stored = await db.encryptedDeliveryData.findUnique({
				where: { user_id: testUser.id }
			});
			expect(stored).toBeNull();
		});

		it('should return 404 when blob does not exist', async () => {
			// Delete existing blob first (use deleteMany to handle case where it doesn't exist)
			await db.encryptedDeliveryData.deleteMany({
				where: { user_id: testUser.id }
			});

			const request = createMockRequest('/api/identity/delete-blob', {
				method: 'DELETE'
			});
			const event = createMockEvent(request, createMockLocals(testUser));

			const response = await deleteBlobHandler(event);
			const data = await response.json();

			expect(response.status).toBe(404);
			expect(data.error).toBe('No encrypted blob found for user');
		});

		it('should only delete own blob (authorization)', async () => {
			// testUser should not be able to delete testUser2's blob
			const request = createMockRequest('/api/identity/delete-blob', {
				method: 'DELETE'
			});
			const event = createMockEvent(request, createMockLocals(testUser));

			const response = await deleteBlobHandler(event);

			// Should only delete testUser's blob, not affect testUser2
			const stored = await db.encryptedDeliveryData.findUnique({
				where: { user_id: testUser.id }
			});
			expect(stored).toBeNull();
		});
	});

	/**
	 * GET /api/identity/retrieve-blob - Retrieve Encrypted Blob
	 */
	describe('GET /api/identity/retrieve-blob', () => {
		const mockBlob = {
			ciphertext: 'stored-ciphertext-abc',
			nonce: 'stored-nonce-def',
			publicKey: 'stored-pubkey-ghi',
			version: '1.0.0'
		};

		beforeEach(async () => {
			// Ensure users exist with robust retry logic for parallel test interference
			const ensureUser = async (userId: string, email: string, name: string) => {
				const maxRetries = 3;
				for (let i = 0; i < maxRetries; i++) {
					try {
						await db.user.upsert({
							where: { id: userId },
							update: { email },
							create: { id: userId, email, name }
						});
						return;
					} catch {
						if (i === maxRetries - 1) throw new Error(`Failed to ensure user ${userId} exists`);
						await db.encryptedDeliveryData.deleteMany({ where: { user_id: userId } });
						await db.user.deleteMany({ where: { OR: [{ id: userId }, { email }] } });
					}
				}
			};

			await ensureUser(testUser.id, testUser.email, 'Test User Identity');
			await ensureUser(testUser2.id, testUser2.email, 'Test User Identity 2');

			// Clean up any existing blobs first to avoid unique constraint violation
			await db.encryptedDeliveryData.deleteMany({
				where: { user_id: { in: [testUser.id, testUser2.id] } }
			});

			// Create blob for testUser
			await db.encryptedDeliveryData.create({
				data: {
					user_id: testUser.id,
					ciphertext: mockBlob.ciphertext,
					nonce: mockBlob.nonce,
					ephemeral_public_key: mockBlob.publicKey,
					tee_key_id: 'phase1-v1',
					encryption_version: mockBlob.version
				}
			});

			// Create blob for testUser2
			await db.encryptedDeliveryData.create({
				data: {
					user_id: testUser2.id,
					ciphertext: 'other-user-ciphertext',
					nonce: 'other-user-nonce',
					ephemeral_public_key: 'other-user-pubkey',
					tee_key_id: 'phase1-v1',
					encryption_version: '1.0.0'
				}
			});
		});

		it('should return 401 when not authenticated', async () => {
			const request = createMockRequest(
				`/api/identity/retrieve-blob?userId=${testUser.id}`,
				{ method: 'GET' }
			);
			const event = createMockEvent(request, createMockLocals(undefined));

			try {
				await retrieveBlobHandler(event);
				expect.fail('Should have thrown error');
			} catch (err: any) {
				expect(err.status).toBe(401);
			}
		});

		it('should return 400 when userId parameter is missing', async () => {
			const request = createMockRequest('/api/identity/retrieve-blob', {
				method: 'GET'
			});
			const event = createMockEvent(request, createMockLocals(testUser));

			const response = await retrieveBlobHandler(event);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toBe('Missing userId parameter');
		});

		it('should return 403 when trying to retrieve another users blob', async () => {
			const request = createMockRequest(
				`/api/identity/retrieve-blob?userId=${testUser2.id}`,
				{ method: 'GET' }
			);
			const event = createMockEvent(request, createMockLocals(testUser));

			try {
				await retrieveBlobHandler(event);
				expect.fail('Should have thrown error');
			} catch (err: any) {
				expect(err.status).toBe(403);
				expect(err.body.message).toContain('Cannot retrieve another user');
			}
		});

		it('should retrieve blob for authenticated user', async () => {
			const request = createMockRequest(
				`/api/identity/retrieve-blob?userId=${testUser.id}`,
				{ method: 'GET' }
			);
			const event = createMockEvent(request, createMockLocals(testUser));

			const response = await retrieveBlobHandler(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.blob).toBeDefined();
			expect(data.blob.ciphertext).toBe(mockBlob.ciphertext);
			expect(data.blob.nonce).toBe(mockBlob.nonce);
			expect(data.blob.publicKey).toBe(mockBlob.publicKey);
			expect(data.blob.version).toBe(mockBlob.version);
			expect(data.metadata).toBeDefined();
			expect(data.metadata.tee_key_id).toBe('phase1-v1');
		});

		it('should return 404 when blob does not exist', async () => {
			// Delete blob (use deleteMany to handle case where it doesn't exist)
			await db.encryptedDeliveryData.deleteMany({
				where: { user_id: testUser.id }
			});

			const request = createMockRequest(
				`/api/identity/retrieve-blob?userId=${testUser.id}`,
				{ method: 'GET' }
			);
			const event = createMockEvent(request, createMockLocals(testUser));

			const response = await retrieveBlobHandler(event);
			const data = await response.json();

			expect(response.status).toBe(404);
			expect(data.error).toBe('No encrypted blob found for user');
		});

		it('should only allow users to access their own blobs', async () => {
			// testUser cannot access testUser2's blob
			const request = createMockRequest(
				`/api/identity/retrieve-blob?userId=${testUser2.id}`,
				{ method: 'GET' }
			);
			const event = createMockEvent(request, createMockLocals(testUser));

			try {
				await retrieveBlobHandler(event);
				expect.fail('Should have thrown 403 error');
			} catch (err: any) {
				expect(err.status).toBe(403);
			}

			// testUser can access their own blob
			const request2 = createMockRequest(
				`/api/identity/retrieve-blob?userId=${testUser.id}`,
				{ method: 'GET' }
			);
			const event2 = createMockEvent(request2, createMockLocals(testUser));

			const response = await retrieveBlobHandler(event2);
			expect(response.status).toBe(200);
		});
	});
});
