/**
 * Async transaction receipt verification.
 *
 * When clients submit a txHash directly (bypass path), this module
 * verifies the transaction actually succeeded on-chain. Runs as a
 * fire-and-forget background check — does NOT block the API response.
 *
 * SERVER-ONLY: Uses $env/dynamic/private for RPC URL.
 */

import { env } from '$env/dynamic/private';
import { JsonRpcProvider } from 'ethers';

/** Public fallback RPC for Scroll Sepolia when env var is not set. */
const SCROLL_SEPOLIA_PUBLIC_RPC = 'https://sepolia-rpc.scroll.io';

interface VerificationContext {
	debateId: string;
	type: 'argument' | 'cosign';
	userId?: string;
}

/**
 * Fire-and-forget transaction receipt verification.
 *
 * Checks whether the given txHash was mined and succeeded on-chain.
 * Retries once after 5 s if the receipt is not yet available (tx may
 * still be propagating / indexing).
 *
 * This function NEVER throws — all errors are caught and logged so
 * callers can safely invoke it without `await`.
 */
export function verifyTransactionAsync(txHash: string, context: VerificationContext): void {
	// Launch the async work without awaiting — truly fire-and-forget.
	_verify(txHash, context).catch(() => {
		// Belt-and-suspenders: _verify already has its own try/catch,
		// but guard against any unforeseen rejection escaping.
	});
}

async function _verify(txHash: string, context: VerificationContext): Promise<void> {
	try {
		const rpcUrl = env.SCROLL_RPC_URL || SCROLL_SEPOLIA_PUBLIC_RPC;
		const provider = new JsonRpcProvider(rpcUrl);

		let receipt = await provider.getTransactionReceipt(txHash);

		// Retry once after 5 s — the tx may not be indexed yet.
		if (receipt === null) {
			await new Promise((r) => setTimeout(r, 5_000));
			receipt = await provider.getTransactionReceipt(txHash);
		}

		if (receipt === null) {
			console.warn(
				`[tx-verifier] NOT FOUND: ${txHash} not on-chain after timeout for ${context.type} in debate ${context.debateId}`
			);
			return;
		}

		if (receipt.status === 1) {
			console.log(
				`[tx-verifier] Verified: ${txHash} for ${context.type} in debate ${context.debateId}`
			);
		} else {
			console.warn(
				`[tx-verifier] FAILED: ${txHash} reverted on-chain for ${context.type} in debate ${context.debateId}`
			);
		}
	} catch (err) {
		// Fire-and-forget: never propagate errors.
		console.warn(
			`[tx-verifier] Error checking ${txHash} for ${context.type} in debate ${context.debateId}:`,
			err
		);
	}
}
