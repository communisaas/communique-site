<!--
  DeliveryJourney.svelte

  Container component orchestrating the CWC submission feedback experience.
  Implements staged reveal: results are known immediately but revealed progressively
  for emotional arc and perceived responsiveness.

  Based on: docs/temp/CWC-FEEDBACK-REDESIGN.md

  Journey Stages:
  - acknowledging: Click received, immediate feedback (<100ms)
  - delivering: Animated progress with staged office reveals (2-4s)
  - complete: Results shown with celebration
  - details: User examining specifics (optional)

  Design Principles:
  - One action (contact Congress) → one confident completion
  - Results are known; animation is performative but meaningful
  - Partial success is still success—celebrate what worked
  - Unavailable offices are permanent (no false retry promises)
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { spring } from 'svelte/motion';
	import type {
		JourneyStage,
		DeliveryResult,
		DeliverySummary,
		TemplateMetrics
	} from './delivery-types';
	import { TIMING } from './delivery-types';
	import DeliveryProgress from './DeliveryProgress.svelte';
	import DeliveryConfirmation from './DeliveryConfirmation.svelte';

	// ============================================================================
	// Props
	// ============================================================================

	interface Props {
		/** Unique submission identifier */
		submissionId: string;

		/** Full delivery results (already resolved, not polling) */
		results: DeliveryResult[];

		/** Template metadata for proof/receipt */
		template?: TemplateMetrics;

		/** Called when journey reaches completion */
		onComplete?: () => void;

		/** Called when user wants to view details */
		onShowDetails?: () => void;

		/** Called when user wants to retry failed deliveries */
		onRetry?: (results: DeliveryResult[]) => void;
	}

	let {
		submissionId,
		results,
		template,
		onComplete,
		onShowDetails,
		onRetry
	}: Props = $props();

	// ============================================================================
	// State
	// ============================================================================

	/** Current journey stage */
	let stage: JourneyStage = $state('acknowledging');

	/** Number of offices revealed during staged animation */
	let revealedOffices = $state(0);

	/** Progress percentage for animation (0-100) */
	let progress = $state(0);

	/** Whether the completion animation has fired */
	let celebrationComplete = $state(false);

	// ============================================================================
	// Derived State
	// ============================================================================

	/** Compute summary from results */
	let summary: DeliverySummary = $derived({
		total: results.length,
		delivered: results.filter((r) => r.outcome === 'delivered').length,
		failed: results.filter((r) => r.outcome === 'failed').length,
		unavailable: results.filter((r) => r.outcome === 'unavailable').length
	});

	/** Get retryable failures (not unavailable - those are permanent) */
	let retryableResults = $derived(
		results.filter((r) => r.outcome === 'failed' && r.retryable !== false)
	);

	/** Whether there are any retryable failures */
	let hasRetryable = $derived(retryableResults.length > 0);

	/** Progress stage for DeliveryProgress component */
	let progressStage = $derived.by((): 'anticipating' | 'progressing' | 'complete' => {
		if (stage === 'acknowledging') return 'anticipating';
		if (stage === 'delivering') return 'progressing';
		return 'complete';
	});

	// ============================================================================
	// Animation Orchestration
	// ============================================================================

	/**
	 * Orchestrate the staged reveal journey
	 *
	 * Timeline:
	 * 0ms: acknowledging (immediate feedback)
	 * 50ms: transition to delivering
	 * 600ms: begin progress animation
	 * 600-3000ms: staged office reveals
	 * 3000ms: transition to complete
	 * 3400ms: celebration pulse
	 * 3700ms: settle to final state
	 */
	function orchestrateJourney() {
		const totalOffices = results.length;

		// Stage 1: Acknowledging → Delivering
		setTimeout(() => {
			stage = 'delivering';
			progress = 10; // Initial progress bump
		}, TIMING.CLICK_RESPONSE);

		// Stage 2: Build anticipation
		setTimeout(() => {
			progress = 25;
		}, TIMING.CLICK_RESPONSE + TIMING.ANTICIPATION / 2);

		// Stage 3: Staged office reveals
		const revealStart = TIMING.CLICK_RESPONSE + TIMING.ANTICIPATION;
		const intervalPerOffice = TIMING.STAGE_INTERVAL;

		results.forEach((_, index) => {
			const revealTime = revealStart + index * intervalPerOffice;
			const progressIncrement = (75 / totalOffices) * (index + 1) + 25;

			setTimeout(() => {
				revealedOffices = index + 1;
				progress = Math.min(progressIncrement, 95);
			}, revealTime);
		});

		// Stage 4: Complete
		const completionTime = revealStart + totalOffices * intervalPerOffice + TIMING.SETTLE;

		setTimeout(() => {
			progress = 100;
			stage = 'complete';
		}, completionTime);

		// Stage 5: Celebration
		setTimeout(() => {
			celebrationComplete = true;
			onComplete?.();
		}, completionTime + TIMING.CELEBRATION_PULSE);
	}

	// Start journey on mount
	onMount(() => {
		// Immediate acknowledgment
		stage = 'acknowledging';

		// Begin orchestration
		orchestrateJourney();
	});

	// ============================================================================
	// Handlers
	// ============================================================================

	function handleViewDetails() {
		stage = 'details';
		onShowDetails?.();
	}

	function handleRetry() {
		if (hasRetryable && onRetry) {
			onRetry(retryableResults);
		}
	}
</script>

<!-- ============================================================================
     Template
     ============================================================================ -->

<div class="journey-container" data-stage={stage}>
	<!-- Acknowledging State -->
	{#if stage === 'acknowledging'}
		<div class="stage-acknowledging">
			<div class="pulse-indicator"></div>
			<p class="acknowledging-text">Sending your message...</p>
		</div>
	{/if}

	<!-- Delivering State -->
	{#if stage === 'delivering'}
		<div class="stage-delivering">
			<DeliveryProgress {progress} stage={progressStage} />

			<!-- Office reveal counter -->
			<div class="reveal-counter" aria-live="polite">
				{#if revealedOffices > 0}
					<span class="revealed-count">{revealedOffices}</span>
					<span class="revealed-label">
						of {results.length} {results.length === 1 ? 'office' : 'offices'}
					</span>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Complete State -->
	{#if stage === 'complete' || stage === 'details'}
		<div class="stage-complete">
			<DeliveryConfirmation {summary} />

			<!-- Actions -->
			<div class="actions">
				<button class="action-button primary" onclick={handleViewDetails}>
					View Details
				</button>

				{#if hasRetryable}
					<button class="action-button secondary" onclick={handleRetry}>
						Retry Failed ({retryableResults.length})
					</button>
				{/if}
			</div>

			<!-- Unavailable explanation (if any) -->
			{#if summary.unavailable > 0}
				<p class="unavailable-note">
					{summary.unavailable}
					{summary.unavailable === 1 ? 'office is' : 'offices are'} not currently
					accepting messages through this system.
				</p>
			{/if}
		</div>
	{/if}
</div>

<!-- ============================================================================
     Styles
     ============================================================================ -->

<style>
	.journey-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
		min-height: 300px;
		padding: var(--space-lg, 1.5rem);
	}

	/* Acknowledging State */
	.stage-acknowledging {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-md, 1rem);
		padding: var(--space-xl, 2rem);
	}

	.pulse-indicator {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: oklch(0.65 0.15 250);
		animation: pulse 1.2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			transform: scale(1);
			opacity: 1;
		}
		50% {
			transform: scale(1.1);
			opacity: 0.8;
		}
	}

	.acknowledging-text {
		font-size: 1rem;
		color: var(--text-secondary, oklch(0.45 0.02 250));
		margin: 0;
	}

	/* Delivering State */
	.stage-delivering {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-lg, 1.5rem);
		width: 100%;
		max-width: 400px;
		padding: var(--space-xl, 2rem);
	}

	.reveal-counter {
		display: flex;
		align-items: baseline;
		gap: 0.375rem;
		min-height: 1.5rem;
	}

	.revealed-count {
		font-size: 1.5rem;
		font-weight: 600;
		color: oklch(0.65 0.15 250);
		font-variant-numeric: tabular-nums;
	}

	.revealed-label {
		font-size: 0.875rem;
		color: var(--text-secondary, oklch(0.45 0.02 250));
	}

	/* Complete State */
	.stage-complete {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-lg, 1.5rem);
		width: 100%;
		animation: fadeIn 300ms ease-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Actions */
	.actions {
		display: flex;
		gap: var(--space-sm, 0.5rem);
		flex-wrap: wrap;
		justify-content: center;
	}

	.action-button {
		padding: 0.75rem 1.5rem;
		border-radius: 8px;
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		transition:
			background-color 150ms ease-out,
			transform 150ms ease-out;
	}

	.action-button:hover {
		transform: translateY(-1px);
	}

	.action-button:active {
		transform: translateY(0);
	}

	.action-button.primary {
		background: oklch(0.65 0.15 250);
		color: white;
		border: none;
	}

	.action-button.primary:hover {
		background: oklch(0.55 0.15 250);
	}

	.action-button.secondary {
		background: transparent;
		color: oklch(0.45 0.02 250);
		border: 1px solid oklch(0.85 0.01 250);
	}

	.action-button.secondary:hover {
		background: oklch(0.97 0.01 250);
	}

	/* Unavailable Note */
	.unavailable-note {
		font-size: 0.8125rem;
		color: var(--text-tertiary, oklch(0.60 0.01 250));
		text-align: center;
		margin: 0;
		max-width: 320px;
		line-height: 1.5;
	}

	/* Responsive - Tablet */
	@media (max-width: 768px) {
		.stage-delivering {
			max-width: 100%;
			padding: var(--space-lg, 1.5rem);
		}
	}

	/* Responsive - Mobile */
	@media (max-width: 640px) {
		.journey-container {
			padding: var(--space-md, 1rem);
			min-height: 280px;
		}

		.stage-acknowledging {
			padding: var(--space-lg, 1.5rem);
		}

		.stage-delivering {
			padding: var(--space-lg, 1.5rem);
			gap: var(--space-md, 1rem);
		}

		.revealed-count {
			font-size: 1.25rem;
		}

		.actions {
			flex-direction: column;
			width: 100%;
			gap: var(--space-xs, 0.25rem);
		}

		/* Ensure 44px touch targets */
		.action-button {
			width: 100%;
			min-height: 44px;
			padding: 0.875rem 1.5rem;
			font-size: 1rem;
		}

		.unavailable-note {
			font-size: 0.875rem;
			max-width: 100%;
			padding: 0 var(--space-sm, 0.5rem);
		}
	}

	/* Responsive - Small phones */
	@media (max-width: 375px) {
		.journey-container {
			padding: var(--space-sm, 0.5rem);
		}

		.action-button {
			padding: 0.75rem 1rem;
		}
	}

	/* Safe area for notched devices */
	@supports (padding: env(safe-area-inset-bottom)) {
		.journey-container {
			padding-bottom: calc(var(--space-lg, 1.5rem) + env(safe-area-inset-bottom));
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.pulse-indicator {
			animation: none;
		}

		.stage-complete {
			animation: none;
		}
	}
</style>
