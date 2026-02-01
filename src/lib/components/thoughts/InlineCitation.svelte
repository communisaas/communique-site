<script lang="ts">
	/**
	 * InlineCitation: Clickable source reference within thought content
	 *
	 * PERCEPTUAL ENGINEERING:
	 * - Subtle dotted underline signals clickability without distraction
	 * - Hover state provides brief preview (tooltip for non-documents)
	 * - Document citations show DocumentPreview on hover (L2 depth)
	 * - Click emits event for progressive disclosure in DetailDrawer
	 * - Color matches coordination graph aesthetic (teal for routes)
	 *
	 * TIMING CONSTANTS:
	 * All timing values sourced from $lib/core/perceptual/timing
	 *
	 * ACCESSIBILITY:
	 * - Keyboard navigable (tab to focus, enter/space to activate)
	 * - ARIA attributes for screen readers
	 * - Semantic button element for interaction
	 * - Focus ring visible for keyboard users
	 */

	import type { Citation } from '$lib/core/thoughts/types';
	import type { ParsedDocument } from '$lib/server/reducto/types';
	import DocumentPreview from './DocumentPreview.svelte';
	import { L2_HOVER_DELAY, L2_LINGER, L2_FADE_IN } from '$lib/core/perceptual';

	interface Props {
		citation: Citation;
		/** Optional parsed document for document-type citations (enables L2 preview) */
		document?: ParsedDocument;
		onclick?: (citation: Citation) => void;
		/** Callback when user clicks "View Full" in document preview */
		onViewFull?: (document: ParsedDocument) => void;
	}

	let { citation, document, onclick, onViewFull }: Props = $props();

	// Document preview hover state
	let showPreview = $state(false);
	let hoverDelayTimer: ReturnType<typeof setTimeout> | null = $state(null);
	let lingerTimer: ReturnType<typeof setTimeout> | null = $state(null);
	let previewPosition = $state<{ x: number; y: number } | undefined>(undefined);
	let citationElement: HTMLButtonElement | undefined = $state(undefined);

	// Check if this citation can show document preview
	const isDocumentCitation = $derived(
		citation.sourceType === 'document' && document !== undefined
	);

	// Truncate excerpt for tooltip preview (non-document citations)
	const previewExcerpt = $derived(
		citation.excerpt.length > 100 ? citation.excerpt.slice(0, 100) + '...' : citation.excerpt
	);

	// Calculate preview position relative to citation element
	function calculatePreviewPosition(): { x: number; y: number } | undefined {
		if (!citationElement) return undefined;

		const rect = citationElement.getBoundingClientRect();
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		const previewWidth = 320; // DocumentPreview width
		const previewHeight = 280; // Approximate height

		// Position below the citation by default
		let x = rect.left;
		let y = rect.bottom + 8;

		// Adjust horizontal position if preview would overflow right edge
		if (x + previewWidth > viewportWidth - 16) {
			x = viewportWidth - previewWidth - 16;
		}

		// Adjust horizontal position if preview would overflow left edge
		if (x < 16) {
			x = 16;
		}

		// If preview would overflow bottom, position above citation
		if (y + previewHeight > viewportHeight - 16) {
			y = rect.top - previewHeight - 8;
		}

		return { x, y };
	}

	// Handle mouse enter on citation
	function handleMouseEnter() {
		if (!isDocumentCitation) return;

		// Clear any pending linger timer
		if (lingerTimer) {
			clearTimeout(lingerTimer);
			lingerTimer = null;
		}

		// Start hover delay timer
		hoverDelayTimer = setTimeout(() => {
			previewPosition = calculatePreviewPosition();
			showPreview = true;
			hoverDelayTimer = null;
		}, L2_HOVER_DELAY);
	}

	// Handle mouse leave from citation
	function handleMouseLeave() {
		if (!isDocumentCitation) return;

		// Clear hover delay timer if preview hasn't shown yet
		if (hoverDelayTimer) {
			clearTimeout(hoverDelayTimer);
			hoverDelayTimer = null;
		}

		// Start linger timer to allow mouse to move to preview
		lingerTimer = setTimeout(() => {
			showPreview = false;
			lingerTimer = null;
		}, L2_LINGER);
	}

	// Handle mouse enter on preview (cancel linger timer)
	function handlePreviewMouseEnter() {
		if (lingerTimer) {
			clearTimeout(lingerTimer);
			lingerTimer = null;
		}
	}

	// Handle mouse leave from preview
	function handlePreviewMouseLeave() {
		// Start linger timer
		lingerTimer = setTimeout(() => {
			showPreview = false;
			lingerTimer = null;
		}, L2_LINGER);
	}

	// Handle View Full click in preview
	function handleViewFull(doc: ParsedDocument) {
		showPreview = false;
		onViewFull?.(doc);
	}

	// Handle external link click in preview
	function handleExternalLink(url: string) {
		window.open(url, '_blank', 'noopener,noreferrer');
	}

	function handleClick() {
		// Clear any timers
		if (hoverDelayTimer) {
			clearTimeout(hoverDelayTimer);
			hoverDelayTimer = null;
		}
		if (lingerTimer) {
			clearTimeout(lingerTimer);
			lingerTimer = null;
		}
		showPreview = false;

		onclick?.(citation);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleClick();
		}
	}

	// Cleanup timers on unmount
	$effect(() => {
		return () => {
			if (hoverDelayTimer) clearTimeout(hoverDelayTimer);
			if (lingerTimer) clearTimeout(lingerTimer);
		};
	});
</script>

<button
	bind:this={citationElement}
	type="button"
	class="inline-citation group relative inline-flex cursor-pointer items-baseline
		border-b border-dotted border-coord-route-solid/50
		text-coord-route-solid transition-all duration-150
		hover:border-solid hover:border-coord-route-solid
		focus:outline-none focus-visible:ring-2 focus-visible:ring-coord-route-solid/30 focus-visible:ring-offset-1"
	onclick={handleClick}
	onkeydown={handleKeydown}
	onmouseenter={handleMouseEnter}
	onmouseleave={handleMouseLeave}
	aria-label={`Citation: ${citation.label}`}
	aria-describedby={`citation-preview-${citation.id}`}
	role="button"
	tabindex={0}
>
	<!-- Citation label -->
	<span class="inline-citation-label text-sm font-medium">
		{citation.label}
	</span>

	<!-- Simple tooltip preview for non-document citations (appears on hover via CSS) -->
	{#if !isDocumentCitation}
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
	{/if}
</button>

<!-- Document Preview (L2 depth) - shown for document-type citations -->
{#if isDocumentCitation && showPreview && document}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="document-preview-wrapper"
		onmouseenter={handlePreviewMouseEnter}
		onmouseleave={handlePreviewMouseLeave}
	>
		<DocumentPreview
			{document}
			position={previewPosition}
			onViewFull={handleViewFull}
			onExternalLink={handleExternalLink}
		/>
	</div>
{/if}

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
		/* Duration from PERCEPTUAL_TIMING.L2_FADE_IN */
		animation: fadeIn calc(var(--l2-fade-in, 150) * 1ms) ease-out;
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

	/* Document preview wrapper - ensures preview is positioned in document flow */
	.document-preview-wrapper {
		position: fixed;
		z-index: 100;
		/* Smooth fade-in animation from PERCEPTUAL_TIMING.L2_FADE_IN */
		animation: documentPreviewFadeIn calc(var(--l2-fade-in, 150) * 1ms) ease-out;
	}

	@keyframes documentPreviewFadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
</style>
