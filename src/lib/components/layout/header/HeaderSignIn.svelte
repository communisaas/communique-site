<script lang="ts">
	/**
	 * HeaderSignIn - Authentication pill for anonymous users
	 *
	 * Perceptual Engineering: Non-intrusive auth option.
	 * Visually lighter than CTAs. Doesn't demand attention.
	 */
	import SignInModal from '$lib/components/modals/SignInModal.svelte';

	let authModal: SignInModal;

	function handleSignIn(): void {
		authModal.open();
	}
</script>

<button class="header-signin" onclick={handleSignIn} aria-label="Sign in to your account">
	<span>Sign in</span>
</button>

<SignInModal bind:this={authModal} />

<style>
	.header-signin {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 8px 16px;
		border-radius: 20px;
		background: oklch(0.95 0.01 250);
		border: 1px solid var(--header-border);
		cursor: pointer;
		transition: all var(--header-transition-fast) var(--header-easing);
	}

	.header-signin span {
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--header-text-secondary);
	}

	.header-signin:hover {
		background: oklch(1 0 0 / 0.9);
		border-color: oklch(0.75 0.02 250);
		box-shadow: 0 2px 8px oklch(0 0 0 / 0.08);
		transform: translateY(-1px);
	}

	.header-signin:hover span {
		color: var(--header-text-primary);
	}

	.header-signin:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--header-focus-ring);
	}

	.header-signin:active {
		transform: translateY(0);
		box-shadow: 0 1px 4px oklch(0 0 0 / 0.06);
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.header-signin {
			transition: none;
		}

		.header-signin:hover {
			transform: none;
		}
	}
</style>
