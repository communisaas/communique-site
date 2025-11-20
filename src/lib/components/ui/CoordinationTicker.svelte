<script lang="ts">
	/**
	 * CoordinationTicker - Animated count display for coordination signals
	 *
	 * Showcases dual-font typography system + dopamine-pushing spring physics
	 *
	 * Design Principles:
	 * - JetBrains Mono for count (data/metrics)
	 * - Satoshi for label (brand/words)
	 * - Spring animation for organic, physics-based motion
	 * - GPU-accelerated (transform only, no layout shifts)
	 * - Accessible (respects prefers-reduced-motion)
	 *
	 * Usage:
	 * ```svelte
	 * <CoordinationTicker count={1247} label="sent this" />
	 * <CoordinationTicker count={47} label="coordinating" size="large" emphasize />
	 * ```
	 */

	import { spring } from 'svelte/motion';
	import { onMount } from 'svelte';

	interface CoordinationTickerProps {
		/** Current count value */
		count: number;

		/** Label text (e.g., "sent this", "coordinating", "active") */
		label?: string;

		/** Size variant */
		size?: 'small' | 'medium' | 'large';

		/** Emphasize with accent color + pulse animation */
		emphasize?: boolean;

		/** Disable animation (respects user preference) */
		reduceMotion?: boolean;
	}

	let {
		count = 0,
		label = 'coordinating',
		size = 'medium',
		emphasize = false,
		reduceMotion = false
	}: CoordinationTickerProps = $props();

	// Spring physics for smooth, organic count animation
	// Slower stiffness = more bounce/overshoot (dopamine-pushing!)
	// Higher damping = less oscillation (maintains credibility)
	let displayCount = spring(count, {
		stiffness: 0.15, // Slow spring creates satisfying bounce
		damping: 0.6 // Moderate damping for 1-2 oscillations
	});

	// Scale animation for emphasis on count change
	let scale = spring(1, {
		stiffness: 0.3,
		damping: 0.7
	});

	// Update display count when prop changes
	$effect(() => {
		displayCount.set(count);

		// Bounce scale on count increase (dopamine trigger!)
		if (!reduceMotion && emphasize) {
			scale.set(1.15);
			setTimeout(() => scale.set(1), 100);
		}
	});

	// Detect user's motion preference
	let prefersReducedMotion = $state(false);

	onMount(() => {
		const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		prefersReducedMotion = mediaQuery.matches;

		const handleChange = (e: MediaQueryListEvent) => {
			prefersReducedMotion = e.matches;
		};

		mediaQuery.addEventListener('change', handleChange);
		return () => mediaQuery.removeEventListener('change', handleChange);
	});

	// Size configuration
	const sizeClasses = {
		small: {
			count: 'text-lg', // 18px
			label: 'text-xs' // 12px
		},
		medium: {
			count: 'text-2xl', // 24px
			label: 'text-sm' // 14px
		},
		large: {
			count: 'text-4xl', // 36px
			label: 'text-base' // 16px
		}
	};

	// Color configuration
	const colorClasses = emphasize
		? 'text-violet-600' // Accent color for emphasis
		: 'text-slate-900'; // Standard primary text

	const labelColorClasses = emphasize
		? 'text-violet-600' // Match count color when emphasized
		: 'text-slate-600'; // Standard secondary text

	// Animation configuration
	const shouldAnimate = !reduceMotion && !prefersReducedMotion;

	// Pulse animation for emphasized state
	const pulseClasses = emphasize && shouldAnimate ? 'animate-pulse' : '';
</script>

<div
	class="inline-flex items-baseline gap-1.5"
	role="status"
	aria-live="polite"
	aria-label="{Math.floor($displayCount)} {label}"
>
	<!-- Count: JetBrains Mono with spring animation -->
	<span
		class="font-mono {sizeClasses[size].count} font-bold tabular-nums {colorClasses} {pulseClasses}"
		style="transform: scale({shouldAnimate ? $scale : 1}); transform-origin: center bottom;"
	>
		{Math.floor($displayCount).toLocaleString()}
	</span>

	<!-- Label: Satoshi for brand voice -->
	{#if label}
		<span class="font-brand {sizeClasses[size].label} font-medium {labelColorClasses}">
			{label}
		</span>
	{/if}
</div>

<style>
	/* Ensure GPU acceleration for smooth animation */
	span {
		will-change: transform;
	}

	/* Override pulse animation when motion should be reduced */
	@media (prefers-reduced-motion: reduce) {
		.animate-pulse {
			animation: none;
		}

		span {
			will-change: auto;
			transform: none !important;
		}
	}
</style>
