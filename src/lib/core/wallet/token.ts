/**
 * ERC-20 Token Balance, Approval, & Formatting Helpers — browser-safe.
 *
 * USDC staking requires ERC-20 approval before staking operations.
 * This module provides balance reading, allowance checking, approval,
 * and amount formatting/parsing.
 *
 * BROWSER ONLY: No $env imports, no server-only dependencies.
 */

import { Contract, type Provider, type Signer } from 'ethers';
import {
	DEBATE_MARKET_ADDRESS,
	STAKING_TOKEN_ADDRESS,
	TOKEN_DECIMALS
} from '$lib/core/contracts';

// Re-export so downstream code (e.g. debate-client.ts) doesn't break.
export { DEBATE_MARKET_ADDRESS, STAKING_TOKEN_ADDRESS, TOKEN_DECIMALS };

// ═══════════════════════════════════════════════════════════════════════════
// ERC-20 ABI (minimal)
// ═══════════════════════════════════════════════════════════════════════════

const ERC20_ABI = [
	'function balanceOf(address owner) view returns (uint256)',
	'function allowance(address owner, address spender) view returns (uint256)',
	'function approve(address spender, uint256 amount) returns (bool)'
];

// ═══════════════════════════════════════════════════════════════════════════
// BALANCE (READ-ONLY)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Read the ERC-20 token balance for an address.
 *
 * @param provider - ethers v6 Provider (read-only)
 * @param tokenAddress - ERC-20 token contract address
 * @param ownerAddress - Wallet address to check balance for
 * @returns Raw balance in smallest unit (e.g. 5000000n = 5 USDC)
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
 * Read native ETH balance (for gas display).
 */
export async function getEthBalance(
	provider: Provider,
	ownerAddress: string
): Promise<bigint> {
	return await provider.getBalance(ownerAddress);
}

// ═══════════════════════════════════════════════════════════════════════════
// APPROVAL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Read ERC-20 allowance for a spender.
 */
export async function getTokenAllowance(
	provider: Provider,
	tokenAddress: string,
	owner: string,
	spender: string
): Promise<bigint> {
	const token = new Contract(tokenAddress, ERC20_ABI, provider);
	return await token.allowance(owner, spender);
}

/**
 * Ensure the spender has sufficient ERC-20 allowance. If current allowance
 * is below `amount`, approves max uint256 (one TX, infinite approval).
 * Idempotent: no-op if already approved.
 *
 * @param signer - Wallet signer for the approval TX
 * @param tokenAddress - ERC-20 token contract address
 * @param spender - Contract address to approve (e.g. DebateMarket)
 * @param amount - Minimum required allowance
 */
export async function ensureTokenApproval(
	signer: Signer,
	tokenAddress: string,
	spender: string,
	amount: bigint
): Promise<void> {
	const signerAddress = await signer.getAddress();
	const token = new Contract(tokenAddress, ERC20_ABI, signer);
	const currentAllowance: bigint = await token.allowance(signerAddress, spender);
	if (currentAllowance >= amount) return;

	const maxUint256 = (1n << 256n) - 1n;
	const tx = await token.approve(spender, maxUint256);
	await tx.wait();
}

// ═══════════════════════════════════════════════════════════════════════════
// FORMATTING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Format a raw token amount to a human-readable string.
 *
 * @param amount - Raw amount in smallest unit (e.g. 5000000n)
 * @param decimals - Token decimals (default: 6 for USDC)
 * @returns Formatted string (e.g. "5.000000")
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
 * @param humanAmount - Human-readable string (e.g. "5", "0.50")
 * @param decimals - Token decimals (default: 6 for USDC)
 * @returns Raw amount in smallest unit (e.g. 5000000n)
 */
export function parseTokenAmount(humanAmount: string, decimals: number = TOKEN_DECIMALS): bigint {
	const trimmed = humanAmount.trim();
	if (trimmed === '' || trimmed === '.') {
		return 0n;
	}

	if (trimmed.startsWith('-')) {
		throw new Error('Token amount cannot be negative');
	}

	const parts = trimmed.split('.');
	const wholePart = parts[0] || '0';
	const fractionalPart = (parts[1] || '').slice(0, decimals).padEnd(decimals, '0');

	return BigInt(wholePart) * 10n ** BigInt(decimals) + BigInt(fractionalPart);
}
