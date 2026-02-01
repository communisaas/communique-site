<script lang="ts">
	import { spring } from 'svelte/motion';

	/**
	 * DeliveryProgress.svelte
	 *
	 * Unified progress indicator for congressional office message delivery.
	 * Uses spring physics for smooth, natural-feeling animations.
	 *
	 * Design Principles:
	 * - Single unified progress bar (NOT per-office bars)
	 * - Smooth spring interpolation for professional feel
	 * - Color transition: blue during progress, green at completion
	 * - Clean, accessible, responsive
	 */

	interface Props {
		/** Current progress percentage (0-100) */
		progress: number;

		/** Current stage of delivery journey */
		stage: 'anticipating' | 'progressing' | 'complete';
	}

	let { progress, stage }: Props = $props();

	// ============================================================================
	// Animation State
	// ============================================================================

	/**
	 * Spring-animated progress value
	 * Provides smooth, physics-based interpolation between progress updates
	 *
	 * stiffness: 0.1 - Gentle acceleration (not too bouncy)
	 * damping: 0.8 - Smooth deceleration (slightly underdamped for natural feel)
	 */
	const smoothProgress = spring(0, {
		stiffness: 0.1,
		damping: 0.8,
	});

	// Update spring target when progress changes
	$effect(() => {
		smoothProgress.set(progress);
	});

	// ============================================================================
	// Derived State
	// ============================================================================

	/** Progress bar fill color - green when complete, blue otherwise */
	const progressColor = $derived(progress >= 100 ? 'bg-green-500' : 'bg-blue-500');

	/** Progress bar transition class - smooth color change at completion */
	const transitionClass = $derived(
		progress >= 100 ? 'transition-colors duration-300 ease-out' : '',
	);

	/** Status message based on current stage */
	const statusMessage = $derived.by(() => {
		switch (stage) {
			case 'anticipating':
				return 'Preparing your message...';
			case 'progressing':
				return 'Reaching your representatives...';
			case 'complete':
				return 'Delivery complete';
			default:
				return '';
		}
	});

	/** Accessibility label for progress bar */
	const ariaLabel = $derived(`Delivery progress: ${Math.round($smoothProgress)}%`);
</script>

<div class="progress-container" role="status" aria-label={ariaLabel} aria-live="polite">
	<!-- Progress Track -->
	<div class="progress-track">
		<!-- Progress Fill -->
		<div
			class="progress-fill {progressColor} {transitionClass}"
			style="width: {$smoothProgress}%"
			role="progressbar"
			aria-valuenow={Math.round($smoothProgress)}
			aria-valuemin={0}
			aria-valuemax={100}
		></div>
	</div>

	<!-- Status Label -->
	{#if statusMessage}
		<p class="progress-label">{statusMessage}</p>
	{/if}
</div>

<style>
	/* Container */
	.progress-container {
		display: flex;
		flex-direction: column;
		gap: 0.75rem; /* 12px */
		width: 100%;
	}

	/* Progress Track (Background) */
	.progress-track {
		position: relative;
		width: 100%;
		height: 0.5rem; /* 8px */
		background-color: oklch(0.95 0.01 250); /* Very light blue-gray */
		border-radius: 9999px; /* Fully rounded */
		overflow: hidden;
	}

	/* Progress Fill (Foreground) */
	.progress-fill {
		position: absolute;
		top: 0;
		left: 0;
		height: 100%;
		border-radius: 9999px; /* Fully rounded */
		transition: width 0ms; /* Width animated by spring, not CSS */
	}

	/* Status Label */
	.progress-label {
		font-size: 0.875rem; /* 14px */
		font-weight: 500;
		color: oklch(0.45 0.02 250); /* Medium gray-blue */
		text-align: center;
		line-height: 1.25rem; /* 20px */
		margin: 0;
	}

	/* Smooth color transitions */
	.progress-fill {
		transition-property: background-color;
		transition-timing-function: cubic-bezier(0.33, 1, 0.68, 1); /* Ease-out */
	}

	/* Accessibility: Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		.progress-fill {
			transition: none;
		}
	}

	/* Responsive: Larger progress bar on mobile for touch targets */
	@media (max-width: 640px) {
		.progress-track {
			height: 0.625rem; /* 10px */
		}

		.progress-label {
			font-size: 1rem; /* 16px */
		}
	}
</style>
