<script lang="ts">
	import { getRecoveryManager, hasRecoveryConfigured } from '$lib/core/blockchain/social-recovery';
	import type { RecoveryConfig, Guardian } from '$lib/core/blockchain/social-recovery';
	import { Shield, UserPlus, CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-svelte';

	/**
	 * RecoverySetup Component
	 *
	 * Guides users through setting up social recovery for their passkey wallet.
	 * Requires 3 guardians for 2-of-3 approval mechanism.
	 */

	interface Props {
		accountId: string;
		onComplete?: (config: RecoveryConfig) => void;
		onSkip?: () => void;
	}

	let { accountId, onComplete, onSkip }: Props = $props();

	let state = $state<'intro' | 'setup' | 'confirm' | 'success' | 'error'>('intro');
	let errorMessage = $state<string | null>(null);
	let isProcessing = $state(false);
	let config = $state<RecoveryConfig | null>(null);

	// Guardian email inputs
	let guardian1Email = $state('');
	let guardian2Email = $state('');
	let guardian3Email = $state('');

	const recoveryManager = getRecoveryManager();

	// Check if recovery already configured
	let isConfigured = $state(false);
	$effect(() => {
		hasRecoveryConfigured(accountId).then((configured) => {
			isConfigured = configured;
			if (configured) {
				loadExistingConfig();
			}
		});
	});

	async function loadExistingConfig() {
		const existing = await recoveryManager.getRecoveryConfig(accountId);
		if (existing) {
			config = existing;
			state = 'success';
		}
	}

	function validateEmails(): string | null {
		const emails = [guardian1Email, guardian2Email, guardian3Email];

		// Check all filled
		if (emails.some((e) => !e.trim())) {
			return 'Please enter all 3 guardian email addresses';
		}

		// Validate format
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		for (const email of emails) {
			if (!emailRegex.test(email)) {
				return `Invalid email format: ${email}`;
			}
		}

		// Check for duplicates
		const uniqueEmails = new Set(emails.map((e) => e.toLowerCase()));
		if (uniqueEmails.size !== emails.length) {
			return 'Guardian emails must be unique';
		}

		return null;
	}

	function goToConfirm() {
		const error = validateEmails();
		if (error) {
			errorMessage = error;
			return;
		}

		errorMessage = null;
		state = 'confirm';
	}

	async function setupRecovery() {
		isProcessing = true;
		errorMessage = null;

		try {
			const emails = [guardian1Email.trim(), guardian2Email.trim(), guardian3Email.trim()];

			config = await recoveryManager.setupRecovery(accountId, emails);

			state = 'success';

			if (onComplete) {
				onComplete(config);
			}
		} catch (error) {
			console.error('[RecoverySetup] Setup failed:', error);
			errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			state = 'error';
		} finally {
			isProcessing = false;
		}
	}

	function handleSkip() {
		if (onSkip) {
			onSkip();
		}
	}
</script>

<div class="recovery-setup">
	<!-- Intro Screen -->
	{#if state === 'intro'}
		<div class="recovery-setup__content">
			<div class="recovery-setup__header">
				<Shield class="recovery-setup__icon" size={48} />
				<h2 class="recovery-setup__title">Set up account recovery</h2>
				<p class="recovery-setup__subtitle">
					Choose 3 trusted people who can help you recover your account if you lose access
				</p>
			</div>

			<div class="recovery-setup__features">
				<div class="recovery-setup__feature">
					<UserPlus size={20} />
					<div>
						<strong>2-of-3 Guardian Approval</strong>
						<p>Any 2 of your 3 guardians can approve account recovery</p>
					</div>
				</div>

				<div class="recovery-setup__feature">
					<Shield size={20} />
					<div>
						<strong>True Account Ownership</strong>
						<p>You maintain full control even if Communique shuts down</p>
					</div>
				</div>

				<div class="recovery-setup__feature">
					<CheckCircle2 size={20} />
					<div>
						<strong>Works with Any NEAR Wallet</strong>
						<p>Migrate to any wallet supporting passkey authentication</p>
					</div>
				</div>
			</div>

			<div class="recovery-setup__actions">
				<button
					type="button"
					class="recovery-setup__button recovery-setup__button--primary"
					onclick={() => (state = 'setup')}
				>
					Set up recovery
				</button>

				{#if onSkip}
					<button
						type="button"
						class="recovery-setup__button recovery-setup__button--secondary"
						onclick={handleSkip}
					>
						Skip for now
					</button>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Setup Screen -->
	{#if state === 'setup'}
		<div class="recovery-setup__content">
			<div class="recovery-setup__header">
				<h2 class="recovery-setup__title">Choose your guardians</h2>
				<p class="recovery-setup__subtitle">
					Enter email addresses of 3 trusted people who can help recover your account
				</p>
			</div>

			<form class="recovery-setup__form" onsubmit={(e) => e.preventDefault()}>
				<div class="recovery-setup__field">
					<label for="guardian1">Guardian 1 Email</label>
					<input
						id="guardian1"
						type="email"
						bind:value={guardian1Email}
						placeholder="friend@example.com"
						required
					/>
					<p class="recovery-setup__hint">A trusted friend or family member</p>
				</div>

				<div class="recovery-setup__field">
					<label for="guardian2">Guardian 2 Email</label>
					<input
						id="guardian2"
						type="email"
						bind:value={guardian2Email}
						placeholder="family@example.com"
						required
					/>
					<p class="recovery-setup__hint">Another trusted person</p>
				</div>

				<div class="recovery-setup__field">
					<label for="guardian3">Guardian 3 Email</label>
					<input
						id="guardian3"
						type="email"
						bind:value={guardian3Email}
						placeholder="backup@example.com"
						required
					/>
					<p class="recovery-setup__hint">A third trusted contact</p>
				</div>

				{#if errorMessage}
					<div class="recovery-setup__error">
						<AlertCircle size={20} />
						<p>{errorMessage}</p>
					</div>
				{/if}

				<div class="recovery-setup__actions">
					<button
						type="button"
						class="recovery-setup__button recovery-setup__button--primary"
						onclick={goToConfirm}
					>
						Continue
					</button>

					<button
						type="button"
						class="recovery-setup__button recovery-setup__button--secondary"
						onclick={() => (state = 'intro')}
					>
						Back
					</button>
				</div>
			</form>
		</div>
	{/if}

	<!-- Confirm Screen -->
	{#if state === 'confirm'}
		<div class="recovery-setup__content">
			<div class="recovery-setup__header">
				<h2 class="recovery-setup__title">Confirm your guardians</h2>
				<p class="recovery-setup__subtitle">
					These people will receive an email invitation to become your account guardians
				</p>
			</div>

			<div class="recovery-setup__guardians">
				<div class="recovery-setup__guardian">
					<CheckCircle2 size={20} />
					<div>
						<strong>Guardian 1</strong>
						<p>{guardian1Email}</p>
					</div>
				</div>

				<div class="recovery-setup__guardian">
					<CheckCircle2 size={20} />
					<div>
						<strong>Guardian 2</strong>
						<p>{guardian2Email}</p>
					</div>
				</div>

				<div class="recovery-setup__guardian">
					<CheckCircle2 size={20} />
					<div>
						<strong>Guardian 3</strong>
						<p>{guardian3Email}</p>
					</div>
				</div>
			</div>

			<div class="recovery-setup__info">
				<AlertCircle size={20} />
				<div>
					<strong>How recovery works:</strong>
					<ul>
						<li>If you lose access, you can request account recovery</li>
						<li>Your guardians will receive an approval request</li>
						<li>Any 2 guardians can approve your recovery</li>
						<li>You'll create a new passkey on your new device</li>
					</ul>
				</div>
			</div>

			<div class="recovery-setup__actions">
				<button
					type="button"
					class="recovery-setup__button recovery-setup__button--primary"
					onclick={setupRecovery}
					disabled={isProcessing}
				>
					{isProcessing ? 'Setting up...' : 'Confirm and set up recovery'}
				</button>

				<button
					type="button"
					class="recovery-setup__button recovery-setup__button--secondary"
					onclick={() => (state = 'setup')}
					disabled={isProcessing}
				>
					Edit guardians
				</button>
			</div>
		</div>
	{/if}

	<!-- Success Screen -->
	{#if state === 'success'}
		<div class="recovery-setup__content recovery-setup__content--centered">
			<CheckCircle2 class="recovery-setup__icon recovery-setup__icon--success" size={48} />
			<h3 class="recovery-setup__status-title">Recovery set up successfully!</h3>
			<p class="recovery-setup__status-text">
				Your guardians have been notified and can help you recover your account if needed
			</p>

			{#if config}
				<div class="recovery-setup__summary">
					<div class="recovery-setup__summary-item">
						<strong>Account:</strong>
						<code>{config.accountId}</code>
					</div>
					<div class="recovery-setup__summary-item">
						<strong>Guardians:</strong>
						<ul>
							{#each config.guardians as guardian}
								<li>{guardian.email} <span class="status">{guardian.status}</span></li>
							{/each}
						</ul>
					</div>
					<div class="recovery-setup__summary-item">
						<strong>Approval Threshold:</strong>
						<span>{config.threshold} of {config.guardians.length} guardians required</span>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Error Screen -->
	{#if state === 'error'}
		<div class="recovery-setup__content recovery-setup__content--centered">
			<XCircle class="recovery-setup__icon recovery-setup__icon--error" size={48} />
			<h3 class="recovery-setup__status-title">Setup failed</h3>
			<p class="recovery-setup__error-message">{errorMessage}</p>

			<div class="recovery-setup__actions">
				<button
					type="button"
					class="recovery-setup__button recovery-setup__button--primary"
					onclick={() => (state = 'setup')}
				>
					Try again
				</button>

				{#if onSkip}
					<button
						type="button"
						class="recovery-setup__button recovery-setup__button--secondary"
						onclick={handleSkip}
					>
						Skip for now
					</button>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.recovery-setup {
		max-width: 600px;
		margin: 0 auto;
		padding: 2rem;
	}

	.recovery-setup__content {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.recovery-setup__content--centered {
		align-items: center;
		text-align: center;
	}

	.recovery-setup__header {
		text-align: center;
	}

	.recovery-setup__icon {
		color: #3b82f6;
		margin: 0 auto 1rem;
	}

	.recovery-setup__icon--success {
		color: #10b981;
	}

	.recovery-setup__icon--error {
		color: #ef4444;
	}

	.recovery-setup__title {
		font-size: 1.5rem;
		font-weight: 600;
		margin-bottom: 0.5rem;
		color: #111827;
	}

	.recovery-setup__subtitle {
		font-size: 1rem;
		color: #6b7280;
	}

	.recovery-setup__features {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.5rem;
		background: #f9fafb;
		border-radius: 0.5rem;
	}

	.recovery-setup__feature {
		display: flex;
		gap: 1rem;
		align-items: start;
	}

	.recovery-setup__feature :global(svg) {
		flex-shrink: 0;
		margin-top: 0.25rem;
		color: #3b82f6;
	}

	.recovery-setup__feature strong {
		display: block;
		margin-bottom: 0.25rem;
		color: #111827;
	}

	.recovery-setup__feature p {
		font-size: 0.875rem;
		color: #6b7280;
		margin: 0;
	}

	.recovery-setup__form {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.recovery-setup__field {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.recovery-setup__field label {
		font-weight: 500;
		color: #374151;
	}

	.recovery-setup__field input {
		padding: 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 0.5rem;
		font-size: 1rem;
	}

	.recovery-setup__field input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.recovery-setup__hint {
		font-size: 0.875rem;
		color: #6b7280;
		margin: 0;
	}

	.recovery-setup__guardians {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.5rem;
		background: #f9fafb;
		border-radius: 0.5rem;
	}

	.recovery-setup__guardian {
		display: flex;
		gap: 1rem;
		align-items: start;
	}

	.recovery-setup__guardian :global(svg) {
		flex-shrink: 0;
		margin-top: 0.25rem;
		color: #10b981;
	}

	.recovery-setup__guardian strong {
		display: block;
		margin-bottom: 0.25rem;
		color: #111827;
	}

	.recovery-setup__guardian p {
		font-size: 0.875rem;
		color: #6b7280;
		margin: 0;
	}

	.recovery-setup__info {
		display: flex;
		gap: 1rem;
		padding: 1rem;
		background: #eff6ff;
		border: 1px solid #bfdbfe;
		border-radius: 0.5rem;
		color: #1e40af;
	}

	.recovery-setup__info :global(svg) {
		flex-shrink: 0;
		margin-top: 0.25rem;
	}

	.recovery-setup__info strong {
		display: block;
		margin-bottom: 0.5rem;
	}

	.recovery-setup__info ul {
		margin: 0;
		padding-left: 1.25rem;
		font-size: 0.875rem;
	}

	.recovery-setup__info li {
		margin-bottom: 0.25rem;
	}

	.recovery-setup__error {
		display: flex;
		gap: 1rem;
		padding: 1rem;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 0.5rem;
		color: #991b1b;
	}

	.recovery-setup__error :global(svg) {
		flex-shrink: 0;
	}

	.recovery-setup__error p {
		margin: 0;
		font-size: 0.875rem;
	}

	.recovery-setup__actions {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.recovery-setup__button {
		padding: 0.75rem 1.5rem;
		font-size: 1rem;
		font-weight: 500;
		border-radius: 0.5rem;
		border: none;
		cursor: pointer;
		transition: all 0.2s;
	}

	.recovery-setup__button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.recovery-setup__button--primary {
		background: #3b82f6;
		color: white;
	}

	.recovery-setup__button--primary:hover:not(:disabled) {
		background: #2563eb;
	}

	.recovery-setup__button--secondary {
		background: white;
		color: #374151;
		border: 1px solid #d1d5db;
	}

	.recovery-setup__button--secondary:hover:not(:disabled) {
		background: #f9fafb;
	}

	.recovery-setup__status-title {
		font-size: 1.25rem;
		font-weight: 600;
		margin: 0;
		color: #111827;
	}

	.recovery-setup__status-text {
		font-size: 1rem;
		color: #6b7280;
		margin: 0;
	}

	.recovery-setup__error-message {
		padding: 1rem;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 0.5rem;
		color: #991b1b;
		font-size: 0.875rem;
	}

	.recovery-setup__summary {
		width: 100%;
		padding: 1.5rem;
		background: #f9fafb;
		border-radius: 0.5rem;
		text-align: left;
	}

	.recovery-setup__summary-item {
		margin-bottom: 1rem;
	}

	.recovery-setup__summary-item:last-child {
		margin-bottom: 0;
	}

	.recovery-setup__summary-item strong {
		display: block;
		margin-bottom: 0.5rem;
		color: #374151;
	}

	.recovery-setup__summary-item code {
		display: block;
		padding: 0.5rem;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 0.25rem;
		font-family: 'Monaco', 'Courier New', monospace;
		font-size: 0.875rem;
		word-break: break-all;
	}

	.recovery-setup__summary-item ul {
		margin: 0;
		padding-left: 1.25rem;
	}

	.recovery-setup__summary-item li {
		margin-bottom: 0.25rem;
		font-size: 0.875rem;
		color: #6b7280;
	}

	.recovery-setup__summary-item .status {
		margin-left: 0.5rem;
		padding: 0.125rem 0.5rem;
		background: #fef3c7;
		color: #92400e;
		border-radius: 0.25rem;
		font-size: 0.75rem;
		text-transform: capitalize;
	}
</style>
