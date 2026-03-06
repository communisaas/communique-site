/**
 * Unit tests for /api/identity/verify-mdl/verify POST handler
 *
 * Tests the mDL verification completion endpoint:
 *   - KV retrieval by nonce + immediate deletion (one-time use)
 *   - Session ownership validation (user ID match)
 *   - Trust tier conditional upgrade (only if < 5, never downgrade)
 *   - 410 for expired/already-used session
 *   - 403 for wrong user (session mismatch)
 *   - 422 for malformed credential (processCredentialResponse failure)
 *   - Auth guard (requires authenticated session)
 *   - Identity binding: bindIdentityCommitment for Sybil detection + account merging
 *   - Database updates: findUnique (read tier) + update (conditional tier upgrade + metadata)
 *
 * Security contract:
 *   - Ephemeral key is deleted immediately after retrieval (one-time use)
 *   - Session ownership verified: stored userId must match authenticated user
 *   - Trust tier upgraded to 5 ONLY when current tier < 5 (never downgrade)
 *   - Credential hash stored as identity_commitment for ZKP derivation
 *   - SvelteKit error() objects are re-thrown (proper HTTP status codes)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mockProcessCredentialResponse = vi.hoisted(() => vi.fn());

const mockPrismaUser = vi.hoisted(() => ({
	findUnique: vi.fn(),
	update: vi.fn()
}));

const mockBindIdentityCommitment = vi.hoisted(() => vi.fn());

const mockPrisma = vi.hoisted(() => ({
	user: mockPrismaUser
}));

const mockDevSessionStore = vi.hoisted(() => new Map<string, { data: string; expires: number }>());

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('$lib/core/db', () => ({
	db: mockPrisma,
	prisma: mockPrisma
}));

vi.mock('$lib/core/identity/mdl-verification', () => ({
	processCredentialResponse: mockProcessCredentialResponse
}));

vi.mock('$lib/core/identity/identity-binding', () => ({
	bindIdentityCommitment: (...args: unknown[]) => mockBindIdentityCommitment(...args)
}));

// Mock the dev session store (dynamically imported by verify endpoint)
vi.mock('../../../src/routes/api/identity/verify-mdl/_dev-session-store', () => ({
	devSessionStore: mockDevSessionStore
}));

// ---------------------------------------------------------------------------
// Import the module under test AFTER mocks are set up
// ---------------------------------------------------------------------------

import { POST } from '../../../src/routes/api/identity/verify-mdl/verify/+server';

// ---------------------------------------------------------------------------
// Mock crypto.subtle
// ---------------------------------------------------------------------------

const mockImportKey = vi.fn();

// Save original crypto
const originalCrypto = globalThis.crypto;

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TEST_USER_ID = 'user-mdl-verify-001';
const TEST_NONCE = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';

const MOCK_PRIVATE_KEY_JWK = {
	kty: 'EC',
	crv: 'P-256',
	x: 'mock-x',
	y: 'mock-y',
	d: 'mock-d'
};

const MOCK_IMPORTED_KEY = { type: 'private', algorithm: { name: 'ECDH' } };

const MOCK_SESSION_DATA = JSON.stringify({
	privateKeyJwk: MOCK_PRIVATE_KEY_JWK,
	userId: TEST_USER_ID,
	createdAt: Date.now()
});

const MOCK_SUCCESS_RESULT = {
	success: true,
	district: 'CA-12',
	state: 'CA',
	credentialHash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
	verificationMethod: 'mdl'
};

function makeRequestEvent(overrides: {
	body?: unknown;
	session?: { userId: string } | null;
	platform?: any;
} = {}) {
	const body = overrides.body ?? {
		protocol: 'org-iso-mdoc',
		data: 'base64-encoded-credential-data',
		nonce: TEST_NONCE
	};

	return {
		request: new Request('http://localhost/api/identity/verify-mdl/verify', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		locals: {
			session: overrides.session !== undefined
				? overrides.session
				: { userId: TEST_USER_ID },
			user: overrides.session !== undefined
				? (overrides.session ? { id: overrides.session.userId } : null)
				: { id: TEST_USER_ID }
		},
		platform: overrides.platform !== undefined ? overrides.platform : null,
		params: {},
		url: new URL('http://localhost/api/identity/verify-mdl/verify'),
		cookies: { get: () => undefined, getAll: () => [], set: () => {}, delete: () => {}, serialize: () => '' },
		fetch: globalThis.fetch,
		getClientAddress: () => '127.0.0.1',
		setHeaders: () => {},
		isDataRequest: false,
		isSubRequest: false,
		route: { id: '/api/identity/verify-mdl/verify' }
	} as any;
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
	vi.clearAllMocks();
	mockDevSessionStore.clear();

	// Mock crypto.subtle.importKey
	mockImportKey.mockResolvedValue(MOCK_IMPORTED_KEY);

	Object.defineProperty(globalThis, 'crypto', {
		value: {
			subtle: {
				importKey: mockImportKey,
				generateKey: vi.fn(),
				exportKey: vi.fn(),
				digest: vi.fn()
			},
			getRandomValues: originalCrypto?.getRandomValues?.bind(originalCrypto)
		},
		writable: true,
		configurable: true
	});

	// Default: successful credential processing
	mockProcessCredentialResponse.mockResolvedValue(MOCK_SUCCESS_RESULT);

	// Default: identity binding succeeds (no merge)
	mockBindIdentityCommitment.mockResolvedValue({
		success: true,
		userId: TEST_USER_ID,
		linkedToExisting: false
	});

	// Default: DB operations succeed
	mockPrismaUser.findUnique.mockResolvedValue({ trust_tier: 1 });
	mockPrismaUser.update.mockResolvedValue({});
});

afterEach(() => {
	vi.restoreAllMocks();

	// Restore original crypto
	Object.defineProperty(globalThis, 'crypto', {
		value: originalCrypto,
		writable: true,
		configurable: true
	});
});

// ============================================================================
// Authentication Guard
// ============================================================================

describe('POST /api/identity/verify-mdl/verify', () => {
	describe('authentication guard', () => {
		it('should throw 401 when session is null', async () => {
			const event = makeRequestEvent({ session: null });

			try {
				await POST(event);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(401);
			}
		});

		it('should throw 401 when session has no userId', async () => {
			const event = makeRequestEvent({ session: {} as any });

			try {
				await POST(event);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(401);
			}
		});

		it('should throw 401 when session is undefined', async () => {
			const event = makeRequestEvent();
			event.locals.session = undefined;

			try {
				await POST(event);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(401);
			}
		});

		it('should proceed when session has a valid userId', async () => {
			// Set up KV with session data
			const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			const response = await POST(event);
			expect(response.status).toBe(200);
		});
	});

	// ============================================================================
	// Input Validation
	// ============================================================================

	describe('input validation', () => {
		it('should throw 400 when protocol is missing', async () => {
			const event = makeRequestEvent({
				body: { data: 'test', nonce: TEST_NONCE }
			});

			try {
				await POST(event);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});

		it('should throw 400 when data is missing', async () => {
			const event = makeRequestEvent({
				body: { protocol: 'org-iso-mdoc', nonce: TEST_NONCE }
			});

			try {
				await POST(event);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});

		it('should throw 400 when nonce is missing', async () => {
			const event = makeRequestEvent({
				body: { protocol: 'org-iso-mdoc', data: 'test' }
			});

			try {
				await POST(event);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});

		it('should throw 400 when all fields are missing', async () => {
			const event = makeRequestEvent({
				body: {}
			});

			try {
				await POST(event);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});
	});

	// ============================================================================
	// KV Retrieval + Immediate Deletion (One-Time Use)
	// ============================================================================

	describe('KV retrieval and one-time use', () => {
		it('should retrieve session from KV using nonce-based key', async () => {
			const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			await POST(event);

			expect(mockKvGet).toHaveBeenCalledWith(`mdl-session:${TEST_NONCE}`);
		});

		it('should delete KV entry immediately after retrieval (one-time use)', async () => {
			const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			await POST(event);

			expect(mockKvDelete).toHaveBeenCalledWith(`mdl-session:${TEST_NONCE}`);
			// Delete should be called regardless of what happens next
			expect(mockKvDelete).toHaveBeenCalledTimes(1);
		});

		it('should throw 410 when KV entry is not found (expired)', async () => {
			const mockKvGet = vi.fn().mockResolvedValue(null);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			try {
				await POST(event);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(410);
				expect(err.body?.message).toContain('expired or already used');
			}
		});

		it('should throw 410 when KV entry has already been used (deleted)', async () => {
			const mockKvGet = vi.fn().mockResolvedValue(null);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			try {
				await POST(event);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(410);
			}
		});

		it('should still delete KV entry even when session data is null', async () => {
			const mockKvGet = vi.fn().mockResolvedValue(null);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			try {
				await POST(event);
			} catch {
				// Expected 410
			}

			expect(mockKvDelete).toHaveBeenCalledWith(`mdl-session:${TEST_NONCE}`);
		});
	});

	// ============================================================================
	// Dev Mode Fallback
	// ============================================================================

	describe('dev mode fallback (in-memory devSessionStore)', () => {
		it('should retrieve from devSessionStore when KV is unavailable', async () => {
			mockDevSessionStore.set(`mdl-session:${TEST_NONCE}`, {
				data: MOCK_SESSION_DATA,
				expires: Date.now() + 300_000
			});

			const event = makeRequestEvent({ platform: null });
			const response = await POST(event);

			expect(response.status).toBe(200);
		});

		it('should delete entry from devSessionStore after retrieval', async () => {
			mockDevSessionStore.set(`mdl-session:${TEST_NONCE}`, {
				data: MOCK_SESSION_DATA,
				expires: Date.now() + 300_000
			});

			const event = makeRequestEvent({ platform: null });
			await POST(event);

			expect(mockDevSessionStore.has(`mdl-session:${TEST_NONCE}`)).toBe(false);
		});

		it('should treat expired dev store entries as null', async () => {
			mockDevSessionStore.set(`mdl-session:${TEST_NONCE}`, {
				data: MOCK_SESSION_DATA,
				expires: Date.now() - 1000 // expired 1 second ago
			});

			const event = makeRequestEvent({ platform: null });

			try {
				await POST(event);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(410);
			}
		});

		it('should throw 410 when dev store entry does not exist', async () => {
			// devSessionStore is empty
			const event = makeRequestEvent({ platform: null });

			try {
				await POST(event);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(410);
			}
		});
	});

	// ============================================================================
	// Session Ownership Validation
	// ============================================================================

	describe('session ownership validation', () => {
		it('should throw 403 when stored userId does not match authenticated user', async () => {
			const mismatchedSessionData = JSON.stringify({
				privateKeyJwk: MOCK_PRIVATE_KEY_JWK,
				userId: 'different-user-id',
				createdAt: Date.now()
			});

			const mockKvGet = vi.fn().mockResolvedValue(mismatchedSessionData);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				session: { userId: TEST_USER_ID },
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			try {
				await POST(event);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(403);
				expect(err.body?.message).toContain('mismatch');
			}
		});

		it('should proceed when stored userId matches authenticated user', async () => {
			const matchingSessionData = JSON.stringify({
				privateKeyJwk: MOCK_PRIVATE_KEY_JWK,
				userId: TEST_USER_ID,
				createdAt: Date.now()
			});

			const mockKvGet = vi.fn().mockResolvedValue(matchingSessionData);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				session: { userId: TEST_USER_ID },
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			const response = await POST(event);
			expect(response.status).toBe(200);
		});

		it('should still delete KV entry before throwing 403', async () => {
			const mismatchedSessionData = JSON.stringify({
				privateKeyJwk: MOCK_PRIVATE_KEY_JWK,
				userId: 'wrong-user',
				createdAt: Date.now()
			});

			const mockKvGet = vi.fn().mockResolvedValue(mismatchedSessionData);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			try {
				await POST(event);
			} catch {
				// Expected 403
			}

			// KV entry should have been deleted before the ownership check
			expect(mockKvDelete).toHaveBeenCalledTimes(1);
		});
	});

	// ============================================================================
	// Ephemeral Key Import
	// ============================================================================

	describe('ephemeral key import', () => {
		it('should import the private key as ECDH P-256', async () => {
			const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			await POST(event);

			expect(mockImportKey).toHaveBeenCalledWith(
				'jwk',
				MOCK_PRIVATE_KEY_JWK,
				{ name: 'ECDH', namedCurve: 'P-256' },
				false, // NOT extractable (import for use only)
				['deriveKey', 'deriveBits']
			);
		});
	});

	// ============================================================================
	// Credential Processing
	// ============================================================================

	describe('credential processing', () => {
		it('should call processCredentialResponse with correct parameters', async () => {
			const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				body: {
					protocol: 'org-iso-mdoc',
					data: 'test-credential-data',
					nonce: TEST_NONCE
				},
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			await POST(event);

			expect(mockProcessCredentialResponse).toHaveBeenCalledWith(
				'test-credential-data',
				'org-iso-mdoc',
				MOCK_IMPORTED_KEY,
				TEST_NONCE,
				{ vicalKv: undefined }
			);
		});

		it('should return 422 when processCredentialResponse returns failure', async () => {
			mockProcessCredentialResponse.mockResolvedValue({
				success: false,
				error: 'invalid_format',
				message: 'CBOR decode failed'
			});

			const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(422);
			expect(data.error).toBe('invalid_format');
			expect(data.message).toBe('CBOR decode failed');
		});

		it('should return 422 for decryption_failed error', async () => {
			mockProcessCredentialResponse.mockResolvedValue({
				success: false,
				error: 'decryption_failed',
				message: 'HPKE decryption failed'
			});

			const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			const response = await POST(event);
			expect(response.status).toBe(422);
		});

		it('should return 422 for signature_invalid error', async () => {
			mockProcessCredentialResponse.mockResolvedValue({
				success: false,
				error: 'signature_invalid',
				message: 'COSE_Sign1 verification failed'
			});

			const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			const response = await POST(event);
			expect(response.status).toBe(422);
		});

		it('should return unsupported_state error with supportedStates when issuer not in trust store', async () => {
			mockProcessCredentialResponse.mockResolvedValue({
				success: false,
				error: 'unsupported_state',
				message: 'This mDL was issued by a state not yet in our trust store. Supported states: CA, NM, AK, AZ',
				supportedStates: ['CA', 'NM', 'AK', 'AZ', 'CO', 'GA', 'HI', 'IL', 'MD', 'MT', 'ND', 'OH', 'PR', 'UT', 'VA']
			});

			const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			const response = await POST(event);
			expect(response.status).toBe(422);

			const body = await response.json();
			expect(body.error).toBe('unsupported_state');
			expect(body.supportedStates).toBeDefined();
			expect(Array.isArray(body.supportedStates)).toBe(true);
			expect(body.supportedStates.length).toBeGreaterThan(0);
			expect(body.supportedStates).toContain('CA');
			expect(body.supportedStates).toContain('NM');
		});

		it('should NOT include supportedStates for signature_invalid errors (non-regression)', async () => {
			mockProcessCredentialResponse.mockResolvedValue({
				success: false,
				error: 'signature_invalid',
				message: 'ECDSA signature verification failed'
			});

			const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			const response = await POST(event);
			expect(response.status).toBe(422);

			const body = await response.json();
			expect(body.error).toBe('signature_invalid');
			expect(body.supportedStates).toBeUndefined();
		});

		it('supportedStates should match supportedIACAStates() output', async () => {
			const { supportedIACAStates } = await import('$lib/core/identity/iaca-roots');
			const expected = supportedIACAStates();

			mockProcessCredentialResponse.mockResolvedValue({
				success: false,
				error: 'unsupported_state',
				message: 'Unsupported state',
				supportedStates: expected
			});

			const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			const response = await POST(event);
			const body = await response.json();

			expect(body.supportedStates).toEqual(expected);
			expect(body.supportedStates.length).toBe(expected.length);
			// Every state in the response must be a valid 2-letter code
			for (const state of body.supportedStates) {
				expect(state).toMatch(/^[A-Z]{2}$/);
			}
		});

		it('should have 16 states in supportedIACAStates() including WV', async () => {
			const { supportedIACAStates } = await import('$lib/core/identity/iaca-roots');
			const states = supportedIACAStates();

			expect(states.length).toBe(16);
			expect(states).toContain('WV');
			expect(states).toContain('CA');
			expect(states).toContain('NM');
			expect(states).toContain('AK');
		});

		it('should have valid WV IACA root structure', async () => {
			const { IACA_ROOTS } = await import('$lib/core/identity/iaca-roots');

			expect(IACA_ROOTS.WV).toBeDefined();
			expect(Array.isArray(IACA_ROOTS.WV)).toBe(true);
			expect(IACA_ROOTS.WV.length).toBeGreaterThan(0);

			const wvRoot = IACA_ROOTS.WV[0];
			expect(wvRoot.state).toBe('WV');
			expect(wvRoot.issuer).toBeTruthy();

			// certificateB64 must be valid base64
			const decoded = atob(wvRoot.certificateB64);
			expect(decoded.length).toBeGreaterThan(0);
			// DER starts with SEQUENCE tag (0x30)
			expect(decoded.charCodeAt(0)).toBe(0x30);

			// expiresAt must be a future date
			const expiry = new Date(wvRoot.expiresAt);
			expect(expiry.getTime()).toBeGreaterThan(Date.now());
		});

		it('should return 422 for missing_fields error', async () => {
			mockProcessCredentialResponse.mockResolvedValue({
				success: false,
				error: 'missing_fields',
				message: 'Missing postal_code and state'
			});

			const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			const response = await POST(event);
			expect(response.status).toBe(422);
		});

		it('should return 422 for unsupported_protocol error', async () => {
			mockProcessCredentialResponse.mockResolvedValue({
				success: false,
				error: 'unsupported_protocol',
				message: 'Unsupported protocol: unknown'
			});

			const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			const response = await POST(event);
			expect(response.status).toBe(422);
		});
	});

	// ============================================================================
	// Trust Tier Upgrade (Conditional)
	// ============================================================================

	describe('trust tier conditional upgrade', () => {
		it('should upgrade users with trust_tier < 5 via findUnique + update', async () => {
			mockPrismaUser.findUnique.mockResolvedValue({ trust_tier: 1 });

			const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			await POST(event);

			expect(mockPrismaUser.findUnique).toHaveBeenCalledWith({
				where: { id: TEST_USER_ID },
				select: { trust_tier: true }
			});

			expect(mockPrismaUser.update).toHaveBeenCalledWith({
				where: { id: TEST_USER_ID },
				data: expect.objectContaining({
					trust_tier: 5,
					document_type: 'mdl',
					address_verification_method: 'mdl'
				})
			});
		});

		it('should NOT downgrade users already at tier 5', async () => {
			mockPrismaUser.findUnique.mockResolvedValue({ trust_tier: 5 });

			const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			const response = await POST(event);

			// Should still succeed -- the user was already at tier 5
			expect(response.status).toBe(200);
			// Update should NOT include trust_tier
			const updateData = mockPrismaUser.update.mock.calls[0][0].data;
			expect(updateData.trust_tier).toBeUndefined();
		});

		it('should set verified_at timestamp in update', async () => {
			const before = new Date();
			const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			await POST(event);
			const after = new Date();

			const updateData = mockPrismaUser.update.mock.calls[0][0].data;
			expect(updateData.verified_at).toBeInstanceOf(Date);
			expect(updateData.verified_at.getTime()).toBeGreaterThanOrEqual(before.getTime());
			expect(updateData.verified_at.getTime()).toBeLessThanOrEqual(after.getTime());
		});

		it('should set address_verified_at in update', async () => {
			const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			await POST(event);

			const updateData = mockPrismaUser.update.mock.calls[0][0].data;
			expect(updateData.address_verified_at).toBeInstanceOf(Date);
		});

		it('should upgrade users with null trust_tier', async () => {
			mockPrismaUser.findUnique.mockResolvedValue({ trust_tier: null });

			const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			await POST(event);

			const updateData = mockPrismaUser.update.mock.calls[0][0].data;
			expect(updateData.trust_tier).toBe(5);
		});
	});

	// ============================================================================
	// Unconditional Metadata Update
	// ============================================================================

	describe('identity binding and metadata update', () => {
		it('should call bindIdentityCommitment before DB update', async () => {
			const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			await POST(event);

			expect(mockBindIdentityCommitment).toHaveBeenCalledWith(
				TEST_USER_ID,
				expect.any(String)
			);
		});

		it('should always update metadata regardless of trust tier', async () => {
			mockPrismaUser.findUnique.mockResolvedValue({ trust_tier: 5 });

			const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			await POST(event);

			expect(mockPrismaUser.update).toHaveBeenCalledWith({
				where: { id: TEST_USER_ID },
				data: expect.objectContaining({
					address_verification_method: 'mdl',
					document_type: 'mdl'
				})
			});
		});

		it('should use single findUnique + update pattern (no updateMany)', async () => {
			const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			await POST(event);

			expect(mockPrismaUser.findUnique).toHaveBeenCalledTimes(1);
			expect(mockPrismaUser.update).toHaveBeenCalledTimes(1);
		});

		it('should use canonical userId from binding result for DB operations', async () => {
			const mergedUserId = 'merged-user-id';
			mockBindIdentityCommitment.mockResolvedValue({
				success: true,
				userId: mergedUserId,
				linkedToExisting: true,
				mergeDetails: { accountsMoved: 2, sourceEmail: 'a@b.com', targetEmail: 'c@d.com' }
			});

			const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			await POST(event);

			// Should use the merged userId, not the session userId
			expect(mockPrismaUser.findUnique).toHaveBeenCalledWith({
				where: { id: mergedUserId },
				select: { trust_tier: true }
			});
			expect(mockPrismaUser.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: mergedUserId }
				})
			);
		});
	});

	// ============================================================================
	// Response Format
	// ============================================================================

	describe('response format', () => {
		it('should return success with district, state, and credentialHash', async () => {
			const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.district).toBe('CA-12');
			expect(data.state).toBe('CA');
			expect(data.credentialHash).toBe(MOCK_SUCCESS_RESULT.credentialHash);
		});

		it('should return JSON content type', async () => {
			const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			const response = await POST(event);

			expect(response.headers.get('content-type')).toContain('application/json');
		});
	});

	// ============================================================================
	// Error Cases
	// ============================================================================

	describe('error cases', () => {
		it('should throw 500 when crypto.subtle.importKey fails', async () => {
			mockImportKey.mockRejectedValue(new Error('Invalid key data'));

			const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			try {
				await POST(event);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});

		it('should throw 500 when processCredentialResponse throws', async () => {
			mockProcessCredentialResponse.mockRejectedValue(new Error('Unexpected processing error'));

			const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			try {
				await POST(event);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});

		it('should throw 500 when database findUnique fails', async () => {
			mockPrismaUser.findUnique.mockRejectedValue(new Error('DB connection lost'));

			const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			try {
				await POST(event);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});

		it('should throw 500 when database update fails', async () => {
			mockPrismaUser.update.mockRejectedValue(new Error('Record not found'));

			const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			try {
				await POST(event);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});

		it('should re-throw SvelteKit errors (preserve status codes)', async () => {
			// When a SvelteKit error() is thrown internally, it should be re-thrown
			// not wrapped in a 500
			const mockKvGet = vi.fn().mockResolvedValue(null); // will trigger 410
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			try {
				await POST(event);
				expect.fail('Should have thrown');
			} catch (err: any) {
				// Should be 410, not 500
				expect(err.status).toBe(410);
			}
		});

		it('should handle malformed JSON in KV session data', async () => {
			const mockKvGet = vi.fn().mockResolvedValue('not-valid-json{{{');
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			try {
				await POST(event);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});
	});

	// ============================================================================
	// Security Properties
	// ============================================================================

	describe('security properties', () => {
		it('should not return the ephemeral private key in the response', async () => {
			const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			const response = await POST(event);
			const data = await response.json();
			const text = JSON.stringify(data);

			expect(text).not.toContain('mock-d'); // private key d param
			expect(data).not.toHaveProperty('privateKey');
			expect(data).not.toHaveProperty('privateKeyJwk');
		});

		it('should import the private key as non-extractable', async () => {
			const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			await POST(event);

			// The imported key should not be extractable
			const importKeyCall = mockImportKey.mock.calls[0];
			expect(importKeyCall[3]).toBe(false); // extractable = false
		});

		it('should enforce KV deletion before any further processing', async () => {
			// Track call order
			const callOrder: string[] = [];

			const mockKvGet = vi.fn().mockImplementation(async () => {
				callOrder.push('kv.get');
				return MOCK_SESSION_DATA;
			});
			const mockKvDelete = vi.fn().mockImplementation(async () => {
				callOrder.push('kv.delete');
			});

			mockImportKey.mockImplementation(async () => {
				callOrder.push('importKey');
				return MOCK_IMPORTED_KEY;
			});

			mockProcessCredentialResponse.mockImplementation(async () => {
				callOrder.push('processCredential');
				return MOCK_SUCCESS_RESULT;
			});

			const event = makeRequestEvent({
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			await POST(event);

			// kv.delete must come before importKey and processCredential
			const deleteIndex = callOrder.indexOf('kv.delete');
			const importIndex = callOrder.indexOf('importKey');
			const processIndex = callOrder.indexOf('processCredential');

			expect(deleteIndex).toBeLessThan(importIndex);
			expect(deleteIndex).toBeLessThan(processIndex);
		});
	});

	// ============================================================================
	// Protocol Support
	// ============================================================================

	describe('protocol support', () => {
		it('should pass org-iso-mdoc protocol to processCredentialResponse', async () => {
			const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				body: { protocol: 'org-iso-mdoc', data: 'test', nonce: TEST_NONCE },
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			await POST(event);

			expect(mockProcessCredentialResponse).toHaveBeenCalledWith(
				'test',
				'org-iso-mdoc',
				expect.anything(),
				TEST_NONCE,
				{ vicalKv: undefined }
			);
		});

		it('should pass openid4vp protocol to processCredentialResponse', async () => {
			const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
			const mockKvDelete = vi.fn().mockResolvedValue(undefined);
			const event = makeRequestEvent({
				body: { protocol: 'openid4vp', data: { vp_token: 'jwt.token.sig' }, nonce: TEST_NONCE },
				platform: {
					env: {
						DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
					}
				}
			});

			await POST(event);

			expect(mockProcessCredentialResponse).toHaveBeenCalledWith(
				{ vp_token: 'jwt.token.sig' },
				'openid4vp',
				expect.anything(),
				TEST_NONCE,
				{ vicalKv: undefined }
			);
		});
	});
});
