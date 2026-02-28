/**
 * Unit tests for src/lib/core/contracts.ts
 *
 * The contracts module reads from $env/dynamic/public at import time.
 * We mock that virtual module with a Proxy that delegates to process.env,
 * mirroring SvelteKit's runtime behaviour. To test env overrides we use
 * vi.resetModules() + dynamic import so the module re-evaluates with the
 * new process.env values.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

// Mock $env/dynamic/public — the Proxy reads from process.env at access time,
// returning undefined for unset keys (matching SvelteKit's nullish semantics).
vi.mock('$env/dynamic/public', () => ({
	env: new Proxy({} as Record<string, string | undefined>, {
		get: (_target, prop: string) => process.env[prop]
	})
}));

// Static import for default-value and type-correctness tests.
// No PUBLIC_* env vars are set, so all values should be defaults.
import {
	DEBATE_MARKET_ADDRESS,
	DISTRICT_GATE_ADDRESS,
	STAKING_TOKEN_ADDRESS,
	SCROLL_CHAIN_ID,
	TOKEN_DECIMALS,
	TOKEN_SYMBOL
} from '$lib/core/contracts';

describe('contracts constants', () => {
	// ── Default values (no env overrides) ──────────────────────────────

	describe('default values', () => {
		it('DEBATE_MARKET_ADDRESS defaults to Scroll Sepolia v6.2 deployment', () => {
			expect(DEBATE_MARKET_ADDRESS).toBe('0xAa1e5CcA6377c7c2E4dE2Df15dC87c51ccb9B751');
		});

		it('DISTRICT_GATE_ADDRESS defaults to Scroll Sepolia deployment', () => {
			expect(DISTRICT_GATE_ADDRESS).toBe('0xC5efdBE8A11d3EA1dD326360f43F159D9dfF684f');
		});

		it('SCROLL_CHAIN_ID defaults to 534351 (Scroll Sepolia)', () => {
			expect(SCROLL_CHAIN_ID).toBe(534351);
		});

		it('TOKEN_DECIMALS is 6', () => {
			expect(TOKEN_DECIMALS).toBe(6);
		});

		it('TOKEN_SYMBOL is USDC', () => {
			expect(TOKEN_SYMBOL).toBe('USDC');
		});

		it('STAKING_TOKEN_ADDRESS defaults to zero address (placeholder)', () => {
			expect(STAKING_TOKEN_ADDRESS).toBe('0x0000000000000000000000000000000000000000');
		});
	});

	// ── Type correctness ───────────────────────────────────────────────

	describe('type correctness', () => {
		it('all addresses are strings', () => {
			expect(typeof DEBATE_MARKET_ADDRESS).toBe('string');
			expect(typeof DISTRICT_GATE_ADDRESS).toBe('string');
		});

		it('SCROLL_CHAIN_ID is a number', () => {
			expect(typeof SCROLL_CHAIN_ID).toBe('number');
		});

		it('TOKEN_DECIMALS is a number', () => {
			expect(typeof TOKEN_DECIMALS).toBe('number');
		});
	});

	// ── Address format ─────────────────────────────────────────────────

	describe('address format', () => {
		it.each([
			['DEBATE_MARKET_ADDRESS', DEBATE_MARKET_ADDRESS],
			['DISTRICT_GATE_ADDRESS', DISTRICT_GATE_ADDRESS]
		])('%s starts with 0x', (_name, address) => {
			expect(address).toMatch(/^0x/);
		});

		it.each([
			['DEBATE_MARKET_ADDRESS', DEBATE_MARKET_ADDRESS],
			['DISTRICT_GATE_ADDRESS', DISTRICT_GATE_ADDRESS]
		])('%s is 42 characters (20-byte hex)', (_name, address) => {
			expect(address).toHaveLength(42);
		});
	});

	// ── Env var override behaviour ─────────────────────────────────────

	describe('env var overrides', () => {
		const ENV_KEYS = [
			'PUBLIC_DEBATE_MARKET_ADDRESS',
			'PUBLIC_DISTRICT_GATE_ADDRESS',
			'PUBLIC_SCROLL_CHAIN_ID'
		];

		afterEach(() => {
			for (const key of ENV_KEYS) {
				delete process.env[key];
			}
		});

		it('respects env override for DEBATE_MARKET_ADDRESS', async () => {
			vi.resetModules();
			process.env.PUBLIC_DEBATE_MARKET_ADDRESS = '0x' + 'a'.repeat(40);
			const { DEBATE_MARKET_ADDRESS: addr } = await import('$lib/core/contracts');
			expect(addr).toBe('0x' + 'a'.repeat(40));
		});

		it('respects env override for DISTRICT_GATE_ADDRESS', async () => {
			vi.resetModules();
			process.env.PUBLIC_DISTRICT_GATE_ADDRESS = '0x' + 'c'.repeat(40);
			const { DISTRICT_GATE_ADDRESS: addr } = await import('$lib/core/contracts');
			expect(addr).toBe('0x' + 'c'.repeat(40));
		});

		it('respects env override for SCROLL_CHAIN_ID and coerces to number', async () => {
			vi.resetModules();
			process.env.PUBLIC_SCROLL_CHAIN_ID = '534352';
			const { SCROLL_CHAIN_ID: chainId } = await import('$lib/core/contracts');
			expect(chainId).toBe(534352);
			expect(typeof chainId).toBe('number');
		});
	});
});
