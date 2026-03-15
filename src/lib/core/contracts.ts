/**
 * Contract addresses and token constants — CLIENT-SAFE single source of truth.
 *
 * All contract addresses default to Scroll Sepolia but can be overridden via
 * `$env/dynamic/public` environment variables for mainnet or other networks.
 * SvelteKit injects public env vars during SSR, so they are available in both
 * server and client contexts at module-evaluation time.
 *
 * Override env vars (set in wrangler.toml [vars] or Cloudflare dashboard):
 *   PUBLIC_DEBATE_MARKET_ADDRESS   — DebateMarket contract address
 *   PUBLIC_DISTRICT_GATE_ADDRESS   — DistrictGate verifier contract address
 *   PUBLIC_STAKING_TOKEN_ADDRESS   — ERC-20 staking token (USDC) address
 *   PUBLIC_SCROLL_CHAIN_ID         — Target chain ID (534351 = Sepolia, 534352 = mainnet)
 *
 * Other modules should import from this file rather than declaring their own
 * copies.
 *
 * Exception: `src/lib/core/blockchain/debate-market-client.ts` reads from
 * $env/dynamic/private for server-side flexibility (environment-overridable).
 *
 * BROWSER SAFE: $env/dynamic/public is available everywhere in SvelteKit.
 */

import { env } from '$env/dynamic/public';
import { FEATURES } from '$lib/config/features';

/** DebateMarket contract (Scroll Sepolia V11 — hardened, parameterized timelocks). */
export const DEBATE_MARKET_ADDRESS =
	env.PUBLIC_DEBATE_MARKET_ADDRESS ?? '0xA07D6F620FEc31A163E1F888956e4c98D522B906';

/** DistrictGate verifier contract (Scroll Sepolia V11). */
export const DISTRICT_GATE_ADDRESS =
	env.PUBLIC_DISTRICT_GATE_ADDRESS ?? '0x139F96f38931cF2C2E1B4D285028d748F9DCA157';

/** ERC-20 staking token address (tUSDC on Scroll Sepolia V11). */
export const STAKING_TOKEN_ADDRESS =
	env.PUBLIC_STAKING_TOKEN_ADDRESS ?? '0xe70623c79E3b3F7909bd3e989E50a18DdB13C95d';

if (!env.PUBLIC_STAKING_TOKEN_ADDRESS && FEATURES.WALLET) {
	console.warn(
		'[contracts] PUBLIC_STAKING_TOKEN_ADDRESS is not set — using zero address. ' +
		'Staking/onramp features will not work until a real USDC address is configured.'
	);
}

/** Target chain ID (Scroll Sepolia = 534351, Scroll mainnet = 534352). */
export const SCROLL_CHAIN_ID = Number(env.PUBLIC_SCROLL_CHAIN_ID ?? '534351');

/** Token decimals for USDC (6). */
export const TOKEN_DECIMALS = 6;

/** Token symbol for display purposes. */
export const TOKEN_SYMBOL = 'USDC';
