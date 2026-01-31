<script lang="ts">
	/**
	 * ConfidenceIndicator: Visual confidence level for composite streaming
	 *
	 * PERCEPTUAL ENGINEERING:
	 * - 3 dots that fill based on confidence thresholds (peripheral perception)
	 * - Users notice pattern without focal attention: ●○○ → ●●○ → ●●●
	 * - Smooth transitions (200ms ease-out) for confidence changes
	 * - Color progression from low → medium → high confidence
	 * - Optional checkmark overlay when verified (trust signal)
	 *
	 * CONFIDENCE MODEL:
	 * - Base confidence 0.4 (discovery phase)
	 * - +0.15 per verification step
	 * - Thresholds: 0.33 (1 dot), 0.66 (2 dots), 1.0 (3 dots)
	 *
	 * ACCESSIBILITY:
	 * - aria-label describes current confidence level
	 * - role="meter" with aria-valuenow/min/max for screen readers
	 */

	interface Props {
		/** Confidence value from 0 to 1 */
		confidence: number;
		/** Shows checkmark overlay when verification complete */
		verified?: boolean;
		/** Size variant for inline vs standalone use */
		size?: 'sm' | 'md';
	}

	let { confidence, verified = false, size = 'sm' }: Props = $props();

	// Confidence thresholds for dot filling
	const THRESHOLDS = [0.33, 0.66, 1.0] as const;

	// Compute filled dots based on confidence
	const filledDots = $derived(
		THRESHOLDS.map((threshold) => confidence >= threshold)
	);

	// Compute overall confidence level for color and aria
	const confidenceLevel = $derived(
		confidence >= 0.66 ? 'high' : confidence >= 0.33 ? 'medium' : 'low'
	);

	// Human-readable confidence description for accessibility
	const confidenceLabel = $derived(
		verified
			? `Verified, ${Math.round(confidence * 100)}% confidence`
			: `${confidenceLevel} confidence, ${Math.round(confidence * 100)}%`
	);

	// Size classes
	const sizeClasses = {
		sm: {
			container: 'gap-0.5',
			dot: 'h-1.5 w-1.5',
			checkmark: 'h-3 w-3 -right-1 -top-1'
		},
		md: {
			container: 'gap-1',
			dot: 'h-2 w-2',
			checkmark: 'h-4 w-4 -right-1.5 -top-1.5'
		}
	} as const;

	const currentSize = $derived(sizeClasses[size]);
</script>

<div
	class="confidence-indicator inline-flex items-center {currentSize.container} relative"
	role="meter"
	aria-valuenow={Math.round(confidence * 100)}
	aria-valuemin={0}
	aria-valuemax={100}
	aria-label={confidenceLabel}
	data-confidence-level={confidenceLevel}
	data-verified={verified || undefined}
>
	{#each [0, 1, 2] as index}
		<span
			class="confidence-dot rounded-full transition-all duration-200 ease-out {currentSize.dot}"
			class:filled={filledDots[index]}
			class:confidence-low={filledDots[index] && confidenceLevel === 'low'}
			class:confidence-medium={filledDots[index] && confidenceLevel === 'medium'}
			class:confidence-high={filledDots[index] && confidenceLevel === 'high'}
			aria-hidden="true"
		></span>
	{/each}

	<!-- Verified checkmark overlay -->
	{#if verified}
		<span
			class="verified-checkmark absolute {currentSize.checkmark} flex items-center justify-center rounded-full bg-emerald-500 text-white"
			aria-hidden="true"
		>
			<svg
				viewBox="0 0 16 16"
				fill="currentColor"
				class="h-2/3 w-2/3"
			>
				<path
					fill-rule="evenodd"
					d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z"
					clip-rule="evenodd"
				/>
			</svg>
		</span>
	{/if}
</div>

<style>
	/*
	 * Confidence Color Tokens
	 * Using existing design system colors semantically:
	 * - Low: Warning/caution (amber)
	 * - Medium: Info/progress (indigo)
	 * - High: Success/verified (emerald)
	 */
	.confidence-indicator {
		--confidence-low: var(--status-warning-500, #f59e0b);
		--confidence-medium: var(--participation-primary-500, #6366f1);
		--confidence-high: var(--channel-verified-500, #10b981);
		--confidence-empty: var(--surface-border, oklch(0.9 0.008 60 / 0.8));
	}

	/* Base dot state (empty) */
	.confidence-dot {
		background-color: var(--confidence-empty);
		opacity: 0.4;
	}

	/* Filled dot states with color progression */
	.confidence-dot.filled {
		opacity: 1;
	}

	.confidence-dot.confidence-low {
		background-color: var(--confidence-low);
	}

	.confidence-dot.confidence-medium {
		background-color: var(--confidence-medium);
	}

	.confidence-dot.confidence-high {
		background-color: var(--confidence-high);
	}

	/* Verified checkmark entrance animation */
	.verified-checkmark {
		animation: checkmarkPop 300ms ease-out;
	}

	@keyframes checkmarkPop {
		0% {
			transform: scale(0);
			opacity: 0;
		}
		50% {
			transform: scale(1.2);
		}
		100% {
			transform: scale(1);
			opacity: 1;
		}
	}

	/* Dark mode support */
	:global(.dark) .confidence-indicator {
		--confidence-empty: oklch(0.4 0.01 60 / 0.5);
	}

	:global(.dark) .confidence-dot:not(.filled) {
		opacity: 0.3;
	}
</style>
