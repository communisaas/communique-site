<script lang="ts">
	import type { PageData } from './$types';
	import { modalActions } from '$lib/stores/modalSystem.svelte';

	let { data }: { data: PageData } = $props();

	const user = $derived(data.user);
	const orgs = $derived(user?.orgMemberships ?? []);

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
		{:else if user}
			<!-- Authenticated but no orgs -->
			<div class="org-landing__empty">
				<p class="org-landing__empty-text">
					No organizations yet.
				</p>
				<a href="mailto:hello@commons.email?subject=Organizations" class="org-landing__cta">
					Get in touch
				</a>
			</div>
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
</style>
