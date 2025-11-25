<script lang="ts">
	/**
	 * CreationSpark - Perceptual Engineering
	 *
	 * The visible entry point for template creation.
	 * NOT a button that opens a modal. A SURFACE that invites writing.
	 *
	 * Cognitive principle: Recognition > Recall
	 * Users see the writing surface, understand what "create" means,
	 * and can begin immediately without predicting modal contents.
	 *
	 * Low commitment: typing in a field is lower friction than clicking
	 * an abstract button. The spark captures initial intent, then
	 * transitions to the full wizard.
	 */

	import { createEventDispatcher } from 'svelte';
	import { ArrowRight } from '@lucide/svelte';

	const dispatch = createEventDispatcher<{
		activate: { initialText: string };
	}>();

	let issueText = $state('');
	let isFocused = $state(false);
	let inputEl = $state<HTMLTextAreaElement | null>(null);

	// Derived: has user started writing?
	const hasContent = $derived(issueText.trim().length > 0);
	const isActivated = $derived(hasContent || isFocused);

	function handleContinue() {
		dispatch('activate', { initialText: issueText.trim() });
	}

	function handleKeydown(event: KeyboardEvent) {
		// Cmd/Ctrl + Enter to continue
		if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && hasContent) {
			event.preventDefault();
			handleContinue();
		}
	}
</script>

<div class="creation-spark" class:activated={isActivated} class:has-content={hasContent}>
	<!-- Brand + Headline integrated into creation surface -->
	<div class="spark-header">
		<p class="brand-mark">communiqué</p>
		<h1 class="headline">
			Your voice.
			<span class="accent">Sent together.</span>
		</h1>
		<p class="subhead">Write it once. Share the link. Everyone can send it.</p>
	</div>

	<!-- The writing surface - immediately visible -->
	<div class="spark-surface">
		<label for="issue-input" class="spark-prompt"> What needs to change? </label>

		<div class="input-container" class:focused={isFocused}>
			<textarea
				bind:this={inputEl}
				bind:value={issueText}
				id="issue-input"
				class="spark-input"
				placeholder="The rent keeps going up but wages don't..."
				rows="3"
				onfocus={() => (isFocused = true)}
				onblur={() => (isFocused = false)}
				onkeydown={handleKeydown}
			></textarea>

			<!-- Subtle helper text -->
			<div class="input-footer">
				{#if hasContent}
					<span class="char-count">{issueText.length} characters</span>
				{:else}
					<span class="hint">Describe the problem you want to solve</span>
				{/if}
			</div>
		</div>

		<!-- Continue action - appears when content exists or focused -->
		<div class="spark-actions" class:visible={isActivated}>
			<button
				type="button"
				class="continue-btn"
				class:ready={hasContent}
				onclick={handleContinue}
				disabled={!hasContent}
			>
				<span class="btn-text">
					{hasContent ? 'Pick decision-makers' : 'Start typing above'}
				</span>
				<ArrowRight class="btn-icon" />
			</button>

			{#if hasContent}
				<p class="action-hint">
					Press <kbd>⌘</kbd><kbd>Enter</kbd> to continue
				</p>
			{/if}
		</div>
	</div>

	<!-- Or browse existing -->
	<div class="spark-divider">
		<span class="divider-line"></span>
		<span class="divider-text">or join an existing campaign</span>
		<span class="divider-line"></span>
	</div>
</div>

<style>
	/*
	 * CreationSpark - Perceptual Engineering Styles
	 *
	 * Visual hierarchy:
	 * 1. Headline establishes context (200ms)
	 * 2. Writing surface draws focus (immediate affordance)
	 * 3. Continue action reveals on engagement
	 *
	 * Color: Uses participation-primary (cyan) for activation states
	 * Typography: Satoshi for brand voice
	 */

	.creation-spark {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	/* Header - Brand + Headline */
	.spark-header {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.brand-mark {
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.875rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		text-transform: lowercase;
		color: oklch(0.42 0.08 55); /* Warm amber-brown */
		margin: 0;
	}

	.headline {
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 2rem;
		font-weight: 700;
		line-height: 1.15;
		letter-spacing: -0.02em;
		color: oklch(0.15 0.02 250);
		margin: 0;
	}

	@media (min-width: 640px) {
		.headline {
			font-size: 2.5rem;
		}
	}

	@media (min-width: 1024px) {
		.headline {
			font-size: 2.75rem;
		}
	}

	.headline .accent {
		display: block;
		color: oklch(0.55 0.15 195); /* Cyan - participation color */
	}

	.subhead {
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 1rem;
		font-weight: 500;
		line-height: 1.5;
		color: oklch(0.25 0.02 250);
		margin: 0.25rem 0 0 0;
	}

	@media (min-width: 640px) {
		.subhead {
			font-size: 1.125rem;
		}
	}

	/* Writing Surface */
	.spark-surface {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.spark-prompt {
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.875rem;
		font-weight: 600;
		color: oklch(0.35 0.02 250);
		margin: 0;
	}

	.input-container {
		position: relative;
		border-radius: 12px;
		border: 2px solid oklch(0.85 0.02 250);
		background: oklch(0.99 0.005 250);
		transition:
			border-color 200ms ease-out,
			box-shadow 200ms ease-out,
			background 200ms ease-out;
	}

	.input-container.focused {
		border-color: oklch(0.65 0.12 195);
		box-shadow:
			0 0 0 3px oklch(0.7 0.1 195 / 0.15),
			0 4px 12px -2px oklch(0.5 0.1 195 / 0.1);
		background: white;
	}

	.spark-input {
		width: 100%;
		padding: 1rem;
		border: none;
		border-radius: 10px;
		background: transparent;
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 1rem;
		line-height: 1.5;
		color: oklch(0.2 0.02 250);
		resize: none;
		outline: none;
	}

	.spark-input::placeholder {
		color: oklch(0.6 0.02 250);
		font-style: italic;
	}

	.input-footer {
		padding: 0.5rem 1rem;
		border-top: 1px solid oklch(0.92 0.01 250);
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.char-count {
		font-size: 0.75rem;
		color: oklch(0.5 0.02 250);
		font-variant-numeric: tabular-nums;
	}

	.hint {
		font-size: 0.75rem;
		color: oklch(0.55 0.02 250);
		font-style: italic;
	}

	/* Actions - collapse height when hidden to avoid negative space */
	.spark-actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		opacity: 0;
		max-height: 0;
		overflow: hidden;
		transform: translateY(-8px);
		transition:
			opacity 200ms ease-out,
			transform 200ms ease-out,
			max-height 200ms ease-out;
		pointer-events: none;
	}

	.spark-actions.visible {
		opacity: 1;
		max-height: 120px; /* Enough for button + hint */
		transform: translateY(0);
		pointer-events: auto;
	}

	.continue-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.875rem 1.5rem;
		border: none;
		border-radius: 10px;
		background: oklch(0.85 0.02 250);
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.9375rem;
		font-weight: 600;
		color: oklch(0.5 0.02 250);
		cursor: not-allowed;
		transition:
			background 200ms ease-out,
			color 200ms ease-out,
			transform 150ms ease-out,
			box-shadow 200ms ease-out;
	}

	.continue-btn.ready {
		background: linear-gradient(135deg, oklch(0.55 0.15 195), oklch(0.48 0.17 195));
		color: white;
		cursor: pointer;
	}

	.continue-btn.ready:hover {
		transform: translateY(-1px);
		box-shadow: 0 4px 12px -2px oklch(0.5 0.15 195 / 0.35);
	}

	.continue-btn.ready:active {
		transform: translateY(0);
	}

	.continue-btn:disabled {
		cursor: not-allowed;
	}

	/* Icon styles - use :global() to reach inside Lucide component */
	.continue-btn :global(.btn-icon) {
		width: 1rem;
		height: 1rem;
		transition: transform 150ms ease-out;
	}

	.continue-btn.ready:hover :global(.btn-icon) {
		transform: translateX(2px);
	}

	.action-hint {
		font-size: 0.75rem;
		color: oklch(0.55 0.02 250);
		text-align: center;
		margin: 0;
	}

	.action-hint kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		height: 1.25rem;
		padding: 0 0.25rem;
		border-radius: 4px;
		background: oklch(0.95 0.01 250);
		border: 1px solid oklch(0.88 0.02 250);
		font-family: system-ui, sans-serif;
		font-size: 0.625rem;
		font-weight: 600;
		color: oklch(0.45 0.02 250);
		margin: 0 0.125rem;
	}

	/*
	 * Divider - transforms presentation based on layout context
	 *
	 * Perceptual Engineering:
	 * - Mobile (stacked): Horizontal lines predict vertical flow → content below
	 * - Desktop (side-by-side): Lines would contradict horizontal relationship
	 *
	 * Solution: Keep the semantic content, adapt visual treatment
	 */
	.spark-divider {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-top: 0.5rem;
	}

	/* Desktop: Transform to directional label without misleading lines */
	@media (min-width: 1280px) {
		.spark-divider {
			margin-top: 1.5rem;
			padding-top: 1.5rem;
			border-top: 1px solid oklch(0.92 0.01 250);
			justify-content: flex-start;
			gap: 0.5rem;
		}
	}

	.divider-line {
		flex: 1;
		height: 1px;
		background: oklch(0.88 0.02 250);
	}

	/* Hide horizontal lines on desktop - spatial positioning already encodes "or" */
	@media (min-width: 1280px) {
		.divider-line {
			display: none;
		}
	}

	.divider-text {
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.8125rem;
		color: oklch(0.55 0.02 250);
		white-space: nowrap;
	}

	/* Desktop: Style as a gentle pointer toward the right column */
	@media (min-width: 1280px) {
		.divider-text {
			font-size: 0.875rem;
			font-weight: 500;
			color: oklch(0.45 0.02 250);
		}

		/* Add subtle arrow to indicate horizontal direction */
		.divider-text::after {
			content: ' →';
			opacity: 0.5;
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.spark-actions {
			transition: none;
		}

		.continue-btn {
			transition: none;
		}

		.input-container {
			transition: none;
		}
	}
</style>
