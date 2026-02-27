/**
 * Wallet Balance Endpoint
 *
 * GET /api/wallet/balance?address=0x...
 *
 * Returns the USDC balance for an address on Scroll (reads the staking token contract).
 * Public endpoint (no auth required) — balances are public on-chain data.
 *
 * Response: {
 *   balance: string,     // Raw amount (e.g., "20000000")
 *   formatted: string,   // Human-readable (e.g., "20.00")
 *   symbol: "USDC",
 *   decimals: 6
 * }
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { JsonRpcProvider, Contract, isAddress, getAddress } from 'ethers';
import { env } from '$env/dynamic/public';
import { STAKING_TOKEN_ADDRESS, TOKEN_DECIMALS, TOKEN_SYMBOL } from '$lib/core/contracts';

const ERC20_ABI = ['function balanceOf(address) view returns (uint256)'];

// Lazily initialized provider — survives across requests within the same
// Worker isolate but is cheap to recreate if the isolate is recycled.
let _provider: JsonRpcProvider | null = null;

function getProvider(): JsonRpcProvider {
	if (!_provider) {
		const rpcUrl = env.PUBLIC_SCROLL_RPC_URL || 'https://sepolia-rpc.scroll.io';
		_provider = new JsonRpcProvider(rpcUrl);
	}
	return _provider;
}

/**
 * Format a raw token amount (bigint) to a human-readable decimal string.
 * e.g., 20000000n with 6 decimals => "20.00"
 */
function formatTokenAmount(raw: bigint, decimals: number): string {
	const divisor = 10n ** BigInt(decimals);
	const whole = raw / divisor;
	const remainder = raw % divisor;

	// Pad the fractional part to exactly `decimals` digits, then take first 2
	const fractionalFull = remainder.toString().padStart(decimals, '0');
	const fractionalDisplay = fractionalFull.slice(0, 2);

	return `${whole}.${fractionalDisplay}`;
}

export const GET: RequestHandler = async ({ url }) => {
	const addressParam = url.searchParams.get('address');

	if (!addressParam) {
		throw error(400, 'Missing required query parameter: address');
	}

	if (!isAddress(addressParam)) {
		throw error(400, 'Invalid Ethereum address');
	}

	// Normalize to checksummed address
	const checksummedAddress = getAddress(addressParam);

	try {
		const provider = getProvider();
		const contract = new Contract(STAKING_TOKEN_ADDRESS, ERC20_ABI, provider);
		const rawBalance: bigint = await contract.balanceOf(checksummedAddress);

		const formatted = formatTokenAmount(rawBalance, TOKEN_DECIMALS);

		return json(
			{
				balance: rawBalance.toString(),
				formatted,
				symbol: TOKEN_SYMBOL,
				decimals: TOKEN_DECIMALS
			},
			{
				headers: {
					'Cache-Control': 'public, max-age=10, s-maxage=10'
				}
			}
		);
	} catch (err) {
		console.error('[wallet/balance] RPC call failed:', err);

		// If the provider is stale or the RPC endpoint changed, reset it
		_provider = null;

		throw error(502, 'Failed to fetch on-chain balance');
	}
};
