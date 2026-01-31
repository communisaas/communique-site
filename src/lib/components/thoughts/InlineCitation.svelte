<script lang="ts">
	/**
	 * InlineCitation: Clickable source reference within thought content
	 *
	 * PERCEPTUAL ENGINEERING:
	 * - Subtle dotted underline signals clickability without distraction
	 * - Hover state provides brief preview (tooltip)
	 * - Click emits event for progressive disclosure in DetailDrawer
	 * - Color matches coordination graph aesthetic (teal for routes)
	 *
	 * ACCESSIBILITY:
	 * - Keyboard navigable (tab to focus, enter/space to activate)
	 * - ARIA attributes for screen readers
	 * - Semantic button element for interaction
	 * - Focus ring visible for keyboard users
	 */

	import type { Citation } from '$lib/core/thoughts/types';

	interface Props {
		citation: Citation;
		onclick?: (citation: Citation) => void;
	}

	let { citation, onclick }: Props = $props();

	// Truncate excerpt for tooltip preview
	const previewExcerpt = $derived(
		citation.excerpt.length > 100 ? citation.excerpt.slice(0, 100) + '...' : citation.excerpt
	);

	function handleClick() {
		onclick?.(citation);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleClick();
		}
	}
</script>

<button
	type="button"
	class="inline-citation group relative inline-flex cursor-pointer items-baseline
		border-b border-dotted border-coord-route-solid/50
		text-coord-route-solid transition-all duration-150
		hover:border-solid hover:border-coord-route-solid
		focus:outline-none focus-visible:ring-2 focus-visible:ring-coord-route-solid/30 focus-visible:ring-offset-1"
	onclick={handleClick}
	onkeydown={handleKeydown}
	aria-label={`Citation: ${citation.label}`}
	aria-describedby={`citation-preview-${citation.id}`}
	role="button"
	tabindex={0}
>
	<!-- Citation label -->
	<span class="inline-citation-label text-sm font-medium">
		{citation.label}
	</span>

	<!-- Tooltip preview (appears on hover) -->
	<span
		id="citation-preview-{citation.id}"
		class="citation-tooltip pointer-events-none absolute bottom-full left-0 z-50 mb-2 hidden
			max-w-xs rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-xs
			text-text-secondary shadow-lg group-hover:block"
		role="tooltip"
	>
		<span class="block font-medium text-text-primary">{citation.label}</span>
		<span class="mt-1 block italic text-text-tertiary">"{previewExcerpt}"</span>
		<span class="mt-1 block text-[10px] text-text-quaternary">Click to explore source</span>

		<!-- Tooltip arrow -->
		<svg
			class="absolute left-4 top-full h-2 w-4 text-surface-overlay"
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 16 8"
		>
			<path fill="currentColor" d="M0,0 L8,8 L16,0 Z" />
		</svg>
	</span>
</button>

<style>
	/* Smooth transition for underline effect */
	.inline-citation {
		background-image: linear-gradient(
			to right,
			var(--coord-route-solid) 0%,
			var(--coord-route-solid) 100%
		);
		background-size: 0% 1px;
		background-position: left bottom;
		background-repeat: no-repeat;
		transition:
			background-size 200ms ease,
			border-color 150ms ease;
	}

	.inline-citation:hover {
		background-size: 100% 1px;
	}

	/* Tooltip positioning and animation */
	.citation-tooltip {
		animation: fadeIn 150ms ease-out;
		white-space: normal;
		word-break: break-word;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Ensure tooltip doesn't overflow viewport */
	.citation-tooltip {
		left: 50%;
		transform: translateX(-50%);
	}
</style>
