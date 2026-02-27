/**
 * Unit tests for debate argument & cosign API endpoints — txHash client-submission bypass path.
 *
 * When the request body includes a valid `txHash` (0x + 64 hex chars), the server
 * skips its own on-chain submission (server relayer) and uses the client-provided hash.
 * All other validation (auth, tier, stance, nullifier dedup) still runs.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════
// MOCKS — vi.hoisted runs before any imports, vi.mock is hoisted automatically
// ═══════════════════════════════════════════════════════════════════════════

const {
	mockPrisma,
	mockVerifyTransactionAsync,
	mockSubmitArgument,
	mockCoSignArgument
} = vi.hoisted(() => {
	const mockPrisma = {
		debate: { findUnique: vi.fn(), update: vi.fn() },
		debateArgument: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
		debateCoSign: { create: vi.fn() },
		debateNullifier: { findFirst: vi.fn(), create: vi.fn() },
		$transaction: vi.fn()
	};
	return {
		mockPrisma,
		mockVerifyTransactionAsync: vi.fn(),
		mockSubmitArgument: vi.fn().mockRejectedValue(new Error('not configured')),
		mockCoSignArgument: vi.fn().mockRejectedValue(new Error('not configured'))
	};
});

vi.mock('$lib/core/db', () => ({
	prisma: mockPrisma,
	db: mockPrisma
}));

vi.mock('$lib/core/blockchain/tx-verifier', () => ({
	verifyTransactionAsync: mockVerifyTransactionAsync
}));

vi.mock('$lib/core/blockchain/debate-market-client', () => ({
	submitArgument: mockSubmitArgument,
	coSignArgument: mockCoSignArgument
}));

// Mock $types modules to prevent SvelteKit type resolution issues
vi.mock('../../../src/routes/api/debates/[debateId]/arguments/$types', () => ({}));
vi.mock('../../../src/routes/api/debates/[debateId]/cosign/$types', () => ({}));

// ═══════════════════════════════════════════════════════════════════════════
// IMPORTS — after mocks are declared (vi.mock is hoisted by vitest)
// ═══════════════════════════════════════════════════════════════════════════

const { POST: argumentPOST } = await import(
	'../../../src/routes/api/debates/[debateId]/arguments/+server'
);
const { POST: cosignPOST } = await import(
	'../../../src/routes/api/debates/[debateId]/cosign/+server'
);

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

// Valid: 0x + 64 hex chars = 66 chars total
const VALID_TX_HASH = '0x' + 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
const SHORT_TX_HASH = '0x' + 'ab'.repeat(16); // 34 chars, too short
const NO_PREFIX_HASH = 'a1b2c3d4'.repeat(8); // 64 hex chars but missing 0x
const INVALID_HEX_HASH = '0x' + 'zzzz'.repeat(16); // not hex
const VALID_NULLIFIER = '0x' + 'cd'.repeat(32);
const VALID_PROOF = '0x' + 'ab'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function makeArgumentEvent(overrides: {
	debateId?: string;
	body?: Record<string, unknown>;
	user?: Record<string, unknown> | null;
	session?: Record<string, unknown> | null;
} = {}) {
	const body = {
		stance: 'SUPPORT',
		body: 'This is a test argument body that is at least twenty characters long for validation.',
		stakeAmount: 1_000_000,
		proofHex: VALID_PROOF,
		publicInputs: Array(31).fill('0'),
		nullifierHex: VALID_NULLIFIER,
		...overrides.body
	};

	return {
		params: { debateId: overrides.debateId ?? 'debate-123' },
		request: new Request('http://localhost/api/debates/debate-123/arguments', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		locals: {
			session: overrides.session !== undefined ? overrides.session : { userId: 'user-123' },
			user: overrides.user !== undefined ? overrides.user : { id: 'user-123', trust_tier: 3 }
		},
		url: new URL('http://localhost/api/debates/debate-123/arguments')
	} as any;
}

function makeCosignEvent(overrides: {
	debateId?: string;
	body?: Record<string, unknown>;
	user?: Record<string, unknown> | null;
	session?: Record<string, unknown> | null;
} = {}) {
	const body = {
		argumentIndex: 0,
		stakeAmount: 500_000,
		proofHex: VALID_PROOF,
		publicInputs: [...Array(30).fill('0'), '3'], // index 30 = tier 3
		nullifierHex: VALID_NULLIFIER,
		...overrides.body
	};

	return {
		params: { debateId: overrides.debateId ?? 'debate-123' },
		request: new Request('http://localhost/api/debates/debate-123/cosign', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		locals: {
			session: overrides.session !== undefined ? overrides.session : { userId: 'user-123' },
			user: overrides.user !== undefined ? overrides.user : { id: 'user-123', trust_tier: 3 }
		},
		url: new URL('http://localhost/api/debates/debate-123/cosign')
	} as any;
}

/** Set up the "happy path" DB mocks so that the handler reaches the tx/DB path. */
function setupDebateFound() {
	mockPrisma.debate.findUnique.mockResolvedValue({
		id: 'debate-123',
		status: 'active',
		argument_count: 0,
		deadline: new Date(Date.now() + 86_400_000), // tomorrow
		debate_id_onchain: '0x' + 'ee'.repeat(32)
	});
}

function setupNoExistingNullifier() {
	mockPrisma.debateNullifier.findFirst.mockResolvedValue(null);
}

function setupArgumentTransactionSuccess() {
	mockPrisma.$transaction.mockResolvedValue([
		// createArg result
		{ id: 'arg-1', argument_index: 0, weighted_score: 1_000_000n },
		// updateDebate result
		{ id: 'debate-123' },
		// createNullifier result (when nullifier is present)
		{ id: 'nullifier-1' }
	]);
}

function setupCosignArgumentFound() {
	mockPrisma.debateArgument.findUnique.mockResolvedValue({
		id: 'arg-1',
		argument_index: 0,
		debate_id: 'debate-123',
		co_sign_count: 2,
		total_stake: 5_000_000n,
		weighted_score: 3_000_000n
	});
}

function setupCosignTransactionSuccess() {
	mockPrisma.$transaction.mockResolvedValue([
		// updateArg result
		{ id: 'arg-1', co_sign_count: 3 },
		// updateDebate result
		{ id: 'debate-123' },
		// createNullifier result
		{ id: 'nullifier-2' }
	]);
}

/**
 * Call a SvelteKit endpoint and handle `error()` throws.
 * SvelteKit's `error()` throws an HttpError with { status, body }.
 */
async function callEndpoint(handler: Function, event: any) {
	try {
		const response = await handler(event);
		return {
			status: response.status ?? 200,
			body: await response.json()
		};
	} catch (err: any) {
		// SvelteKit's error() throws an HttpError with { status, body }
		if (err && typeof err === 'object' && 'status' in err) {
			return {
				status: err.status,
				body: err.body ?? { message: String(err) }
			};
		}
		throw err;
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════════════════

beforeEach(() => {
	vi.clearAllMocks();
	// Re-apply the default rejection for the server relayer mocks
	// (clearAllMocks resets mockRejectedValue)
	mockSubmitArgument.mockRejectedValue(new Error('not configured'));
	mockCoSignArgument.mockRejectedValue(new Error('not configured'));
});

// ═══════════════════════════════════════════════════════════════════════════
// ARGUMENTS ENDPOINT — Auth & Validation
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/debates/[debateId]/arguments', () => {
	describe('auth & validation', () => {
		it('returns 401 when no session', async () => {
			const event = makeArgumentEvent({ session: null });
			const result = await callEndpoint(argumentPOST, event);
			expect(result.status).toBe(401);
		});

		it('returns 401 when session has no userId', async () => {
			const event = makeArgumentEvent({ session: {} });
			const result = await callEndpoint(argumentPOST, event);
			expect(result.status).toBe(401);
		});

		it('returns 403 when user trust_tier < 3', async () => {
			const event = makeArgumentEvent({ user: { id: 'user-123', trust_tier: 2 } });
			const result = await callEndpoint(argumentPOST, event);
			expect(result.status).toBe(403);
		});

		it('returns 400 for invalid stance', async () => {
			setupDebateFound();
			const event = makeArgumentEvent({ body: { stance: 'NEUTRAL' } });
			const result = await callEndpoint(argumentPOST, event);
			expect(result.status).toBe(400);
		});

		it('returns 400 for argument body < 20 chars', async () => {
			setupDebateFound();
			const event = makeArgumentEvent({ body: { body: 'Too short.' } });
			const result = await callEndpoint(argumentPOST, event);
			expect(result.status).toBe(400);
		});
	});

	// ═══════════════════════════════════════════════════════════════════════
	// ARGUMENTS ENDPOINT — txHash Bypass Path
	// ═══════════════════════════════════════════════════════════════════════

	describe('txHash bypass path', () => {
		beforeEach(() => {
			setupDebateFound();
			setupNoExistingNullifier();
			setupArgumentTransactionSuccess();
		});

		it('skips server relayer when body includes valid txHash', async () => {
			const event = makeArgumentEvent({
				body: { txHash: VALID_TX_HASH }
			});

			const result = await callEndpoint(argumentPOST, event);

			expect(result.status).toBe(200);
			// The debate-market-client's submitArgument should NOT have been called
			expect(mockSubmitArgument).not.toHaveBeenCalled();
		});

		it('creates argument record with client-provided txHash context', async () => {
			const event = makeArgumentEvent({
				body: { txHash: VALID_TX_HASH }
			});

			await callEndpoint(argumentPOST, event);

			// $transaction should be called — contains createArg, updateDebate, createNullifier
			expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);

			// debateArgument.create should have been called with the correct data
			expect(mockPrisma.debateArgument.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						debate_id: 'debate-123',
						argument_index: 0,
						stance: 'SUPPORT'
					})
				})
			);
		});

		it('calls verifyTransactionAsync with the client txHash (fire-and-forget)', async () => {
			const event = makeArgumentEvent({
				body: { txHash: VALID_TX_HASH }
			});

			await callEndpoint(argumentPOST, event);

			expect(mockVerifyTransactionAsync).toHaveBeenCalledTimes(1);
			expect(mockVerifyTransactionAsync).toHaveBeenCalledWith(
				VALID_TX_HASH,
				expect.objectContaining({
					debateId: 'debate-123',
					type: 'argument',
					userId: 'user-123'
				})
			);
		});

		it('returns 200 with argumentId, argumentIndex, and txHash', async () => {
			const event = makeArgumentEvent({
				body: { txHash: VALID_TX_HASH }
			});

			const result = await callEndpoint(argumentPOST, event);

			expect(result.status).toBe(200);
			expect(result.body).toEqual(
				expect.objectContaining({
					argumentId: 'arg-1',
					argumentIndex: 0,
					txHash: VALID_TX_HASH
				})
			);
			expect(result.body.weightedScore).toBeDefined();
		});

		it('falls through to server relayer when txHash is too short', async () => {
			const event = makeArgumentEvent({
				body: { txHash: SHORT_TX_HASH }
			});

			await callEndpoint(argumentPOST, event);

			// Since txHash is invalid, the server relayer path is entered.
			// submitArgument rejects with 'not configured', handler catches and proceeds off-chain.
			expect(mockSubmitArgument).toHaveBeenCalled();
		});

		it('falls through to server relayer when txHash has no 0x prefix', async () => {
			const event = makeArgumentEvent({
				body: { txHash: NO_PREFIX_HASH }
			});

			await callEndpoint(argumentPOST, event);

			expect(mockSubmitArgument).toHaveBeenCalled();
		});

		it('falls through to server relayer when txHash contains non-hex chars', async () => {
			const event = makeArgumentEvent({
				body: { txHash: INVALID_HEX_HASH }
			});

			await callEndpoint(argumentPOST, event);

			expect(mockSubmitArgument).toHaveBeenCalled();
		});
	});

	// ═══════════════════════════════════════════════════════════════════════
	// ARGUMENTS ENDPOINT — Nullifier Dedup with txHash
	// ═══════════════════════════════════════════════════════════════════════

	describe('nullifier dedup with txHash', () => {
		beforeEach(() => {
			setupDebateFound();
		});

		it('returns 409 when nullifier already exists, even with valid txHash', async () => {
			// Nullifier already used
			mockPrisma.debateNullifier.findFirst.mockResolvedValue({ id: 'existing-nullifier' });

			const event = makeArgumentEvent({
				body: { txHash: VALID_TX_HASH }
			});

			const result = await callEndpoint(argumentPOST, event);

			expect(result.status).toBe(409);
			// Server relayer should NOT have been called — we rejected before reaching that point
			expect(mockSubmitArgument).not.toHaveBeenCalled();
			// DB transaction should NOT have run
			expect(mockPrisma.$transaction).not.toHaveBeenCalled();
		});

		it('creates nullifier record in the transaction when txHash bypass succeeds', async () => {
			setupNoExistingNullifier();
			setupArgumentTransactionSuccess();

			const event = makeArgumentEvent({
				body: { txHash: VALID_TX_HASH }
			});

			await callEndpoint(argumentPOST, event);

			// The handler builds: [createArg, updateDebate, debateNullifier.create(...)]
			expect(mockPrisma.debateNullifier.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						debate_id: 'debate-123',
						nullifier_hash: VALID_NULLIFIER,
						action_type: 'argument'
					})
				})
			);
			expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
		});
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// COSIGN ENDPOINT
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/debates/[debateId]/cosign', () => {
	describe('txHash bypass path', () => {
		beforeEach(() => {
			setupDebateFound();
			setupNoExistingNullifier();
			setupCosignArgumentFound();
			setupCosignTransactionSuccess();
		});

		it('skips server relayer when body includes valid txHash', async () => {
			const event = makeCosignEvent({
				body: { txHash: VALID_TX_HASH }
			});

			const result = await callEndpoint(cosignPOST, event);

			expect(result.status).toBe(200);
			// The debate-market-client's coSignArgument should NOT have been called
			expect(mockCoSignArgument).not.toHaveBeenCalled();
		});

		it('creates co-sign record with txHash context and returns success', async () => {
			const event = makeCosignEvent({
				body: { txHash: VALID_TX_HASH }
			});

			const result = await callEndpoint(cosignPOST, event);

			expect(result.status).toBe(200);
			expect(result.body).toEqual(
				expect.objectContaining({
					success: true,
					txHash: VALID_TX_HASH
				})
			);

			// Verify DB operations were invoked
			expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);

			// debateArgument.update should have been called to increment co-sign count
			expect(mockPrisma.debateArgument.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: 'arg-1' },
					data: expect.objectContaining({
						co_sign_count: { increment: 1 },
						total_stake: expect.anything()
					})
				})
			);

			// Nullifier should be recorded with action_type 'cosign'
			expect(mockPrisma.debateNullifier.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						debate_id: 'debate-123',
						nullifier_hash: VALID_NULLIFIER,
						action_type: 'cosign'
					})
				})
			);
		});

		it('calls verifyTransactionAsync with cosign context', async () => {
			const event = makeCosignEvent({
				body: { txHash: VALID_TX_HASH }
			});

			await callEndpoint(cosignPOST, event);

			expect(mockVerifyTransactionAsync).toHaveBeenCalledTimes(1);
			expect(mockVerifyTransactionAsync).toHaveBeenCalledWith(
				VALID_TX_HASH,
				expect.objectContaining({
					debateId: 'debate-123',
					type: 'cosign',
					userId: 'user-123'
				})
			);
		});

		it('falls through to server relayer when txHash is invalid', async () => {
			const event = makeCosignEvent({
				body: { txHash: SHORT_TX_HASH }
			});

			await callEndpoint(cosignPOST, event);

			// Invalid txHash => server relayer path attempted
			expect(mockCoSignArgument).toHaveBeenCalled();
		});

		it('returns 409 when nullifier already exists for cosign', async () => {
			mockPrisma.debateNullifier.findFirst.mockResolvedValue({ id: 'existing-nullifier' });

			const event = makeCosignEvent({
				body: { txHash: VALID_TX_HASH }
			});

			const result = await callEndpoint(cosignPOST, event);

			expect(result.status).toBe(409);
			expect(mockCoSignArgument).not.toHaveBeenCalled();
			expect(mockPrisma.$transaction).not.toHaveBeenCalled();
		});
	});

	describe('auth & validation', () => {
		it('returns 401 when no session', async () => {
			const event = makeCosignEvent({ session: null });
			const result = await callEndpoint(cosignPOST, event);
			expect(result.status).toBe(401);
		});

		it('returns 403 when user trust_tier < 3', async () => {
			const event = makeCosignEvent({ user: { id: 'user-123', trust_tier: 2 } });
			const result = await callEndpoint(cosignPOST, event);
			expect(result.status).toBe(403);
		});

		it('returns 400 when argumentIndex is missing', async () => {
			setupDebateFound();
			const event = makeCosignEvent({ body: { argumentIndex: undefined } });
			const result = await callEndpoint(cosignPOST, event);
			expect(result.status).toBe(400);
		});

		it('returns 404 when argument not found', async () => {
			setupDebateFound();
			setupNoExistingNullifier();
			mockPrisma.debateArgument.findUnique.mockResolvedValue(null);

			const event = makeCosignEvent();
			const result = await callEndpoint(cosignPOST, event);
			expect(result.status).toBe(404);
		});
	});
});
