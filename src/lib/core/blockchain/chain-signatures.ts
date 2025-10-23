/**
 * NEAR Chain Signatures Integration
 *
 * Wrapper around @voter-protocol/client Chain Signatures functionality.
 * Enables deterministic address derivation across multiple blockchains
 * using NEAR's MPC threshold signature protocol.
 *
 * Architecture:
 * - NEAR implicit account (ed25519 passkey)
 * - MPC-derived ECDSA addresses (Scroll, Ethereum, Bitcoin)
 * - No private keys stored (derived on-demand via MPC)
 */

import { voterBlockchainClient } from './voter-client';

/**
 * Derive Scroll L2 address from NEAR implicit account
 * Uses NEAR Chain Signatures MPC to derive ECDSA public key → address
 *
 * SECURITY: Address derived deterministically from NEAR account.
 * No private keys stored. MPC signs transactions via 300+ validators.
 *
 * @param nearAccountId - NEAR implicit account ID (e.g., "abc123...def456.near")
 * @returns Scroll address (EVM-compatible)
 */
export async function deriveScrollAddress(nearAccountId: string): Promise<string> {
	// Get account state from VOTER Protocol client
	const accountState = voterBlockchainClient.getCurrentAccount();

	if (accountState.scrollAddress) {
		return accountState.scrollAddress;
	}

	// If no cached address, create account to trigger derivation
	const account = await voterBlockchainClient.createAccount('passkey');

	return account.scrollAddress;
}

/**
 * Derive Ethereum L1 address from NEAR implicit account
 * Same MPC process as Scroll, but for Ethereum mainnet
 *
 * @param nearAccountId - NEAR implicit account ID
 * @returns Ethereum address (EVM-compatible)
 */
export async function deriveEthereumAddress(nearAccountId: string): Promise<string> {
	const account = voterBlockchainClient.getCurrentAccount();

	if (!account.scrollAddress) {
		// Scroll and Ethereum use same address derivation (both ECDSA)
		const newAccount = await voterBlockchainClient.createAccount('passkey');
		return newAccount.ethereumAddress;
	}

	// Scroll address = Ethereum address (same ECDSA derivation)
	return account.scrollAddress;
}

/**
 * Check if user has a NEAR account with derived addresses
 *
 * @returns Account existence status
 */
export function hasChainSignaturesAccount(): boolean {
	const account = voterBlockchainClient.getCurrentAccount();
	return account.nearAccount !== null && account.scrollAddress !== null;
}

/**
 * Get all derived addresses for current user
 *
 * @returns All blockchain addresses derived from NEAR account
 */
export function getAllDerivedAddresses() {
	const account = voterBlockchainClient.getCurrentAccount();

	return {
		near: account.nearAccount,
		scroll: account.scrollAddress,
		ethereum: account.scrollAddress, // Same as Scroll (ECDSA)
		connectedWallet: account.connectedWallet // External wallet (MetaMask, etc.)
	};
}
