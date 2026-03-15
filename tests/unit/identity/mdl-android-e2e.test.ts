/**
 * E2E integration tests for the Android mDL verification flow
 *
 * Tests the full start → verify pipeline as exercised by Android devices
 * using the Digital Credentials API (Chrome 128+ on Android 14+).
 *
 * Key coverage:
 *   - platform.env.PUBLIC_APP_URL used as openid4vp client_id (CF Workers fix)
 *   - Fallback to 'https://commons.email' when PUBLIC_APP_URL is absent
 *   - Session lifecycle: KV create (start) → KV retrieve+delete (verify)
 *   - Trust tier upgrade to 5 (never downgrade)
 *   - Identity commitment binding and BN254 fallback path
 *   - Unsupported state → 422 with supportedStates list
 *   - Full dual-protocol response shape (org-iso-mdoc + openid4vp)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mockCborEncode = vi.hoisted(() => vi.fn());
const mockCborTagged = vi.hoisted(() => vi.fn());

const mockDevSessionStoreStart = vi.hoisted(() => ({
	set: vi.fn(),
	get: vi.fn(),
	delete: vi.fn()
}));

const mockProcessCredentialResponse = vi.hoisted(() => vi.fn());

const mockPrismaUser = vi.hoisted(() => ({
	findUnique: vi.fn(),
	update: vi.fn()
}));

const mockBindIdentityCommitment = vi.hoisted(() => vi.fn());

const mockPrisma = vi.hoisted(() => ({
	user: mockPrismaUser
}));

const mockDevSessionStoreVerify = vi.hoisted(
	() => new Map<string, { data: string; expires: number }>()
);

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('cbor-web', () => ({
	default: {
		encode: mockCborEncode,
		Tagged: mockCborTagged
	},
	encode: mockCborEncode,
	Tagged: mockCborTagged
}));

vi.mock('$routes/api/identity/verify-mdl/_dev-session-store', () => ({
	devSessionStore: mockDevSessionStoreStart
}));

vi.mock('../../../src/routes/api/identity/verify-mdl/_dev-session-store', () => ({
	devSessionStore: mockDevSessionStoreVerify
}));

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

// ---------------------------------------------------------------------------
// Import modules under test AFTER mocks
// ---------------------------------------------------------------------------

import { POST as startPOST } from '../../../src/routes/api/identity/verify-mdl/start/+server';
import { POST as verifyPOST } from '../../../src/routes/api/identity/verify-mdl/verify/+server';

// ---------------------------------------------------------------------------
// Mock crypto.subtle
// ---------------------------------------------------------------------------

const mockGenerateKey = vi.fn();
const mockExportKey = vi.fn();
const mockImportKey = vi.fn();

const originalCrypto = globalThis.crypto;

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TEST_USER_ID = 'user-android-e2e-001';

const MOCK_KEY_PAIR = {
	privateKey: { type: 'private', algorithm: { name: 'ECDH' } },
	publicKey: { type: 'public', algorithm: { name: 'ECDH' } }
};

const MOCK_PRIVATE_KEY_JWK = {
	kty: 'EC',
	crv: 'P-256',
	x: 'android-x-coord',
	y: 'android-y-coord',
	d: 'android-private-d'
};

const MOCK_IMPORTED_KEY = { type: 'private', algorithm: { name: 'ECDH' } };

const MOCK_CBOR_BYTES = new Uint8Array([0xa2, 0x01, 0x02, 0x03, 0x04]);

const MOCK_SUCCESS_RESULT = {
	success: true,
	district: 'CA-12',
	state: 'CA',
	credentialHash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
	verificationMethod: 'mdl'
};

const MOCK_SESSION_DATA = JSON.stringify({
	privateKeyJwk: MOCK_PRIVATE_KEY_JWK,
	userId: TEST_USER_ID,
	createdAt: Date.now()
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStartEvent(overrides: {
	session?: { userId: string } | null;
	platform?: any;
} = {}) {
	return {
		request: new Request('http://localhost/api/identity/verify-mdl/start', {
			method: 'POST'
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
		url: new URL('http://localhost/api/identity/verify-mdl/start'),
		cookies: { get: () => undefined, getAll: () => [], set: () => {}, delete: () => {}, serialize: () => '' },
		fetch: globalThis.fetch,
		getClientAddress: () => '127.0.0.1',
		setHeaders: () => {},
		isDataRequest: false,
		isSubRequest: false,
		route: { id: '/api/identity/verify-mdl/start' }
	} as any;
}

function makeVerifyEvent(overrides: {
	body?: unknown;
	session?: { userId: string } | null;
	platform?: any;
} = {}) {
	const body = overrides.body ?? {
		protocol: 'org-iso-mdoc',
		data: 'base64-encoded-credential-data',
		nonce: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'
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
	mockDevSessionStoreVerify.clear();

	// Crypto mocks
	mockGenerateKey.mockResolvedValue(MOCK_KEY_PAIR);
	mockExportKey.mockResolvedValue(MOCK_PRIVATE_KEY_JWK);
	mockImportKey.mockResolvedValue(MOCK_IMPORTED_KEY);

	Object.defineProperty(globalThis, 'crypto', {
		value: {
			subtle: {
				generateKey: mockGenerateKey,
				exportKey: mockExportKey,
				importKey: mockImportKey,
				digest: vi.fn()
			},
			getRandomValues: (arr: Uint8Array) => {
				for (let i = 0; i < arr.length; i++) {
					arr[i] = (i * 7 + 42) % 256;
				}
				return arr;
			}
		},
		writable: true,
		configurable: true
	});

	// CBOR mocks
	mockCborEncode.mockReturnValue(MOCK_CBOR_BYTES);
	mockCborTagged.mockImplementation((tag: number, value: any) => ({ tag, value }));

	// Verify endpoint defaults
	mockProcessCredentialResponse.mockResolvedValue(MOCK_SUCCESS_RESULT);
	mockBindIdentityCommitment.mockResolvedValue({
		success: true,
		userId: TEST_USER_ID,
		linkedToExisting: false
	});
	mockPrismaUser.findUnique.mockResolvedValue({ trust_tier: 1 });
	mockPrismaUser.update.mockResolvedValue({});
});

afterEach(() => {
	vi.restoreAllMocks();
	Object.defineProperty(globalThis, 'crypto', {
		value: originalCrypto,
		writable: true,
		configurable: true
	});
});

// ============================================================================
// Start Endpoint — platform.env.PUBLIC_APP_URL (CF Workers fix)
// ============================================================================

describe('POST /api/identity/verify-mdl/start — PUBLIC_APP_URL handling', () => {
	it('should use platform.env.PUBLIC_APP_URL for openid4vp client_id', async () => {
		const event = makeStartEvent({
			platform: {
				env: {
					PUBLIC_APP_URL: 'https://my-custom-domain.com',
					DC_SESSION_KV: {
						put: vi.fn().mockResolvedValue(undefined),
						get: vi.fn(),
						delete: vi.fn()
					}
				}
			}
		});

		const response = await startPOST(event);
		const data = await response.json();

		const oid4vpRequest = data.requests[1];
		expect(oid4vpRequest.protocol).toBe('openid4vp');
		expect(oid4vpRequest.data.client_id).toBe('https://my-custom-domain.com');
	});

	it('should fallback to https://commons.email when PUBLIC_APP_URL is not set', async () => {
		const event = makeStartEvent({
			platform: {
				env: {
					DC_SESSION_KV: {
						put: vi.fn().mockResolvedValue(undefined),
						get: vi.fn(),
						delete: vi.fn()
					}
					// PUBLIC_APP_URL intentionally absent
				}
			}
		});

		const response = await startPOST(event);
		const data = await response.json();

		const oid4vpRequest = data.requests[1];
		expect(oid4vpRequest.data.client_id).toBe('https://commons.email');
	});

	it('should fallback to https://commons.email when platform is null', async () => {
		const event = makeStartEvent({ platform: null });

		const response = await startPOST(event);
		const data = await response.json();

		const oid4vpRequest = data.requests[1];
		expect(oid4vpRequest.data.client_id).toBe('https://commons.email');
	});

	it('should fallback to https://commons.email when platform.env is undefined', async () => {
		const event = makeStartEvent({ platform: {} });

		const response = await startPOST(event);
		const data = await response.json();

		const oid4vpRequest = data.requests[1];
		expect(oid4vpRequest.data.client_id).toBe('https://commons.email');
	});

	it('should NOT use process.env.PUBLIC_APP_URL (CF Workers incompatible)', async () => {
		// Simulate what would happen if process.env were populated but platform.env is not
		// The fix ensures we read from platform.env, not process.env
		const originalProcessEnv = process.env.PUBLIC_APP_URL;
		process.env.PUBLIC_APP_URL = 'https://process-env-should-not-be-used.com';

		try {
			const event = makeStartEvent({
				platform: {
					env: {
						DC_SESSION_KV: {
							put: vi.fn().mockResolvedValue(undefined),
							get: vi.fn(),
							delete: vi.fn()
						}
						// PUBLIC_APP_URL not set on platform.env
					}
				}
			});

			const response = await startPOST(event);
			const data = await response.json();

			const oid4vpRequest = data.requests[1];
			// Should use fallback, NOT process.env
			expect(oid4vpRequest.data.client_id).toBe('https://commons.email');
			expect(oid4vpRequest.data.client_id).not.toBe('https://process-env-should-not-be-used.com');
		} finally {
			if (originalProcessEnv !== undefined) {
				process.env.PUBLIC_APP_URL = originalProcessEnv;
			} else {
				delete process.env.PUBLIC_APP_URL;
			}
		}
	});
});

// ============================================================================
// Start Endpoint — Session Creation with KV TTL
// ============================================================================

describe('POST /api/identity/verify-mdl/start — session creation', () => {
	it('should write session to KV with 5-minute TTL (300s)', async () => {
		const mockKvPut = vi.fn().mockResolvedValue(undefined);
		const event = makeStartEvent({
			platform: {
				env: {
					DC_SESSION_KV: { put: mockKvPut, get: vi.fn(), delete: vi.fn() },
					PUBLIC_APP_URL: 'https://commons.email'
				}
			}
		});

		const response = await startPOST(event);
		const data = await response.json();

		expect(mockKvPut).toHaveBeenCalledTimes(1);
		const [key, _value, options] = mockKvPut.mock.calls[0];
		expect(key).toBe(`mdl-session:${data.nonce}`);
		expect(options).toEqual({ expirationTtl: 300 });
	});

	it('should store userId and privateKeyJwk in session data', async () => {
		const mockKvPut = vi.fn().mockResolvedValue(undefined);
		const event = makeStartEvent({
			platform: {
				env: {
					DC_SESSION_KV: { put: mockKvPut, get: vi.fn(), delete: vi.fn() }
				}
			}
		});

		await startPOST(event);

		const sessionData = JSON.parse(mockKvPut.mock.calls[0][1]);
		expect(sessionData.userId).toBe(TEST_USER_ID);
		expect(sessionData.privateKeyJwk).toEqual(MOCK_PRIVATE_KEY_JWK);
		expect(sessionData.createdAt).toBeDefined();
	});

	it('should return 401 when no session', async () => {
		const event = makeStartEvent({ session: null });

		try {
			await startPOST(event);
			expect.fail('Should have thrown');
		} catch (err: any) {
			expect(err.status).toBe(401);
		}
	});
});

// ============================================================================
// Start Endpoint — CBOR DeviceRequest
// ============================================================================

describe('POST /api/identity/verify-mdl/start — CBOR DeviceRequest', () => {
	it('should encode DeviceRequest with correct docType and namespace', async () => {
		const event = makeStartEvent({ platform: null });
		await startPOST(event);

		expect(mockCborEncode).toHaveBeenCalled();
		const itemsRequestArg = mockCborEncode.mock.calls[0][0];

		expect(itemsRequestArg).toBeInstanceOf(Map);
		expect(itemsRequestArg.get('docType')).toBe('org.iso.18013.5.1.mDL');

		const nameSpaces = itemsRequestArg.get('nameSpaces');
		expect(nameSpaces).toBeInstanceOf(Map);
		expect(nameSpaces.has('org.iso.18013.5.1')).toBe(true);
	});

	it('should include both org-iso-mdoc and openid4vp in dual-protocol response', async () => {
		const event = makeStartEvent({ platform: null });
		const response = await startPOST(event);
		const data = await response.json();

		expect(data.requests).toHaveLength(2);
		expect(data.requests[0].protocol).toBe('org-iso-mdoc');
		expect(data.requests[1].protocol).toBe('openid4vp');
	});
});

// ============================================================================
// Verify Endpoint — Session Expiry / Missing
// ============================================================================

describe('POST /api/identity/verify-mdl/verify — expired/missing session', () => {
	it('should return 410 when KV session is expired (null)', async () => {
		const mockKvGet = vi.fn().mockResolvedValue(null);
		const mockKvDelete = vi.fn().mockResolvedValue(undefined);
		const event = makeVerifyEvent({
			platform: {
				env: {
					DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
				}
			}
		});

		try {
			await verifyPOST(event);
			expect.fail('Should have thrown');
		} catch (err: any) {
			expect(err.status).toBe(410);
		}
	});

	it('should return 410 when session already consumed (one-time use)', async () => {
		// First call returns data, second returns null (already deleted)
		const mockKvGet = vi.fn().mockResolvedValue(null);
		const mockKvDelete = vi.fn().mockResolvedValue(undefined);
		const event = makeVerifyEvent({
			platform: {
				env: {
					DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
				}
			}
		});

		try {
			await verifyPOST(event);
			expect.fail('Should have thrown');
		} catch (err: any) {
			expect(err.status).toBe(410);
			expect(err.body?.message).toContain('expired or already used');
		}
	});
});

// ============================================================================
// Verify Endpoint — User Mismatch
// ============================================================================

describe('POST /api/identity/verify-mdl/verify — user mismatch', () => {
	it('should return 403 when session userId does not match authenticated user', async () => {
		const mismatchedData = JSON.stringify({
			privateKeyJwk: MOCK_PRIVATE_KEY_JWK,
			userId: 'different-user-id',
			createdAt: Date.now()
		});

		const mockKvGet = vi.fn().mockResolvedValue(mismatchedData);
		const mockKvDelete = vi.fn().mockResolvedValue(undefined);
		const event = makeVerifyEvent({
			session: { userId: TEST_USER_ID },
			platform: {
				env: {
					DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
				}
			}
		});

		try {
			await verifyPOST(event);
			expect.fail('Should have thrown');
		} catch (err: any) {
			expect(err.status).toBe(403);
			expect(err.body?.message).toContain('mismatch');
		}
	});
});

// ============================================================================
// Verify Endpoint — Trust Tier Upgrade
// ============================================================================

describe('POST /api/identity/verify-mdl/verify — trust tier upgrade', () => {
	it('should upgrade trust_tier to 5 on successful verification', async () => {
		mockPrismaUser.findUnique.mockResolvedValue({ trust_tier: 2 });

		const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
		const mockKvDelete = vi.fn().mockResolvedValue(undefined);
		const event = makeVerifyEvent({
			platform: {
				env: {
					DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
				}
			}
		});

		const response = await verifyPOST(event);
		expect(response.status).toBe(200);

		expect(mockPrismaUser.update).toHaveBeenCalledWith({
			where: { id: TEST_USER_ID },
			data: expect.objectContaining({
				trust_tier: 5,
				document_type: 'mdl',
				address_verification_method: 'mdl'
			})
		});
	});

	it('should never downgrade trust_tier (user already at tier 5)', async () => {
		mockPrismaUser.findUnique.mockResolvedValue({ trust_tier: 5 });

		const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
		const mockKvDelete = vi.fn().mockResolvedValue(undefined);
		const event = makeVerifyEvent({
			platform: {
				env: {
					DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
				}
			}
		});

		const response = await verifyPOST(event);
		expect(response.status).toBe(200);

		const updateData = mockPrismaUser.update.mock.calls[0][0].data;
		expect(updateData.trust_tier).toBeUndefined();
		// Metadata should still be updated
		expect(updateData.document_type).toBe('mdl');
		expect(updateData.address_verification_method).toBe('mdl');
	});

	it('should upgrade when trust_tier is null', async () => {
		mockPrismaUser.findUnique.mockResolvedValue({ trust_tier: null });

		const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
		const mockKvDelete = vi.fn().mockResolvedValue(undefined);
		const event = makeVerifyEvent({
			platform: {
				env: {
					DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
				}
			}
		});

		await verifyPOST(event);

		const updateData = mockPrismaUser.update.mock.calls[0][0].data;
		expect(updateData.trust_tier).toBe(5);
	});
});

// ============================================================================
// Verify Endpoint — Identity Commitment Binding
// ============================================================================

describe('POST /api/identity/verify-mdl/verify — identity commitment', () => {
	it('should use identityCommitment from result when available', async () => {
		const resultWithIdentity = {
			...MOCK_SUCCESS_RESULT,
			identityCommitment: 'aabbccdd11223344aabbccdd11223344aabbccdd11223344aabbccdd11223344'
		};
		mockProcessCredentialResponse.mockResolvedValue(resultWithIdentity);

		const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
		const mockKvDelete = vi.fn().mockResolvedValue(undefined);
		const event = makeVerifyEvent({
			platform: {
				env: {
					DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
				}
			}
		});

		await verifyPOST(event);

		expect(mockBindIdentityCommitment).toHaveBeenCalledWith(
			TEST_USER_ID,
			'aabbccdd11223344aabbccdd11223344aabbccdd11223344aabbccdd11223344'
		);
	});

	it('should fallback to BN254-reduced credentialHash when identityCommitment is absent', async () => {
		// Result without identityCommitment — triggers fallback path
		const resultWithoutIdentity = {
			success: true,
			district: 'CA-12',
			state: 'CA',
			credentialHash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
			verificationMethod: 'mdl'
			// identityCommitment intentionally absent
		};
		mockProcessCredentialResponse.mockResolvedValue(resultWithoutIdentity);

		const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
		const mockKvDelete = vi.fn().mockResolvedValue(undefined);
		const event = makeVerifyEvent({
			platform: {
				env: {
					DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
				}
			}
		});

		await verifyPOST(event);

		// Should have called bindIdentityCommitment with a BN254-reduced value
		expect(mockBindIdentityCommitment).toHaveBeenCalledTimes(1);
		const commitment = mockBindIdentityCommitment.mock.calls[0][1];
		// Must be 64-char hex string
		expect(commitment).toMatch(/^[0-9a-f]{64}$/);

		// Verify the BN254 reduction: hash mod BN254_MODULUS
		const BN254_MODULUS =
			21888242871839275222246405745257275088548364400416034343698204186575808495617n;
		const hashValue = BigInt('0x' + resultWithoutIdentity.credentialHash);
		const expected = (hashValue % BN254_MODULUS).toString(16).padStart(64, '0');
		expect(commitment).toBe(expected);
	});

	it('should use canonical userId from merge for DB operations', async () => {
		const mergedUserId = 'merged-canonical-user';
		mockBindIdentityCommitment.mockResolvedValue({
			success: true,
			userId: mergedUserId,
			linkedToExisting: true,
			mergeDetails: { accountsMoved: 1 }
		});

		const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
		const mockKvDelete = vi.fn().mockResolvedValue(undefined);
		const event = makeVerifyEvent({
			platform: {
				env: {
					DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
				}
			}
		});

		await verifyPOST(event);

		// DB operations should target the merged user
		expect(mockPrismaUser.findUnique).toHaveBeenCalledWith({
			where: { id: mergedUserId },
			select: { trust_tier: true }
		});
		expect(mockPrismaUser.update).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: mergedUserId }
			})
		);

		// Response should include the canonical userId
		// (We need to verify this through the response)
	});
});

// ============================================================================
// Verify Endpoint — Unsupported State (422)
// ============================================================================

describe('POST /api/identity/verify-mdl/verify — unsupported state', () => {
	it('should return 422 with supportedStates list for unsupported_state error', async () => {
		const supportedStates = ['CA', 'NM', 'AK', 'AZ', 'CO', 'GA', 'HI', 'IL', 'MD', 'MT', 'ND', 'OH', 'PR', 'UT', 'VA', 'WV'];
		mockProcessCredentialResponse.mockResolvedValue({
			success: false,
			error: 'unsupported_state',
			message: 'This mDL was issued by a state not yet in our trust store',
			supportedStates
		});

		const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
		const mockKvDelete = vi.fn().mockResolvedValue(undefined);
		const event = makeVerifyEvent({
			platform: {
				env: {
					DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
				}
			}
		});

		const response = await verifyPOST(event);
		expect(response.status).toBe(422);

		const body = await response.json();
		expect(body.error).toBe('unsupported_state');
		expect(body.supportedStates).toBeDefined();
		expect(Array.isArray(body.supportedStates)).toBe(true);
		expect(body.supportedStates).toEqual(supportedStates);
	});

	it('should NOT include supportedStates for non-unsupported_state errors', async () => {
		mockProcessCredentialResponse.mockResolvedValue({
			success: false,
			error: 'invalid_format',
			message: 'CBOR decode failed'
		});

		const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
		const mockKvDelete = vi.fn().mockResolvedValue(undefined);
		const event = makeVerifyEvent({
			platform: {
				env: {
					DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
				}
			}
		});

		const response = await verifyPOST(event);
		expect(response.status).toBe(422);

		const body = await response.json();
		expect(body.supportedStates).toBeUndefined();
	});
});

// ============================================================================
// Full E2E Flow — Start → Verify with Shared KV
// ============================================================================

describe('Android mDL E2E flow — start → verify lifecycle', () => {
	it('should complete full flow: start creates session, verify consumes it', async () => {
		// Simulate shared KV store
		const kvStore = new Map<string, { value: string; ttl: number }>();

		const mockKv = {
			put: vi.fn().mockImplementation(async (key: string, value: string, opts: any) => {
				kvStore.set(key, { value, ttl: opts?.expirationTtl ?? 0 });
			}),
			get: vi.fn().mockImplementation(async (key: string) => {
				const entry = kvStore.get(key);
				return entry?.value ?? null;
			}),
			delete: vi.fn().mockImplementation(async (key: string) => {
				kvStore.delete(key);
			})
		};

		const platform = {
			env: {
				DC_SESSION_KV: mockKv,
				PUBLIC_APP_URL: 'https://commons.email'
			}
		};

		// --- Step 1: Start ---
		const startEvent = makeStartEvent({ platform });
		const startResponse = await startPOST(startEvent);
		expect(startResponse.status).toBe(200);

		const startData = await startResponse.json();
		const { nonce, requests } = startData;

		// Verify dual-protocol response
		expect(requests).toHaveLength(2);
		expect(requests[0].protocol).toBe('org-iso-mdoc');
		expect(requests[1].protocol).toBe('openid4vp');
		expect(requests[1].data.client_id).toBe('https://commons.email');
		expect(requests[1].data.nonce).toBe(nonce);

		// Verify KV was written
		expect(mockKv.put).toHaveBeenCalledTimes(1);
		expect(kvStore.has(`mdl-session:${nonce}`)).toBe(true);

		// --- Step 2: Verify ---
		const verifyEvent = makeVerifyEvent({
			body: {
				protocol: 'org-iso-mdoc',
				data: 'android-credential-response-data',
				nonce
			},
			platform
		});

		const verifyResponse = await verifyPOST(verifyEvent);
		expect(verifyResponse.status).toBe(200);

		const verifyData = await verifyResponse.json();
		expect(verifyData.success).toBe(true);
		expect(verifyData.district).toBe('CA-12');
		expect(verifyData.state).toBe('CA');
		expect(verifyData.identityCommitmentBound).toBe(true);

		// Verify KV was consumed (deleted)
		expect(mockKv.delete).toHaveBeenCalledWith(`mdl-session:${nonce}`);
		expect(kvStore.has(`mdl-session:${nonce}`)).toBe(false);
	});

	it('should reject second verify attempt after session consumed', async () => {
		const kvStore = new Map<string, { value: string }>();

		const mockKv = {
			put: vi.fn().mockImplementation(async (key: string, value: string) => {
				kvStore.set(key, { value });
			}),
			get: vi.fn().mockImplementation(async (key: string) => {
				return kvStore.get(key)?.value ?? null;
			}),
			delete: vi.fn().mockImplementation(async (key: string) => {
				kvStore.delete(key);
			})
		};

		const platform = {
			env: {
				DC_SESSION_KV: mockKv,
				PUBLIC_APP_URL: 'https://commons.email'
			}
		};

		// Start
		const startEvent = makeStartEvent({ platform });
		const startResponse = await startPOST(startEvent);
		const { nonce } = await startResponse.json();

		// First verify — succeeds
		const verifyEvent1 = makeVerifyEvent({
			body: { protocol: 'org-iso-mdoc', data: 'cred-data', nonce },
			platform
		});
		const response1 = await verifyPOST(verifyEvent1);
		expect(response1.status).toBe(200);

		// Second verify — should fail with 410 (session already consumed)
		const verifyEvent2 = makeVerifyEvent({
			body: { protocol: 'org-iso-mdoc', data: 'cred-data', nonce },
			platform
		});

		try {
			await verifyPOST(verifyEvent2);
			expect.fail('Should have thrown');
		} catch (err: any) {
			expect(err.status).toBe(410);
		}
	});
});

// ============================================================================
// Missing Identity Fields Fallback
// ============================================================================

describe('POST /api/identity/verify-mdl/verify — missing identity fields fallback', () => {
	it('should use credentialHash mod BN254 when identityCommitment is missing', async () => {
		// A hash that exceeds BN254 modulus to exercise the reduction
		const largeHash = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
		mockProcessCredentialResponse.mockResolvedValue({
			success: true,
			district: 'NY-10',
			state: 'NY',
			credentialHash: largeHash,
			verificationMethod: 'mdl'
			// No identityCommitment — triggers fallback
		});

		const mockKvGet = vi.fn().mockResolvedValue(MOCK_SESSION_DATA);
		const mockKvDelete = vi.fn().mockResolvedValue(undefined);
		const event = makeVerifyEvent({
			platform: {
				env: {
					DC_SESSION_KV: { get: mockKvGet, delete: mockKvDelete, put: vi.fn() }
				}
			}
		});

		await verifyPOST(event);

		const commitment = mockBindIdentityCommitment.mock.calls[0][1];
		// Verify the reduction is correct
		const BN254_MODULUS =
			21888242871839275222246405745257275088548364400416034343698204186575808495617n;
		const hashValue = BigInt('0x' + largeHash);
		const expected = (hashValue % BN254_MODULUS).toString(16).padStart(64, '0');
		expect(commitment).toBe(expected);
		// The result should be less than BN254_MODULUS
		expect(BigInt('0x' + commitment)).toBeLessThan(BN254_MODULUS);
	});
});
