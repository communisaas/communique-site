<script lang="ts">
	/**
	 * Blockchain Initialization Component
	 *
	 * Handles client-side blockchain account creation after OAuth callback.
	 * This component MUST be placed in the browser-only rendering path
	 * (e.g., inside onMount or wrapped in {#if browser}).
	 *
	 * Usage:
	 * ```svelte
	 * <BlockchainInit
	 *   userId={user.id}
	 *   provider="google"
	 *   oauthUserId={googleUserId}
	 * >
	 *   <!-- Content shown after blockchain accounts are ready -->
	 *   <YourComponent />
	 * </BlockchainInit>
	 * ```
	 *
	 * Features:
	 * - Automatic NEAR account creation via passkeys (Face ID/Touch ID)
	 * - Deterministic Scroll address derivation
	 * - Loading states with progress feedback
	 * - Error handling with retry capability
	 * - Zero server-side execution (SSR-safe)
	 */

	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { initializeBlockchain, blockchain } from '$lib/core/blockchain/use-blockchain';

	// =============================================================================
	// PROPS
	// =============================================================================

	interface Props {
		/** Communique user ID */
		userId: string;

		/** OAuth provider (google, facebook, etc.) */
		provider: string;

		/** Provider-specific OAuth user ID */
		oauthUserId: string;

		/** Optional: Skip initialization if user already has accounts */
		skipIfExists?: boolean;

		/** Optional: Show loading UI (default: true) */
		showLoading?: boolean;

		/** Optional: Show error UI (default: true) */
		showError?: boolean;

		/** Optional: Auto-retry on error (default: false) */
		autoRetry?: boolean;

		/** Optional: Retry delay in ms (default: 3000) */
		retryDelay?: number;
	}

	let {
		userId,
		provider,
		oauthUserId,
		skipIfExists = true,
		showLoading = true,
		showError = true,
		autoRetry = false,
		retryDelay = 3000,
		children
	}: Props = $props();

	// =============================================================================
	// STATE
	// =============================================================================

	let initAttempted = $state(false);
	let retryCount = $state(0);
	let retryTimer: ReturnType<typeof setTimeout> | null = null;

	// =============================================================================
	// LIFECYCLE
	// =============================================================================

	onMount(async () => {
		// Skip if not in browser (redundant safety check)
		if (!browser) {
			console.warn('[BlockchainInit] Component mounted in SSR context - skipping');
			return;
		}

		// Skip if already initialized and skipIfExists is true
		if (skipIfExists && $blockchain.initialized) {
			console.log('[BlockchainInit] Blockchain already initialized - skipping');
			initAttempted = true;
			return;
		}

		// Initialize blockchain accounts
		await attemptInitialization();

		// Cleanup on unmount
		return () => {
			if (retryTimer) {
				clearTimeout(retryTimer);
			}
		};
	});

	// =============================================================================
	// FUNCTIONS
	// =============================================================================

	async function attemptInitialization(): Promise<void> {
		if (!browser) return;

		initAttempted = true;

		try {
			console.log('[BlockchainInit] Initializing blockchain accounts...', {
				userId,
				provider,
				retryCount
			});

			await initializeBlockchain(userId, provider, oauthUserId);

			console.log('[BlockchainInit] Successfully initialized blockchain accounts');
			retryCount = 0; // Reset retry count on success
		} catch (error) {
			console.error('[BlockchainInit] Failed to initialize blockchain accounts:', error);

			// Auto-retry if enabled
			if (autoRetry && retryCount < 3) {
				retryCount++;
				console.log(
					`[BlockchainInit] Auto-retrying in ${retryDelay}ms (attempt ${retryCount}/3)...`
				);

				retryTimer = setTimeout(() => {
					attemptInitialization();
				}, retryDelay);
			}
		}
	}

	async function manualRetry(): Promise<void> {
		retryCount = 0; // Reset retry count for manual retry
		await attemptInitialization();
	}
</script>

<!-- LOADING STATE -->
{#if showLoading && $blockchain.loading}
	<div class="blockchain-init-loading">
		<div class="loading-spinner"></div>
		<p class="loading-text">Creating your blockchain accounts...</p>
		<p class="loading-subtext">This may trigger Face ID or Touch ID verification</p>
	</div>
{/if}

<!-- ERROR STATE -->
{#if showError && $blockchain.error && !$blockchain.loading}
	<div class="blockchain-init-error">
		<div class="error-icon">⚠️</div>
		<p class="error-title">Blockchain Initialization Failed</p>
		<p class="error-message">{$blockchain.error}</p>

		{#if autoRetry && retryCount > 0}
			<p class="retry-info">Retrying... (attempt {retryCount}/3)</p>
		{:else}
			<button class="retry-button" onclick={manualRetry} type="button"> Try Again </button>
		{/if}
	</div>
{/if}

<!-- SUCCESS STATE - RENDER CHILDREN -->
{#if $blockchain.initialized}
	{@render children?.()}
{/if}

<style>
	/* Loading State */
	.blockchain-init-loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		min-height: 200px;
	}

	.loading-spinner {
		width: 40px;
		height: 40px;
		border: 3px solid rgba(0, 0, 0, 0.1);
		border-top-color: #3b82f6;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.loading-text {
		margin-top: 1rem;
		font-size: 1rem;
		font-weight: 500;
		color: #1f2937;
	}

	.loading-subtext {
		margin-top: 0.5rem;
		font-size: 0.875rem;
		color: #6b7280;
	}

	/* Error State */
	.blockchain-init-error {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		background-color: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 0.5rem;
		margin: 1rem 0;
	}

	.error-icon {
		font-size: 2.5rem;
		margin-bottom: 1rem;
	}

	.error-title {
		font-size: 1.125rem;
		font-weight: 600;
		color: #991b1b;
		margin-bottom: 0.5rem;
	}

	.error-message {
		font-size: 0.875rem;
		color: #7f1d1d;
		text-align: center;
		margin-bottom: 1rem;
	}

	.retry-info {
		font-size: 0.875rem;
		color: #6b7280;
		font-style: italic;
	}

	.retry-button {
		padding: 0.5rem 1rem;
		background-color: #3b82f6;
		color: white;
		border: none;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.retry-button:hover {
		background-color: #2563eb;
	}

	.retry-button:active {
		background-color: #1d4ed8;
	}
</style>
