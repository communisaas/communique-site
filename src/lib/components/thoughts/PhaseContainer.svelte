<script lang="ts">
	/**
	 * PhaseContainer: Collapsible group of thoughts for a reasoning phase
	 *
	 * PERCEPTUAL ENGINEERING:
	 * - Active phase expanded (clear focus on current activity)
	 * - Completed phases soft-collapsed (70% opacity, hover to expand)
	 * - Smooth slide transitions (temporal rhythm)
	 * - Visual grouping through border and background
	 * - Phase status indicator (color-coded dot)
	 *
	 * ACCESSIBILITY:
	 * - Button for collapse/expand (keyboard navigable)
	 * - ARIA expanded state
	 * - Focus visible ring
	 * - Clear visual hierarchy
	 */

	import { untrack } from 'svelte';
	import type { PhaseState, ThoughtSegment, Citation } from '$lib/core/thoughts/types';
	import type { ParsedDocument } from '$lib/server/reducto/types';
	import { ChevronDown, ChevronRight } from 'lucide-svelte';
	import ThoughtSegmentComponent from './ThoughtSegment.svelte';

	interface Props {
		phase: PhaseState;
		segments: ThoughtSegment[];
		oncitationclick?: (citation: Citation) => void;
		/** Map of documentId -> ParsedDocument for L2 preview on hover */
		documents?: Map<string, ParsedDocument>;
		/** Callback when user clicks "View Full" in document preview */
		onViewFullDocument?: (document: ParsedDocument) => void;
	}

	let { phase, segments, oncitationclick, documents, onViewFullDocument }: Props = $props();

	// Collapse state (completed phases start collapsed — one-shot init)
	let collapsed = $state(untrack(() => phase.status === 'complete'));

	// Derived state
	const isActive = $derived(phase.status === 'active');
	const isComplete = $derived(phase.status === 'complete');
	const isPending = $derived(phase.status === 'pending');

	// Duration calculation
	const duration = $derived(
		phase.endTime && phase.startTime
			? `${((phase.endTime - phase.startTime) / 1000).toFixed(1)}s`
			: null
	);

	// Phase status indicator color
	const statusColor = $derived(
		isActive
			? 'bg-coord-route-solid'
			: isComplete
				? 'bg-coord-verified'
				: 'bg-surface-border-strong'
	);

	// Phase name formatting (capitalize first letter)
	const phaseName = $derived(
		phase.name.charAt(0).toUpperCase() + phase.name.slice(1)
	);

	function toggleCollapse() {
		collapsed = !collapsed;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			toggleCollapse();
		}
	}

	// Auto-expand when phase becomes active
	$effect(() => {
		if (isActive) {
			collapsed = false;
		}
	});
</script>

<div
	class="phase-container rounded-lg border border-surface-border bg-surface-base/50 transition-all duration-200
		{isActive ? 'shadow-md' : ''} {isComplete && collapsed ? 'opacity-70 hover:opacity-100' : ''}"
	role="region"
	aria-label="{phaseName} phase"
>
	<!-- Phase header (always visible) -->
	<button
		type="button"
		class="phase-header group flex w-full items-center justify-between gap-3 px-4 py-3 text-left
			transition-colors duration-150 focus:outline-none focus-visible:ring-2
			focus-visible:ring-coord-route-solid/30 focus-visible:ring-offset-1"
		onclick={toggleCollapse}
		onkeydown={handleKeydown}
		aria-expanded={!collapsed}
	>
		<!-- Left: Status indicator + name -->
		<div class="flex items-center gap-3">
			<!-- Status dot -->
			<div
				class="status-dot h-2 w-2 flex-shrink-0 rounded-full transition-all duration-200 {statusColor}
					{isActive ? 'animate-pulse' : ''}"
				aria-label="{phase.status} status"
			></div>

			<!-- Phase name -->
			<h3
				class="phase-name text-base font-semibold {isActive
					? 'text-text-primary'
					: 'text-text-secondary'}"
			>
				{phaseName}
			</h3>
		</div>

		<!-- Right: Duration + chevron -->
		<div class="flex items-center gap-3">
			{#if duration}
				<span class="text-xs text-text-quaternary">{duration}</span>
			{/if}

			<!-- Chevron -->
			<div class="transition-transform duration-200">
				{#if collapsed}
					<ChevronRight class="h-4 w-4 text-text-quaternary group-hover:text-text-tertiary" />
				{:else}
					<ChevronDown class="h-4 w-4 text-text-quaternary group-hover:text-text-tertiary" />
				{/if}
			</div>
		</div>
	</button>

	<!-- Phase content (collapsible) -->
	{#if !collapsed}
		<div class="phase-content border-t border-surface-border px-4 pb-3 pt-2">
			{#if segments.length > 0}
				<div class="segments-list space-y-1">
					{#each segments as segment (segment.id)}
						<ThoughtSegmentComponent {segment} {oncitationclick} {documents} {onViewFullDocument} />
					{/each}
				</div>
			{:else}
				<!-- Empty state -->
				<p class="py-4 text-center text-sm italic text-text-quaternary">
					{isPending ? 'Waiting to start...' : 'No thoughts yet'}
				</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	/* Smooth slide animation for phase content */
	.phase-content {
		animation: slideDown 250ms cubic-bezier(0.4, 0, 0.2, 1);
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			max-height: 0;
		}
		to {
			opacity: 1;
			max-height: 1000px;
		}
	}

	/* Hover effect for header */
	.phase-header:hover {
		background-color: var(--surface-raised);
	}

	/* Pulsing animation for active phase indicator */
	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.7;
			transform: scale(1.1);
		}
	}

	.animate-pulse {
		animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}
</style>
