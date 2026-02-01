<!--
  DeliveryConfirmation.svelte

  Primary celebration UI for successful/partial delivery completion.

  Based on: docs/temp/CWC-FEEDBACK-REDESIGN.md (Section 6)

  Design Principles:
  - Make it feel like an accomplishment, not a status update
  - Lead with emotion before data
  - Different messaging based on outcome type
  - Celebrate partial success, don't emphasize failure

  ABSTRACTION (2026-02-01):
  - Supports generic legislatures via LegislatureConfig
  - Headlines pulled from config.headlines (success/partial/failure)
  - All celebration logic, spring physics, and visual design preserved
  - Outcome categorization logic unchanged
-->
<script lang="ts">
	import type { DeliverySummary, LegislatureConfig } from './delivery-types';
	import { LEGISLATURE_CONFIGS } from './delivery-types';
	import { CheckCircle2, AlertCircle, Info } from 'lucide-svelte';
	import { spring } from 'svelte/motion';
	import { onMount } from 'svelte';
	import Confetti from './Confetti.svelte';

	// ============================================================================
	// Props
	// ============================================================================

	interface Props {
		summary: DeliverySummary;
		/** Legislature configuration for headlines - defaults to US Congress */
		config?: LegislatureConfig;
	}

	let {
		summary,
		config = LEGISLATURE_CONFIGS.US_CONGRESS
	}: Props = $props();

	// ============================================================================
	// Computed State
	// ============================================================================

	/**
	 * Determine outcome category for messaging and styling
	 *
	 * Categories:
	 * - full-success: All offices reached
	 * - partial-with-unavailable: Some offices not accepting messages (not our fault)
	 * - partial-with-failure: Some deliveries failed (technical issues)
	 * - failure: No offices reached
	 */
	let outcomeType = $derived.by(() => {
		// Complete failure
		if (summary.delivered === 0) return 'failure';

		// Full success
		if (summary.delivered === summary.total) return 'full-success';

		// Partial success - determine if we have real failures or just unavailable
		if (summary.failed > 0) return 'partial-with-failure';

		return 'partial-with-unavailable';
	});

	/**
	 * Whether there are any unavailable offices (permanent condition)
	 */
	let hasUnavailable = $derived(summary.unavailable > 0);

	/**
	 * Primary headline based on outcome type
	 *
	 * ABSTRACTION: Headlines now sourced from LegislatureConfig
	 * This allows customization for different legislatures:
	 * - US Congress: "Your voice reached Congress"
	 * - UK Parliament: "Your message reached Parliament"
	 * - Canadian Parliament: "Your voice reached Parliament"
	 * - Australian Parliament: "Your message reached Parliament"
	 *
	 * Messaging strategy:
	 * - Full success: Celebratory and confident (config.headlines.success)
	 * - Partial with unavailable: Still positive, focus on success (config.headlines.success)
	 * - Partial with failure: Honest but not alarming (config.headlines.partial)
	 * - Complete failure: Direct and actionable (config.headlines.failure)
	 */
	let headline = $derived.by(() => {
		switch (outcomeType) {
			case 'full-success':
			case 'partial-with-unavailable':
				return config.headlines.success;
			case 'partial-with-failure':
				return config.headlines.partial;
			case 'failure':
				return config.headlines.failure;
		}
	});

	/**
	 * Secondary text with delivery counts
	 *
	 * NOTE: This remains generic (not legislature-specific) since it's
	 * quantitative rather than qualitative
	 */
	let subtext = $derived.by(() => {
		switch (outcomeType) {
			case 'full-success':
				return `All ${summary.total} ${summary.total === 1 ? 'office' : 'offices'} received your message`;
			case 'partial-with-unavailable':
				return `${summary.delivered} ${summary.delivered === 1 ? 'office' : 'offices'} received your message`;
			case 'partial-with-failure':
				return `${summary.delivered} of ${summary.total} offices reached`;
			case 'failure':
				return "We couldn't reach your representatives";
		}
	});

	/**
	 * Icon to display based on outcome
	 */
	let IconComponent = $derived.by(() => {
		switch (outcomeType) {
			case 'full-success':
			case 'partial-with-unavailable':
				return CheckCircle2;
			case 'partial-with-failure':
				return Info;
			case 'failure':
				return AlertCircle;
		}
	});

	/**
	 * CSS class for outcome-specific styling
	 */
	let outcomeClass = $derived.by(() => {
		switch (outcomeType) {
			case 'full-success':
			case 'partial-with-unavailable':
				return 'success';
			case 'partial-with-failure':
				return 'partial';
			case 'failure':
				return 'failure';
		}
	});

	// ============================================================================
	// Animation
	// ============================================================================

	/**
	 * Celebration pulse animation
	 * Uses spring physics for natural motion
	 *
	 * Spring parameters:
	 * - stiffness: 0.3 (gentle, not jarring)
	 * - damping: 0.6 (smooth deceleration)
	 *
	 * This creates a satisfying "bounce" that feels responsive without
	 * being distracting or childish
	 */
	let scale = spring(1, {
		stiffness: 0.3,
		damping: 0.6
	});

	/**
	 * Trigger celebration animation on mount
	 *
	 * Timeline:
	 * 0ms: Component mounts at scale 1
	 * ~50ms: Spring animates to scale 1.05
	 * 400ms: Spring returns to scale 1
	 * ~600ms: Spring settles completely
	 */
	onMount(() => {
		scale.set(1.05);
		setTimeout(() => scale.set(1), 400);
	});
</script>

<!-- ============================================================================
     Template
     ============================================================================ -->

<div
	class="confirmation-container outcome-{outcomeClass}"
	style="transform: scale({$scale})"
>
	<!-- Confetti for success outcomes -->
	{#if outcomeType === 'full-success' || outcomeType === 'partial-with-unavailable'}
		<Confetti count={32} />
	{/if}

	<!-- Success Icon -->
	<div class="icon-wrapper">
		<svelte:component this={IconComponent} size={48} strokeWidth={1.5} />
	</div>

	<!-- Headline (Emotional Confirmation) -->
	<h2 class="headline">
		{headline}
	</h2>

	<!-- Subtext (Quantified Outcome) -->
	<p class="subtext">
		{subtext}
	</p>

	<!-- Delivery Count Badge (Visual Emphasis) -->
	<div class="count-badge">
		<span class="count-delivered">{summary.delivered}</span>
		<span class="count-separator">/</span>
		<span class="count-total">{summary.total}</span>
	</div>
</div>

<!-- ============================================================================
     Styles
     ============================================================================ -->

<style>
	.confirmation-container {
		position: relative; /* For confetti overlay */
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-lg, 1.5rem);
		padding: var(--space-2xl, 3rem) var(--space-xl, 2rem);
		border-radius: 16px;
		transition: transform 400ms cubic-bezier(0.33, 1, 0.68, 1);
		will-change: transform;
		overflow: hidden; /* Contain confetti */
	}

	/* Outcome-specific backgrounds
	 *
	 * Design rationale:
	 * - Subtle gradients (not flat colors) for depth and visual interest
	 * - High lightness (L > 0.95) keeps it celebratory, not alarming
	 * - Low chroma maintains professionalism
	 * - Color psychology:
	 *   - Green: Success, progress, completion
	 *   - Yellow: Caution, attention (for partial)
	 *   - Red: Problem, requires action (for failure)
	 */
	.outcome-success {
		background: linear-gradient(
			135deg,
			oklch(0.97 0.02 145) 0%,   /* Green tint */
			oklch(0.98 0.01 250) 100%  /* Blue tint */
		);
	}

	.outcome-partial {
		background: linear-gradient(
			135deg,
			oklch(0.97 0.02 60) 0%,    /* Yellow tint */
			oklch(0.98 0.01 250) 100%  /* Blue tint */
		);
	}

	.outcome-failure {
		background: linear-gradient(
			135deg,
			oklch(0.97 0.02 25) 0%,    /* Red tint */
			oklch(0.98 0.01 250) 100%  /* Neutral tint */
		);
	}

	/* Icon Wrapper
	 *
	 * Design: Elevated white circle with shadow creates visual hierarchy
	 * and draws eye to the outcome status
	 */
	.icon-wrapper {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 80px;
		height: 80px;
		border-radius: 50%;
		background: white;
		box-shadow:
			0 2px 8px rgba(0, 0, 0, 0.08),
			0 8px 24px rgba(0, 0, 0, 0.06);
	}

	.outcome-success .icon-wrapper {
		color: oklch(0.70 0.17 145); /* Green */
	}

	.outcome-partial .icon-wrapper {
		color: oklch(0.65 0.15 60); /* Yellow-orange */
	}

	.outcome-failure .icon-wrapper {
		color: oklch(0.65 0.20 25); /* Red */
	}

	/* Typography
	 *
	 * Hierarchy:
	 * 1. Headline: Emotional, largest, darkest (primary attention)
	 * 2. Subtext: Contextual, medium, gray (supporting detail)
	 * 3. Count badge: Data, largest numbers, colored (visual anchor)
	 */
	.headline {
		font-size: var(--text-headline, 1.5rem);
		font-weight: 600;
		color: var(--text-primary, oklch(0.20 0.02 250));
		text-align: center;
		margin: 0;
		line-height: 1.3;
	}

	.subtext {
		font-size: var(--text-body, 1rem);
		color: var(--text-secondary, oklch(0.45 0.02 250));
		text-align: center;
		margin: 0;
		line-height: 1.5;
		max-width: 400px;
	}

	/* Count Badge
	 *
	 * Design: Large numbers use tabular-nums for consistent spacing
	 * Color coding reinforces outcome sentiment
	 */
	.count-badge {
		display: flex;
		align-items: baseline;
		gap: 0.25rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.count-delivered {
		font-size: var(--text-stat, 2.5rem);
		line-height: 1;
	}

	.outcome-success .count-delivered {
		color: oklch(0.70 0.17 145);
	}

	.outcome-partial .count-delivered {
		color: oklch(0.65 0.15 60);
	}

	.outcome-failure .count-delivered {
		color: oklch(0.65 0.20 25);
	}

	.count-separator {
		font-size: var(--text-headline, 1.5rem);
		color: var(--text-tertiary, oklch(0.60 0.01 250));
	}

	.count-total {
		font-size: var(--text-headline, 1.5rem);
		color: var(--text-secondary, oklch(0.45 0.02 250));
	}

	/* Responsive Design - Mobile
	 *
	 * Strategy: Scale down proportionally while maintaining visual hierarchy
	 * and ensuring touch targets remain accessible (min 44px)
	 */
	@media (max-width: 640px) {
		.confirmation-container {
			padding: var(--space-xl, 2rem) var(--space-lg, 1.5rem);
			gap: var(--space-md, 1rem);
		}

		.icon-wrapper {
			width: 64px;
			height: 64px;
		}

		.icon-wrapper :global(svg) {
			width: 36px;
			height: 36px;
		}

		.headline {
			font-size: 1.25rem;
		}

		.subtext {
			font-size: 0.9375rem;
			max-width: 100%;
		}

		.count-delivered {
			font-size: 2rem;
		}

		.count-separator,
		.count-total {
			font-size: 1.25rem;
		}
	}

	/* Responsive Design - Small phones
	 *
	 * Further reduction for very constrained viewports
	 */
	@media (max-width: 375px) {
		.confirmation-container {
			padding: var(--space-lg, 1.5rem) var(--space-md, 1rem);
			border-radius: 12px;
		}

		.icon-wrapper {
			width: 56px;
			height: 56px;
		}

		.icon-wrapper :global(svg) {
			width: 32px;
			height: 32px;
		}

		.headline {
			font-size: 1.125rem;
		}

		.count-delivered {
			font-size: 1.75rem;
		}

		.count-separator,
		.count-total {
			font-size: 1.125rem;
		}
	}

	/* Accessibility - Reduced Motion
	 *
	 * Respect user's motion preferences by disabling spring animation
	 * Component still functions, just without the celebratory pulse
	 */
	@media (prefers-reduced-motion: reduce) {
		.confirmation-container {
			transition: none;
		}
	}
</style>
