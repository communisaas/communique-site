<script lang="ts">
	/**
	 * HeaderAvatar - User identity with dropdown menu
	 *
	 * Perceptual Engineering: Avatar IS identity confirmation.
	 * No verbose "Welcome back, X!" - the avatar speaks for itself.
	 * Dropdown reveals secondary actions only on demand.
	 */
	import { User, LogOut, ChevronDown } from '@lucide/svelte';
	import type { HeaderUser } from '$lib/types/any-replacements';
	import { performLogout } from '$lib/core/identity/cache-invalidation';

	let { user }: { user: HeaderUser } = $props();

	// Handle logout with cache clearing
	async function handleLogout(event: MouseEvent): Promise<void> {
		event.preventDefault();
		isOpen = false;
		await performLogout();
	}

	let isOpen = $state(false);
	let dropdownRef = $state<HTMLDivElement | null>(null);

	// Close dropdown when clicking outside
	function handleClickOutside(event: MouseEvent): void {
		if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
			isOpen = false;
		}
	}

	// Close on Escape
	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape' && isOpen) {
			isOpen = false;
		}
	}

	// Toggle dropdown
	function toggleDropdown(): void {
		isOpen = !isOpen;
	}

	// Attach/detach event listeners
	$effect(() => {
		if (isOpen) {
			document.addEventListener('click', handleClickOutside);
			document.addEventListener('keydown', handleKeydown);
		}
		return () => {
			document.removeEventListener('click', handleClickOutside);
			document.removeEventListener('keydown', handleKeydown);
		};
	});

	// Extract first name for display
	const firstName = $derived(user.name?.split(' ')[0] ?? 'User');

	// Generate initials for fallback avatar
	const initials = $derived.by(() => {
		if (!user.name) return 'U';
		const parts = user.name.split(' ');
		if (parts.length >= 2) {
			return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
		}
		return parts[0][0]?.toUpperCase() ?? 'U';
	});
</script>

<div class="header-avatar-container" bind:this={dropdownRef}>
	<button
		class="header-avatar-button"
		onclick={toggleDropdown}
		aria-expanded={isOpen}
		aria-haspopup="menu"
		aria-label="Account menu for {firstName}"
	>
		{#if user.picture}
			<img src={user.picture} alt="" class="header-avatar" />
		{:else}
			<div class="header-avatar header-avatar--fallback">
				{initials}
			</div>
		{/if}
		<span class="header-avatar-name">{firstName}</span>
		<ChevronDown class="header-avatar-chevron" />
	</button>

	{#if isOpen}
		<div class="header-dropdown" role="menu" aria-label="Account options">
			<a href="/profile" class="header-dropdown-item" role="menuitem">
				<User class="header-dropdown-item-icon" />
				<span>Profile</span>
			</a>
			<div class="header-dropdown-divider"></div>
			<button type="button" onclick={handleLogout} class="header-dropdown-item" role="menuitem">
				<LogOut class="header-dropdown-item-icon" />
				<span>Sign out</span>
			</button>
		</div>
	{/if}
</div>

<style>
	.header-avatar-container {
		position: relative;
	}

	.header-avatar-button {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 8px 4px 4px;
		border-radius: 24px;
		background: transparent;
		border: 1px solid transparent;
		cursor: pointer;
		transition: all var(--header-transition-fast) var(--header-easing);
	}

	.header-avatar-button:hover {
		background: oklch(0.95 0.01 250);
		border-color: var(--header-border);
	}

	.header-avatar-button[aria-expanded='true'] {
		background: oklch(0.95 0.01 250);
		border-color: var(--header-border);
	}

	.header-avatar-button:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--header-focus-ring);
	}

	.header-avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: 1.5px solid oklch(0.7 0.02 260);
		object-fit: cover;
		flex-shrink: 0;
	}

	.header-avatar--fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		background: oklch(0.92 0.02 250);
		color: var(--header-text-secondary);
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.header-avatar-name {
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--header-text-primary);
	}

	/* Hide name on very small screens */
	@media (max-width: 400px) {
		.header-avatar-name {
			display: none;
		}
	}

	.header-avatar-button :global(.header-avatar-chevron) {
		width: 16px;
		height: 16px;
		color: var(--header-text-muted);
		transition: transform var(--header-transition-fast) var(--header-easing);
	}

	.header-avatar-button[aria-expanded='true'] :global(.header-avatar-chevron) {
		transform: rotate(180deg);
	}

	/* Dropdown menu */
	.header-dropdown {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		min-width: 180px;
		padding: 6px;
		background: oklch(1 0 0 / 0.98);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border: 1px solid var(--header-border);
		border-radius: 12px;
		box-shadow:
			0 4px 6px oklch(0 0 0 / 0.05),
			0 10px 24px oklch(0 0 0 / 0.1);

		transform-origin: top right;
		animation: dropdown-enter 150ms var(--header-easing);
	}

	@keyframes dropdown-enter {
		from {
			opacity: 0;
			transform: scale(0.95) translateY(-4px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	.header-dropdown-item {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 10px 12px;
		border-radius: 8px;
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.875rem;
		color: var(--header-text-secondary);
		text-decoration: none;
		transition: all 100ms ease-out;
	}

	.header-dropdown-item:hover {
		background: oklch(0.95 0.01 250);
		color: var(--header-text-primary);
	}

	.header-dropdown-item:focus-visible {
		outline: none;
		background: oklch(0.95 0.01 250);
		color: var(--header-text-primary);
	}

	.header-dropdown-item :global(.header-dropdown-item-icon) {
		width: 18px;
		height: 18px;
		opacity: 0.7;
		flex-shrink: 0;
	}

	.header-dropdown-divider {
		height: 1px;
		margin: 6px 0;
		background: var(--header-border);
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.header-dropdown {
			animation: none;
		}

		.header-avatar-button {
			transition: none;
		}

		.header-avatar-button :global(.header-avatar-chevron) {
			transition: none;
		}
	}
</style>
