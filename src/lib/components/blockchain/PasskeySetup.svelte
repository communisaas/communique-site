<script lang="ts">
	import { getPasskeyWallet, isPasskeySupported, getPasskeyDeviceName } from '$lib/core/blockchain/client-signing';
	import { Fingerprint, Shield, CheckCircle2, XCircle, Loader2 } from 'lucide-svelte';

	/**
	 * PasskeySetup Component
	 *
	 * Guides users through setting up their passkey wallet for blockchain transactions.
	 * One-time setup that enables signing with Touch ID/Face ID.
	 */

	interface Props {
		accountId: string; // NEAR account ID (e.g., "random-abc123.communique.testnet")
		username?: string; // Display name (e.g., user's email)
		onComplete?: (publicKey: string) => void;
		onCancel?: () => void;
	}

	let { accountId, username, onComplete, onCancel }: Props = $props();

	let state = $state<'intro' | 'setup' | 'success' | 'error'>('intro');
	let errorMessage = $state<string | null>(null);
	let publicKey = $state<string | null>(null);
	let isProcessing = $state(false);

	const passkeySupported = isPasskeySupported();
	const deviceName = getPasskeyDeviceName();

	/**
	 * Start passkey setup process
	 */
	async function startSetup() {
		if (!passkeySupported) {
			errorMessage = 'Passkeys are not supported on this device/browser.';
			state = 'error';
			return;
		}

		state = 'setup';
		isProcessing = true;
		errorMessage = null;

		try {
			const wallet = getPasskeyWallet();
			const pk = await wallet.createPasskeyWallet(accountId, username);

			publicKey = pk;
			state = 'success';

			// Notify parent component
			if (onComplete) {
				onComplete(pk);
			}
		} catch (error) {
			console.error('[PasskeySetup] Setup failed:', error);
			errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			state = 'error';
		} finally {
			isProcessing = false;
		}
	}

	/**
	 * Retry setup after error
	 */
	function retry() {
		state = 'intro';
		errorMessage = null;
	}

	/**
	 * Cancel setup
	 */
	function handleCancel() {
		if (onCancel) {
			onCancel();
		}
	}
</script>

<div class="passkey-setup">
	<!-- Intro Screen -->
	{#if state === 'intro'}
		<div class="passkey-setup__content">
			<div class="passkey-setup__header">
				<Fingerprint class="passkey-setup__icon" size={48} />
				<h2 class="passkey-setup__title">Set up your secure wallet</h2>
				<p class="passkey-setup__subtitle">
					One-time setup to enable signing transactions with {deviceName}
				</p>
			</div>

			<div class="passkey-setup__features">
				<div class="passkey-setup__feature">
					<Shield size={20} />
					<div>
						<strong>No passwords needed</strong>
						<p>Your device's biometric authentication keeps you secure</p>
					</div>
				</div>

				<div class="passkey-setup__feature">
					<Fingerprint size={20} />
					<div>
						<strong>Private keys never leave your device</strong>
						<p>Keys are stored in your device's secure enclave</p>
					</div>
				</div>

				<div class="passkey-setup__feature">
					<CheckCircle2 size={20} />
					<div>
						<strong>Sign with biometrics</strong>
						<p>Approve transactions with Touch ID, Face ID, or your PIN</p>
					</div>
				</div>
			</div>

			{#if !passkeySupported}
				<div class="passkey-setup__warning">
					<XCircle size={20} />
					<p>
						<strong>Passkeys not supported</strong><br />
						Your browser or device doesn't support passkeys. Please use a modern browser like Chrome, Safari, or Firefox.
					</p>
				</div>
			{/if}

			<div class="passkey-setup__actions">
				<button
					type="button"
					class="passkey-setup__button passkey-setup__button--primary"
					onclick={startSetup}
					disabled={!passkeySupported || isProcessing}
				>
					{isProcessing ? 'Setting up...' : 'Set up passkey'}
				</button>

				{#if onCancel}
					<button
						type="button"
						class="passkey-setup__button passkey-setup__button--secondary"
						onclick={handleCancel}
						disabled={isProcessing}
					>
						Maybe later
					</button>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Setup In Progress Screen -->
	{#if state === 'setup'}
		<div class="passkey-setup__content passkey-setup__content--centered">
			<Loader2 class="passkey-setup__spinner" size={48} />
			<h3 class="passkey-setup__status-title">Follow the prompts on your device</h3>
			<p class="passkey-setup__status-text">
				Use your {deviceName} to create your secure wallet
			</p>
		</div>
	{/if}

	<!-- Success Screen -->
	{#if state === 'success'}
		<div class="passkey-setup__content passkey-setup__content--centered">
			<CheckCircle2 class="passkey-setup__icon passkey-setup__icon--success" size={48} />
			<h3 class="passkey-setup__status-title">Wallet set up successfully!</h3>
			<p class="passkey-setup__status-text">
				You can now sign transactions with your {deviceName}
			</p>

			{#if publicKey}
				<div class="passkey-setup__technical">
					<details>
						<summary>Technical details</summary>
						<div class="passkey-setup__technical-content">
							<p><strong>Account ID:</strong></p>
							<code>{accountId}</code>
							<p><strong>Public Key:</strong></p>
							<code class="passkey-setup__code">{publicKey}</code>
						</div>
					</details>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Error Screen -->
	{#if state === 'error'}
		<div class="passkey-setup__content passkey-setup__content--centered">
			<XCircle class="passkey-setup__icon passkey-setup__icon--error" size={48} />
			<h3 class="passkey-setup__status-title">Setup failed</h3>
			<p class="passkey-setup__error-message">{errorMessage}</p>

			<div class="passkey-setup__actions">
				<button
					type="button"
					class="passkey-setup__button passkey-setup__button--primary"
					onclick={retry}
				>
					Try again
				</button>

				{#if onCancel}
					<button
						type="button"
						class="passkey-setup__button passkey-setup__button--secondary"
						onclick={handleCancel}
					>
						Cancel
					</button>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.passkey-setup {
		max-width: 600px;
		margin: 0 auto;
		padding: 2rem;
	}

	.passkey-setup__content {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.passkey-setup__content--centered {
		align-items: center;
		text-align: center;
	}

	.passkey-setup__header {
		text-align: center;
	}

	.passkey-setup__icon {
		color: #3b82f6;
		margin: 0 auto 1rem;
	}

	.passkey-setup__icon--success {
		color: #10b981;
	}

	.passkey-setup__icon--error {
		color: #ef4444;
	}

	.passkey-setup__title {
		font-size: 1.5rem;
		font-weight: 600;
		margin-bottom: 0.5rem;
		color: #111827;
	}

	.passkey-setup__subtitle {
		font-size: 1rem;
		color: #6b7280;
	}

	.passkey-setup__features {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.5rem;
		background: #f9fafb;
		border-radius: 0.5rem;
	}

	.passkey-setup__feature {
		display: flex;
		gap: 1rem;
		align-items: start;
	}

	.passkey-setup__feature :global(svg) {
		flex-shrink: 0;
		margin-top: 0.25rem;
		color: #3b82f6;
	}

	.passkey-setup__feature strong {
		display: block;
		margin-bottom: 0.25rem;
		color: #111827;
	}

	.passkey-setup__feature p {
		font-size: 0.875rem;
		color: #6b7280;
		margin: 0;
	}

	.passkey-setup__warning {
		display: flex;
		gap: 1rem;
		padding: 1rem;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 0.5rem;
		color: #991b1b;
	}

	.passkey-setup__warning :global(svg) {
		flex-shrink: 0;
	}

	.passkey-setup__warning p {
		margin: 0;
		font-size: 0.875rem;
	}

	.passkey-setup__actions {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.passkey-setup__button {
		padding: 0.75rem 1.5rem;
		font-size: 1rem;
		font-weight: 500;
		border-radius: 0.5rem;
		border: none;
		cursor: pointer;
		transition: all 0.2s;
	}

	.passkey-setup__button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.passkey-setup__button--primary {
		background: #3b82f6;
		color: white;
	}

	.passkey-setup__button--primary:hover:not(:disabled) {
		background: #2563eb;
	}

	.passkey-setup__button--secondary {
		background: white;
		color: #374151;
		border: 1px solid #d1d5db;
	}

	.passkey-setup__button--secondary:hover:not(:disabled) {
		background: #f9fafb;
	}

	.passkey-setup__spinner {
		animation: spin 1s linear infinite;
		color: #3b82f6;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.passkey-setup__status-title {
		font-size: 1.25rem;
		font-weight: 600;
		margin: 0;
		color: #111827;
	}

	.passkey-setup__status-text {
		font-size: 1rem;
		color: #6b7280;
		margin: 0;
	}

	.passkey-setup__error-message {
		padding: 1rem;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 0.5rem;
		color: #991b1b;
		font-size: 0.875rem;
	}

	.passkey-setup__technical {
		width: 100%;
		margin-top: 1rem;
	}

	.passkey-setup__technical details {
		background: #f9fafb;
		border-radius: 0.5rem;
		padding: 1rem;
		text-align: left;
	}

	.passkey-setup__technical summary {
		cursor: pointer;
		font-weight: 500;
		color: #374151;
	}

	.passkey-setup__technical-content {
		margin-top: 1rem;
		font-size: 0.75rem;
		color: #6b7280;
	}

	.passkey-setup__technical-content p {
		margin: 0.5rem 0 0.25rem;
	}

	.passkey-setup__technical-content code {
		display: block;
		padding: 0.5rem;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 0.25rem;
		font-family: 'Monaco', 'Courier New', monospace;
		word-break: break-all;
	}

	.passkey-setup__code {
		font-size: 0.625rem;
	}
</style>
