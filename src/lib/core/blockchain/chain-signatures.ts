/**
 * NEAR Chain Signatures - Multi-Chain Address Derivation
 *
 * Derives Ethereum-compatible addresses (for Scroll) from NEAR accounts
 * using NEAR's MPC network. No private keys are stored anywhere.
 */

import { computeAddress } from 'ethers';
import { db } from '$lib/core/db';
import { rpc, viewMethod } from './rpc';

const NEAR_CONFIG = {
	networkId: (process.env.NEAR_NETWORK_ID || 'testnet') as 'mainnet' | 'testnet',
	// 🔄 REMOVED: Direct RPC URL - now using RPC abstraction layer with automatic failover
	// nodeUrl: process.env.NEAR_NODE_URL || 'https://rpc.testnet.near.org',
	mpcContract: process.env.NEAR_MPC_CONTRACT || 'v1.signer.testnet'
};

/**
 * Derive Scroll address from NEAR account via Chain Signatures
 *
 * @param nearAccountId - NEAR account ID (e.g., "google-abc123.communique.testnet")
 * @returns Ethereum-compatible address for Scroll (e.g., "0x1b48b83a...")
 */
export async function deriveScrollAddress(nearAccountId: string): Promise<string> {
	try {
		// 1. Call MPC contract to get derived public key via RPC abstraction layer
		// MPC network computes this deterministically from:
		//   - NEAR account ID
		//   - Derivation path ("scroll-sepolia,1")
		// Keys never exist in complete form - distributed across 8 nodes
		const result = await viewMethod(
			NEAR_CONFIG.mpcContract,
			'public_key_for',
			{
				path: 'scroll-sepolia,1',
				predecessor: nearAccountId
			},
			NEAR_CONFIG.networkId
		);

		// 2. Parse derived public key
		const publicKeyData = typeof result === 'string' ? result : JSON.stringify(result);
		const publicKeyJson = JSON.parse(publicKeyData);

		// 3. Convert secp256k1 public key to Ethereum address
		const publicKeyHex = `0x${publicKeyJson.public_key || publicKeyJson}`;
		const scrollAddress = computeAddress(publicKeyHex);

		// 4. Store derived address in database
		await db.user.update({
			where: { near_account_id: nearAccountId },
			data: {
				scroll_address: scrollAddress,
				scroll_derivation_path: 'scroll-sepolia,1'
			}
		});

		console.log(`[Chain Signatures] Derived Scroll address: ${scrollAddress}`);
		return scrollAddress;
	} catch (error) {
		console.error('[Chain Signatures] Derivation failed:', error);
		throw new Error(
			`Failed to derive Scroll address: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Get or derive Scroll address for user
 *
 * @param userId - Communique user ID
 * @returns Scroll address
 */
export async function ensureScrollAddress(userId: string): Promise<string> {
	const user = await db.user.findUnique({ where: { id: userId } });

	if (!user) {
		throw new Error('User not found');
	}

	// Return existing address if present
	if (user.scroll_address) {
		return user.scroll_address;
	}

	// Derive new address from NEAR account
	if (!user.near_account_id) {
		throw new Error('User has no NEAR account - create NEAR account first');
	}

	return await deriveScrollAddress(user.near_account_id);
}

/**
 * Sign Scroll transaction via NEAR MPC network
 *
 * ⚠️ DEPRECATION NOTICE: This function will be replaced with client-side signing.
 *
 * The transaction signing flow will move entirely to the client side using
 * NEAR passkeys (see client-signing.ts). This server-side implementation is
 * kept temporarily for backwards compatibility during the migration.
 *
 * TODO: Remove this function after migrating all signing to client-side passkeys
 *
 * @param nearAccountId - NEAR account ID
 * @param txPayload - Transaction payload to sign (32-byte hash)
 * @returns Signature components { r, s, v }
 */
export async function signScrollTransaction(
	_nearAccountId: string,
	_txPayload: Uint8Array
): Promise<{ r: string; s: string; v: number }> {
	// TODO (Week 2): Implement client-side transaction signing with passkeys
	// This requires:
	// 1. User authentication via passkey (WebAuthn/FIDO2)
	// 2. Client-side call to MPC contract sign() method
	// 3. Proper transaction construction and RLP encoding
	//
	// For now, throw error to prevent accidental server-side signing
	throw new Error(
		'Server-side transaction signing is deprecated. ' +
		'Use client-side passkey signing via ClientPasskeyWallet.signTransaction() ' +
		'See: src/lib/core/blockchain/client-signing.ts'
	);
}

/**
 * Check if user has complete blockchain setup
 *
 * @param userId - Communique user ID
 * @returns True if user has both NEAR and Scroll accounts
 */
export async function hasCompleteBlockchainSetup(userId: string): Promise<boolean> {
	const user = await db.user.findUnique({
		where: { id: userId },
		select: {
			near_account_id: true,
			scroll_address: true
		}
	});

	return !!(user?.near_account_id && user?.scroll_address);
}
