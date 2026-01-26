<script lang="ts">
	import { onDestroy } from 'svelte';

	/**
	 * ThinkingAtmosphere - Perceptual Engineering Component
	 *
	 * Displays streaming thoughts from an AI agent as an atmospheric presence,
	 * not a log. Thoughts fade in and out, building anticipation toward a result.
	 *
	 * Perceptual principles:
	 * - Single thought visible (replaces, doesn't accumulate)
	 * - Soft transitions (300ms fade)
	 * - Subtle life indicator (breathing animation)
	 * - No container (floats in space)
	 * - Typography that breathes (lighter weight, muted)
	 *
	 * The goal: users feel the agent "thinking with them", building trust
	 * that their issue is being carefully considered.
	 */

	let {
		thoughts = [],
		isActive = false,
		onComplete
	}: {
		thoughts: string[];
		isActive: boolean;
		onComplete?: () => void;
	} = $props();

	// Track which thought is currently displayed
	let displayedThoughtIndex = $state(-1);
	let isTransitioning = $state(false);
	let opacity = $state(0);

	// Track active timeouts for cleanup
	let activeTimeouts: number[] = [];

	// Current thought with fade logic
	const currentThought = $derived(
		displayedThoughtIndex >= 0 && displayedThoughtIndex < thoughts.length
			? thoughts[displayedThoughtIndex]
			: null
	);

	// When new thoughts arrive, transition to show them
	$effect(() => {
		if (thoughts.length > 0 && thoughts.length - 1 > displayedThoughtIndex) {
			transitionToThought(thoughts.length - 1);
		}
	});

	// When generation completes, fade out
	$effect(() => {
		if (!isActive && currentThought) {
			// Fade out the last thought
			const timeout1 = setTimeout(() => {
				opacity = 0;
				const timeout2 = setTimeout(() => {
					if (onComplete) onComplete();
				}, 300);
				activeTimeouts.push(timeout2);
			}, 800); // Hold the last thought briefly
			activeTimeouts.push(timeout1);
		}
	});

	async function transitionToThought(index: number) {
		if (isTransitioning) return;
		isTransitioning = true;

		// If there's a current thought, fade it out first
		if (currentThought) {
			opacity = 0;
			await sleep(200);
		}

		// Update to new thought
		displayedThoughtIndex = index;

		// Fade in new thought
		await sleep(50); // Small delay for DOM update
		opacity = 1;

		isTransitioning = false;
	}

	function sleep(ms: number): Promise<void> {
		return new Promise((resolve) => {
			const timeout = setTimeout(resolve, ms);
			activeTimeouts.push(timeout);
		});
	}

	onDestroy(() => {
		// Clear all active timeouts
		activeTimeouts.forEach((timeout) => clearTimeout(timeout));
		activeTimeouts = [];
	});
</script>

{#if isActive || currentThought}
	<div
		class="thinking-atmosphere"
		class:active={isActive}
		aria-live="polite"
		aria-label="AI thinking process"
	>
		<!-- Subtle progress indicator -->
		<div class="progress-dots" class:visible={isActive}>
			<span class="dot"></span>
			<span class="dot"></span>
			<span class="dot"></span>
		</div>

		<!-- Thought content with fade -->
		{#if currentThought}
			<p class="thought" style="opacity: {opacity}">
				{currentThought}
			</p>
		{:else if isActive}
			<p class="thought thought-placeholder" style="opacity: 0.4">Understanding your concern...</p>
		{/if}
	</div>
{/if}

<style>
	.thinking-atmosphere {
		position: relative;
		padding: 1rem 0;
		min-height: 3rem;
	}

	/* Progress dots - subtle indicator of activity */
	.progress-dots {
		display: flex;
		gap: 0.375rem;
		justify-content: center;
		margin-bottom: 0.75rem;
		opacity: 0;
		transition: opacity 0.3s ease;
	}

	.progress-dots.visible {
		opacity: 1;
	}

	.dot {
		width: 0.375rem;
		height: 0.375rem;
		border-radius: 50%;
		background: var(--color-participation-primary-400, #818cf8);
		opacity: 0.4;
		animation: pulse 1.4s ease-in-out infinite;
	}

	.dot:nth-child(2) {
		animation-delay: 0.2s;
	}

	.dot:nth-child(3) {
		animation-delay: 0.4s;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 0.3;
			transform: scale(0.9);
		}
		50% {
			opacity: 0.8;
			transform: scale(1.1);
		}
	}

	/* Thought text - atmospheric, not clinical */
	.thought {
		font-size: 0.875rem;
		line-height: 1.5;
		color: #64748b; /* slate-500 - muted but readable */
		font-style: italic;
		text-align: center;
		max-width: 32rem;
		margin: 0 auto;
		transition:
			opacity 0.3s ease-out,
			transform 0.3s ease-out;
		/* Subtle breathing animation */
		animation: breathe 4s ease-in-out infinite;
	}

	.thought-placeholder {
		animation: none;
	}

	@keyframes breathe {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-2px);
		}
	}

	/* Active state - slightly more prominent */
	.thinking-atmosphere.active .thought {
		color: #475569; /* slate-600 - slightly more prominent when active */
	}

	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		.dot {
			animation: none;
			opacity: 0.6;
		}

		.thought {
			animation: none;
		}
	}
</style>
