<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { modalActions } from '$lib/stores/modalSystem.svelte';

	let { data }: { data: PageData } = $props();

	const user = $derived(data.user);
	const orgs = $derived(user?.orgMemberships ?? []);

	// Creation form state
	let showCreate = $state(false);
	let orgName = $state('');
	let orgSlug = $state('');
	let slugEdited = $state(false);
	let submitting = $state(false);
	let errorMsg = $state('');

	function deriveSlug(name: string): string {
		return name
			.toLowerCase()
			.replace(/[^a-z0-9\s-]/g, '')
			.replace(/\s+/g, '-')
			.replace(/-+/g, '-')
			.replace(/^-|-$/g, '')
			.slice(0, 48);
	}

	function handleNameInput(e: Event): void {
		const val = (e.target as HTMLInputElement).value;
		orgName = val;
		if (!slugEdited) {
			orgSlug = deriveSlug(val);
		}
	}

	function handleSlugInput(e: Event): void {
		const val = (e.target as HTMLInputElement).value;
		orgSlug = val.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 48);
		slugEdited = true;
	}

	function openCreate(): void {
		showCreate = true;
		orgName = '';
		orgSlug = '';
		slugEdited = false;
		errorMsg = '';
	}

	async function handleCreate(): Promise<void> {
		if (!orgName.trim() || !orgSlug.trim()) return;

		submitting = true;
		errorMsg = '';

		try {
			const res = await fetch('/api/org', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: orgName.trim(), slug: orgSlug.trim() })
			});

			if (!res.ok) {
				const data = await res.json().catch(() => null);
				if (res.status === 409) {
					errorMsg = 'That slug is taken. Try another.';
				} else {
					errorMsg = data?.message || 'Something went wrong.';
				}
				return;
			}

			const { slug } = await res.json();
			await goto(`/org/${slug}`);
		} finally {
			submitting = false;
		}
	}

	function handleSignIn(): void {
		modalActions.openModal('sign-in-modal', 'sign-in');
	}
</script>

<div class="org-landing">
	<div class="org-landing__inner">
		<h1 class="org-landing__title">Organizations</h1>
		<p class="org-landing__sub">
			Run campaigns. Track verified action. Deliver proof to decision-makers.
		</p>

		{#if orgs.length > 0}
			<!-- Org list for members -->
			<div class="org-landing__list">
				{#each orgs as org}
					<a href="/org/{org.orgSlug}" class="org-landing__card">
						{#if org.orgAvatar}
							<img src={org.orgAvatar} alt="" class="org-landing__avatar" />
						{:else}
							<div class="org-landing__avatar org-landing__avatar--fallback">
								{org.orgName.charAt(0).toUpperCase()}
							</div>
						{/if}
						<div class="org-landing__card-info">
							<span class="org-landing__card-name">{org.orgName}</span>
							<span class="org-landing__card-meta">
								{org.role}{#if org.activeCampaignCount > 0}
									&middot; {org.activeCampaignCount} active
								{/if}
							</span>
						</div>
						<span class="org-landing__arrow" aria-hidden="true">&rarr;</span>
					</a>
				{/each}
			</div>

			<!-- Create another -->
			{#if showCreate}
				<div class="org-create" style="margin-top: 1.5rem;">
					<form class="org-create__form" onsubmit={(e) => { e.preventDefault(); handleCreate(); }}>
						<label class="org-create__label">
							<span class="org-create__label-text">Name</span>
							<input
								type="text"
								class="org-create__input"
								placeholder="Acme Coalition"
								value={orgName}
								oninput={handleNameInput}
								maxlength="100"
								required
							/>
						</label>
						<label class="org-create__label">
							<span class="org-create__label-text">Slug</span>
							<div class="org-create__slug-row">
								<span class="org-create__slug-prefix">/org/</span>
								<input
									type="text"
									class="org-create__input org-create__input--slug"
									placeholder="acme-coalition"
									value={orgSlug}
									oninput={handleSlugInput}
									maxlength="48"
									required
								/>
							</div>
						</label>
						{#if errorMsg}
							<p class="org-create__error">{errorMsg}</p>
						{/if}
						<div class="org-create__actions">
							<button type="button" class="org-create__cancel" onclick={() => { showCreate = false; }}>Cancel</button>
							<button type="submit" class="org-landing__cta" disabled={submitting || !orgName.trim() || !orgSlug.trim()}>
								{submitting ? 'Creating…' : 'Create'}
							</button>
						</div>
					</form>
				</div>
			{:else}
				<button class="org-landing__create-link" onclick={openCreate}>
					Create new organization
				</button>
			{/if}
		{:else if user}
			<!-- Authenticated but no orgs -->
			{#if showCreate}
				<div class="org-create">
					<form class="org-create__form" onsubmit={(e) => { e.preventDefault(); handleCreate(); }}>
						<label class="org-create__label">
							<span class="org-create__label-text">Name</span>
							<input
								type="text"
								class="org-create__input"
								placeholder="Acme Coalition"
								value={orgName}
								oninput={handleNameInput}
								maxlength="100"
								required
							/>
						</label>
						<label class="org-create__label">
							<span class="org-create__label-text">Slug</span>
							<div class="org-create__slug-row">
								<span class="org-create__slug-prefix">/org/</span>
								<input
									type="text"
									class="org-create__input org-create__input--slug"
									placeholder="acme-coalition"
									value={orgSlug}
									oninput={handleSlugInput}
									maxlength="48"
									required
								/>
							</div>
						</label>
						{#if errorMsg}
							<p class="org-create__error">{errorMsg}</p>
						{/if}
						<div class="org-create__actions">
							<button type="button" class="org-create__cancel" onclick={() => { showCreate = false; }}>Cancel</button>
							<button type="submit" class="org-landing__cta" disabled={submitting || !orgName.trim() || !orgSlug.trim()}>
								{submitting ? 'Creating…' : 'Create'}
							</button>
						</div>
					</form>
				</div>
			{:else}
				<div class="org-landing__empty">
					<p class="org-landing__empty-text">
						No organizations yet.
					</p>
					<button class="org-landing__cta" onclick={openCreate}>
						Create one
					</button>
				</div>
			{/if}
		{:else}
			<!-- Not signed in -->
			<div class="org-landing__empty">
				<button class="org-landing__cta" onclick={handleSignIn}>
					Sign in to get started
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.org-landing {
		min-height: 60vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 3rem 1.5rem;
	}

	.org-landing__inner {
		max-width: 28rem;
		width: 100%;
		text-align: center;
	}

	.org-landing__title {
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 1.5rem;
		font-weight: 700;
		color: oklch(0.2 0.03 250);
		margin: 0 0 0.5rem;
	}

	.org-landing__sub {
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.9375rem;
		color: oklch(0.5 0.02 250);
		margin: 0 0 2rem;
		line-height: 1.5;
	}

	.org-landing__list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		text-align: left;
	}

	.org-landing__card {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.875rem 1rem;
		border-radius: 12px;
		border: 1px solid oklch(0.92 0.01 250);
		background: oklch(0.99 0.003 250);
		text-decoration: none;
		transition: all 150ms ease-out;
	}

	.org-landing__card:hover {
		border-color: oklch(0.8 0.04 180);
		background: oklch(0.98 0.008 180 / 0.5);
	}

	.org-landing__avatar {
		width: 2rem;
		height: 2rem;
		border-radius: 7px;
		object-fit: cover;
		flex-shrink: 0;
	}

	.org-landing__avatar--fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		background: oklch(0.92 0.06 180);
		color: oklch(0.4 0.12 180);
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.8125rem;
		font-weight: 600;
	}

	.org-landing__card-info {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
		flex: 1;
	}

	.org-landing__card-name {
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.875rem;
		font-weight: 600;
		color: oklch(0.25 0.02 250);
	}

	.org-landing__card-meta {
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.75rem;
		color: oklch(0.5 0.02 250);
		text-transform: capitalize;
	}

	.org-landing__arrow {
		font-size: 0.875rem;
		color: oklch(0.6 0.02 250);
		flex-shrink: 0;
		transition: transform 150ms ease-out;
	}

	.org-landing__card:hover .org-landing__arrow {
		transform: translateX(2px);
		color: oklch(0.45 0.08 180);
	}

	.org-landing__empty {
		padding: 2rem 0;
	}

	.org-landing__empty-text {
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.875rem;
		color: oklch(0.5 0.02 250);
		margin: 0 0 1.25rem;
	}

	.org-landing__cta {
		display: inline-block;
		padding: 0.625rem 1.25rem;
		border-radius: 8px;
		border: 1px solid oklch(0.8 0.04 180);
		background: oklch(0.97 0.01 180);
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.875rem;
		font-weight: 500;
		color: oklch(0.35 0.1 180);
		text-decoration: none;
		cursor: pointer;
		transition: all 150ms ease-out;
	}

	.org-landing__cta:hover {
		background: oklch(0.94 0.03 180);
		border-color: oklch(0.7 0.06 180);
	}

	.org-landing__cta:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Create link — subtle affordance below org list */
	.org-landing__create-link {
		display: inline-block;
		margin-top: 1.25rem;
		padding: 0;
		border: none;
		background: transparent;
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.8125rem;
		font-weight: 500;
		color: oklch(0.5 0.06 180);
		cursor: pointer;
		transition: color 150ms ease-out;
	}

	.org-landing__create-link:hover {
		color: oklch(0.38 0.1 180);
	}

	/* Creation form */
	.org-create {
		text-align: left;
	}

	.org-create__form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.25rem;
		border-radius: 12px;
		border: 1px solid oklch(0.88 0.04 180);
		background: oklch(0.985 0.005 180 / 0.5);
	}

	.org-create__label {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.org-create__label-text {
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.75rem;
		font-weight: 600;
		color: oklch(0.4 0.02 250);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.org-create__input {
		padding: 0.5rem 0.75rem;
		border-radius: 8px;
		border: 1px solid oklch(0.88 0.02 250);
		background: white;
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.875rem;
		color: oklch(0.2 0.02 250);
		outline: none;
		transition: border-color 150ms ease-out;
	}

	.org-create__input:focus {
		border-color: oklch(0.65 0.1 180);
	}

	.org-create__input::placeholder {
		color: oklch(0.7 0.01 250);
	}

	.org-create__slug-row {
		display: flex;
		align-items: center;
		gap: 0;
	}

	.org-create__slug-prefix {
		padding: 0.5rem 0 0.5rem 0.75rem;
		border-radius: 8px 0 0 8px;
		border: 1px solid oklch(0.88 0.02 250);
		border-right: none;
		background: oklch(0.96 0.005 250);
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.8125rem;
		color: oklch(0.5 0.02 250);
		user-select: none;
	}

	.org-create__input--slug {
		border-radius: 0 8px 8px 0;
		flex: 1;
		min-width: 0;
	}

	.org-create__error {
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.8125rem;
		color: oklch(0.5 0.15 25);
		margin: 0;
	}

	.org-create__actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		margin-top: 0.25rem;
	}

	.org-create__cancel {
		padding: 0.5rem 1rem;
		border: none;
		background: transparent;
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.8125rem;
		font-weight: 500;
		color: oklch(0.5 0.02 250);
		cursor: pointer;
		transition: color 150ms ease-out;
	}

	.org-create__cancel:hover {
		color: oklch(0.3 0.02 250);
	}
</style>
