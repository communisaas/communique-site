/**
 * OAuth → NEAR Account Creation via Web3Auth MPC
 *
 * Creates deterministic NEAR accounts from OAuth identities.
 * Keys are managed by Web3Auth's MPC network - we store ONLY account IDs.
 */

import { db } from '$lib/core/db';
import { createHash } from 'crypto';
import { rpc } from './rpc';

/**
 * Environment configuration
 */
const NEAR_CONFIG = {
	networkId: process.env.NEAR_NETWORK_ID || 'testnet',
	// 🔄 REMOVED: Direct RPC URL - now using RPC abstraction layer with automatic failover
	// nodeUrl: process.env.NEAR_NODE_URL || 'https://rpc.testnet.near.org',
	web3authClientId: process.env.WEB3AUTH_CLIENT_ID || '',
	web3authNetwork: (process.env.WEB3AUTH_NETWORK as 'mainnet' | 'testnet' | 'cyan') || 'testnet',
	accountSalt: process.env.NEAR_ACCOUNT_SALT || '' // CRITICAL: Must be set for privacy
};

/**
 * Generate cryptographically secure random entropy for account ID
 */
function generateAccountEntropy(): string {
	// Generate 128-bit (16 bytes) of cryptographic entropy
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return Array.from(bytes, (byte: number) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Create privacy-safe NEAR account ID
 *
 * 🔒 PRIVACY FIX: Account IDs are NO LONGER linkable to real identities.
 *
 * Previously: `google-abc123.communique.testnet` (INSECURE - shows provider, predictable hash)
 * Now: `random-a3f2d9c8.communique.testnet` (SECURE - no provider, salted + random)
 *
 * Security properties:
 * - Uses deployment-wide secret salt (NEAR_ACCOUNT_SALT env var)
 * - Uses per-user random entropy (128-bit, stored in database)
 * - No OAuth provider name in account ID
 * - Impossible to reverse-engineer OAuth identity from account ID
 * - Deterministic for same user (can regenerate if entropy is preserved)
 *
 * @param oauthProvider - OAuth provider (google, facebook, twitter, etc)
 * @param oauthUserId - Unique user ID from OAuth provider
 * @returns NEAR account ID (e.g., "random-a3f2d9c8.communique.testnet")
 */
export async function createNEARAccountFromOAuth(
	oauthProvider: 'google' | 'facebook' | 'twitter' | 'linkedin' | 'discord',
	oauthUserId: string
): Promise<string> {
	// CRITICAL: Verify deployment salt is configured
	if (!NEAR_CONFIG.accountSalt) {
		throw new Error(
			'NEAR_ACCOUNT_SALT environment variable not set. ' +
			'This is REQUIRED for privacy-safe account generation. ' +
			'Generate with: openssl rand -hex 32'
		);
	}

	// 1. Find the user by OAuth provider and ID
	const account = await db.account.findFirst({
		where: {
			provider: oauthProvider,
			provider_account_id: oauthUserId
		},
		include: {
			user: {
				select: {
					id: true,
					near_account_id: true,
					near_account_entropy: true
				}
			}
		}
	});

	if (!account) {
		throw new Error(`No account found for ${oauthProvider}:${oauthUserId}`);
	}

	// 2. Check if account already exists
	if (account.user.near_account_id) {
		console.log(`[NEAR] Account already exists: ${account.user.near_account_id}`);
		return account.user.near_account_id;
	}

	// 3. Generate or retrieve user-specific entropy
	let entropy = account.user.near_account_entropy;
	if (!entropy) {
		entropy = generateAccountEntropy();
		console.log(`[NEAR] Generated new entropy for user ${account.user.id}`);
	}

	// 4. Create privacy-safe account ID hash
	// Hash includes: deployment salt + oauth provider + oauth user ID + per-user entropy
	// This makes account IDs:
	// - Unique per user
	// - Impossible to link to OAuth identity without both salt and entropy
	// - Consistent for the same user (deterministic given entropy)
	const accountHash = createHash('sha256')
		.update(NEAR_CONFIG.accountSalt) // Deployment-wide secret
		.update(oauthProvider)
		.update(oauthUserId)
		.update(entropy) // Per-user random component
		.digest('hex')
		.slice(0, 12); // Use first 12 hex chars (48 bits)

	// 5. Create privacy-safe account ID (no provider name)
	const accountId = `random-${accountHash}.communique.testnet`;

	// 6. Store account ID and entropy
	try {
		await db.user.update({
			where: { id: account.user.id },
			data: {
				near_account_id: accountId,
				near_account_entropy: entropy,
				near_auth_method: 'web3auth_oauth',
				near_account_created_at: new Date()
			}
		});

		console.log(`[NEAR] Created privacy-safe account ID: ${accountId}`);
		return accountId;
	} catch (error) {
		console.error('[NEAR] Account creation failed:', error);
		throw new Error(
			`Failed to create NEAR account: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Get or create NEAR account for user
 *
 * @param userId - Communique user ID
 * @returns NEAR account ID
 */
export async function ensureNEARAccount(userId: string): Promise<string> {
	const user = await db.user.findUnique({ where: { id: userId } });

	if (!user) {
		throw new Error('User not found');
	}

	// Return existing account if present
	if (user.near_account_id) {
		return user.near_account_id;
	}

	// Create new account from OAuth identity
	const account = await db.account.findFirst({
		where: { user_id: userId, type: 'oauth' }
	});

	if (!account) {
		throw new Error('No OAuth account found for user');
	}

	return await createNEARAccountFromOAuth(
		account.provider as 'google' | 'facebook' | 'twitter' | 'linkedin' | 'discord',
		account.provider_account_id
	);
}
