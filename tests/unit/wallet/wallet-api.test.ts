/**
 * Unit tests for wallet API endpoints:
 *   GET  /api/wallet/nonce    — nonce generation
 *   POST /api/wallet/connect  — EIP-191 signature verification + wallet binding
 *   GET  /api/wallet/balance  — on-chain USDC (ERC-20) balance read
 *
 * These test the SvelteKit route handler functions directly, passing mock
 * RequestEvent-shaped objects. External dependencies (ethers, DB, nonce store)
 * are mocked so we test handler logic in isolation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════
// Hoisted mock functions — vi.hoisted() makes these available to vi.mock()
// factories, which are hoisted above all other code.
// ═══════════════════════════════════════════════════════════════════════════

const { mockVerifyMessage, mockBalanceOf, mockFindUnique, mockUpdate } =
	vi.hoisted(() => {
		return {
			mockVerifyMessage: vi.fn(),
			mockBalanceOf: vi.fn(),
			mockFindUnique: vi.fn(),
			mockUpdate: vi.fn()
		};
	});

// ═══════════════════════════════════════════════════════════════════════════
// Module mocks
// ═══════════════════════════════════════════════════════════════════════════

// Mock $env/dynamic/public (used by balance endpoint via contracts.ts)
vi.mock('$env/dynamic/public', () => ({
	env: {}
}));

// Mock $lib/core/contracts (used by balance endpoint)
vi.mock('$lib/core/contracts', () => ({
	TOKEN_DECIMALS: 6,
	TOKEN_SYMBOL: 'USDC',
	STAKING_TOKEN_ADDRESS: '0x1B999C28130475d78Ae19778918C06F98209287B'
}));

// Mock ethers — provide real isAddress/getAddress for validation, mock the rest.
// The balance endpoint uses Contract.balanceOf() for ERC-20 balance reads.
vi.mock('ethers', async () => {
	const actual = await vi.importActual<typeof import('ethers')>('ethers');
	return {
		...actual,
		verifyMessage: mockVerifyMessage,
		JsonRpcProvider: class FakeProvider {},
		Contract: class FakeContract {
			balanceOf = mockBalanceOf;
		}
	};
});

// Mock $lib/core/db (the dbMockPlugin handles this in normal runs, but
// explicit mock ensures the connect handler's db calls are interceptable)
vi.mock('$lib/core/db', () => ({
	db: {
		user: {
			findUnique: (...args: unknown[]) => mockFindUnique(...args),
			update: (...args: unknown[]) => mockUpdate(...args)
		}
	}
}));

// ═══════════════════════════════════════════════════════════════════════════
// Imports (after mocks are declared)
// ═══════════════════════════════════════════════════════════════════════════

import { GET as nonceGET } from '../../../src/routes/api/wallet/nonce/+server';
import { POST as connectPOST } from '../../../src/routes/api/wallet/connect/+server';
import { GET as balanceGET } from '../../../src/routes/api/wallet/balance/+server';
import { nonceStore } from '../../../src/routes/api/wallet/_nonce-store';
import { getAddress } from 'ethers';

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

/** A valid checksummed Ethereum address for testing */
const VALID_ADDRESS = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';

function makeNonceEvent(locals: Record<string, unknown> = {}) {
	return { locals } as any;
}

function makeConnectEvent(
	body: Record<string, unknown>,
	locals: Record<string, unknown> = {}
) {
	return {
		locals,
		request: {
			json: () => Promise.resolve(body)
		}
	} as any;
}

function makeBalanceEvent(address?: string) {
	const url = address
		? new URL(`http://localhost/api/wallet/balance?address=${address}`)
		: new URL('http://localhost/api/wallet/balance');
	return { url } as any;
}

// ═══════════════════════════════════════════════════════════════════════════
// A. GET /api/wallet/nonce
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/wallet/nonce', () => {
	beforeEach(() => {
		nonceStore.clear();
	});

	it('returns 401 when no locals.user', async () => {
		const response = await nonceGET(makeNonceEvent());
		expect(response.status).toBe(401);

		const data = await response.json();
		expect(data.error).toBeDefined();
	});

	it('returns 200 with { nonce, message, expiresAt } when authenticated', async () => {
		const response = await nonceGET(makeNonceEvent({ user: { id: 'user-123' } }));
		expect(response.status).toBe(200);

		const data = await response.json();
		expect(data).toHaveProperty('nonce');
		expect(data).toHaveProperty('message');
		expect(data).toHaveProperty('expiresAt');
	});

	it('nonce is a 64-character hex string (32 bytes)', async () => {
		const response = await nonceGET(makeNonceEvent({ user: { id: 'user-123' } }));
		const data = await response.json();

		expect(data.nonce).toMatch(/^[0-9a-f]{64}$/);
	});

	it('message contains "Commons Wallet Verification" and the nonce', async () => {
		const response = await nonceGET(makeNonceEvent({ user: { id: 'user-123' } }));
		const data = await response.json();

		expect(data.message).toContain('Commons Wallet Verification');
		expect(data.message).toContain(data.nonce);
	});

	it('expiresAt is a valid ISO date string roughly 5 minutes in the future', async () => {
		const before = Date.now();
		const response = await nonceGET(makeNonceEvent({ user: { id: 'user-123' } }));
		const after = Date.now();
		const data = await response.json();

		const expiresAtMs = new Date(data.expiresAt).getTime();
		expect(Number.isNaN(expiresAtMs)).toBe(false);

		// Should be ~5 minutes (300_000ms) from now, with some tolerance
		const fiveMinMs = 5 * 60 * 1000;
		expect(expiresAtMs).toBeGreaterThanOrEqual(before + fiveMinMs - 1000);
		expect(expiresAtMs).toBeLessThanOrEqual(after + fiveMinMs + 1000);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// B. POST /api/wallet/connect
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/wallet/connect', () => {
	const USER_ID = 'user-abc';
	const NONCE = 'a'.repeat(64);
	const SIGNATURE = '0xfakesignature';
	const MESSAGE = 'Commons Wallet Verification\n\nNonce: ' + NONCE;

	function seedNonceStore(overrides: Partial<{ userId: string; expiresAt: number }> = {}) {
		nonceStore.set(NONCE, {
			userId: overrides.userId ?? USER_ID,
			nonce: NONCE,
			message: MESSAGE,
			expiresAt: overrides.expiresAt ?? Date.now() + 5 * 60 * 1000
		});
	}

	beforeEach(() => {
		nonceStore.clear();
		mockVerifyMessage.mockReset();
		mockFindUnique.mockReset();
		mockUpdate.mockReset();
	});

	it('returns 401 when no locals.user', async () => {
		const response = await connectPOST(
			makeConnectEvent(
				{ address: VALID_ADDRESS, signature: SIGNATURE, nonce: NONCE },
				{}
			)
		);
		expect(response.status).toBe(401);
	});

	it('returns 400 for missing body fields', async () => {
		const locals = { user: { id: USER_ID } };

		// Missing address
		let response = await connectPOST(
			makeConnectEvent({ signature: SIGNATURE, nonce: NONCE }, locals)
		);
		expect(response.status).toBe(400);
		let data = await response.json();
		expect(data.error).toContain('address');

		// Missing signature
		response = await connectPOST(
			makeConnectEvent({ address: VALID_ADDRESS, nonce: NONCE }, locals)
		);
		expect(response.status).toBe(400);
		data = await response.json();
		expect(data.error).toContain('signature');

		// Missing nonce
		response = await connectPOST(
			makeConnectEvent({ address: VALID_ADDRESS, signature: SIGNATURE }, locals)
		);
		expect(response.status).toBe(400);
		data = await response.json();
		expect(data.error).toContain('nonce');
	});

	it('returns 400 for invalid Ethereum address format', async () => {
		const response = await connectPOST(
			makeConnectEvent(
				{ address: 'not-an-address', signature: SIGNATURE, nonce: NONCE },
				{ user: { id: USER_ID } }
			)
		);
		expect(response.status).toBe(400);

		const data = await response.json();
		expect(data.error).toContain('address');
	});

	it('returns 400 for expired nonce', async () => {
		// Seed with an already-expired nonce
		seedNonceStore({ expiresAt: Date.now() - 1000 });

		const response = await connectPOST(
			makeConnectEvent(
				{ address: VALID_ADDRESS, signature: SIGNATURE, nonce: NONCE },
				{ user: { id: USER_ID } }
			)
		);
		expect(response.status).toBe(400);

		const data = await response.json();
		expect(data.error.toLowerCase()).toContain('expired');
	});

	it('returns 400 when signature does not match address', async () => {
		seedNonceStore();

		// verifyMessage recovers a DIFFERENT address
		const differentAddress = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
		mockVerifyMessage.mockReturnValue(differentAddress);

		const response = await connectPOST(
			makeConnectEvent(
				{ address: VALID_ADDRESS, signature: SIGNATURE, nonce: NONCE },
				{ user: { id: USER_ID } }
			)
		);
		expect(response.status).toBe(400);

		const data = await response.json();
		expect(data.error.toLowerCase()).toContain('signature');
	});

	it('returns 200 on success: valid nonce, matching signature, DB update succeeds', async () => {
		seedNonceStore();

		// verifyMessage recovers the same address (checksummed)
		const checksummed = getAddress(VALID_ADDRESS);
		mockVerifyMessage.mockReturnValue(checksummed);

		// No existing user with that wallet
		mockFindUnique.mockResolvedValue(null);

		// DB update succeeds
		mockUpdate.mockResolvedValue({ id: USER_ID, wallet_address: checksummed });

		const response = await connectPOST(
			makeConnectEvent(
				{ address: VALID_ADDRESS, signature: SIGNATURE, nonce: NONCE },
				{ user: { id: USER_ID } }
			)
		);
		expect(response.status).toBe(200);

		const data = await response.json();
		expect(data.success).toBe(true);
		expect(data.address).toBe(checksummed);

		// Nonce should be consumed (deleted from store)
		expect(nonceStore.has(NONCE)).toBe(false);

		// DB update should have been called with correct args
		expect(mockUpdate).toHaveBeenCalledWith({
			where: { id: USER_ID },
			data: {
				wallet_address: checksummed,
				wallet_type: 'evm'
			}
		});
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// C. GET /api/wallet/balance
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/wallet/balance', () => {
	beforeEach(() => {
		mockBalanceOf.mockReset();
	});

	it('returns 400 when no address query param', async () => {
		try {
			await balanceGET(makeBalanceEvent());
			// If it did not throw, fail the test
			expect.unreachable('Expected handler to throw');
		} catch (e: any) {
			expect(e.status).toBe(400);
		}
	});

	it('returns 400 for invalid address format', async () => {
		try {
			await balanceGET(makeBalanceEvent('not-an-address'));
			expect.unreachable('Expected handler to throw');
		} catch (e: any) {
			expect(e.status).toBe(400);
		}
	});

	it('returns 200 with correct { balance, formatted, symbol, decimals }', async () => {
		// 5_000_000n = 5 USDC (6 decimals)
		mockBalanceOf.mockResolvedValue(5_000_000n);

		const response = await balanceGET(makeBalanceEvent(VALID_ADDRESS));
		expect(response.status).toBe(200);

		const data = await response.json();
		expect(data.balance).toBe('5000000');
		expect(data.symbol).toBe('USDC');
		expect(data.decimals).toBe(6);
	});

	it('formatted is correctly computed (5.0000 USDC)', async () => {
		mockBalanceOf.mockResolvedValue(5_000_000n);

		const response = await balanceGET(makeBalanceEvent(VALID_ADDRESS));
		const data = await response.json();

		expect(data.formatted).toBe('5.0000');
	});

	it('returns 502 when RPC call fails', async () => {
		mockBalanceOf.mockRejectedValue(new Error('RPC timeout'));

		try {
			await balanceGET(makeBalanceEvent(VALID_ADDRESS));
			expect.unreachable('Expected handler to throw');
		} catch (e: any) {
			expect(e.status).toBe(502);
		}
	});
});
