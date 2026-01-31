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
	}

	let { thoughts = [], isActive = false, context }: Props = $props();

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
	<div class="agent-thinking" role="status" aria-live="polite" aria-label="AI analysis in progress">
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
		color: #64748b; /* slate-500 */
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
		color: #334155; /* slate-700 */
		text-align: left;
		margin: 0;
		padding: 0.375rem 0.5rem;
		border-left: 2px solid transparent;
		transition: all 0.2s ease-out;
	}

	/* Latest thought - highlighted */
	.thought.latest {
		color: #1e293b; /* slate-800 */
		border-left-color: var(--color-participation-primary-500, #6366f1);
		background: #f8fafc; /* slate-50 */
	}

	/* Older thoughts - faded back */
	.thought.faded {
		color: #64748b; /* slate-500 */
	}

	.thought.placeholder {
		color: #94a3b8; /* slate-400 */
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
		background: #e2e8f0; /* slate-200 */
		border-radius: 2px;
	}

	.thought-log::-webkit-scrollbar-thumb:hover {
		background: #cbd5e1; /* slate-300 */
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.activity-pulse {
			animation: none;
			opacity: 0.7;
		}
	}
</style>
