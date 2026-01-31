<script lang="ts">
	/**
	 * PhaseAmbient: Subtle ambient indicator for composite streaming phases
	 *
	 * PERCEPTUAL ENGINEERING:
	 * - Peripheral awareness: noticed but not focused on
	 * - Color temperature shifts communicate phase without demanding attention
	 * - Very low opacity (0.05-0.1) for ambient, non-distracting presence
	 * - Smooth transitions create sense of progression
	 *
	 * COLOR SEMANTICS:
	 * - Discovery: Warm amber (active exploration, energy)
	 * - Verification: Cool teal (cross-referencing, validation)
	 * - Complete: Calm green (finished, settled)
	 * - Degraded: Muted amber (fallback mode, still working)
	 * - Idle: No ambient effect (baseline state)
	 *
	 * USAGE:
	 * - Wrap content for gradient overlay effect
	 * - Or position absolutely within a relative container
	 */

	import type { Snippet } from 'svelte';

	type Phase = 'idle' | 'discovery' | 'verification' | 'complete' | 'degraded';

	interface Props {
		/** Current reasoning phase */
		phase: Phase;
		/** Content to wrap (optional - can be positioned absolutely) */
		children?: Snippet;
		/** Whether to use absolute positioning instead of wrapping */
		absolute?: boolean;
	}

	let { phase, children, absolute = false }: Props = $props();

	// Phase-specific CSS classes for styling
	const phaseClass = $derived(
		phase === 'idle' ? '' : `phase-ambient--${phase}`
	);

	// Whether ambient effect is active
	const isActive = $derived(phase !== 'idle');
</script>

{#if absolute}
	<!-- Absolute positioning mode: overlay within a relative container -->
	<div
		class="phase-ambient phase-ambient--absolute {phaseClass}"
		class:phase-ambient--active={isActive}
		aria-hidden="true"
	></div>
{:else}
	<!-- Wrapper mode: contains children with ambient effect -->
	<div
		class="phase-ambient phase-ambient--wrapper {phaseClass}"
		class:phase-ambient--active={isActive}
	>
		{#if children}
			{@render children()}
		{/if}
	</div>
{/if}

<style>
	/* === PHASE COLOR TOKENS === */
	.phase-ambient {
		--phase-discovery: oklch(0.85 0.08 85);    /* Warm amber-cream */
		--phase-verification: oklch(0.85 0.06 200); /* Cool teal-grey */
		--phase-complete: oklch(0.85 0.06 145);    /* Calm green-grey */
		--phase-degraded: oklch(0.85 0.04 60);     /* Muted amber */

		/* Current phase color - defaults to transparent */
		--current-phase-color: transparent;

		/* Transition timing */
		--phase-transition: 300ms ease-out;
	}

	/* === BASE STYLES === */
	.phase-ambient--wrapper {
		position: relative;
		isolation: isolate;
	}

	.phase-ambient--wrapper::before {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 0;
		border-radius: inherit;

		/* Gradient from top edge, fading down */
		background: linear-gradient(
			to bottom,
			var(--current-phase-color) 0%,
			transparent 40%
		);
		opacity: 0;
		transition:
			opacity var(--phase-transition),
			background var(--phase-transition);
	}

	.phase-ambient--wrapper > :global(*) {
		position: relative;
		z-index: 1;
	}

	.phase-ambient--absolute {
		position: absolute;
		inset: 0;
		pointer-events: none;
		border-radius: inherit;

		/* Radial gradient from top corners for soft glow effect */
		background:
			radial-gradient(
				ellipse 80% 50% at 10% 0%,
				var(--current-phase-color) 0%,
				transparent 70%
			),
			radial-gradient(
				ellipse 80% 50% at 90% 0%,
				var(--current-phase-color) 0%,
				transparent 70%
			);
		opacity: 0;
		transition:
			opacity var(--phase-transition),
			background var(--phase-transition);
	}

	/* === ACTIVE STATE === */
	.phase-ambient--active.phase-ambient--wrapper::before,
	.phase-ambient--active.phase-ambient--absolute {
		opacity: 0.08;
	}

	/* === PHASE-SPECIFIC COLORS === */
	.phase-ambient--discovery {
		--current-phase-color: var(--phase-discovery);
	}

	.phase-ambient--verification {
		--current-phase-color: var(--phase-verification);
	}

	.phase-ambient--complete {
		--current-phase-color: var(--phase-complete);
	}

	.phase-ambient--degraded {
		--current-phase-color: var(--phase-degraded);
	}

	/* === REDUCED MOTION === */
	@media (prefers-reduced-motion: reduce) {
		.phase-ambient {
			--phase-transition: 0ms;
		}

		.phase-ambient--wrapper::before,
		.phase-ambient--absolute {
			transition: none;
		}
	}
</style>
