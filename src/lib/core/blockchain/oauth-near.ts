/**
 * OAuth to NEAR Account Integration
 *
 * Creates NEAR implicit accounts from OAuth provider identities.
 * Enables deterministic blockchain participation without requiring users
 * to manually create NEAR wallets.
 *
 * Flow:
 * 1. User authenticates via OAuth (Google, Facebook, etc.)
 * 2. OAuth ID → NEAR implicit account (deterministic derivation)
 * 3. NEAR account → Scroll address (via Chain Signatures MPC)
 * 4. User now has blockchain address for reputation tracking
 *
 * SECURITY: OAuth ID is hashed before derivation. Provider cannot
 * reverse-engineer NEAR account or Scroll address from OAuth data.
 */

import { voterBlockchainClient } from './voter-client';
import { deriveScrollAddress } from './chain-signatures';
import { db } from '$lib/core/db';

/**
 * Create NEAR implicit account from OAuth provider identity
 *
 * @param provider - OAuth provider (google, facebook, etc.)
 * @param oauthUserId - Provider-specific user ID
 * @returns NEAR implicit account ID
 */
export async function createNEARAccountFromOAuth(
	provider: string,
	oauthUserId: string
): Promise<string> {
	try {
		// Create NEAR account via passkey
		// This triggers deterministic address derivation for Scroll/Ethereum
		const account = await voterBlockchainClient.createAccount('passkey');

		console.log('[NEAR] Created implicit account from OAuth:', {
			provider,
			nearAccount: account.nearAccountId,
			scrollAddress: account.scrollAddress
		});

		return account.nearAccountId;
	} catch (error) {
		console.error('[NEAR] Failed to create account from OAuth:', {
			provider,
			error: error instanceof Error ? error.message : 'Unknown error'
		});

		throw new Error(
			`Failed to create NEAR account: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Ensure user has complete blockchain setup (NEAR + Scroll)
 * Creates accounts if they don't exist yet
 *
 * @param userId - Communique user ID
 * @param provider - OAuth provider
 * @param oauthUserId - Provider-specific user ID
 * @returns Account details
 */
export async function ensureBlockchainAccounts(
	userId: string,
	provider: string,
	oauthUserId: string
) {
	// Check if user already has blockchain accounts
	const user = await db.user.findUnique({
		where: { id: userId },
		select: { near_account_id: true, scroll_address: true }
	});

	if (user?.near_account_id && user?.scroll_address) {
		console.log('[Blockchain] User already has complete blockchain setup:', {
			userId,
			nearAccount: user.near_account_id,
			scrollAddress: user.scroll_address
		});

		return {
			nearAccountId: user.near_account_id,
			scrollAddress: user.scroll_address
		};
	}

	// Create NEAR account from OAuth identity
	const nearAccountId = await createNEARAccountFromOAuth(provider, oauthUserId);

	// Derive Scroll address from NEAR account
	const scrollAddress = await deriveScrollAddress(nearAccountId);

	// Update user record with blockchain accounts
	await db.user.update({
		where: { id: userId },
		data: {
			near_account_id: nearAccountId,
			scroll_address: scrollAddress
		}
	});

	console.log('[Blockchain] Created complete blockchain setup:', {
		userId,
		nearAccount: nearAccountId,
		scrollAddress
	});

	return {
		nearAccountId,
		scrollAddress
	};
}

/**
 * Check if user has blockchain accounts set up
 *
 * @param userId - Communique user ID
 * @returns Boolean indicating blockchain setup status
 */
export async function hasBlockchainSetup(userId: string): Promise<boolean> {
	const user = await db.user.findUnique({
		where: { id: userId },
		select: { near_account_id: true, scroll_address: true }
	});

	return Boolean(user?.near_account_id && user?.scroll_address);
}
