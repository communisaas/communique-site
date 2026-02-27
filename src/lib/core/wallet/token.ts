/**
 * ERC-20 Token Helpers — browser-safe balance reading and spending approval.
 *
 * Provides pure helper functions for interacting with ERC-20 tokens (USDC)
 * on Scroll Sepolia. Used by the debate market staking flow to check balances,
 * read allowances, and approve the DebateMarket contract to spend tokens.
 *
 * BROWSER ONLY: No $env imports, no server-only dependencies.
 * Leaf dependency: imports nothing from other wallet modules.
 *
 * @see evm-provider.ts  EVMWalletProvider — provides the BrowserProvider/Signer
 * @see types.ts         WalletProvider — interface for signing
 */

import { Contract, type Provider, type Signer } from 'ethers';
import {
	STAKING_TOKEN_ADDRESS,
	DEBATE_MARKET_ADDRESS,
	TOKEN_DECIMALS
} from '$lib/core/contracts';

// Re-export so downstream code (e.g. debate-client.ts) doesn't break.
export { STAKING_TOKEN_ADDRESS, DEBATE_MARKET_ADDRESS, TOKEN_DECIMALS };

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** Minimal ERC-20 ABI for balance/allowance/approve operations. */
const ERC20_ABI = [
	'function balanceOf(address owner) view returns (uint256)',
	'function allowance(address owner, address spender) view returns (uint256)',
	'function approve(address spender, uint256 amount) returns (bool)',
	'function decimals() view returns (uint8)',
	'function symbol() view returns (string)'
];

/**
 * Cap for generous approvals. 2^128 - 1 rather than max uint256
 * to avoid the infinite-approval footgun while still being large enough
 * to never need re-approval in practice.
 */
const MAX_APPROVAL = 2n ** 128n - 1n;

// ═══════════════════════════════════════════════════════════════════════════
// BALANCE & ALLOWANCE (READ-ONLY)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Read the ERC-20 token balance for an address.
 *
 * @param provider - ethers v6 Provider (read-only, e.g. from BrowserProvider)
 * @param tokenAddress - ERC-20 contract address
 * @param ownerAddress - Wallet address to check balance for
 * @returns Raw balance in smallest unit (e.g. 20000000 = $20.00 USDC)
 */
export async function getTokenBalance(
	provider: Provider,
	tokenAddress: string,
	ownerAddress: string
): Promise<bigint> {
	const token = new Contract(tokenAddress, ERC20_ABI, provider);
	return await token.balanceOf(ownerAddress);
}

/**
 * Read the current ERC-20 allowance granted to a spender.
 *
 * @param provider - ethers v6 Provider (read-only)
 * @param tokenAddress - ERC-20 contract address
 * @param ownerAddress - Token holder address
 * @param spenderAddress - Address authorized to spend (e.g. DebateMarket contract)
 * @returns Current allowance in smallest unit
 */
export async function getTokenAllowance(
	provider: Provider,
	tokenAddress: string,
	ownerAddress: string,
	spenderAddress: string
): Promise<bigint> {
	const token = new Contract(tokenAddress, ERC20_ABI, provider);
	return await token.allowance(ownerAddress, spenderAddress);
}

// ═══════════════════════════════════════════════════════════════════════════
// APPROVAL (WRITE)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Send an ERC-20 approve transaction.
 *
 * Dispatches the approval via the signer (triggers wallet popup in MetaMask)
 * and waits for on-chain confirmation.
 *
 * @param signer - ethers v6 Signer (from BrowserProvider.getSigner())
 * @param tokenAddress - ERC-20 contract address
 * @param spenderAddress - Address to approve for spending
 * @param amount - Raw amount to approve in smallest unit
 * @returns Transaction hash of the confirmed approval
 * @throws On user rejection, insufficient gas, or tx revert
 */
export async function approveTokenSpend(
	signer: Signer,
	tokenAddress: string,
	spenderAddress: string,
	amount: bigint
): Promise<string> {
	const token = new Contract(tokenAddress, ERC20_ABI, signer);
	const tx = await token.approve(spenderAddress, amount);
	const receipt = await tx.wait();
	return receipt.hash;
}

/**
 * Ensure the spender has sufficient allowance, approving if needed.
 *
 * If the current allowance is already >= amount, returns null (no tx sent).
 * Otherwise, sends an approve tx for amount * 10 (generous buffer to avoid
 * re-approving on every subsequent stake), capped at 2^128 - 1.
 *
 * @param signer - ethers v6 Signer (from BrowserProvider.getSigner())
 * @param tokenAddress - ERC-20 contract address
 * @param ownerAddress - Token holder address (must match signer)
 * @param spenderAddress - Address to approve for spending
 * @param amount - Minimum required allowance in smallest unit
 * @returns Approval tx hash if a new approval was sent, null if already sufficient
 */
export async function ensureAllowance(
	signer: Signer,
	tokenAddress: string,
	ownerAddress: string,
	spenderAddress: string,
	amount: bigint
): Promise<string | null> {
	const currentAllowance = await getTokenAllowance(
		signer.provider!,
		tokenAddress,
		ownerAddress,
		spenderAddress
	);

	if (currentAllowance >= amount) {
		return null;
	}

	// Generous approval: 10x the requested amount, capped at 2^128 - 1
	const approvalAmount = amount * 10n > MAX_APPROVAL ? MAX_APPROVAL : amount * 10n;

	return await approveTokenSpend(signer, tokenAddress, spenderAddress, approvalAmount);
}

// ═══════════════════════════════════════════════════════════════════════════
// FORMATTING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Format a raw token amount to a human-readable string.
 *
 * @param amount - Raw amount in smallest unit (e.g. 20000000n)
 * @param decimals - Token decimals (default: 6 for USDC)
 * @returns Formatted string (e.g. "20.00")
 *
 * @example
 *   formatTokenAmount(20000000n)     // "20.00"
 *   formatTokenAmount(1500n)         // "0.001500"
 *   formatTokenAmount(0n)            // "0.000000"
 */
export function formatTokenAmount(amount: bigint, decimals: number = TOKEN_DECIMALS): string {
	const divisor = 10n ** BigInt(decimals);
	const wholePart = amount / divisor;
	const fractionalPart = amount % divisor;

	// Pad fractional part with leading zeros to match decimal places
	const fractionalStr = fractionalPart.toString().padStart(decimals, '0');

	return `${wholePart}.${fractionalStr}`;
}

/**
 * Parse a human-readable token amount to raw smallest-unit bigint.
 *
 * @param humanAmount - Human-readable string (e.g. "20.00", "5", "0.5")
 * @param decimals - Token decimals (default: 6 for USDC)
 * @returns Raw amount in smallest unit (e.g. 20000000n)
 *
 * @example
 *   parseTokenAmount("20.00")   // 20000000n
 *   parseTokenAmount("5")       // 5000000n
 *   parseTokenAmount("0.5")     // 500000n
 */
export function parseTokenAmount(humanAmount: string, decimals: number = TOKEN_DECIMALS): bigint {
	const trimmed = humanAmount.trim();
	if (trimmed === '' || trimmed === '.') {
		return 0n;
	}

	const parts = trimmed.split('.');
	const wholePart = parts[0] || '0';
	const fractionalPart = (parts[1] || '').slice(0, decimals).padEnd(decimals, '0');

	return BigInt(wholePart) * 10n ** BigInt(decimals) + BigInt(fractionalPart);
}
