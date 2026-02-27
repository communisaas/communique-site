<!--
	WalletStatus.svelte

	Read-only display of a connected EVM wallet. Designed to fit the 48px IdentityStrip.

	Shows: truncated address + chain health dot + optional disconnect affordance.
	Hover/focus reveals a popover with the full address (copy-to-clipboard) and chain label.

	Chain health semantics:
	  green  — Scroll Sepolia (534351), the target network for this app
	  yellow — any other chain (user is on the wrong network)
	  grey   — no chainId provided

	No $effect needed: this is a pure display component driven entirely by props.
-->

<script lang="ts">
	// Scroll Sepolia chain ID — inlined to avoid importing evm-provider.ts
	// (which pulls in ethers BrowserProvider) into the SSR bundle.
	// Canonical source: src/lib/core/wallet/evm-provider.ts
	const SCROLL_SEPOLIA_CHAIN_ID = 534351;

	type ChainStatus = 'correct' | 'wrong' | 'unknown';

	// ── Props ─────────────────────────────────────────────────────────────────

	let {
		address,
		chainId = null,
		ondisconnect
	}: {
		address: string | null;
		chainId?: number | null;
		ondisconnect?: () => void;
	} = $props();

	// ── Derived display values ────────────────────────────────────────────────

	const truncatedAddress = $derived(
		address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null
	);
	const chainStatus: ChainStatus = $derived(
		chainId == null
			? 'unknown'
			: chainId === SCROLL_SEPOLIA_CHAIN_ID
				? 'correct'
				: 'wrong'
	);

	const chainLabel = $derived(
		chainId === SCROLL_SEPOLIA_CHAIN_ID
			? 'Scroll Sepolia'
			: chainId != null
				? `Chain ${chainId}`
				: 'Unknown network'
	);

	// ── Popover state ─────────────────────────────────────────────────────────
	// Intentionally simple: no library, no portal. The status pill lives in the
	// header, so the popover can drop from it naturally without scroll concerns.

	let isOpen: boolean = $state(false);
	let copied: boolean = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | null = null;

	function openPopover() {
		isOpen = true;
	}

	function closePopover() {
		isOpen = false;
	}

	function togglePopover() {
		isOpen = !isOpen;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && isOpen) {
			isOpen = false;
		}
	}

	function handleTriggerKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			togglePopover();
		}
		if (event.key === 'Escape') {
			isOpen = false;
		}
	}

	async function copyAddress() {
		if (!address) return;

		try {
			await navigator.clipboard.writeText(address);
			copied = true;

			// Clear any existing timer before scheduling a new one
			if (copyTimer != null) clearTimeout(copyTimer);
			copyTimer = setTimeout(() => {
				copied = false;
				copyTimer = null;
			}, 2000);
		} catch {
			// Clipboard API unavailable or denied — silently no-op
		}
	}
</script>

<!--
	svelte:window must be at the component root (Svelte 5 restriction).
	The handler is a no-op when the popover is closed.
-->
<svelte:window onkeydown={isOpen ? handleKeydown : undefined} />

<!-- Nothing to show when there is no address -->
{#if address && truncatedAddress}
	{#if isOpen}
		<!-- Invisible backdrop catches outside clicks without blocking pointer events globally -->
		<div
			class="wallet-status__backdrop"
			role="presentation"
			onclick={closePopover}
		></div>
	{/if}

	<div class="wallet-status">
		<!-- Trigger: the address pill -->
		<button
			type="button"
			class="wallet-status__pill"
			class:wallet-status__pill--open={isOpen}
			onclick={togglePopover}
			onmouseenter={openPopover}
			onmouseleave={closePopover}
			onkeydown={handleTriggerKeydown}
			aria-haspopup="true"
			aria-expanded={isOpen}
			aria-label="Wallet connected: {address}. Press Enter to see options."
		>
			<!-- Chain health indicator dot -->
			<span
				class="wallet-status__dot"
				class:wallet-status__dot--correct={chainStatus === 'correct'}
				class:wallet-status__dot--wrong={chainStatus === 'wrong'}
				class:wallet-status__dot--unknown={chainStatus === 'unknown'}
				aria-hidden="true"
			></span>

			<span class="wallet-status__address" aria-hidden="true">
				{truncatedAddress}
			</span>
		</button>

		<!-- Popover panel -->
		{#if isOpen}
			<div
				class="wallet-status__popover"
				role="dialog"
				aria-label="Wallet details"
				onmouseenter={openPopover}
				onmouseleave={closePopover}
			>
				<!-- Full address with copy -->
				<div class="wallet-status__popover-row wallet-status__popover-row--address">
					<span class="wallet-status__full-address">{address}</span>
					<button
						type="button"
						class="wallet-status__copy-btn"
						onclick={copyAddress}
						aria-label={copied ? 'Copied' : 'Copy address'}
					>
						{#if copied}
							<span class="wallet-status__copy-feedback">Copied</span>
						{:else}
							<span class="wallet-status__copy-feedback">Copy</span>
						{/if}
					</button>
				</div>

				<!-- Chain indicator row -->
				<div class="wallet-status__popover-row wallet-status__popover-row--chain">
					<span
						class="wallet-status__chain-dot"
						class:wallet-status__chain-dot--correct={chainStatus === 'correct'}
						class:wallet-status__chain-dot--wrong={chainStatus === 'wrong'}
						class:wallet-status__chain-dot--unknown={chainStatus === 'unknown'}
						aria-hidden="true"
					></span>
					<span class="wallet-status__chain-label">{chainLabel}</span>
					{#if chainStatus === 'wrong'}
						<span class="wallet-status__chain-warning">Wrong network</span>
					{/if}
				</div>

				<!-- Disconnect (only rendered when handler is provided) -->
				{#if ondisconnect}
					<div class="wallet-status__popover-footer">
						<button
							type="button"
							class="wallet-status__disconnect-btn"
							onclick={() => {
								isOpen = false;
								ondisconnect?.();
							}}
						>
							Disconnect wallet
						</button>
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	/* ── Outer wrapper ──────────────────────────────────────────────────────── */
	/* position:relative creates the anchor for the absolutely-positioned popover */

	.wallet-status {
		position: relative;
		display: inline-flex;
		align-items: center;
	}

	/* ── Invisible backdrop ─────────────────────────────────────────────────── */
	/* Covers the viewport behind the popover so clicks outside close it */

	.wallet-status__backdrop {
		position: fixed;
		inset: 0;
		z-index: 90;
	}

	/* ── Address pill ───────────────────────────────────────────────────────── */

	.wallet-status__pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px 4px 8px;
		border-radius: 20px;
		border: 1px solid var(--header-border, oklch(0.85 0.02 250 / 0.6));
		background: oklch(0.97 0.01 250 / 0.55);
		cursor: pointer;
		transition:
			background 150ms cubic-bezier(0.4, 0, 0.2, 1),
			border-color 150ms cubic-bezier(0.4, 0, 0.2, 1);

		/* Ensure it fits in the 48px header strip with comfortable tap area */
		height: 32px;
	}

	.wallet-status__pill:hover,
	.wallet-status__pill--open {
		background: oklch(0.94 0.02 250 / 0.7);
		border-color: oklch(0.75 0.05 250 / 0.7);
	}

	.wallet-status__pill:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--header-focus-ring, oklch(0.6 0.15 270 / 0.5));
	}

	/* ── Chain health dot (on the pill) ─────────────────────────────────────── */

	.wallet-status__dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		flex-shrink: 0;
		transition: background-color 300ms ease-out;
	}

	.wallet-status__dot--correct {
		background-color: oklch(0.65 0.2 160);
		box-shadow: 0 0 0 2px oklch(0.65 0.2 160 / 0.2);
	}

	.wallet-status__dot--wrong {
		background-color: oklch(0.78 0.16 80);
		box-shadow: 0 0 0 2px oklch(0.78 0.16 80 / 0.2);
	}

	.wallet-status__dot--unknown {
		background-color: oklch(0.7 0.02 250);
	}

	/* ── Truncated address text ─────────────────────────────────────────────── */

	.wallet-status__address {
		font-family: 'Berkeley Mono', 'Cascadia Code', ui-monospace, monospace;
		font-size: 0.75rem;
		font-weight: 500;
		letter-spacing: 0.02em;
		color: var(--header-text-primary, oklch(0.15 0.02 250));
		white-space: nowrap;
	}

	/* ── Popover panel ──────────────────────────────────────────────────────── */

	.wallet-status__popover {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		z-index: 100;

		min-width: 280px;
		max-width: 360px;
		padding: 6px;

		background: oklch(1 0 0 / 0.98);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border: 1px solid var(--header-border, oklch(0.85 0.02 250 / 0.6));
		border-radius: 12px;
		box-shadow:
			0 4px 6px oklch(0 0 0 / 0.05),
			0 10px 24px oklch(0 0 0 / 0.1);

		transform-origin: top right;
		animation: popover-enter 140ms cubic-bezier(0.4, 0, 0.2, 1);
	}

	@keyframes popover-enter {
		from {
			opacity: 0;
			transform: scale(0.95) translateY(-4px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	/* ── Popover rows ───────────────────────────────────────────────────────── */

	.wallet-status__popover-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		border-radius: 8px;
	}

	.wallet-status__popover-row--address {
		background: oklch(0.97 0.01 250 / 0.6);
	}

	.wallet-status__popover-row--chain {
		padding-top: 6px;
		padding-bottom: 6px;
	}

	/* ── Full address display ───────────────────────────────────────────────── */

	.wallet-status__full-address {
		flex: 1;
		min-width: 0;
		font-family: 'Berkeley Mono', 'Cascadia Code', ui-monospace, monospace;
		font-size: 0.75rem;
		letter-spacing: 0.025em;
		color: var(--header-text-primary, oklch(0.15 0.02 250));
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* ── Copy button ────────────────────────────────────────────────────────── */

	.wallet-status__copy-btn {
		flex-shrink: 0;
		padding: 3px 8px;
		border-radius: 6px;
		border: 1px solid oklch(0.85 0.02 250 / 0.5);
		background: transparent;
		cursor: pointer;
		transition:
			background 120ms ease-out,
			border-color 120ms ease-out;
	}

	.wallet-status__copy-btn:hover {
		background: oklch(0.93 0.02 250 / 0.7);
		border-color: oklch(0.75 0.05 250 / 0.6);
	}

	.wallet-status__copy-btn:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--header-focus-ring, oklch(0.6 0.15 270 / 0.5));
	}

	.wallet-status__copy-feedback {
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--header-text-secondary, oklch(0.45 0.02 250));
	}

	/* ── Chain indicator dot (in popover) ───────────────────────────────────── */

	.wallet-status__chain-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.wallet-status__chain-dot--correct {
		background-color: oklch(0.65 0.2 160);
	}

	.wallet-status__chain-dot--wrong {
		background-color: oklch(0.78 0.16 80);
	}

	.wallet-status__chain-dot--unknown {
		background-color: oklch(0.7 0.02 250);
	}

	.wallet-status__chain-label {
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.8125rem;
		color: var(--header-text-secondary, oklch(0.45 0.02 250));
	}

	.wallet-status__chain-warning {
		margin-left: auto;
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.75rem;
		font-weight: 600;
		color: oklch(0.6 0.16 70);
		padding: 2px 7px;
		border-radius: 20px;
		background: oklch(0.78 0.16 80 / 0.12);
	}

	/* ── Disconnect button ──────────────────────────────────────────────────── */

	.wallet-status__popover-footer {
		padding: 6px 0 2px;
		border-top: 1px solid var(--header-border, oklch(0.85 0.02 250 / 0.6));
		margin-top: 4px;
	}

	.wallet-status__disconnect-btn {
		display: flex;
		width: 100%;
		padding: 9px 12px;
		border-radius: 8px;
		border: none;
		background: transparent;
		cursor: pointer;
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.875rem;
		font-weight: 500;
		color: oklch(0.5 0.2 20);
		text-align: left;
		transition: background 100ms ease-out;
	}

	.wallet-status__disconnect-btn:hover {
		background: oklch(0.97 0.03 20 / 0.5);
	}

	.wallet-status__disconnect-btn:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px oklch(0.55 0.2 20 / 0.3);
	}

	/* ── Reduced motion ─────────────────────────────────────────────────────── */

	@media (prefers-reduced-motion: reduce) {
		.wallet-status__popover {
			animation: none;
		}

		.wallet-status__pill,
		.wallet-status__dot,
		.wallet-status__copy-btn,
		.wallet-status__disconnect-btn {
			transition: none;
		}
	}
</style>
