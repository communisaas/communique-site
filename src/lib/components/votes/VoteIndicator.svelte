<script lang="ts">
	/**
	 * VoteIndicator - L1 Peripheral Awareness Component
	 *
	 * Provides at-a-glance vote position recognition through color-coded badges.
	 * Designed for peripheral vision scanning in dense information displays.
	 *
	 * Color semantics follow established political UI patterns:
	 * - Green (Yea): Affirmative action, consistent with success states
	 * - Red (Nay): Negative action, consistent with rejection states
	 * - Gray (Not Voting): Neutral/inactive, low visual weight
	 * - Yellow (Present): Attention/awareness without commitment
	 *
	 * Accessibility: Relies on both color AND text label for WCAG compliance.
	 * Screen readers announce full position via aria-label.
	 */

	interface Props {
		position: 'yea' | 'nay' | 'not_voting' | 'present';
		size?: 'sm' | 'md';
		showLabel?: boolean;
	}

	let { position, size = 'sm', showLabel = false }: Props = $props();

	// Color-coded semantic variants with sufficient contrast ratios (WCAG AA)
	const variants = {
		yea: 'bg-emerald-50 text-emerald-700 border-emerald-300',
		nay: 'bg-red-50 text-red-700 border-red-300',
		not_voting: 'bg-gray-50 text-gray-600 border-gray-200',
		present: 'bg-amber-50 text-amber-700 border-amber-300'
	};

	const sizes = {
		sm: 'px-2 py-0.5 text-xs',
		md: 'px-3 py-1 text-sm'
	};

	// Human-readable labels
	const labels = {
		yea: 'Yea',
		nay: 'Nay',
		not_voting: 'Not Voting',
		present: 'Present'
	};

	// Full context for screen readers
	const ariaLabels = {
		yea: 'Voted in favor',
		nay: 'Voted against',
		not_voting: 'Did not vote',
		present: 'Voted present'
	};
</script>

<span
	class="inline-flex items-center rounded-full border font-medium transition-colors {variants[
		position
	]} {sizes[size]}"
	role="status"
	aria-label={ariaLabels[position]}
>
	{#if showLabel}
		{labels[position]}
	{:else}
		<!-- Minimal indicator dot for ultra-compact display -->
		<span class="sr-only">{labels[position]}</span>
		<span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"></span>
	{/if}
</span>
