<script lang="ts">
	import { onDestroy } from 'svelte';
	import { slide } from 'svelte/transition';

	/**
	 * ThinkingAtmosphere - Perceptual Engineering Component
	 *
	 * Displays streaming thoughts as a scannable research log.
	 * Left-justified for F-pattern reading. Accumulated to show progress.
	 *
	 * Perceptual principles:
	 * - Left-justified for natural scanning
	 * - Accumulated log shows research depth
	 * - Latest thought highlighted, older fade back
	 * - Compact container with subtle border
	 * - Auto-scroll to latest
	 *
	 * The goal: users see research happening in real-time,
	 * building confidence their issue is being analyzed.
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

	// Track active timeouts for cleanup
	let activeTimeouts: number[] = [];

	// Container ref for auto-scroll
	let containerRef: HTMLDivElement | null = $state(null);

	// Auto-scroll when new thoughts arrive
	// Wait for slide transition (150ms) to complete before scrolling
	$effect(() => {
		const thoughtCount = thoughts.length;
		if (thoughtCount > 0 && containerRef) {
			// Wait for slide transition to complete, then scroll
			const timeout = setTimeout(() => {
				containerRef?.scrollTo({
					top: containerRef.scrollHeight,
					behavior: 'smooth'
				});
			}, 160); // Slightly longer than transition duration (150ms)
			activeTimeouts.push(timeout);
		}
	});

	// Notify completion
	$effect(() => {
		if (!isActive && thoughts.length > 0 && onComplete) {
			const timeout = setTimeout(onComplete, 400);
			activeTimeouts.push(timeout);
		}
	});

	onDestroy(() => {
		activeTimeouts.forEach((timeout) => clearTimeout(timeout));
		activeTimeouts = [];
	});
</script>

{#if isActive || thoughts.length > 0}
	<div
		class="thinking-atmosphere"
		class:active={isActive}
		aria-live="polite"
		aria-label="AI thinking process"
	>
		<!-- Header with activity indicator -->
		<div class="header">
			{#if isActive}
				<span class="pulse" aria-hidden="true"></span>
			{/if}
			<span class="label">Analyzing...</span>
		</div>

		<!-- Thought log -->
		<div class="thought-log" bind:this={containerRef} role="log">
			{#each thoughts as thought, i (i)}
				<p
					class="thought"
					class:latest={i === thoughts.length - 1 && isActive}
					class:faded={i < thoughts.length - 1}
					transition:slide={{ duration: 150 }}
				>
					{thought}
				</p>
			{/each}

			{#if isActive && thoughts.length === 0}
				<p class="thought placeholder">Understanding your concern...</p>
			{/if}
		</div>
	</div>
{/if}

<style>
	.thinking-atmosphere {
		padding: 0.75rem;
		border-radius: 0.5rem;
		border: 1px solid #e2e8f0; /* slate-200 */
		background: #f8fafc; /* slate-50 */
	}

	.header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.pulse {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--color-participation-primary-500, #6366f1);
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 0.4;
		}
		50% {
			opacity: 1;
		}
	}

	.label {
		font-size: 0.75rem;
		font-weight: 500;
		color: #64748b; /* slate-500 */
	}

	.thought-log {
		max-height: 8rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.thought {
		font-size: 0.8125rem;
		line-height: 1.4;
		color: #334155; /* slate-700 */
		text-align: left;
		margin: 0;
		padding: 0.25rem 0.5rem;
		border-left: 2px solid transparent;
		transition: all 0.15s ease-out;
	}

	.thought.latest {
		color: #1e293b; /* slate-800 */
		border-left-color: var(--color-participation-primary-500, #6366f1);
		background: white;
	}

	.thought.faded {
		color: #64748b; /* slate-500 */
	}

	.thought.placeholder {
		color: #94a3b8; /* slate-400 */
		font-style: italic;
	}

	/* Scrollbar */
	.thought-log::-webkit-scrollbar {
		width: 3px;
	}

	.thought-log::-webkit-scrollbar-track {
		background: transparent;
	}

	.thought-log::-webkit-scrollbar-thumb {
		background: #e2e8f0;
		border-radius: 2px;
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.pulse {
			animation: none;
			opacity: 0.7;
		}
	}
</style>
