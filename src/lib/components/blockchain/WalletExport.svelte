<script lang="ts">
	import { getRecoveryManager } from '$lib/core/blockchain/social-recovery';
	import { Download, Copy, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-svelte';

	/**
	 * WalletExport Component
	 *
	 * Allows users to export their account data for:
	 * - Migration to other NEAR wallets
	 * - Backup and recovery documentation
	 * - Understanding their account sovereignty
	 */

	interface Props {
		accountId: string;
		publicKey: string;
	}

	let { accountId, publicKey }: Props = $props();

	let exportData = $state<any>(null);
	let isExporting = $state(false);
	let errorMessage = $state<string | null>(null);
	let copiedField = $state<string | null>(null);

	const recoveryManager = getRecoveryManager();

	async function exportAccount() {
		isExporting = true;
		errorMessage = null;

		try {
			exportData = await recoveryManager.exportAccountData(accountId);
		} catch (error) {
			console.error('[WalletExport] Export failed:', error);
			errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		} finally {
			isExporting = false;
		}
	}

	async function copyToClipboard(text: string, field: string) {
		try {
			await navigator.clipboard.writeText(text);
			copiedField = field;
			setTimeout(() => {
				copiedField = null;
			}, 2000);
		} catch (error) {
			console.error('[WalletExport] Copy failed:', error);
		}
	}

	function downloadAsJSON() {
		if (!exportData) return;

		const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `near-account-${accountId}-${Date.now()}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}
</script>

<div class="wallet-export">
	{#if !exportData}
		<div class="wallet-export__intro">
			<div class="wallet-export__header">
				<Download class="wallet-export__icon" size={48} />
				<h2 class="wallet-export__title">Export your account</h2>
				<p class="wallet-export__subtitle">
					Get all your account information to migrate to another wallet or keep as backup
				</p>
			</div>

			<div class="wallet-export__features">
				<div class="wallet-export__feature">
					<CheckCircle2 size={20} />
					<div>
						<strong>Complete Account Data</strong>
						<p>Account ID, public key, recovery configuration, and migration instructions</p>
					</div>
				</div>

				<div class="wallet-export__feature">
					<CheckCircle2 size={20} />
					<div>
						<strong>Works with Any NEAR Wallet</strong>
						<p>Import into wallet.near.org, MyNearWallet, or any passkey-compatible wallet</p>
					</div>
				</div>

				<div class="wallet-export__feature">
					<CheckCircle2 size={20} />
					<div>
						<strong>True Ownership</strong>
						<p>Your account works independently of Communique</p>
					</div>
				</div>
			</div>

			<div class="wallet-export__warning">
				<AlertCircle size={20} />
				<div>
					<strong>Keep your export safe</strong>
					<p>
						This data contains your account ID and recovery information. Store it securely and don't
						share it publicly.
					</p>
				</div>
			</div>

			{#if errorMessage}
				<div class="wallet-export__error">
					<AlertCircle size={20} />
					<p>{errorMessage}</p>
				</div>
			{/if}

			<button
				type="button"
				class="wallet-export__button wallet-export__button--primary"
				onclick={exportAccount}
				disabled={isExporting}
			>
				{isExporting ? 'Exporting...' : 'Export account data'}
			</button>
		</div>
	{:else}
		<div class="wallet-export__data">
			<div class="wallet-export__header">
				<CheckCircle2 class="wallet-export__icon wallet-export__icon--success" size={48} />
				<h2 class="wallet-export__title">Account exported successfully</h2>
				<p class="wallet-export__subtitle">
					Your account data is ready. Save this information securely.
				</p>
			</div>

			<div class="wallet-export__section">
				<h3>Account Information</h3>

				<div class="wallet-export__field">
					<label>Account ID</label>
					<div class="wallet-export__field-content">
						<code>{exportData.accountId}</code>
						<button
							type="button"
							class="wallet-export__copy"
							onclick={() => copyToClipboard(exportData.accountId, 'accountId')}
							title="Copy to clipboard"
						>
							{#if copiedField === 'accountId'}
								<CheckCircle2 size={16} />
							{:else}
								<Copy size={16} />
							{/if}
						</button>
					</div>
				</div>

				<div class="wallet-export__field">
					<label>Public Key</label>
					<div class="wallet-export__field-content">
						<code class="wallet-export__code-small">{exportData.publicKey}</code>
						<button
							type="button"
							class="wallet-export__copy"
							onclick={() => copyToClipboard(exportData.publicKey, 'publicKey')}
							title="Copy to clipboard"
						>
							{#if copiedField === 'publicKey'}
								<CheckCircle2 size={16} />
							{:else}
								<Copy size={16} />
							{/if}
						</button>
					</div>
				</div>

				<div class="wallet-export__field">
					<label>Authentication Method</label>
					<div class="wallet-export__field-content">
						<span>NEAR Passkey (WebAuthn/FIDO2)</span>
					</div>
				</div>

				<div class="wallet-export__field">
					<label>Exported At</label>
					<div class="wallet-export__field-content">
						<span>{new Date(exportData.exportedAt).toLocaleString()}</span>
					</div>
				</div>
			</div>

			{#if exportData.recoveryConfig}
				<div class="wallet-export__section">
					<h3>Recovery Configuration</h3>

					<div class="wallet-export__field">
						<label>Guardians ({exportData.recoveryConfig.guardians.length})</label>
						<ul class="wallet-export__guardians">
							{#each exportData.recoveryConfig.guardians as guardian}
								<li>
									{guardian.email}
									<span class="wallet-export__guardian-status">{guardian.status}</span>
								</li>
							{/each}
						</ul>
					</div>

					<div class="wallet-export__field">
						<label>Approval Threshold</label>
						<div class="wallet-export__field-content">
							<span
								>{exportData.recoveryConfig.threshold} of {exportData.recoveryConfig.guardians
									.length} guardians required</span
							>
						</div>
					</div>
				</div>
			{:else}
				<div class="wallet-export__warning">
					<AlertCircle size={20} />
					<div>
						<strong>No recovery configured</strong>
						<p>
							Consider setting up social recovery to protect your account if you lose access to
							this device.
						</p>
					</div>
				</div>
			{/if}

			<div class="wallet-export__section">
				<h3>Migration Instructions</h3>
				<div class="wallet-export__instructions">
					<pre>{exportData.instructions}</pre>
				</div>
			</div>

			<div class="wallet-export__section">
				<h3>Compatible Wallets</h3>
				<div class="wallet-export__wallets">
					<a
						href="https://wallet.near.org"
						target="_blank"
						rel="noopener noreferrer"
						class="wallet-export__wallet-link"
					>
						<span>NEAR Wallet</span>
						<ExternalLink size={16} />
					</a>
					<a
						href="https://mynearwallet.com"
						target="_blank"
						rel="noopener noreferrer"
						class="wallet-export__wallet-link"
					>
						<span>MyNearWallet</span>
						<ExternalLink size={16} />
					</a>
				</div>
			</div>

			<div class="wallet-export__actions">
				<button
					type="button"
					class="wallet-export__button wallet-export__button--primary"
					onclick={downloadAsJSON}
				>
					<Download size={20} />
					Download as JSON
				</button>

				<button
					type="button"
					class="wallet-export__button wallet-export__button--secondary"
					onclick={() => (exportData = null)}
				>
					Done
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.wallet-export {
		max-width: 700px;
		margin: 0 auto;
		padding: 2rem;
	}

	.wallet-export__intro,
	.wallet-export__data {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.wallet-export__header {
		text-align: center;
	}

	.wallet-export__icon {
		color: #3b82f6;
		margin: 0 auto 1rem;
	}

	.wallet-export__icon--success {
		color: #10b981;
	}

	.wallet-export__title {
		font-size: 1.5rem;
		font-weight: 600;
		margin-bottom: 0.5rem;
		color: #111827;
	}

	.wallet-export__subtitle {
		font-size: 1rem;
		color: #6b7280;
	}

	.wallet-export__features {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.5rem;
		background: #f9fafb;
		border-radius: 0.5rem;
	}

	.wallet-export__feature {
		display: flex;
		gap: 1rem;
		align-items: start;
	}

	.wallet-export__feature :global(svg) {
		flex-shrink: 0;
		margin-top: 0.25rem;
		color: #10b981;
	}

	.wallet-export__feature strong {
		display: block;
		margin-bottom: 0.25rem;
		color: #111827;
	}

	.wallet-export__feature p {
		font-size: 0.875rem;
		color: #6b7280;
		margin: 0;
	}

	.wallet-export__warning {
		display: flex;
		gap: 1rem;
		padding: 1rem;
		background: #fffbeb;
		border: 1px solid #fde68a;
		border-radius: 0.5rem;
		color: #92400e;
	}

	.wallet-export__warning :global(svg) {
		flex-shrink: 0;
		margin-top: 0.25rem;
	}

	.wallet-export__warning strong {
		display: block;
		margin-bottom: 0.25rem;
	}

	.wallet-export__warning p {
		margin: 0;
		font-size: 0.875rem;
	}

	.wallet-export__error {
		display: flex;
		gap: 1rem;
		padding: 1rem;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 0.5rem;
		color: #991b1b;
	}

	.wallet-export__error :global(svg) {
		flex-shrink: 0;
	}

	.wallet-export__error p {
		margin: 0;
		font-size: 0.875rem;
	}

	.wallet-export__button {
		padding: 0.75rem 1.5rem;
		font-size: 1rem;
		font-weight: 500;
		border-radius: 0.5rem;
		border: none;
		cursor: pointer;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}

	.wallet-export__button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.wallet-export__button--primary {
		background: #3b82f6;
		color: white;
	}

	.wallet-export__button--primary:hover:not(:disabled) {
		background: #2563eb;
	}

	.wallet-export__button--secondary {
		background: white;
		color: #374151;
		border: 1px solid #d1d5db;
	}

	.wallet-export__button--secondary:hover:not(:disabled) {
		background: #f9fafb;
	}

	.wallet-export__section {
		padding: 1.5rem;
		background: #f9fafb;
		border-radius: 0.5rem;
	}

	.wallet-export__section h3 {
		margin: 0 0 1rem;
		font-size: 1.125rem;
		font-weight: 600;
		color: #111827;
	}

	.wallet-export__field {
		margin-bottom: 1rem;
	}

	.wallet-export__field:last-child {
		margin-bottom: 0;
	}

	.wallet-export__field label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #374151;
		font-size: 0.875rem;
	}

	.wallet-export__field-content {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.wallet-export__field-content code {
		flex: 1;
		padding: 0.5rem;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 0.25rem;
		font-family: 'Monaco', 'Courier New', monospace;
		font-size: 0.875rem;
		word-break: break-all;
	}

	.wallet-export__code-small {
		font-size: 0.75rem !important;
	}

	.wallet-export__copy {
		flex-shrink: 0;
		padding: 0.5rem;
		background: white;
		border: 1px solid #d1d5db;
		border-radius: 0.25rem;
		cursor: pointer;
		transition: all 0.2s;
		color: #6b7280;
	}

	.wallet-export__copy:hover {
		background: #f9fafb;
		border-color: #3b82f6;
		color: #3b82f6;
	}

	.wallet-export__guardians {
		margin: 0;
		padding-left: 1.25rem;
		list-style: none;
	}

	.wallet-export__guardians li {
		padding: 0.5rem 0;
		border-bottom: 1px solid #e5e7eb;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.wallet-export__guardians li:last-child {
		border-bottom: none;
	}

	.wallet-export__guardian-status {
		padding: 0.125rem 0.5rem;
		background: #fef3c7;
		color: #92400e;
		border-radius: 0.25rem;
		font-size: 0.75rem;
		text-transform: capitalize;
	}

	.wallet-export__instructions {
		padding: 1rem;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 0.25rem;
		overflow-x: auto;
	}

	.wallet-export__instructions pre {
		margin: 0;
		font-family: 'Monaco', 'Courier New', monospace;
		font-size: 0.8125rem;
		line-height: 1.6;
		white-space: pre-wrap;
		word-break: break-word;
		color: #374151;
	}

	.wallet-export__wallets {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.wallet-export__wallet-link {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 0.25rem;
		color: #3b82f6;
		text-decoration: none;
		transition: all 0.2s;
	}

	.wallet-export__wallet-link:hover {
		border-color: #3b82f6;
		background: #eff6ff;
	}

	.wallet-export__actions {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
</style>
