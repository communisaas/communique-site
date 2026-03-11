<script module lang="ts">
	export interface OnboardingState {
		hasDescription: boolean;
		hasSupporters: boolean;
		hasCampaigns: boolean;
		hasTeam: boolean;
		hasSentEmail: boolean;
	}
</script>

<script lang="ts">
	let {
		orgSlug,
		onboarding,
		orgDescription,
		billingEmail,
		onStepComplete
	}: {
		orgSlug: string;
		onboarding: OnboardingState;
		orgDescription: string | null;
		billingEmail: string | null;
		onStepComplete?: (step: keyof OnboardingState) => void;
	} = $props();

	// Local overrides for optimistic UI — never mutate the prop directly
	let localOverrides = $state<Partial<OnboardingState>>({});
	const resolved = $derived({
		hasDescription: localOverrides.hasDescription ?? onboarding.hasDescription,
		hasSupporters: localOverrides.hasSupporters ?? onboarding.hasSupporters,
		hasCampaigns: localOverrides.hasCampaigns ?? onboarding.hasCampaigns,
		hasTeam: localOverrides.hasTeam ?? onboarding.hasTeam,
		hasSentEmail: localOverrides.hasSentEmail ?? onboarding.hasSentEmail
	});

	function markComplete(step: keyof OnboardingState): void {
		localOverrides = { ...localOverrides, [step]: true };
		onStepComplete?.(step);
	}

	// Step 1: Configure org (inline form)
	let editingOrg = $state(false);
	let descInput = $state(orgDescription ?? '');
	let emailInput = $state(billingEmail ?? '');
	let savingOrg = $state(false);
	let orgSaveError = $state('');

	// Step 2: Invite team (inline form)
	let editingInvite = $state(false);
	let inviteEmail = $state('');
	let inviteRole = $state('editor');
	let sendingInvite = $state(false);
	let inviteMsg = $state('');
	let inviteMsgType = $state<'success' | 'error'>('success');

	const completedCount = $derived(
		[resolved.hasDescription, resolved.hasSupporters, resolved.hasCampaigns, resolved.hasTeam, resolved.hasSentEmail]
			.filter(Boolean).length
	);

	const totalSteps = 5;

	const progressPct = $derived(Math.round((completedCount / totalSteps) * 100));

	async function saveOrgDetails(): Promise<void> {
		savingOrg = true;
		orgSaveError = '';
		try {
			const body: Record<string, string> = {};
			if (descInput.trim()) body.description = descInput.trim();
			if (emailInput.trim()) body.billing_email = emailInput.trim();

			if (Object.keys(body).length === 0) {
				editingOrg = false;
				return;
			}

			const res = await fetch(`/api/org/${orgSlug}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (!res.ok) {
				const data = await res.json().catch(() => null);
				orgSaveError = data?.message || 'Failed to save.';
				return;
			}

			editingOrg = false;
			markComplete('hasDescription');
		} finally {
			savingOrg = false;
		}
	}

	async function sendInvite(): Promise<void> {
		if (!inviteEmail.trim() || !inviteEmail.includes('@')) return;
		sendingInvite = true;
		inviteMsg = '';

		try {
			const res = await fetch(`/api/org/${orgSlug}/invites`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					invites: [{ email: inviteEmail.trim().toLowerCase(), role: inviteRole }]
				})
			});

			if (!res.ok) {
				const data = await res.json().catch(() => null);
				inviteMsg = data?.message || 'Failed to send invite.';
				inviteMsgType = 'error';
				return;
			}

			inviteMsg = `Invite sent to ${inviteEmail.trim()}`;
			inviteMsgType = 'success';
			inviteEmail = '';
			markComplete('hasTeam');
		} finally {
			sendingInvite = false;
		}
	}
</script>

<div class="checklist">
	<div class="checklist__header">
		<div class="checklist__header-text">
			<p class="checklist__title">Get started</p>
			<p class="checklist__progress-label">{completedCount} of {totalSteps} complete</p>
		</div>
		<div class="checklist__progress-bar">
			<div class="checklist__progress-fill" style="width: {progressPct}%"></div>
		</div>
	</div>

	<div class="checklist__steps">
		<!-- Step 1: Configure org -->
		<div class="checklist__step" class:checklist__step--done={resolved.hasDescription}>
			<div class="checklist__step-indicator">
				{#if resolved.hasDescription}
					<svg viewBox="0 0 20 20" fill="currentColor" class="checklist__check-icon">
						<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
					</svg>
				{:else}
					<span class="checklist__step-number">1</span>
				{/if}
			</div>
			<div class="checklist__step-content">
				<div class="checklist__step-row">
					<span class="checklist__step-label">Add a description and billing email</span>
					{#if !resolved.hasDescription && !editingOrg}
						<button class="checklist__step-action" onclick={() => { editingOrg = true; }}>Configure</button>
					{/if}
				</div>
				{#if editingOrg}
					<div class="checklist__inline-form">
						<label class="checklist__field">
							<span class="checklist__field-label">Description</span>
							<textarea
								class="checklist__textarea"
								rows="2"
								placeholder="What does your organization do?"
								bind:value={descInput}
								maxlength="500"
							></textarea>
						</label>
						<label class="checklist__field">
							<span class="checklist__field-label">Billing email</span>
							<input
								type="email"
								class="checklist__input"
								placeholder="billing@yourorg.com"
								bind:value={emailInput}
							/>
						</label>
						{#if orgSaveError}
							<p class="checklist__error">{orgSaveError}</p>
						{/if}
						<div class="checklist__inline-actions">
							<button class="checklist__btn-ghost" onclick={() => { editingOrg = false; }}>Cancel</button>
							<button class="checklist__btn-primary" disabled={savingOrg} onclick={saveOrgDetails}>
								{savingOrg ? 'Saving...' : 'Save'}
							</button>
						</div>
					</div>
				{/if}
			</div>
		</div>

		<!-- Step 2: Invite team -->
		<div class="checklist__step" class:checklist__step--done={resolved.hasTeam}>
			<div class="checklist__step-indicator">
				{#if resolved.hasTeam}
					<svg viewBox="0 0 20 20" fill="currentColor" class="checklist__check-icon">
						<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
					</svg>
				{:else}
					<span class="checklist__step-number">2</span>
				{/if}
			</div>
			<div class="checklist__step-content">
				<div class="checklist__step-row">
					<span class="checklist__step-label">Invite your team</span>
					{#if !resolved.hasTeam && !editingInvite}
						<button class="checklist__step-action" onclick={() => { editingInvite = true; }}>Invite</button>
					{/if}
				</div>
				{#if editingInvite}
					<div class="checklist__inline-form">
						<div class="checklist__invite-row">
							<input
								type="email"
								class="checklist__input checklist__input--flex"
								placeholder="colleague@example.com"
								bind:value={inviteEmail}
								onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sendInvite(); } }}
							/>
							<select class="checklist__select" bind:value={inviteRole}>
								<option value="editor">Editor</option>
								<option value="member">Viewer</option>
							</select>
							<button
								class="checklist__btn-primary"
								disabled={sendingInvite || !inviteEmail.includes('@')}
								onclick={sendInvite}
							>
								{sendingInvite ? 'Sending...' : 'Send'}
							</button>
						</div>
						{#if inviteMsg}
							<p class="checklist__msg" class:checklist__msg--error={inviteMsgType === 'error'}>
								{inviteMsg}
							</p>
						{/if}
						<button class="checklist__btn-ghost checklist__btn-sm" onclick={() => { editingInvite = false; }}>Done</button>
					</div>
				{/if}
			</div>
		</div>

		<!-- Step 3: Import supporters -->
		<div class="checklist__step" class:checklist__step--done={resolved.hasSupporters}>
			<div class="checklist__step-indicator">
				{#if resolved.hasSupporters}
					<svg viewBox="0 0 20 20" fill="currentColor" class="checklist__check-icon">
						<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
					</svg>
				{:else}
					<span class="checklist__step-number">3</span>
				{/if}
			</div>
			<div class="checklist__step-content">
				<div class="checklist__step-row">
					<span class="checklist__step-label">Import supporters</span>
					{#if !resolved.hasSupporters}
						<a href="/org/{orgSlug}/supporters/import" class="checklist__step-action">Import</a>
					{/if}
				</div>
				<p class="checklist__step-hint">Upload CSV or sync from Action Network</p>
			</div>
		</div>

		<!-- Step 4: Create first campaign -->
		<div class="checklist__step" class:checklist__step--done={resolved.hasCampaigns}>
			<div class="checklist__step-indicator">
				{#if resolved.hasCampaigns}
					<svg viewBox="0 0 20 20" fill="currentColor" class="checklist__check-icon">
						<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
					</svg>
				{:else}
					<span class="checklist__step-number">4</span>
				{/if}
			</div>
			<div class="checklist__step-content">
				<div class="checklist__step-row">
					<span class="checklist__step-label">Create your first campaign</span>
					{#if !resolved.hasCampaigns}
						<a href="/org/{orgSlug}/campaigns/new" class="checklist__step-action">Create</a>
					{/if}
				</div>
				<p class="checklist__step-hint">Letter campaigns, events, or forms</p>
			</div>
		</div>

		<!-- Step 5: Send first email -->
		<div class="checklist__step" class:checklist__step--done={resolved.hasSentEmail}>
			<div class="checklist__step-indicator">
				{#if resolved.hasSentEmail}
					<svg viewBox="0 0 20 20" fill="currentColor" class="checklist__check-icon">
						<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
					</svg>
				{:else}
					<span class="checklist__step-number">5</span>
				{/if}
			</div>
			<div class="checklist__step-content">
				<div class="checklist__step-row">
					<span class="checklist__step-label">Send your first email</span>
					{#if !resolved.hasSentEmail}
						<a href="/org/{orgSlug}/emails/compose" class="checklist__step-action">Compose</a>
					{/if}
				</div>
				<p class="checklist__step-hint">Reach supporters with verified delivery</p>
			</div>
		</div>
	</div>
</div>

<style>
	.checklist {
		border-radius: 12px;
		border: 1px solid oklch(0.85 0.06 180 / 0.5);
		background: oklch(0.98 0.01 180 / 0.3);
		overflow: hidden;
	}

	.checklist__header {
		padding: 1rem 1.25rem;
		border-bottom: 1px solid oklch(0.92 0.02 250 / 0.6);
	}

	.checklist__header-text {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 0.625rem;
	}

	.checklist__title {
		font-size: 0.875rem;
		font-weight: 600;
		color: oklch(0.25 0.03 250);
		margin: 0;
	}

	.checklist__progress-label {
		font-size: 0.75rem;
		color: oklch(0.5 0.02 250);
		margin: 0;
	}

	.checklist__progress-bar {
		height: 4px;
		border-radius: 2px;
		background: oklch(0.92 0.01 250);
		overflow: hidden;
	}

	.checklist__progress-fill {
		height: 100%;
		border-radius: 2px;
		background: oklch(0.5 0.14 180);
		transition: width 400ms ease-out;
	}

	/* Steps */
	.checklist__steps {
		padding: 0.5rem 0;
	}

	.checklist__step {
		display: flex;
		gap: 0.75rem;
		padding: 0.75rem 1.25rem;
		transition: background 150ms ease-out;
	}

	.checklist__step:hover {
		background: oklch(0.97 0.005 250 / 0.5);
	}

	.checklist__step--done {
		opacity: 0.6;
	}

	.checklist__step-indicator {
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		margin-top: 0.0625rem;
		border: 1.5px solid oklch(0.8 0.02 250);
		color: oklch(0.5 0.02 250);
		font-size: 0.6875rem;
		font-weight: 600;
	}

	.checklist__step--done .checklist__step-indicator {
		border-color: oklch(0.5 0.14 180);
		background: oklch(0.5 0.14 180);
		color: white;
	}

	.checklist__check-icon {
		width: 0.75rem;
		height: 0.75rem;
	}

	.checklist__step-number {
		line-height: 1;
	}

	.checklist__step-content {
		flex: 1;
		min-width: 0;
	}

	.checklist__step-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.checklist__step-label {
		font-size: 0.8125rem;
		font-weight: 500;
		color: oklch(0.25 0.02 250);
	}

	.checklist__step--done .checklist__step-label {
		text-decoration: line-through;
		color: oklch(0.5 0.02 250);
	}

	.checklist__step-hint {
		font-size: 0.6875rem;
		color: oklch(0.55 0.01 250);
		margin: 0.125rem 0 0;
	}

	.checklist__step-action {
		font-size: 0.75rem;
		font-weight: 500;
		color: oklch(0.4 0.1 180);
		text-decoration: none;
		background: transparent;
		border: none;
		cursor: pointer;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		transition: all 150ms ease-out;
	}

	.checklist__step-action:hover {
		background: oklch(0.94 0.03 180);
		color: oklch(0.3 0.12 180);
	}

	/* Inline forms */
	.checklist__inline-form {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		margin-top: 0.625rem;
		padding: 0.75rem;
		border-radius: 8px;
		background: white;
		border: 1px solid oklch(0.92 0.01 250);
	}

	.checklist__field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.checklist__field-label {
		font-size: 0.6875rem;
		font-weight: 600;
		color: oklch(0.4 0.02 250);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.checklist__input {
		padding: 0.5rem 0.625rem;
		border-radius: 6px;
		border: 1px solid oklch(0.88 0.02 250);
		background: white;
		font-size: 0.8125rem;
		color: oklch(0.2 0.02 250);
		outline: none;
		transition: border-color 150ms ease-out;
	}

	.checklist__input:focus {
		border-color: oklch(0.65 0.1 180);
	}

	.checklist__input::placeholder {
		color: oklch(0.7 0.01 250);
	}

	.checklist__input--flex {
		flex: 1;
		min-width: 0;
	}

	.checklist__textarea {
		padding: 0.5rem 0.625rem;
		border-radius: 6px;
		border: 1px solid oklch(0.88 0.02 250);
		background: white;
		font-size: 0.8125rem;
		color: oklch(0.2 0.02 250);
		outline: none;
		resize: vertical;
		font-family: inherit;
		transition: border-color 150ms ease-out;
	}

	.checklist__textarea:focus {
		border-color: oklch(0.65 0.1 180);
	}

	.checklist__textarea::placeholder {
		color: oklch(0.7 0.01 250);
	}

	.checklist__select {
		padding: 0.5rem 0.375rem;
		border-radius: 6px;
		border: 1px solid oklch(0.88 0.02 250);
		background: white;
		font-size: 0.75rem;
		color: oklch(0.3 0.02 250);
		outline: none;
		cursor: pointer;
	}

	.checklist__invite-row {
		display: flex;
		gap: 0.375rem;
		align-items: center;
	}

	.checklist__inline-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.checklist__btn-primary {
		padding: 0.375rem 0.75rem;
		border-radius: 6px;
		border: none;
		background: oklch(0.35 0.08 180);
		color: white;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 150ms ease-out;
	}

	.checklist__btn-primary:hover:not(:disabled) {
		background: oklch(0.3 0.1 180);
	}

	.checklist__btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.checklist__btn-ghost {
		padding: 0.375rem 0.75rem;
		border-radius: 6px;
		border: none;
		background: transparent;
		color: oklch(0.5 0.02 250);
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
	}

	.checklist__btn-ghost:hover {
		color: oklch(0.3 0.02 250);
	}

	.checklist__btn-sm {
		align-self: flex-start;
		padding: 0.25rem 0;
	}

	.checklist__error {
		font-size: 0.75rem;
		color: oklch(0.5 0.15 25);
		margin: 0;
	}

	.checklist__msg {
		font-size: 0.75rem;
		color: oklch(0.45 0.12 150);
		margin: 0;
	}

	.checklist__msg--error {
		color: oklch(0.5 0.15 25);
	}
</style>
