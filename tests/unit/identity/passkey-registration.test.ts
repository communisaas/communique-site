/**
 * Unit tests for Passkey Registration module
 *
 * Tests the server-side WebAuthn registration logic:
 *   - generatePasskeyRegistrationOptions: challenge generation, session storage, excludeCredentials
 *   - verifyPasskeyRegistration: attestation verification, credential creation, trust_tier upgrade
 *   - Error cases: expired challenge, invalid attestation, duplicate credential, missing user
 *   - Session management: VerificationSession creation with 5-min TTL
 *
 * Security contract:
 *   - Challenge stored in VerificationSession with 5-minute expiry
 *   - One-time challenge use (status transitions: pending -> verified/failed/expired)
 *   - Session bound to specific user via user_id
 *   - Trust tier upgraded to 1 on successful registration
 *   - did:key derived from COSE public key (non-fatal on failure)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks — these must be declared before vi.mock() factory calls
// ---------------------------------------------------------------------------

const mockGenerateRegistrationOptions = vi.hoisted(() => vi.fn());
const mockVerifyRegistrationResponse = vi.hoisted(() => vi.fn());
const mockDeriveDIDKey = vi.hoisted(() => vi.fn());

const mockDbUser = vi.hoisted(() => ({
	findUnique: vi.fn(),
	update: vi.fn()
}));

const mockDbVerificationSession = vi.hoisted(() => ({
	create: vi.fn(),
	findUnique: vi.fn(),
	update: vi.fn()
}));

const mockDbTransaction = vi.hoisted(() => vi.fn());

const mockDb = vi.hoisted(() => ({
	user: mockDbUser,
	verificationSession: mockDbVerificationSession,
	$transaction: mockDbTransaction
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@simplewebauthn/server', () => ({
	generateRegistrationOptions: mockGenerateRegistrationOptions,
	verifyRegistrationResponse: mockVerifyRegistrationResponse
}));

vi.mock('$lib/core/db', () => ({
	db: mockDb
}));

vi.mock('$lib/core/identity/passkey-rp-config', () => ({
	getPasskeyRPConfig: () => ({
		rpName: 'Communique',
		rpID: 'localhost',
		origin: 'http://localhost:5173'
	})
}));

vi.mock('$lib/core/identity/did-key-derivation', () => ({
	deriveDIDKey: mockDeriveDIDKey
}));

// ---------------------------------------------------------------------------
// Import the module under test AFTER mocks are set up
// ---------------------------------------------------------------------------

import {
	generatePasskeyRegistrationOptions,
	verifyPasskeyRegistration,
	uint8ArrayToBase64url,
	base64urlToUint8Array
} from '$lib/core/identity/passkey-registration';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TEST_USER = {
	id: 'user-reg-001',
	email: 'alice@example.com'
};

const MOCK_CHALLENGE = 'dGVzdC1jaGFsbGVuZ2UtYmFzZTY0dXJs';

const MOCK_REGISTRATION_OPTIONS = {
	challenge: MOCK_CHALLENGE,
	rp: { name: 'Communique', id: 'localhost' },
	user: { id: 'dXNlci1yZWctMDAx', name: 'alice@example.com', displayName: 'alice@example.com' },
	pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
	timeout: 60000,
	attestation: 'none',
	excludeCredentials: [],
	authenticatorSelection: {
		residentKey: 'preferred',
		userVerification: 'preferred',
		authenticatorAttachment: 'platform'
	}
};

function makeMockRegistrationResponse() {
	return {
		id: 'credential-id-base64url',
		rawId: 'credential-id-base64url',
		response: {
			attestationObject: 'mock-attestation-object',
			clientDataJSON: 'mock-client-data-json'
		},
		type: 'public-key',
		clientExtensionResults: {},
		authenticatorAttachment: 'platform'
	};
}

function makeMockVerificationSession(overrides: Record<string, unknown> = {}) {
	return {
		id: 'session-reg-001',
		user_id: TEST_USER.id,
		nonce: 'mock-nonce',
		challenge: JSON.stringify({ challenge: MOCK_CHALLENGE, rpID: 'localhost' }),
		expires_at: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
		status: 'pending',
		method: 'webauthn',
		...overrides
	};
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
	vi.clearAllMocks();

	// Default mock implementations
	mockGenerateRegistrationOptions.mockResolvedValue(MOCK_REGISTRATION_OPTIONS);

	mockDbVerificationSession.create.mockResolvedValue({
		id: 'session-reg-001',
		user_id: TEST_USER.id,
		nonce: 'mock-nonce',
		challenge: JSON.stringify({ challenge: MOCK_CHALLENGE, rpID: 'localhost' }),
		expires_at: new Date(Date.now() + 5 * 60 * 1000),
		status: 'pending',
		method: 'webauthn'
	});

	// Default: user has no existing credential
	mockDbUser.findUnique.mockResolvedValue({ passkey_credential_id: null });

	// Transaction mock: execute the callback with a mock tx that mirrors db
	mockDbTransaction.mockImplementation(async (fn: (tx: typeof mockDb) => Promise<void>) => {
		const tx = {
			user: { update: vi.fn().mockResolvedValue({}) },
			verificationSession: { update: vi.fn().mockResolvedValue({}) }
		};
		return fn(tx as unknown as typeof mockDb);
	});

	mockDeriveDIDKey.mockReturnValue('did:key:zMockDIDKey123');
});

afterEach(() => {
	vi.restoreAllMocks();
});

// ============================================================================
// uint8ArrayToBase64url / base64urlToUint8Array helpers
// ============================================================================

describe('base64url encoding helpers', () => {
	it('should round-trip encode and decode arbitrary bytes', () => {
		const original = new Uint8Array([0, 1, 127, 128, 255, 72, 101, 108, 108, 111]);
		const encoded = uint8ArrayToBase64url(original);
		const decoded = base64urlToUint8Array(encoded);
		expect(decoded).toEqual(original);
	});

	it('should produce URL-safe characters (no +, /, or = padding)', () => {
		const bytes = new Uint8Array(32);
		crypto.getRandomValues(bytes);
		const encoded = uint8ArrayToBase64url(bytes);
		expect(encoded).not.toContain('+');
		expect(encoded).not.toContain('/');
		expect(encoded).not.toContain('=');
	});

	it('should handle empty input', () => {
		const empty = new Uint8Array(0);
		const encoded = uint8ArrayToBase64url(empty);
		const decoded = base64urlToUint8Array(encoded);
		expect(decoded).toEqual(empty);
	});

	it('should handle a single byte', () => {
		const single = new Uint8Array([42]);
		const encoded = uint8ArrayToBase64url(single);
		const decoded = base64urlToUint8Array(encoded);
		expect(decoded).toEqual(single);
	});

	it('should handle bytes that produce + and / in standard base64', () => {
		// 0xFB, 0xFF results in standard base64 '+/' characters
		const bytes = new Uint8Array([251, 255]);
		const encoded = uint8ArrayToBase64url(bytes);
		expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(base64urlToUint8Array(encoded)).toEqual(bytes);
	});
});

// ============================================================================
// generatePasskeyRegistrationOptions
// ============================================================================

describe('generatePasskeyRegistrationOptions', () => {
	describe('happy path', () => {
		it('should return registration options and a session ID', async () => {
			const result = await generatePasskeyRegistrationOptions(TEST_USER);

			expect(result).toHaveProperty('options');
			expect(result).toHaveProperty('sessionId');
			expect(result.options).toBe(MOCK_REGISTRATION_OPTIONS);
			expect(result.sessionId).toBe('session-reg-001');
		});

		it('should call generateRegistrationOptions with correct rpName and rpID', async () => {
			await generatePasskeyRegistrationOptions(TEST_USER);

			expect(mockGenerateRegistrationOptions).toHaveBeenCalledWith(
				expect.objectContaining({
					rpName: 'Communique',
					rpID: 'localhost',
					userName: TEST_USER.email,
					attestationType: 'none'
				})
			);
		});

		it('should set authenticatorSelection for platform authenticator', async () => {
			await generatePasskeyRegistrationOptions(TEST_USER);

			expect(mockGenerateRegistrationOptions).toHaveBeenCalledWith(
				expect.objectContaining({
					authenticatorSelection: {
						residentKey: 'preferred',
						userVerification: 'preferred',
						authenticatorAttachment: 'platform'
					}
				})
			);
		});

		it('should create a VerificationSession with pending status', async () => {
			await generatePasskeyRegistrationOptions(TEST_USER);

			expect(mockDbVerificationSession.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					user_id: TEST_USER.id,
					status: 'pending',
					method: 'webauthn'
				})
			});
		});

		it('should store the challenge and rpID in the VerificationSession', async () => {
			await generatePasskeyRegistrationOptions(TEST_USER);

			const createCall = mockDbVerificationSession.create.mock.calls[0][0];
			const challengeData = JSON.parse(createCall.data.challenge);
			expect(challengeData.challenge).toBe(MOCK_CHALLENGE);
			expect(challengeData.rpID).toBe('localhost');
		});

		it('should set a 5-minute TTL on the VerificationSession', async () => {
			const before = Date.now();
			await generatePasskeyRegistrationOptions(TEST_USER);
			const after = Date.now();

			const createCall = mockDbVerificationSession.create.mock.calls[0][0];
			const expiresAt = createCall.data.expires_at.getTime();

			// Should expire approximately 5 minutes from now
			const fiveMinMs = 5 * 60 * 1000;
			expect(expiresAt).toBeGreaterThanOrEqual(before + fiveMinMs);
			expect(expiresAt).toBeLessThanOrEqual(after + fiveMinMs);
		});

		it('should generate a cryptographic nonce for the session', async () => {
			await generatePasskeyRegistrationOptions(TEST_USER);

			const createCall = mockDbVerificationSession.create.mock.calls[0][0];
			expect(createCall.data.nonce).toBeDefined();
			expect(typeof createCall.data.nonce).toBe('string');
			// Nonce should be non-empty (32 random bytes encoded as base64url)
			expect(createCall.data.nonce.length).toBeGreaterThan(0);
		});
	});

	describe('excludeCredentials', () => {
		it('should look up the user in the database for existing credentials', async () => {
			await generatePasskeyRegistrationOptions(TEST_USER);

			expect(mockDbUser.findUnique).toHaveBeenCalledWith({
				where: { id: TEST_USER.id },
				select: { passkey_credential_id: true }
			});
		});

		it('should pass empty excludeCredentials when user has no existing passkey', async () => {
			mockDbUser.findUnique.mockResolvedValue({ passkey_credential_id: null });

			await generatePasskeyRegistrationOptions(TEST_USER);

			expect(mockGenerateRegistrationOptions).toHaveBeenCalledWith(
				expect.objectContaining({
					excludeCredentials: []
				})
			);
		});

		it('should include existing credential ID in excludeCredentials', async () => {
			mockDbUser.findUnique.mockResolvedValue({
				passkey_credential_id: 'existing-cred-id-abc'
			});

			await generatePasskeyRegistrationOptions(TEST_USER);

			expect(mockGenerateRegistrationOptions).toHaveBeenCalledWith(
				expect.objectContaining({
					excludeCredentials: [{ id: 'existing-cred-id-abc' }]
				})
			);
		});

		it('should pass empty excludeCredentials when user record not found', async () => {
			mockDbUser.findUnique.mockResolvedValue(null);

			await generatePasskeyRegistrationOptions(TEST_USER);

			expect(mockGenerateRegistrationOptions).toHaveBeenCalledWith(
				expect.objectContaining({
					excludeCredentials: []
				})
			);
		});
	});

	describe('error handling', () => {
		it('should propagate errors from generateRegistrationOptions', async () => {
			mockGenerateRegistrationOptions.mockRejectedValue(
				new Error('WebAuthn library error')
			);

			await expect(generatePasskeyRegistrationOptions(TEST_USER)).rejects.toThrow(
				'WebAuthn library error'
			);
		});

		it('should propagate database errors from user lookup', async () => {
			mockDbUser.findUnique.mockRejectedValue(new Error('Database connection failed'));

			await expect(generatePasskeyRegistrationOptions(TEST_USER)).rejects.toThrow(
				'Database connection failed'
			);
		});

		it('should propagate database errors from session creation', async () => {
			mockDbVerificationSession.create.mockRejectedValue(
				new Error('Unique constraint violation')
			);

			await expect(generatePasskeyRegistrationOptions(TEST_USER)).rejects.toThrow(
				'Unique constraint violation'
			);
		});
	});
});

// ============================================================================
// verifyPasskeyRegistration
// ============================================================================

describe('verifyPasskeyRegistration', () => {
	const mockCredentialPublicKey = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
	const mockVerificationResult = {
		verified: true,
		registrationInfo: {
			credential: {
				id: 'credential-id-base64url',
				publicKey: mockCredentialPublicKey,
				counter: 0
			},
			credentialDeviceType: 'multiDevice',
			credentialBackedUp: true
		}
	};

	beforeEach(() => {
		mockDbVerificationSession.findUnique.mockResolvedValue(makeMockVerificationSession());
		mockVerifyRegistrationResponse.mockResolvedValue(mockVerificationResult);
	});

	describe('happy path', () => {
		it('should return credential details on successful verification', async () => {
			const result = await verifyPasskeyRegistration(
				TEST_USER.id,
				makeMockRegistrationResponse() as any,
				'session-reg-001'
			);

			expect(result).toHaveProperty('credentialId', 'credential-id-base64url');
			expect(result).toHaveProperty('publicKeyBase64url');
			expect(result).toHaveProperty('counter', 0);
			expect(result).toHaveProperty('credentialDeviceType', 'multiDevice');
			expect(result).toHaveProperty('credentialBackedUp', true);
		});

		it('should encode the public key as base64url', async () => {
			const result = await verifyPasskeyRegistration(
				TEST_USER.id,
				makeMockRegistrationResponse() as any,
				'session-reg-001'
			);

			// Verify the public key round-trips correctly
			const decoded = base64urlToUint8Array(result.publicKeyBase64url);
			expect(decoded).toEqual(mockCredentialPublicKey);
		});

		it('should call verifyRegistrationResponse with correct parameters', async () => {
			const response = makeMockRegistrationResponse();
			await verifyPasskeyRegistration(
				TEST_USER.id,
				response as any,
				'session-reg-001'
			);

			expect(mockVerifyRegistrationResponse).toHaveBeenCalledWith({
				response,
				expectedChallenge: MOCK_CHALLENGE,
				expectedOrigin: 'http://localhost:5173',
				expectedRPID: 'localhost'
			});
		});

		it('should save credential and upgrade trust_tier in a transaction', async () => {
			let txUserUpdate: any;
			let txSessionUpdate: any;

			mockDbTransaction.mockImplementation(async (fn: any) => {
				const tx = {
					user: {
						update: vi.fn().mockImplementation((args: any) => {
							txUserUpdate = args;
							return {};
						})
					},
					verificationSession: {
						update: vi.fn().mockImplementation((args: any) => {
							txSessionUpdate = args;
							return {};
						})
					}
				};
				return fn(tx);
			});

			await verifyPasskeyRegistration(
				TEST_USER.id,
				makeMockRegistrationResponse() as any,
				'session-reg-001'
			);

			// User record should be updated with passkey data and trust_tier
			expect(txUserUpdate.where).toEqual({ id: TEST_USER.id });
			expect(txUserUpdate.data.passkey_credential_id).toBe('credential-id-base64url');
			expect(txUserUpdate.data.passkey_public_key_jwk).toBeDefined();
			expect(txUserUpdate.data.passkey_created_at).toBeInstanceOf(Date);
			expect(txUserUpdate.data.trust_tier).toBe(1);

			// VerificationSession should be marked as verified
			expect(txSessionUpdate.where).toEqual({ id: 'session-reg-001' });
			expect(txSessionUpdate.data.status).toBe('verified');
		});

		it('should include did_key in user update when derivation succeeds', async () => {
			mockDeriveDIDKey.mockReturnValue('did:key:zTestDIDKey456');

			let txUserUpdate: any;
			mockDbTransaction.mockImplementation(async (fn: any) => {
				const tx = {
					user: {
						update: vi.fn().mockImplementation((args: any) => {
							txUserUpdate = args;
							return {};
						})
					},
					verificationSession: { update: vi.fn().mockResolvedValue({}) }
				};
				return fn(tx);
			});

			await verifyPasskeyRegistration(
				TEST_USER.id,
				makeMockRegistrationResponse() as any,
				'session-reg-001'
			);

			expect(txUserUpdate.data.did_key).toBe('did:key:zTestDIDKey456');
		});

		it('should omit did_key when derivation fails (non-fatal)', async () => {
			mockDeriveDIDKey.mockImplementation(() => {
				throw new Error('Unsupported COSE key type');
			});

			let txUserUpdate: any;
			mockDbTransaction.mockImplementation(async (fn: any) => {
				const tx = {
					user: {
						update: vi.fn().mockImplementation((args: any) => {
							txUserUpdate = args;
							return {};
						})
					},
					verificationSession: { update: vi.fn().mockResolvedValue({}) }
				};
				return fn(tx);
			});

			// Should NOT throw even though deriveDIDKey throws
			const result = await verifyPasskeyRegistration(
				TEST_USER.id,
				makeMockRegistrationResponse() as any,
				'session-reg-001'
			);

			expect(result.credentialId).toBe('credential-id-base64url');
			expect(txUserUpdate.data).not.toHaveProperty('did_key');
		});
	});

	describe('session validation', () => {
		it('should throw when VerificationSession is not found', async () => {
			mockDbVerificationSession.findUnique.mockResolvedValue(null);

			await expect(
				verifyPasskeyRegistration(
					TEST_USER.id,
					makeMockRegistrationResponse() as any,
					'nonexistent-session'
				)
			).rejects.toThrow('Verification session not found');
		});

		it('should throw when session belongs to a different user', async () => {
			mockDbVerificationSession.findUnique.mockResolvedValue(
				makeMockVerificationSession({ user_id: 'different-user-id' })
			);

			await expect(
				verifyPasskeyRegistration(
					TEST_USER.id,
					makeMockRegistrationResponse() as any,
					'session-reg-001'
				)
			).rejects.toThrow('Session does not belong to this user');
		});

		it('should throw when session status is not pending (already used)', async () => {
			mockDbVerificationSession.findUnique.mockResolvedValue(
				makeMockVerificationSession({ status: 'verified' })
			);

			await expect(
				verifyPasskeyRegistration(
					TEST_USER.id,
					makeMockRegistrationResponse() as any,
					'session-reg-001'
				)
			).rejects.toThrow('Verification session already used or expired');
		});

		it('should throw when session status is failed', async () => {
			mockDbVerificationSession.findUnique.mockResolvedValue(
				makeMockVerificationSession({ status: 'failed' })
			);

			await expect(
				verifyPasskeyRegistration(
					TEST_USER.id,
					makeMockRegistrationResponse() as any,
					'session-reg-001'
				)
			).rejects.toThrow('Verification session already used or expired');
		});

		it('should throw when session status is expired', async () => {
			mockDbVerificationSession.findUnique.mockResolvedValue(
				makeMockVerificationSession({ status: 'expired' })
			);

			await expect(
				verifyPasskeyRegistration(
					TEST_USER.id,
					makeMockRegistrationResponse() as any,
					'session-reg-001'
				)
			).rejects.toThrow('Verification session already used or expired');
		});

		it('should throw and mark as expired when session has passed expiry time', async () => {
			mockDbVerificationSession.findUnique.mockResolvedValue(
				makeMockVerificationSession({
					expires_at: new Date(Date.now() - 1000) // expired 1 second ago
				})
			);

			await expect(
				verifyPasskeyRegistration(
					TEST_USER.id,
					makeMockRegistrationResponse() as any,
					'session-reg-001'
				)
			).rejects.toThrow('Verification session expired');

			// Should have updated the session status to expired
			expect(mockDbVerificationSession.update).toHaveBeenCalledWith({
				where: { id: 'session-reg-001' },
				data: { status: 'expired' }
			});
		});

		it('should throw when session method is not webauthn', async () => {
			mockDbVerificationSession.findUnique.mockResolvedValue(
				makeMockVerificationSession({ method: 'email' })
			);

			await expect(
				verifyPasskeyRegistration(
					TEST_USER.id,
					makeMockRegistrationResponse() as any,
					'session-reg-001'
				)
			).rejects.toThrow('Invalid session method');
		});
	});

	describe('WebAuthn verification failures', () => {
		it('should throw and mark session as failed when verification returns false', async () => {
			mockVerifyRegistrationResponse.mockResolvedValue({
				verified: false,
				registrationInfo: null
			});

			await expect(
				verifyPasskeyRegistration(
					TEST_USER.id,
					makeMockRegistrationResponse() as any,
					'session-reg-001'
				)
			).rejects.toThrow('WebAuthn registration verification failed');

			expect(mockDbVerificationSession.update).toHaveBeenCalledWith({
				where: { id: 'session-reg-001' },
				data: { status: 'failed' }
			});
		});

		it('should throw when verification succeeds but registrationInfo is missing', async () => {
			mockVerifyRegistrationResponse.mockResolvedValue({
				verified: true,
				registrationInfo: null
			});

			await expect(
				verifyPasskeyRegistration(
					TEST_USER.id,
					makeMockRegistrationResponse() as any,
					'session-reg-001'
				)
			).rejects.toThrow('WebAuthn registration verification failed');
		});

		it('should propagate errors from verifyRegistrationResponse', async () => {
			mockVerifyRegistrationResponse.mockRejectedValue(
				new Error('Invalid attestation format')
			);

			await expect(
				verifyPasskeyRegistration(
					TEST_USER.id,
					makeMockRegistrationResponse() as any,
					'session-reg-001'
				)
			).rejects.toThrow('Invalid attestation format');
		});
	});

	describe('challenge replay protection', () => {
		it('should only accept sessions with pending status', async () => {
			// Simulate a challenge that was already used
			const usedStatuses = ['verified', 'failed', 'expired'];

			for (const status of usedStatuses) {
				mockDbVerificationSession.findUnique.mockResolvedValue(
					makeMockVerificationSession({ status })
				);

				await expect(
					verifyPasskeyRegistration(
						TEST_USER.id,
						makeMockRegistrationResponse() as any,
						'session-reg-001'
					)
				).rejects.toThrow();
			}
		});

		it('should mark session as expired before throwing on time-based expiry', async () => {
			mockDbVerificationSession.findUnique.mockResolvedValue(
				makeMockVerificationSession({
					expires_at: new Date(Date.now() - 60 * 1000) // 1 minute ago
				})
			);

			try {
				await verifyPasskeyRegistration(
					TEST_USER.id,
					makeMockRegistrationResponse() as any,
					'session-reg-001'
				);
			} catch {
				// Expected
			}

			// The session status should be atomically updated to 'expired'
			expect(mockDbVerificationSession.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: { status: 'expired' }
				})
			);
		});
	});

	describe('TTL boundary conditions', () => {
		it('should accept a session that expires in 1ms (still valid)', async () => {
			// Create a session that expires just barely in the future
			const session = makeMockVerificationSession({
				expires_at: new Date(Date.now() + 1000) // 1 second from now for stability
			});
			mockDbVerificationSession.findUnique.mockResolvedValue(session);

			const result = await verifyPasskeyRegistration(
				TEST_USER.id,
				makeMockRegistrationResponse() as any,
				'session-reg-001'
			);

			expect(result.credentialId).toBe('credential-id-base64url');
		});

		it('should reject a session that expired just now (boundary: Date.now() > expires_at)', async () => {
			// Freeze time to ensure deterministic boundary test
			const now = Date.now();
			vi.spyOn(Date, 'now').mockReturnValue(now);

			const session = makeMockVerificationSession({
				expires_at: new Date(now - 1) // 1ms in the past
			});
			mockDbVerificationSession.findUnique.mockResolvedValue(session);

			await expect(
				verifyPasskeyRegistration(
					TEST_USER.id,
					makeMockRegistrationResponse() as any,
					'session-reg-001'
				)
			).rejects.toThrow('Verification session expired');
		});
	});

	describe('trust tier upgrade', () => {
		it('should set trust_tier to 1 on successful registration', async () => {
			let txUserUpdateData: any;

			mockDbTransaction.mockImplementation(async (fn: any) => {
				const tx = {
					user: {
						update: vi.fn().mockImplementation((args: any) => {
							txUserUpdateData = args.data;
							return {};
						})
					},
					verificationSession: { update: vi.fn().mockResolvedValue({}) }
				};
				return fn(tx);
			});

			await verifyPasskeyRegistration(
				TEST_USER.id,
				makeMockRegistrationResponse() as any,
				'session-reg-001'
			);

			expect(txUserUpdateData.trust_tier).toBe(1);
		});

		it('should set passkey_created_at timestamp on the user record', async () => {
			const before = new Date();

			let txUserUpdateData: any;
			mockDbTransaction.mockImplementation(async (fn: any) => {
				const tx = {
					user: {
						update: vi.fn().mockImplementation((args: any) => {
							txUserUpdateData = args.data;
							return {};
						})
					},
					verificationSession: { update: vi.fn().mockResolvedValue({}) }
				};
				return fn(tx);
			});

			await verifyPasskeyRegistration(
				TEST_USER.id,
				makeMockRegistrationResponse() as any,
				'session-reg-001'
			);

			const after = new Date();
			expect(txUserUpdateData.passkey_created_at).toBeInstanceOf(Date);
			expect(txUserUpdateData.passkey_created_at.getTime()).toBeGreaterThanOrEqual(
				before.getTime()
			);
			expect(txUserUpdateData.passkey_created_at.getTime()).toBeLessThanOrEqual(
				after.getTime()
			);
		});
	});

	describe('credential storage format', () => {
		it('should store credential ID as the base64url string from the library', async () => {
			const result = await verifyPasskeyRegistration(
				TEST_USER.id,
				makeMockRegistrationResponse() as any,
				'session-reg-001'
			);

			expect(result.credentialId).toBe('credential-id-base64url');
		});

		it('should store public key as base64url-encoded Uint8Array', async () => {
			const result = await verifyPasskeyRegistration(
				TEST_USER.id,
				makeMockRegistrationResponse() as any,
				'session-reg-001'
			);

			// The public key should be a valid base64url string
			expect(result.publicKeyBase64url).toMatch(/^[A-Za-z0-9_-]+$/);

			// Should decode back to the original public key bytes
			const decoded = base64urlToUint8Array(result.publicKeyBase64url);
			expect(decoded).toEqual(mockCredentialPublicKey);
		});
	});

	describe('transaction atomicity', () => {
		it('should call $transaction to ensure atomicity of user + session updates', async () => {
			await verifyPasskeyRegistration(
				TEST_USER.id,
				makeMockRegistrationResponse() as any,
				'session-reg-001'
			);

			expect(mockDbTransaction).toHaveBeenCalledTimes(1);
			expect(mockDbTransaction).toHaveBeenCalledWith(expect.any(Function));
		});

		it('should propagate transaction errors', async () => {
			mockDbTransaction.mockRejectedValue(new Error('Transaction deadlock'));

			await expect(
				verifyPasskeyRegistration(
					TEST_USER.id,
					makeMockRegistrationResponse() as any,
					'session-reg-001'
				)
			).rejects.toThrow('Transaction deadlock');
		});
	});
});
