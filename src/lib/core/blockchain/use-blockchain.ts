/**
 * Browser-Safe Blockchain Account Management
 *
 * Provides SSR-safe access to blockchain functionality via Svelte stores.
 * All blockchain operations are deferred to client-side execution with
 * proper browser detection.
 *
 * Architecture:
 * - Server-side: Minimal state, no blockchain imports
 * - Client-side: Dynamic imports, full blockchain functionality
 * - Reactive: Svelte stores for UI integration
 *
 * Usage:
 * ```typescript
 * import { initializeBlockchain, blockchain } from './use-blockchain';
 *
 * onMount(async () => {
 *   await initializeBlockchain(userId, provider, oauthUserId);
 * });
 *
 * $: if ($blockchain.initialized) {
 *   console.log('NEAR:', $blockchain.nearAccountId);
 * }
 * ```
 */

import { browser } from '$app/environment';
import { writable, type Readable } from 'svelte/store';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface BlockchainState {
	/** Whether blockchain accounts have been initialized */
	initialized: boolean;

	/** NEAR implicit account ID (e.g., "abc123...def456.near") */
	nearAccountId: string | null;

	/** Scroll L2 address (EVM-compatible) */
	scrollAddress: string | null;

	/** Ethereum L1 address (same as Scroll, ECDSA derivation) */
	ethereumAddress: string | null;

	/** Loading state during account creation */
	loading: boolean;

	/** Error message if initialization failed */
	error: string | null;
}

// =============================================================================
// STORE INITIALIZATION
// =============================================================================

const blockchainState = writable<BlockchainState>({
	initialized: false,
	nearAccountId: null,
	scrollAddress: null,
	ethereumAddress: null,
	loading: false,
	error: null
});

// =============================================================================
// BLOCKCHAIN INITIALIZATION (BROWSER-ONLY)
// =============================================================================

/**
 * Initialize blockchain accounts for user
 *
 * CRITICAL: This function MUST be called from onMount() in Svelte components
 * to ensure it only runs in browser context. SSR will skip this entirely.
 *
 * @param userId - Communique user ID
 * @param provider - OAuth provider (google, facebook, etc.)
 * @param oauthUserId - Provider-specific user ID
 * @returns Account details or null if SSR
 *
 * @example
 * ```typescript
 * onMount(async () => {
 *   if (browser) {
 *     await initializeBlockchain(user.id, 'google', googleUserId);
 *   }
 * });
 * ```
 */
export async function initializeBlockchain(
	userId: string,
	provider: string,
	oauthUserId: string
): Promise<{
	nearAccountId: string;
	scrollAddress: string;
	ethereumAddress: string;
} | null> {
	// SSR guard - prevent server-side execution
	if (!browser) {
		console.warn('[Blockchain] Cannot initialize in SSR context - skipping');
		return null;
	}

	// Input validation
	if (!userId || !provider || !oauthUserId) {
		const error = 'Missing required parameters for blockchain initialization';
		blockchainState.update((s) => ({ ...s, error }));
		throw new Error(error);
	}

	// Set loading state
	blockchainState.update((s) => ({ ...s, loading: true, error: null }));

	try {
		console.log('[Blockchain] Initializing accounts for user:', {
			userId,
			provider,
			hasOAuthUserId: !!oauthUserId
		});

		// Dynamic import to avoid SSR bundle inclusion
		// This import ONLY happens in browser, never during SSR build
		const { ensureBlockchainAccounts } = await import('./oauth-near');

		// Create or retrieve blockchain accounts
		const accounts = await ensureBlockchainAccounts(userId, provider, oauthUserId);

		console.log('[Blockchain] Successfully initialized accounts:', {
			nearAccount: accounts.nearAccountId,
			scrollAddress: accounts.scrollAddress
		});

		// Update store with successful state
		blockchainState.set({
			initialized: true,
			nearAccountId: accounts.nearAccountId,
			scrollAddress: accounts.scrollAddress,
			ethereumAddress: accounts.scrollAddress, // Same as Scroll (ECDSA)
			loading: false,
			error: null
		});

		return {
			nearAccountId: accounts.nearAccountId,
			scrollAddress: accounts.scrollAddress,
			ethereumAddress: accounts.scrollAddress
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown blockchain error';

		console.error('[Blockchain] Failed to initialize accounts:', {
			userId,
			provider,
			error: message,
			stack: error instanceof Error ? error.stack : undefined
		});

		// Update store with error state
		blockchainState.update((s) => ({
			...s,
			loading: false,
			error: message
		}));

		// Re-throw for caller to handle
		throw error;
	}
}

/**
 * Check if user has existing blockchain accounts in database
 * This is safe to call server-side as it only queries the database
 *
 * @param userId - Communique user ID
 * @returns Whether user has blockchain setup
 */
export async function hasExistingBlockchainSetup(userId: string): Promise<boolean> {
	try {
		// This import is safe because it's just the database client
		const { db } = await import('$lib/core/db');

		const user = await db.user.findUnique({
			where: { id: userId },
			select: { wallet_address: true, scroll_address: true }
		});

		return Boolean(user?.wallet_address && user?.scroll_address);
	} catch (error) {
		console.error('[Blockchain] Failed to check existing setup:', error);
		return false;
	}
}

/**
 * Load existing blockchain accounts from database into store
 * Safe to call server-side (database query only)
 *
 * @param userId - Communique user ID
 */
export async function loadExistingBlockchainAccounts(userId: string): Promise<void> {
	try {
		const { db } = await import('$lib/core/db');

		const user = await db.user.findUnique({
			where: { id: userId },
			select: {
				wallet_address: true,
				scroll_address: true
			}
		});

		if (user?.wallet_address && user?.scroll_address) {
			blockchainState.set({
				initialized: true,
				nearAccountId: user.wallet_address,
				scrollAddress: user.scroll_address,
				ethereumAddress: user.scroll_address, // Same as Scroll
				loading: false,
				error: null
			});

			console.log('[Blockchain] Loaded existing accounts from database:', {
				nearAccount: user.wallet_address,
				scrollAddress: user.scroll_address
			});
		}
	} catch (error) {
		console.error('[Blockchain] Failed to load existing accounts:', error);
	}
}

/**
 * Reset blockchain state (useful for logout/cleanup)
 */
export function resetBlockchainState(): void {
	blockchainState.set({
		initialized: false,
		nearAccountId: null,
		scrollAddress: null,
		ethereumAddress: null,
		loading: false,
		error: null
	});
}

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * Reactive blockchain state store
 * Subscribe to this in Svelte components for reactive updates
 *
 * @example
 * ```svelte
 * <script>
 *   import { blockchain } from '$lib/core/blockchain/use-blockchain';
 * </script>
 *
 * {#if $blockchain.loading}
 *   <p>Creating blockchain accounts...</p>
 * {:else if $blockchain.initialized}
 *   <p>NEAR: {$blockchain.nearAccountId}</p>
 *   <p>Scroll: {$blockchain.scrollAddress}</p>
 * {/if}
 * ```
 */
export const blockchain: Readable<BlockchainState> = {
	subscribe: blockchainState.subscribe
};
