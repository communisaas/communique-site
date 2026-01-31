<script lang="ts">
	/**
	 * ThoughtStream: Main container for structured thought visualization
	 *
	 * PERCEPTUAL ENGINEERING:
	 * - Groups segments by phase (visual organization)
	 * - Active phase expanded, completed phases soft-collapsed (focus management)
	 * - Temporal rhythm through chunked streaming (~300ms intervals)
	 * - Progressive disclosure layers (citations, actions, expansions)
	 * - Scroll behavior: auto-scroll during streaming, manual control when paused
	 *
	 * ARCHITECTURE:
	 * - Receives ThoughtSegment[] and PhaseState[] from parent
	 * - Groups segments by phase for PhaseContainer rendering
	 * - Emits events for citation clicks (consumed by DetailDrawer)
	 * - Manages pause/resume state for streaming control
	 *
	 * ACCESSIBILITY:
	 * - Semantic HTML structure (articles, sections)
	 * - ARIA live region for streaming updates
	 * - Keyboard navigation throughout
	 * - Focus management during streaming
	 */

	import type {
		ThoughtSegment,
		PhaseState,
		Citation,
		ActionTrace,
		ThoughtSegmentGroup
	} from '$lib/core/thoughts/types';
	import PhaseContainer from './PhaseContainer.svelte';
	import StreamControls from './StreamControls.svelte';

	interface Props {
		segments: ThoughtSegment[];
		phases: PhaseState[];
		streaming?: boolean;
		oncitationclick?: (citation: Citation) => void;
		onactionexpand?: (action: ActionTrace) => void;
	}

	let {
		segments = [],
		phases = [],
		streaming = false,
		oncitationclick,
		onactionexpand
	}: Props = $props();

	// Pause state
	let paused = $state(false);

	// Group segments by phase
	const segmentGroups = $derived.by(() => {
		const groups: Map<string, ThoughtSegmentGroup> = new Map();

		// Initialize groups from phases
		for (const phase of phases) {
			groups.set(phase.name, {
				id: phase.name,
				label: phase.name.charAt(0).toUpperCase() + phase.name.slice(1),
				segments: [],
				phase
			});
		}

		// Assign segments to their phase groups
		for (const segment of segments) {
			const group = groups.get(segment.phase);
			if (group) {
				group.segments.push(segment);
			} else {
				// Create group for unknown phase
				groups.set(segment.phase, {
					id: segment.phase,
					label: segment.phase.charAt(0).toUpperCase() + segment.phase.slice(1),
					segments: [segment],
					phase: {
						name: segment.phase,
						status: 'active',
						startTime: segment.timestamp
					}
				});
			}
		}

		return Array.from(groups.values());
	});

	// Auto-scroll to bottom during streaming (unless paused)
	let streamContainer: HTMLDivElement;

	$effect(() => {
		if (streaming && !paused && streamContainer) {
			// Smooth scroll to bottom
			streamContainer.scrollTo({
				top: streamContainer.scrollHeight,
				behavior: 'smooth'
			});
		}
	});

	function handlePause() {
		paused = true;
	}

	function handleResume() {
		paused = false;
	}
</script>

<div
	class="thought-stream flex h-full flex-col"
	role="region"
	aria-label="Agent thought stream"
	aria-live={streaming ? 'polite' : 'off'}
>
	<!-- Stream controls (sticky at top) -->
	{#if streaming || paused}
		<div
			class="stream-controls-container sticky top-0 z-10 border-b border-surface-border
				bg-surface-base/95 px-4 py-3 backdrop-blur-sm"
		>
			<StreamControls {streaming} {paused} onpause={handlePause} onresume={handleResume} />
		</div>
	{/if}

	<!-- Thought stream content (scrollable) -->
	<div
		bind:this={streamContainer}
		class="stream-content flex-1 space-y-4 overflow-y-auto px-4 py-4"
		role="feed"
		aria-busy={streaming}
	>
		{#if segmentGroups.length > 0}
			<!-- Render phase containers -->
			{#each segmentGroups as group (group.id)}
				{#if group.phase}
					<PhaseContainer
						phase={group.phase}
						segments={group.segments}
						{oncitationclick}
					/>
				{/if}
			{/each}
		{:else}
			<!-- Empty state -->
			<div class="empty-state flex h-full items-center justify-center">
				<div class="text-center">
					<p class="text-base font-medium text-text-tertiary">No thoughts yet</p>
					<p class="mt-1 text-sm text-text-quaternary">
						The agent will share its reasoning here as it works
					</p>
				</div>
			</div>
		{/if}

		<!-- Spacer for scroll padding -->
		<div class="h-4" aria-hidden="true"></div>
	</div>
</div>

<style>
	/* Custom scrollbar styling */
	.stream-content {
		scrollbar-width: thin;
		scrollbar-color: var(--surface-border-strong) transparent;
	}

	.stream-content::-webkit-scrollbar {
		width: 8px;
	}

	.stream-content::-webkit-scrollbar-track {
		background: transparent;
	}

	.stream-content::-webkit-scrollbar-thumb {
		background-color: var(--surface-border-strong);
		border-radius: 4px;
	}

	.stream-content::-webkit-scrollbar-thumb:hover {
		background-color: var(--surface-border);
	}

	/* Smooth transitions */
	.thought-stream {
		transition: all 200ms ease-out;
	}

	/* Backdrop blur for sticky controls */
	.stream-controls-container {
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
	}
</style>
