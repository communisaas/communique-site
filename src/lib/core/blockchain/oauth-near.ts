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
 *
 * SSR SAFETY: All functions in this module require browser context.
 * They MUST be called via dynamic imports from client-side code only.
 */

import { browser } from '$app/environment';
import { voterBlockchainClient } from './voter-client';
import { deriveScrollAddress } from './chain-signatures';
import { db } from '$lib/core/db';

/**
 * Create NEAR implicit account from OAuth provider identity
 *
 * CRITICAL: This function requires browser context (WebAuthn, IndexedDB)
 * Must be called from client-side code only via dynamic import
 *
 * @param provider - OAuth provider (google, facebook, etc.)
 * @param oauthUserId - Provider-specific user ID
 * @returns NEAR implicit account ID
 * @throws Error if called in SSR context
 */
export async function createNEARAccountFromOAuth(
	provider: string,
	oauthUserId: string
): Promise<string> {
	// SSR guard - NEAR account creation requires browser APIs
	if (!browser) {
		throw new Error(
			'createNEARAccountFromOAuth requires browser context (WebAuthn). Cannot execute during SSR.'
		);
	}

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
 * CRITICAL: This function requires browser context for account creation
 * Must be called from client-side code only via dynamic import
 *
 * @param userId - Communique user ID
 * @param provider - OAuth provider
 * @param oauthUserId - Provider-specific user ID
 * @returns Account details
 * @throws Error if called in SSR context
 */
export async function ensureBlockchainAccounts(
	userId: string,
	provider: string,
	oauthUserId: string
): Promise<{
	nearAccountId: string;
	scrollAddress: string;
}> {
	// SSR guard - blockchain account creation requires browser APIs
	if (!browser) {
		throw new Error(
			'ensureBlockchainAccounts requires browser context (WebAuthn, IndexedDB). Cannot execute during SSR.'
		);
	}

	// Check if user already has blockchain accounts
	const user = await db.user.findUnique({
		where: { id: userId },
		select: { wallet_address: true, scroll_address: true }
	});

	if (user?.wallet_address && user?.scroll_address) {
		console.log('[Blockchain] User already has complete blockchain setup:', {
			userId,
			nearAccount: user.wallet_address,
			scrollAddress: user.scroll_address
		});

		return {
			nearAccountId: user.wallet_address,
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
			wallet_address: nearAccountId,
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
		select: { wallet_address: true, scroll_address: true }
	});

	return Boolean(user?.wallet_address && user?.scroll_address);
}
