<script lang="ts">
	/**
	 * DraftResumeBanner - Perceptual Engineering
	 *
	 * Surfaces saved drafts at the point of creation entry.
	 * The draft appears WHERE creation happens, not in a separate "drafts" menu.
	 *
	 * Cognitive principles:
	 * - Recognition over Recall: Subject line triggers memory instantly
	 * - Spatial consistency: Same location as new creation
	 * - Sunk cost visibility: Progress dots show investment
	 * - Low cognitive load: Two clear choices (Continue / Start Fresh)
	 *
	 * Visual language:
	 * - Emerald accent: Consistent with "preserved work" in auth gates
	 * - Subtle animation: Draws peripheral attention without demanding it
	 * - Progress dots: Orientation without reading
	 */

	import { createEventDispatcher } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { Sparkles, ArrowRight } from '@lucide/svelte';
	import type { RecentDraft } from '$lib/stores/templateDraft';
	import { formatTimeAgo } from '$lib/stores/templateDraft';

	interface Props {
		draft: RecentDraft;
	}

	let { draft }: Props = $props();

	const dispatch = createEventDispatcher<{
		continue: { draftId: string };
		dismiss: void;
	}>();

	// Map step names to numbers for progress display
	const stepMap: Record<string, number> = {
		objective: 1,
		audience: 2,
		content: 3
	};

	const currentStepNum = $derived(stepMap[draft.currentStep] || 1);
	const totalSteps = 3;
	const timeAgo = $derived(formatTimeAgo(draft.lastSaved));

	// Full title - no truncation
	const displayTitle = $derived(() => {
		return draft.data.objective?.title || 'Untitled draft';
	});

	function handleContinue() {
		dispatch('continue', { draftId: draft.draftId });
	}

	function handleDismiss() {
		dispatch('dismiss');
	}
</script>

<div
	class="draft-resume-banner"
	in:scale={{ duration: 300, start: 0.95, opacity: 0 }}
	out:fade={{ duration: 200 }}
>
	<!-- Header with icon -->
	<div class="banner-header">
		<div class="icon-container">
			<Sparkles class="icon" />
		</div>
		<span class="header-text">Continue where you left off</span>
	</div>

	<!-- Draft preview -->
	<div class="draft-preview">
		<p class="draft-title">"{displayTitle()}"</p>

		<!-- Progress + Time -->
		<div class="draft-meta">
			<!-- Step progress dots -->
			<div class="progress-dots" aria-label="Step {currentStepNum} of {totalSteps}">
				{#each Array(totalSteps) as _, i}
					{@const stepNum = i + 1}
					<span
						class="dot"
						class:completed={stepNum < currentStepNum}
						class:current={stepNum === currentStepNum}
						class:upcoming={stepNum > currentStepNum}
					></span>
					{#if i < totalSteps - 1}
						<span
							class="connector"
							class:filled={stepNum < currentStepNum}
						></span>
					{/if}
				{/each}
			</div>

			<span class="meta-divider">•</span>
			<span class="time-ago">{timeAgo}</span>
		</div>
	</div>

	<!-- Actions -->
	<div class="banner-actions">
		<button type="button" class="btn-secondary" onclick={handleDismiss}>
			Start fresh
		</button>
		<button type="button" class="btn-primary" onclick={handleContinue}>
			Continue
			<ArrowRight class="btn-icon" />
		</button>
	</div>
</div>

<style>
	/*
	 * DraftResumeBanner - Perceptual Engineering Styles
	 *
	 * Visual hierarchy:
	 * 1. Emerald accent signals "preserved work" (100ms)
	 * 2. Subject line triggers recognition (200ms)
	 * 3. Progress dots show orientation (glanceable)
	 * 4. Actions clear without reading
	 *
	 * Consistent with AuthGateOverlay's progress preservation cards
	 */

	.draft-resume-banner {
		background: linear-gradient(
			135deg,
			oklch(0.97 0.02 155),
			oklch(0.95 0.03 155)
		);
		border: 1px solid oklch(0.85 0.05 155);
		border-radius: 12px;
		padding: 1rem;
		margin-bottom: 1.25rem;
		box-shadow:
			0 1px 3px oklch(0.4 0.05 155 / 0.08),
			0 4px 12px oklch(0.4 0.05 155 / 0.04);
	}

	@media (min-width: 640px) {
		.draft-resume-banner {
			padding: 1.25rem;
		}
	}

	/* Header */
	.banner-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.icon-container {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 6px;
		background: oklch(0.55 0.12 155);
	}

	.icon-container :global(.icon) {
		width: 0.875rem;
		height: 0.875rem;
		color: white;
	}

	.header-text {
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.8125rem;
		font-weight: 600;
		color: oklch(0.35 0.08 155);
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	/* Draft preview */
	.draft-preview {
		margin-bottom: 1rem;
	}

	.draft-title {
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 1rem;
		font-weight: 600;
		line-height: 1.4;
		color: oklch(0.25 0.05 155);
		margin: 0 0 0.5rem 0;
	}

	@media (min-width: 640px) {
		.draft-title {
			font-size: 1.0625rem;
		}
	}

	/* Meta row: progress + time */
	.draft-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	/* Progress dots */
	.progress-dots {
		display: flex;
		align-items: center;
		gap: 0;
	}

	.dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		transition: background 200ms ease-out;
	}

	.dot.completed {
		background: oklch(0.55 0.12 155);
	}

	.dot.current {
		background: oklch(0.55 0.12 155);
		box-shadow: 0 0 0 2px oklch(0.55 0.12 155 / 0.3);
	}

	.dot.upcoming {
		background: oklch(0.8 0.04 155);
	}

	.connector {
		width: 0.75rem;
		height: 2px;
		background: oklch(0.8 0.04 155);
		transition: background 200ms ease-out;
	}

	.connector.filled {
		background: oklch(0.55 0.12 155);
	}

	.meta-divider {
		color: oklch(0.6 0.04 155);
		font-size: 0.625rem;
	}

	.time-ago {
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.75rem;
		color: oklch(0.45 0.06 155);
	}

	/* Actions */
	.banner-actions {
		display: flex;
		gap: 0.75rem;
	}

	.btn-secondary {
		flex: 1;
		padding: 0.625rem 1rem;
		border: 1px solid oklch(0.75 0.05 155);
		border-radius: 8px;
		background: white;
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.875rem;
		font-weight: 500;
		color: oklch(0.4 0.06 155);
		cursor: pointer;
		transition:
			background 150ms ease-out,
			border-color 150ms ease-out,
			color 150ms ease-out;
	}

	.btn-secondary:hover {
		background: oklch(0.98 0.01 155);
		border-color: oklch(0.65 0.06 155);
		color: oklch(0.3 0.06 155);
	}

	.btn-primary {
		flex: 1.5;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		padding: 0.625rem 1rem;
		border: none;
		border-radius: 8px;
		background: linear-gradient(
			135deg,
			oklch(0.55 0.12 155),
			oklch(0.48 0.14 155)
		);
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.875rem;
		font-weight: 600;
		color: white;
		cursor: pointer;
		transition:
			transform 150ms ease-out,
			box-shadow 150ms ease-out;
	}

	.btn-primary:hover {
		transform: translateY(-1px);
		box-shadow: 0 4px 12px oklch(0.45 0.12 155 / 0.35);
	}

	.btn-primary:active {
		transform: translateY(0);
	}

	.btn-primary :global(.btn-icon) {
		width: 0.875rem;
		height: 0.875rem;
		transition: transform 150ms ease-out;
	}

	.btn-primary:hover :global(.btn-icon) {
		transform: translateX(2px);
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.draft-resume-banner {
			animation: none;
		}

		.btn-primary,
		.btn-secondary {
			transition: none;
		}
	}
</style>
