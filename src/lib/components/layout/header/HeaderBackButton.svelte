<script lang="ts">
	/**
	 * HeaderBackButton - Contextual back navigation
	 *
	 * Perceptual Engineering: Gestalt proximity + predictable interaction.
	 * Icon + text group together. Hover provides subtle motion feedback.
	 */
	import { ArrowLeft } from '@lucide/svelte';

	let {
		href = '/',
		label = 'Back'
	}: {
		href?: string;
		label?: string;
	} = $props();
</script>

<a {href} class="header-back" aria-label="Navigate back to {label}">
	<ArrowLeft class="header-back__icon" />
	<span class="header-back__label">{label}</span>
</a>

<style>
	.header-back {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		margin: -8px; /* Expand hit area beyond visual bounds */
		border-radius: 8px;
		text-decoration: none;
		color: var(--header-text-secondary);
		transition: all var(--header-transition-fast) var(--header-easing);
	}

	.header-back:hover {
		background: oklch(0.95 0.01 250);
		color: var(--header-text-primary);
	}

	.header-back:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--header-focus-ring);
	}

	.header-back__icon {
		width: 18px;
		height: 18px;
		flex-shrink: 0;
		transition: transform var(--header-transition-fast) var(--header-easing);
	}

	.header-back:hover .header-back__icon {
		transform: translateX(-2px);
	}

	.header-back__label {
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.875rem;
		font-weight: 500;
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.header-back,
		.header-back__icon {
			transition: none;
		}

		.header-back:hover .header-back__icon {
			transform: none;
		}
	}
</style>
