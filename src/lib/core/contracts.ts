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
 *   PUBLIC_STAKING_TOKEN_ADDRESS   — ERC-20 staking token address
 *   PUBLIC_DISTRICT_GATE_ADDRESS   — DistrictGate verifier contract address
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

/** DebateMarket contract (Scroll Sepolia v6.2 default). */
export const DEBATE_MARKET_ADDRESS =
	env.PUBLIC_DEBATE_MARKET_ADDRESS ?? '0xAa1e5CcA6377c7c2E4dE2Df15dC87c51ccb9B751';

/** MockERC20 (USDC-compatible) staking token (Scroll Sepolia v6.2 default). */
export const STAKING_TOKEN_ADDRESS =
	env.PUBLIC_STAKING_TOKEN_ADDRESS ?? '0x1B999C28130475d78Ae19778918C06F98209287B';

/** DistrictGate verifier contract (Scroll Sepolia default). */
export const DISTRICT_GATE_ADDRESS =
	env.PUBLIC_DISTRICT_GATE_ADDRESS ?? '0xC5efdBE8A11d3EA1dD326360f43F159D9dfF684f';

/** Target chain ID (Scroll Sepolia = 534351, Scroll mainnet = 534352). */
export const SCROLL_CHAIN_ID = Number(env.PUBLIC_SCROLL_CHAIN_ID ?? '534351');

/** Token decimals for the staking token (USDC uses 6). */
export const TOKEN_DECIMALS = 6;

/** Token symbol for display purposes. */
export const TOKEN_SYMBOL = 'USDC';
