<script lang="ts">
	/**
	 * ThoughtSegment: Individual thought unit display
	 *
	 * PERCEPTUAL ENGINEERING:
	 * - Visual hierarchy through emphasis levels (highlight = left border, muted = reduced opacity)
	 * - Inline citations rendered as clickable elements (affordance clarity)
	 * - Action segments get specialized rendering (temporal rhythm)
	 * - Type-based styling (insights highlighted, reasoning normal)
	 *
	 * ACCESSIBILITY:
	 * - Semantic HTML structure
	 * - ARIA attributes for type and emphasis
	 * - Keyboard navigation for citations
	 * - High contrast for important items
	 */

	import type { ThoughtSegment as ThoughtSegmentType, Citation } from '$lib/core/thoughts/types';
	import InlineCitation from './InlineCitation.svelte';
	import ActionSegment from './ActionSegment.svelte';
	import { Lightbulb, Sparkles } from 'lucide-svelte';

	interface Props {
		segment: ThoughtSegmentType;
		oncitationclick?: (citation: Citation) => void;
	}

	let { segment, oncitationclick }: Props = $props();

	// Type indicators
	const isAction = $derived(segment.type === 'action');
	const isInsight = $derived(segment.type === 'insight');
	const isRecommendation = $derived(segment.type === 'recommendation');

	// Emphasis styling
	const emphasisClass = $derived(
		segment.emphasis === 'highlight'
			? 'border-l-4 border-coord-route-solid pl-3 bg-coord-route-solid/5'
			: segment.emphasis === 'muted'
				? 'opacity-70'
				: ''
	);

	// Type icon
	const TypeIcon = $derived(
		isInsight ? Lightbulb : isRecommendation ? Sparkles : null
	);
</script>

<div
	class="thought-segment group py-2 transition-opacity duration-200 {emphasisClass}"
	role="article"
	aria-label="{segment.type} thought"
	data-segment-id={segment.id}
>
	{#if isAction && segment.action}
		<!-- Action segments get specialized rendering -->
		<ActionSegment action={segment.action} />
	{:else}
		<!-- Regular thought content -->
		<div class="thought-content flex items-start gap-2">
			<!-- Type icon (for insights/recommendations) -->
			{#if TypeIcon}
				<div class="flex-shrink-0 pt-0.5">
					<TypeIcon
						class="h-4 w-4 {isInsight ? 'text-amber-500' : 'text-purple-500'}"
						strokeWidth={2}
					/>
				</div>
			{/if}

			<!-- Content with inline citations -->
			<div class="flex-1 space-y-1">
				<p
					class="thought-text text-sm leading-relaxed {isInsight || isRecommendation
						? 'font-medium text-text-primary'
						: 'text-text-secondary'}"
				>
					{#if segment.content}
						{segment.content}
					{/if}
				</p>

				<!-- Inline citations -->
				{#if segment.citations && segment.citations.length > 0}
					<div class="citations-list mt-2 flex flex-wrap gap-x-3 gap-y-1">
						{#each segment.citations as citation}
							<InlineCitation {citation} onclick={oncitationclick} />
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	/* Subtle hover effect for highlighted segments */
	.thought-segment:has(.border-l-4):hover {
		background-color: var(--coord-route-solid, rgba(59, 196, 184, 0.08));
	}

	/* Smooth fade-in for new segments */
	.thought-segment {
		animation: fadeInUp 300ms ease-out;
	}

	@keyframes fadeInUp {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Preserve line breaks in thought content */
	.thought-text {
		white-space: pre-wrap;
		word-break: break-word;
	}
</style>
