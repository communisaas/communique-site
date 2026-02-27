<!--
	WalletConnect.svelte

	EVM wallet connection flow — injected provider (MetaMask, Coinbase Wallet, etc.)
	Handles the full SIWE-adjacent flow: connect → nonce fetch → personal_sign → verify.

	States: idle → connecting → signing → verifying → success | error

	Key UX decisions:
	- Error code 4001 (user rejection) is distinguished from other errors: no alarming
	  language, no retry urgency — the user made a deliberate choice.
	- "No wallet detected" falls through to a direct MetaMask install link rather than
	  a dead-end error, preserving progressive enhancement.
	- compact=true collapses to an icon+short-label pill for the 48px header slot.
-->

<script lang="ts">
	import { Wallet, Loader2, CheckCircle2, AlertCircle, ExternalLink } from '@lucide/svelte';
	import { browser } from '$app/environment';
	import type { EVMWalletProvider } from '$lib/core/wallet/evm-provider';

	// ── Props ─────────────────────────────────────────────────────────────────

	let {
		onconnected,
		compact = false
	}: {
		onconnected?: (address: string) => void;
		compact?: boolean;
	} = $props();

	// ── State ─────────────────────────────────────────────────────────────────

	type UIState = 'idle' | 'connecting' | 'signing' | 'verifying' | 'success' | 'error';
	let uiState: UIState = $state('idle');
	let errorMessage: string | null = $state(null);
	let connectedAddress: string | null = $state(null);

	// Whether an injected provider is available (set in $effect, SSR-safe)
	let hasWallet: boolean = $state(false);

	// Detect wallet presence once in browser
	$effect(() => {
		if (browser) {
			hasWallet = typeof (window as Window & { ethereum?: unknown }).ethereum !== 'undefined';
		}
	});

	// ── Helpers ───────────────────────────────────────────────────────────────

	function formatAddress(addr: string): string {
		return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
	}

	function classifyError(err: unknown): string {
		if (err && typeof err === 'object') {
			const e = err as { code?: number; message?: string };

			// EIP-1193: user rejected the request
			if (e.code === 4001) {
				return 'Wallet connection cancelled. Try again when ready.';
			}
			// MetaMask pending request conflict
			if (e.code === -32002) {
				return 'A connection request is already pending. Check your wallet.';
			}
			if (e.message) {
				// Network / chain not added
				if (e.message.includes('Unrecognized chain')) {
					return 'This chain is not configured in your wallet. Add Scroll Sepolia first.';
				}
				return e.message;
			}
		}
		return 'Something went wrong. Please try again.';
	}

	// ── Flow ──────────────────────────────────────────────────────────────────

	async function handleConnect() {
		if (!browser || uiState !== 'idle') return;

		uiState = 'connecting';
		errorMessage = null;

		try {
			// Dynamic import: evm-provider is browser-only, never hits SSR
			const { connectInjectedWallet } = await import('$lib/core/wallet/evm-provider');

			// Step 1 — Request accounts from injected provider.
			// connectInjectedWallet() returns EVMWalletProvider directly (address is on the instance).
			let provider: EVMWalletProvider;
			try {
				provider = await connectInjectedWallet();
			} catch (connectErr) {
				// Surface wallet-level errors before any server round-trip
				errorMessage = classifyError(connectErr);
				uiState = 'error';
				return;
			}

			const address = provider.address;

			// Step 2 — Fetch nonce from server
			const nonceRes = await fetch('/api/wallet/nonce');
			if (!nonceRes.ok) {
				const err = await nonceRes.json().catch(() => ({}));
				throw new Error((err as { error?: string }).error || 'Failed to generate nonce');
			}
			const { message, nonce } = (await nonceRes.json()) as { message: string; nonce: string };

			// Step 3 — Ask user to sign the message
			uiState = 'signing';
			let signature: string;
			try {
				signature = await provider.signMessage(message);
			} catch (signErr) {
				errorMessage = classifyError(signErr);
				uiState = 'error';
				return;
			}

			// Step 4 — Verify signature server-side and bind wallet
			uiState = 'verifying';
			const verifyRes = await fetch('/api/wallet/connect', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ address, signature, nonce })
			});

			if (!verifyRes.ok) {
				const err = await verifyRes.json().catch(() => ({}));
				throw new Error((err as { error?: string }).error || 'Verification failed');
			}

			const result = (await verifyRes.json()) as { success: boolean; address: string };
			if (!result.success) throw new Error('Wallet binding was not confirmed by the server');

			// Success
			connectedAddress = result.address;
			uiState = 'success';

			setTimeout(() => {
				onconnected?.(result.address);
			}, 1200);
		} catch (err) {
			console.error('[WalletConnect] Unhandled error:', err);
			errorMessage = classifyError(err);
			uiState = 'error';
		}
	}

	function retry() {
		uiState = 'idle';
		errorMessage = null;
	}

	// ── Derived labels for in-progress states ─────────────────────────────────

	const spinnerLabel = $derived(
		(uiState as UIState) === 'connecting'
			? 'Connecting...'
			: (uiState as UIState) === 'signing'
				? 'Check your wallet...'
				: 'Verifying...'
	);
</script>

{#if !hasWallet && uiState === 'idle'}
	<!-- No injected wallet detected -->
	<div class="wallet-connect wallet-connect--no-wallet" class:wallet-connect--compact={compact}>
		<div class="wallet-connect__icon-wrap wallet-connect__icon-wrap--muted">
			<Wallet class="wallet-connect__icon" />
		</div>
		{#if !compact}
			<div class="wallet-connect__body">
				<p class="wallet-connect__heading">No wallet detected</p>
				<p class="wallet-connect__sub">
					Install MetaMask or another EVM wallet to continue.
				</p>
				<a
					href="https://metamask.io/download"
					target="_blank"
					rel="noopener noreferrer"
					class="wallet-connect__install-link"
				>
					<ExternalLink class="wallet-connect__install-icon" />
					Install MetaMask
				</a>
			</div>
		{:else}
			<a
				href="https://metamask.io/download"
				target="_blank"
				rel="noopener noreferrer"
				class="wallet-connect__compact-install"
				aria-label="Install MetaMask wallet"
			>
				<ExternalLink class="wallet-connect__compact-icon" />
				Install wallet
			</a>
		{/if}
	</div>

{:else if uiState === 'success'}
	<!-- Success state -->
	<div class="wallet-connect wallet-connect--success" class:wallet-connect--compact={compact}>
		<div class="wallet-connect__icon-wrap wallet-connect__icon-wrap--success">
			<CheckCircle2 class="wallet-connect__icon" />
		</div>
		{#if !compact}
			<div class="wallet-connect__body">
				<p class="wallet-connect__heading wallet-connect__heading--success">Wallet connected</p>
				{#if connectedAddress}
					<p class="wallet-connect__address">{formatAddress(connectedAddress)}</p>
				{/if}
			</div>
		{/if}
	</div>

{:else if uiState === 'error'}
	<!-- Error state with retry -->
	<div class="wallet-connect wallet-connect--error" class:wallet-connect--compact={compact}>
		<div class="wallet-connect__icon-wrap wallet-connect__icon-wrap--error">
			<AlertCircle class="wallet-connect__icon" />
		</div>
		{#if !compact}
			<div class="wallet-connect__body">
				<p class="wallet-connect__heading wallet-connect__heading--error">Connection failed</p>
				<p class="wallet-connect__error-message">{errorMessage}</p>
				<button type="button" class="wallet-connect__retry" onclick={retry}>
					Try again
				</button>
			</div>
		{:else}
			<button
				type="button"
				class="wallet-connect__compact-btn wallet-connect__compact-btn--error"
				onclick={retry}
				aria-label="Retry wallet connection"
			>
				Try again
			</button>
		{/if}
	</div>

{:else if uiState === 'connecting' || uiState === 'signing' || uiState === 'verifying'}
	<!-- In-progress states -->
	<div
		class="wallet-connect wallet-connect--loading"
		class:wallet-connect--compact={compact}
		role="status"
		aria-live="polite"
		aria-label={spinnerLabel}
	>
		<Loader2 class="wallet-connect__spinner" aria-hidden="true" />
		{#if !compact}
			<p class="wallet-connect__loading-label">{spinnerLabel}</p>
		{/if}
	</div>

{:else}
	<!-- Idle state — primary CTA -->
	{#if compact}
		<button
			type="button"
			class="wallet-connect__compact-btn"
			onclick={handleConnect}
			aria-label="Connect EVM wallet"
		>
			<Wallet class="wallet-connect__compact-icon" />
			Connect
		</button>
	{:else}
		<div class="wallet-connect wallet-connect--idle">
			<div class="wallet-connect__icon-wrap">
				<Wallet class="wallet-connect__icon" />
			</div>
			<div class="wallet-connect__body">
				<p class="wallet-connect__heading">Connect your wallet</p>
				<p class="wallet-connect__sub">
					Link your EVM wallet to sign transactions and participate on-chain.
				</p>
				<button
					type="button"
					class="wallet-connect__cta"
					onclick={handleConnect}
				>
					Connect Wallet
				</button>
			</div>
		</div>
	{/if}
{/if}

<style>
	/* ── Base wrapper ───────────────────────────────────────────────────────── */

	.wallet-connect {
		display: flex;
		align-items: flex-start;
		gap: 16px;
		border-radius: 12px;
		padding: 20px;
		border: 1px solid transparent;
	}

	.wallet-connect--idle {
		border-color: oklch(0.85 0.02 250 / 0.6);
		background: oklch(0.99 0.005 250 / 0.5);
		transition:
			border-color 150ms cubic-bezier(0.4, 0, 0.2, 1),
			background 150ms cubic-bezier(0.4, 0, 0.2, 1);
	}

	.wallet-connect--idle:hover {
		border-color: oklch(0.65 0.18 260 / 0.5);
		background: oklch(0.98 0.01 260 / 0.6);
	}

	.wallet-connect--loading {
		align-items: center;
		gap: 12px;
		border-color: oklch(0.85 0.02 250 / 0.4);
		background: oklch(0.99 0.005 250 / 0.3);
		padding: 16px 20px;
	}

	.wallet-connect--success {
		border-color: oklch(0.8 0.1 160 / 0.5);
		background: oklch(0.97 0.03 160 / 0.4);
	}

	.wallet-connect--error {
		border-color: oklch(0.75 0.15 20 / 0.4);
		background: oklch(0.98 0.02 20 / 0.3);
	}

	.wallet-connect--no-wallet {
		border-color: oklch(0.85 0.02 250 / 0.4);
		background: oklch(0.97 0.01 250 / 0.4);
		align-items: center;
	}

	/* ── Icon container ────────────────────────────────────────────────────── */

	.wallet-connect__icon-wrap {
		flex-shrink: 0;
		width: 44px;
		height: 44px;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: oklch(0.55 0.18 260 / 0.12);
	}

	.wallet-connect__icon-wrap--muted {
		background: oklch(0.85 0.02 250 / 0.35);
	}

	.wallet-connect__icon-wrap--success {
		background: oklch(0.65 0.18 160 / 0.15);
	}

	.wallet-connect__icon-wrap--error {
		background: oklch(0.55 0.2 20 / 0.12);
	}

	.wallet-connect__icon {
		width: 22px;
		height: 22px;
		color: oklch(0.5 0.18 260);
	}

	.wallet-connect__icon-wrap--muted .wallet-connect__icon {
		color: oklch(0.55 0.02 250);
	}

	.wallet-connect__icon-wrap--success .wallet-connect__icon {
		color: oklch(0.55 0.18 160);
	}

	.wallet-connect__icon-wrap--error .wallet-connect__icon {
		color: oklch(0.5 0.2 20);
	}

	/* ── Body text ─────────────────────────────────────────────────────────── */

	.wallet-connect__body {
		flex: 1;
		min-width: 0;
	}

	.wallet-connect__heading {
		margin: 0 0 4px;
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--header-text-primary, oklch(0.15 0.02 250));
		line-height: 1.3;
	}

	.wallet-connect__heading--success {
		color: oklch(0.4 0.18 160);
	}

	.wallet-connect__heading--error {
		color: oklch(0.45 0.2 20);
	}

	.wallet-connect__sub {
		margin: 0 0 14px;
		font-size: 0.8125rem;
		color: var(--header-text-secondary, oklch(0.45 0.02 250));
		line-height: 1.5;
	}

	.wallet-connect__address {
		margin: 0;
		font-family: 'Berkeley Mono', 'Cascadia Code', ui-monospace, monospace;
		font-size: 0.8125rem;
		color: oklch(0.4 0.18 160);
		letter-spacing: 0.02em;
	}

	.wallet-connect__error-message {
		margin: 0 0 12px;
		font-size: 0.8125rem;
		color: oklch(0.45 0.2 20);
		line-height: 1.5;
	}

	/* ── Primary CTA button ────────────────────────────────────────────────── */

	.wallet-connect__cta {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 9px 18px;
		border-radius: 8px;
		border: none;
		background: oklch(0.5 0.18 260);
		color: oklch(1 0 0);
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition:
			background 150ms cubic-bezier(0.4, 0, 0.2, 1),
			transform 100ms cubic-bezier(0.4, 0, 0.2, 1),
			box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1);
	}

	.wallet-connect__cta:hover {
		background: oklch(0.44 0.2 260);
		box-shadow: 0 4px 12px oklch(0.5 0.18 260 / 0.3);
	}

	.wallet-connect__cta:active {
		transform: scale(0.98);
	}

	.wallet-connect__cta:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px oklch(0.5 0.18 260 / 0.35);
	}

	/* ── Retry button ──────────────────────────────────────────────────────── */

	.wallet-connect__retry {
		display: inline-flex;
		align-items: center;
		padding: 7px 14px;
		border-radius: 7px;
		border: 1px solid oklch(0.75 0.15 20 / 0.4);
		background: oklch(0.98 0.02 20 / 0.5);
		color: oklch(0.45 0.2 20);
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.8125rem;
		font-weight: 600;
		cursor: pointer;
		transition:
			background 120ms ease-out,
			border-color 120ms ease-out;
	}

	.wallet-connect__retry:hover {
		background: oklch(0.94 0.04 20 / 0.6);
		border-color: oklch(0.65 0.2 20 / 0.5);
	}

	.wallet-connect__retry:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px oklch(0.55 0.2 20 / 0.25);
	}

	/* ── Install link ──────────────────────────────────────────────────────── */

	.wallet-connect__install-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin-top: 14px;
		font-size: 0.8125rem;
		font-weight: 600;
		color: oklch(0.5 0.18 260);
		text-decoration: none;
		transition: color 120ms ease-out;
	}

	.wallet-connect__install-link:hover {
		color: oklch(0.44 0.2 260);
		text-decoration: underline;
	}

	.wallet-connect__install-link:focus-visible {
		outline: none;
		border-radius: 4px;
		box-shadow: 0 0 0 3px oklch(0.5 0.18 260 / 0.3);
	}

	.wallet-connect__install-icon {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
	}

	/* ── Spinner ───────────────────────────────────────────────────────────── */

	.wallet-connect__spinner {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		color: oklch(0.5 0.18 260);
		animation: spin 1s linear infinite;
	}

	.wallet-connect__loading-label {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--header-text-secondary, oklch(0.45 0.02 250));
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	/* ── Compact mode ──────────────────────────────────────────────────────── */
	/* Used in 48px header slot — minimal footprint, no explanatory text */

	.wallet-connect__compact-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 5px 12px 5px 8px;
		border-radius: 20px;
		border: 1px solid oklch(0.75 0.18 260 / 0.35);
		background: oklch(0.5 0.18 260 / 0.1);
		color: oklch(0.45 0.18 260);
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.8125rem;
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
		transition:
			background 150ms cubic-bezier(0.4, 0, 0.2, 1),
			border-color 150ms cubic-bezier(0.4, 0, 0.2, 1),
			color 150ms cubic-bezier(0.4, 0, 0.2, 1);
	}

	.wallet-connect__compact-btn:hover {
		background: oklch(0.5 0.18 260 / 0.15);
		border-color: oklch(0.65 0.2 260 / 0.5);
		color: oklch(0.38 0.2 260);
	}

	.wallet-connect__compact-btn:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px oklch(0.5 0.18 260 / 0.3);
	}

	.wallet-connect__compact-btn--error {
		border-color: oklch(0.75 0.15 20 / 0.4);
		background: oklch(0.55 0.2 20 / 0.1);
		color: oklch(0.45 0.2 20);
	}

	.wallet-connect__compact-btn--error:hover {
		background: oklch(0.55 0.2 20 / 0.18);
		border-color: oklch(0.65 0.2 20 / 0.5);
		color: oklch(0.38 0.2 20);
	}

	.wallet-connect__compact-icon {
		width: 15px;
		height: 15px;
		flex-shrink: 0;
	}

	.wallet-connect__compact-install {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 5px 12px 5px 10px;
		border-radius: 20px;
		border: 1px solid oklch(0.85 0.02 250 / 0.5);
		background: transparent;
		color: oklch(0.5 0.02 250);
		font-size: 0.8125rem;
		font-weight: 500;
		text-decoration: none;
		white-space: nowrap;
		transition: color 120ms ease-out;
	}

	.wallet-connect__compact-install:hover {
		color: oklch(0.5 0.18 260);
	}

	/* ── Reduced motion ────────────────────────────────────────────────────── */

	@media (prefers-reduced-motion: reduce) {
		.wallet-connect__spinner {
			animation: none;
			opacity: 0.6;
		}

		.wallet-connect--idle,
		.wallet-connect__cta,
		.wallet-connect__compact-btn {
			transition: none;
		}
	}
</style>
