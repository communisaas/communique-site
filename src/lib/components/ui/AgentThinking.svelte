<script lang="ts">
	import { fade, slide } from 'svelte/transition';

	/**
	 * AgentThinking - Thought trace display
	 *
	 * Scrolls container to bottom when new thoughts arrive.
	 * Direct scrollTop manipulation - no scrollIntoView unreliability.
	 */

	interface Props {
		thoughts: string[];
		isActive: boolean;
		context?: string;
		compact?: boolean;
	}

	let { thoughts = [], isActive = false, context, compact = false }: Props = $props();

	// Container reference for direct scroll control
	let containerEl: HTMLDivElement | null = $state(null);

	/**
	 * Scroll container to bottom after thought transition ends.
	 * Uses rAF to ensure DOM has painted before measuring scrollHeight.
	 */
	function scrollToBottom() {
		requestAnimationFrame(() => {
			if (containerEl) {
				containerEl.scrollTop = containerEl.scrollHeight;
			}
		});
	}
</script>

{#if isActive || thoughts.length > 0}
	<div class="agent-thinking" class:compact role="status" aria-live="polite" aria-label="AI analysis in progress">
		<!-- Header: context + activity indicator -->
		<div class="header">
			{#if isActive}
				<span class="activity-pulse" aria-hidden="true"></span>
			{/if}
			{#if context}
				<span class="context">{context}</span>
			{/if}
		</div>

		<!-- Thought log - accumulated, scannable -->
		<div class="thought-log" role="log" bind:this={containerEl}>
			{#each thoughts as thought, i (i)}
				<p
					class="thought"
					class:latest={i === thoughts.length - 1 && isActive}
					class:faded={i < thoughts.length - 1}
					transition:slide={{ duration: 150 }}
					onintroend={scrollToBottom}
				>
					{thought}
				</p>
			{/each}

			{#if isActive && thoughts.length === 0}
				<p class="thought placeholder" transition:fade={{ duration: 200 }}>Researching...</p>
			{/if}
		</div>
	</div>
{/if}

<style>
	.agent-thinking {
		display: flex;
		flex-direction: column;
		min-height: 10rem;
		max-height: 16rem;
		padding: 1rem 0;
	}

	/* Header row */
	.header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
		padding-left: 0.25rem;
	}

	/* Subtle pulse - presence indicator */
	.activity-pulse {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--color-participation-primary-500, #6366f1);
		animation: pulse 1.5s ease-in-out infinite;
		flex-shrink: 0;
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

	/* Context label */
	.context {
		font-size: 0.75rem;
		font-weight: 500;
		letter-spacing: 0.02em;
		color: var(--color-participation-primary-600, #4f46e5);
		opacity: 0.7;
	}

	/* Thought log container */
	.thought-log {
		flex: 1;
		min-height: 0; /* Critical: allows flex item to shrink below content size */
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding-right: 0.5rem;
	}

	/* Individual thought - left-justified, scannable */
	.thought {
		font-size: 0.875rem;
		line-height: 1.5;
		color: #3730a3; /* indigo-800 */
		text-align: left;
		margin: 0;
		padding: 0.375rem 0.5rem;
		border-left: 2px solid transparent;
		transition: all 0.2s ease-out;
	}

	/* Latest thought - highlighted with tinted background */
	.thought.latest {
		color: #312e81; /* indigo-900 */
		border-left-color: var(--color-participation-primary-500, #6366f1);
		background: color-mix(in srgb, var(--color-participation-primary-100, #e0e7ff) 40%, transparent);
	}

	/* Older thoughts - faded back */
	.thought.faded {
		color: #6366f1; /* participation-primary-500 equivalent */
		opacity: 0.5;
	}

	.thought.placeholder {
		color: var(--color-participation-primary-400, #818cf8);
		font-style: italic;
	}

	/* Scrollbar styling */
	.thought-log::-webkit-scrollbar {
		width: 4px;
	}

	.thought-log::-webkit-scrollbar-track {
		background: transparent;
	}

	.thought-log::-webkit-scrollbar-thumb {
		background: var(--color-participation-primary-200, #c7d2fe);
		border-radius: 2px;
	}

	.thought-log::-webkit-scrollbar-thumb:hover {
		background: var(--color-participation-primary-300, #a5b4fc);
	}

	/* Compact mode — reduced height for split-view layout */
	.agent-thinking.compact {
		min-height: 4rem;
		max-height: 8rem;
		padding: 0.5rem 0;
	}

	.agent-thinking.compact .thought {
		font-size: 0.75rem;
		padding: 0.25rem 0.5rem;
	}

	.agent-thinking.compact .thought.faded {
		display: none;
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.activity-pulse {
			animation: none;
			opacity: 0.7;
		}
	}
</style>
