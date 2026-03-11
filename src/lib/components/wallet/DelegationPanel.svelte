<!--
	DelegationPanel.svelte

	EIP-7702 delegation UI — lets EVM wallet users delegate their EOA to the
	SimpleAccount contract for gasless transactions via account abstraction.

	Wraps SmartAccountProvider internally. The parent passes the raw
	EVMWalletProvider; this component creates the SmartAccountProvider
	and manages the full delegation lifecycle.

	States: checking → not-delegated | delegated
	        not-delegated → delegating → confirming → success | error
	        success → delegated (auto-transition after 2 seconds)

	Key UX decisions:
	- Error code 4001 (user rejection) gets gentle messaging — "Delegation cancelled."
	  — no retry urgency, because the user made a deliberate choice.
	- The delegate target address is always visible in monospace so the user can
	  verify the contract they are delegating to.
	- Success auto-transitions to "delegated" after 2 seconds, avoiding a dead-end
	  confirmation screen that requires a manual dismiss.
	- When featureEnabled is false, the component renders nothing — no disabled
	  skeleton, no placeholder. Feature-gated UI should be invisible, not grayed out.
-->

<script lang="ts">
	import { Zap, Loader2, CheckCircle2, AlertCircle } from '@lucide/svelte';
	import type { EVMWalletProvider } from '$lib/core/wallet/evm-provider';
	import { WalletConnectionError } from '$lib/core/wallet/evm-provider';
	import {
		SmartAccountProvider,
		SIMPLE_ACCOUNT_ADDRESS
	} from '$lib/core/wallet/smart-account-provider';

	// ── Props ─────────────────────────────────────────────────────────────────

	interface Props {
		provider: EVMWalletProvider;
		featureEnabled?: boolean;
		onDelegated?: (txHash: string) => void;
	}

	let {
		provider,
		featureEnabled = false,
		onDelegated
	}: Props = $props();

	// ── State ─────────────────────────────────────────────────────────────────

	type UIState =
		| 'checking'
		| 'not-delegated'
		| 'delegated'
		| 'delegating'
		| 'confirming'
		| 'success'
		| 'error';

	let uiState: UIState = $state('checking');
	let errorMessage: string | null = $state(null);
	let lastTxHash: string | null = $state(null);
	let successTimer: ReturnType<typeof setTimeout> | null = null;

	// ── SmartAccountProvider instance ─────────────────────────────────────────

	let smartAccount: SmartAccountProvider | null = $state(null);

	// ── Helpers ───────────────────────────────────────────────────────────────

	const truncatedTarget = SIMPLE_ACCOUNT_ADDRESS.slice(0, 6) + '...' + SIMPLE_ACCOUNT_ADDRESS.slice(-4);

	function classifyError(err: unknown): string {
		if (err instanceof WalletConnectionError) {
			if (err.code === 4001) {
				return 'Delegation cancelled. Try again when ready.';
			}
			if (err.code === -32002) {
				return 'A request is already pending. Check your wallet.';
			}
			return err.message;
		}

		if (err && typeof err === 'object') {
			const e = err as { code?: number; message?: string };
			if (e.code === 4001) {
				return 'Delegation cancelled. Try again when ready.';
			}
			if (e.code === -32002) {
				return 'A request is already pending. Check your wallet.';
			}
			if (e.message) return e.message;
		}

		return 'Something went wrong. Please try again.';
	}

	// ── Derived labels ────────────────────────────────────────────────────────

	const statusLabel = $derived(
		uiState === 'checking'
			? 'Checking delegation status...'
			: uiState === 'delegating'
				? 'Confirm in your wallet...'
				: uiState === 'confirming'
					? 'Confirming on-chain...'
					: ''
	);

	const isLoading = $derived(
		uiState === 'checking' || uiState === 'delegating' || uiState === 'confirming'
	);

	// ── Initial delegation check ──────────────────────────────────────────────

	$effect(() => {
		if (!featureEnabled || !provider) return;

		// Create the SmartAccountProvider instance
		const sa = new SmartAccountProvider(provider);
		smartAccount = sa;

		// Check delegation status on mount
		uiState = 'checking';

		sa.isDelegated().then((delegated) => {
			// Guard: if smartAccount changed while awaiting, discard result
			if (smartAccount !== sa) return;

			uiState = delegated ? 'delegated' : 'not-delegated';
		}).catch(() => {
			// isDelegated() already catches internally and returns false,
			// but guard against any unexpected throw
			if (smartAccount !== sa) return;
			uiState = 'not-delegated';
		});

		return () => {
			// Cleanup on provider change or unmount
			if (successTimer != null) {
				clearTimeout(successTimer);
				successTimer = null;
			}
		};
	});

	// ── Delegation flow ───────────────────────────────────────────────────────

	async function handleDelegate() {
		if (!smartAccount || uiState === 'delegating' || uiState === 'confirming') return;

		uiState = 'delegating';
		errorMessage = null;
		lastTxHash = null;

		try {
			// delegate() sends type 4 tx, waits for wallet approval and receipt
			uiState = 'confirming';
			const { txHash } = await smartAccount.delegate();

			lastTxHash = txHash;
			uiState = 'success';

			// Notify parent
			onDelegated?.(txHash);

			// Auto-transition to "delegated" after 2 seconds
			successTimer = setTimeout(() => {
				uiState = 'delegated';
				successTimer = null;
			}, 2000);
		} catch (err) {
			console.error('[DelegationPanel] Delegation failed:', err);
			errorMessage = classifyError(err);
			uiState = 'error';
		}
	}

	function retry() {
		uiState = 'not-delegated';
		errorMessage = null;
		lastTxHash = null;
	}
</script>

{#if !featureEnabled}
	<!-- Feature-gated: render nothing -->
{:else if uiState === 'delegated'}
	<!-- Already delegated — read-only status -->
	<div class="delegation-panel delegation-panel--delegated">
		<div class="delegation-panel__header">
			<div class="delegation-panel__icon-wrap delegation-panel__icon-wrap--active">
				<Zap class="delegation-panel__icon" />
			</div>
			<div class="delegation-panel__title-group">
				<h3 class="delegation-panel__title">Smart Account</h3>
			</div>
			<div class="delegation-panel__badge">
				<span
					class="delegation-panel__status-dot"
					aria-hidden="true"
				></span>
				Active
			</div>
		</div>
		<div class="delegation-panel__body">
			<p class="delegation-panel__description">
				Your wallet is delegated to SimpleAccount.
				Gasless transactions are enabled.
			</p>
			<p class="delegation-panel__target">
				Target: <span class="delegation-panel__address">{truncatedTarget}</span>
			</p>
		</div>
	</div>

{:else if uiState === 'success'}
	<!-- Delegation just confirmed — celebratory state (auto-fades to delegated) -->
	<div class="delegation-panel delegation-panel--success">
		<div class="delegation-panel__header">
			<div class="delegation-panel__icon-wrap delegation-panel__icon-wrap--success">
				<CheckCircle2 class="delegation-panel__icon" />
			</div>
			<div class="delegation-panel__title-group">
				<h3 class="delegation-panel__title delegation-panel__title--success">Delegation confirmed</h3>
			</div>
		</div>
		<div class="delegation-panel__body">
			<p class="delegation-panel__description">
				Your wallet has been delegated to SimpleAccount.
				Gasless transactions are now enabled.
			</p>
			{#if lastTxHash}
				<p class="delegation-panel__tx">
					Tx: <span class="delegation-panel__address">{lastTxHash.slice(0, 10)}...{lastTxHash.slice(-8)}</span>
				</p>
			{/if}
		</div>
	</div>

{:else if uiState === 'error'}
	<!-- Error state with retry -->
	<div class="delegation-panel delegation-panel--error">
		<div class="delegation-panel__header">
			<div class="delegation-panel__icon-wrap delegation-panel__icon-wrap--error">
				<AlertCircle class="delegation-panel__icon" />
			</div>
			<div class="delegation-panel__title-group">
				<h3 class="delegation-panel__title delegation-panel__title--error">Delegation failed</h3>
			</div>
		</div>
		<div class="delegation-panel__body">
			<p class="delegation-panel__error-message">{errorMessage}</p>
			<button
				type="button"
				class="delegation-panel__retry"
				onclick={retry}
			>
				Try again
			</button>
		</div>
	</div>

{:else if isLoading}
	<!-- Loading states: checking, delegating, confirming -->
	<div
		class="delegation-panel delegation-panel--loading"
		role="status"
		aria-live="polite"
		aria-label={statusLabel}
	>
		<div class="delegation-panel__header">
			<div class="delegation-panel__icon-wrap">
				<Zap class="delegation-panel__icon" />
			</div>
			<div class="delegation-panel__title-group">
				<h3 class="delegation-panel__title">Smart Account</h3>
			</div>
		</div>
		<div class="delegation-panel__body delegation-panel__body--loading">
			<Loader2 class="delegation-panel__spinner" aria-hidden="true" />
			<p class="delegation-panel__loading-label">{statusLabel}</p>
		</div>
	</div>

{:else}
	<!-- not-delegated: primary CTA -->
	<div class="delegation-panel delegation-panel--idle">
		<div class="delegation-panel__header">
			<div class="delegation-panel__icon-wrap">
				<Zap class="delegation-panel__icon" />
			</div>
			<div class="delegation-panel__title-group">
				<h3 class="delegation-panel__title">Smart Account</h3>
			</div>
		</div>
		<div class="delegation-panel__body">
			<p class="delegation-panel__description">
				Delegate your wallet to enable gasless transactions via account abstraction.
			</p>
			<button
				type="button"
				class="delegation-panel__cta"
				onclick={handleDelegate}
			>
				Enable Smart Account
			</button>
			<p class="delegation-panel__target">
				Delegation target: <span class="delegation-panel__address">{truncatedTarget}</span>
			</p>
		</div>
	</div>
{/if}

<style>
	/* ── Base panel ─────────────────────────────────────────────────────────── */

	.delegation-panel {
		border-radius: 12px;
		padding: 20px;
		border: 1px solid transparent;
	}

	.delegation-panel--idle {
		border-color: oklch(0.85 0.02 250 / 0.6);
		background: oklch(0.99 0.005 250 / 0.5);
		transition:
			border-color 150ms cubic-bezier(0.4, 0, 0.2, 1),
			background 150ms cubic-bezier(0.4, 0, 0.2, 1);
	}

	.delegation-panel--idle:hover {
		border-color: oklch(0.65 0.18 260 / 0.5);
		background: oklch(0.98 0.01 260 / 0.6);
	}

	.delegation-panel--loading {
		border-color: oklch(0.85 0.02 250 / 0.4);
		background: oklch(0.99 0.005 250 / 0.3);
	}

	.delegation-panel--delegated {
		border-color: oklch(0.8 0.1 160 / 0.5);
		background: oklch(0.97 0.03 160 / 0.4);
	}

	.delegation-panel--success {
		border-color: oklch(0.8 0.1 160 / 0.5);
		background: oklch(0.97 0.03 160 / 0.4);
	}

	.delegation-panel--error {
		border-color: oklch(0.75 0.15 20 / 0.4);
		background: oklch(0.98 0.02 20 / 0.3);
	}

	/* ── Header row ────────────────────────────────────────────────────────── */

	.delegation-panel__header {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 14px;
	}

	/* ── Icon container ────────────────────────────────────────────────────── */

	.delegation-panel__icon-wrap {
		flex-shrink: 0;
		width: 40px;
		height: 40px;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: oklch(0.55 0.18 260 / 0.12);
	}

	.delegation-panel__icon-wrap--active {
		background: oklch(0.65 0.18 160 / 0.15);
	}

	.delegation-panel__icon-wrap--success {
		background: oklch(0.65 0.18 160 / 0.15);
	}

	.delegation-panel__icon-wrap--error {
		background: oklch(0.55 0.2 20 / 0.12);
	}

	:global(.delegation-panel__icon) {
		width: 20px;
		height: 20px;
		color: oklch(0.5 0.18 260);
	}

	:global(.delegation-panel__icon-wrap--active .delegation-panel__icon) {
		color: oklch(0.55 0.18 160);
	}

	:global(.delegation-panel__icon-wrap--success .delegation-panel__icon) {
		color: oklch(0.55 0.18 160);
	}

	:global(.delegation-panel__icon-wrap--error .delegation-panel__icon) {
		color: oklch(0.5 0.2 20);
	}

	/* ── Title + badge ─────────────────────────────────────────────────────── */

	.delegation-panel__title-group {
		flex: 1;
		min-width: 0;
	}

	.delegation-panel__title {
		margin: 0;
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--header-text-primary, oklch(0.15 0.02 250));
		line-height: 1.3;
	}

	.delegation-panel__title--success {
		color: oklch(0.4 0.18 160);
	}

	.delegation-panel__title--error {
		color: oklch(0.45 0.2 20);
	}

	.delegation-panel__badge {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		border-radius: 20px;
		background: oklch(0.65 0.18 160 / 0.12);
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.75rem;
		font-weight: 600;
		color: oklch(0.4 0.18 160);
		letter-spacing: 0.01em;
	}

	.delegation-panel__status-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background-color: oklch(0.65 0.2 160);
		box-shadow: 0 0 0 2px oklch(0.65 0.2 160 / 0.2);
	}

	/* ── Body text ─────────────────────────────────────────────────────────── */

	.delegation-panel__body {
		padding-left: 52px; /* 40px icon + 12px gap = offset to align with text */
	}

	.delegation-panel__body--loading {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.delegation-panel__description {
		margin: 0 0 14px;
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.8125rem;
		color: var(--header-text-secondary, oklch(0.45 0.02 250));
		line-height: 1.5;
	}

	.delegation-panel__target {
		margin: 12px 0 0;
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.75rem;
		color: oklch(0.55 0.02 250);
		line-height: 1.4;
	}

	.delegation-panel__tx {
		margin: 8px 0 0;
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.75rem;
		color: oklch(0.55 0.02 250);
		line-height: 1.4;
	}

	.delegation-panel__address {
		font-family: 'Berkeley Mono', 'Cascadia Code', ui-monospace, monospace;
		font-size: 0.75rem;
		letter-spacing: 0.02em;
		color: oklch(0.4 0.05 250);
	}

	.delegation-panel__error-message {
		margin: 0 0 12px;
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.8125rem;
		color: oklch(0.45 0.2 20);
		line-height: 1.5;
	}

	/* ── Primary CTA button ────────────────────────────────────────────────── */

	.delegation-panel__cta {
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

	.delegation-panel__cta:hover {
		background: oklch(0.44 0.2 260);
		box-shadow: 0 4px 12px oklch(0.5 0.18 260 / 0.3);
	}

	.delegation-panel__cta:active {
		transform: scale(0.98);
	}

	.delegation-panel__cta:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px oklch(0.5 0.18 260 / 0.35);
	}

	/* ── Retry button ──────────────────────────────────────────────────────── */

	.delegation-panel__retry {
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

	.delegation-panel__retry:hover {
		background: oklch(0.94 0.04 20 / 0.6);
		border-color: oklch(0.65 0.2 20 / 0.5);
	}

	.delegation-panel__retry:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px oklch(0.55 0.2 20 / 0.25);
	}

	/* ── Spinner ───────────────────────────────────────────────────────────── */

	:global(.delegation-panel__spinner) {
		width: 18px;
		height: 18px;
		flex-shrink: 0;
		color: oklch(0.5 0.18 260);
		animation: dp-spin 1s linear infinite;
	}

	.delegation-panel__loading-label {
		margin: 0;
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--header-text-secondary, oklch(0.45 0.02 250));
	}

	@keyframes dp-spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* ── Reduced motion ────────────────────────────────────────────────────── */

	@media (prefers-reduced-motion: reduce) {
		:global(.delegation-panel__spinner) {
			animation: none;
			opacity: 0.6;
		}

		.delegation-panel--idle,
		.delegation-panel__cta,
		.delegation-panel__retry {
			transition: none;
		}
	}
</style>
