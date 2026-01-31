<script lang="ts">
	/**
	 * StreamControls: Pause/resume and streaming indicator
	 *
	 * PERCEPTUAL ENGINEERING:
	 * - Pulse animation for streaming indicator (temporal rhythm)
	 * - Clear pause/resume button with icon state change
	 * - Minimal visual footprint (doesn't compete with content)
	 * - Optional speed control for power users
	 *
	 * ACCESSIBILITY:
	 * - Keyboard navigable buttons
	 * - ARIA labels for screen readers
	 * - Focus visible rings
	 * - Clear state indicators
	 */

	import { Pause, Play, Radio } from 'lucide-svelte';

	interface Props {
		streaming?: boolean;
		paused?: boolean;
		onpause?: () => void;
		onresume?: () => void;
		showspeedcontrol?: boolean;
	}

	let {
		streaming = false,
		paused = false,
		onpause,
		onresume,
		showspeedcontrol = false
	}: Props = $props();

	function handlePauseResume() {
		if (paused) {
			onresume?.();
		} else {
			onpause?.();
		}
	}
</script>

<div class="stream-controls flex items-center gap-3">
	<!-- Streaming indicator -->
	{#if streaming && !paused}
		<div
			class="streaming-indicator flex items-center gap-2 rounded-full bg-coord-route-solid/10 px-3 py-1.5"
			role="status"
			aria-live="polite"
		>
			<Radio class="h-3.5 w-3.5 animate-pulse text-coord-route-solid" strokeWidth={2} />
			<span class="text-xs font-medium text-coord-route-solid">Streaming</span>
		</div>
	{/if}

	<!-- Pause/Resume button -->
	{#if streaming}
		<button
			type="button"
			class="control-button group flex items-center gap-2 rounded-lg border border-surface-border
				bg-surface-base px-3 py-1.5 transition-all duration-150
				hover:bg-surface-raised hover:shadow-md
				focus:outline-none focus-visible:ring-2 focus-visible:ring-coord-route-solid/30 focus-visible:ring-offset-1"
			onclick={handlePauseResume}
			aria-label={paused ? 'Resume streaming' : 'Pause streaming'}
		>
			{#if paused}
				<Play class="h-4 w-4 text-coord-route-solid" strokeWidth={2} />
				<span class="text-sm font-medium text-text-secondary group-hover:text-text-primary"
					>Resume</span
				>
			{:else}
				<Pause class="h-4 w-4 text-text-secondary group-hover:text-text-primary" strokeWidth={2} />
				<span class="text-sm font-medium text-text-secondary group-hover:text-text-primary"
					>Pause</span
				>
			{/if}
		</button>
	{/if}

	<!-- Optional: Speed control (for future enhancement) -->
	{#if showspeedcontrol}
		<div class="speed-control flex items-center gap-2">
			<span class="text-xs text-text-tertiary">Speed:</span>
			<select
				class="rounded-md border border-surface-border bg-surface-base px-2 py-1 text-xs
					transition-colors duration-150
					hover:border-surface-border-strong
					focus:border-coord-route-solid focus:outline-none focus:ring-2 focus:ring-coord-route-solid/30"
			>
				<option value="0.5">0.5x</option>
				<option value="1" selected>1x</option>
				<option value="1.5">1.5x</option>
				<option value="2">2x</option>
			</select>
		</div>
	{/if}
</div>

<style>
	/* Pulse animation for streaming indicator */
	.streaming-indicator {
		animation: fadeIn 200ms ease-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	/* Hover lift for control button */
	.control-button:hover {
		transform: translateY(-1px);
	}

	.control-button:active {
		transform: translateY(0);
	}
</style>
