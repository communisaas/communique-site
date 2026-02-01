<!--
  OfficeDetails.svelte

  Expandable list of individual office delivery results.
  Shows grouped offices by legislative body with status icons and outcome details.

  Based on: docs/temp/CWC-FEEDBACK-REDESIGN.md (Section 5D)

  Design Principles:
  - Secondary information, on-demand
  - Group by body (configurable via LegislatureConfig)
  - Status icons: checkmark (delivered), X (failed), circle (unavailable)
  - Color coding per outcome type (green/red/gray)
  - Click to copy confirmation IDs
  - Legislature-agnostic design
-->
<script lang="ts">
	import type { DeliveryResult, LegislatureConfig } from './delivery-types';
	import { LEGISLATURE_CONFIGS } from './delivery-types';
	import {
		groupByBody,
		formatLocation,
		getOutcomeLabel,
		formatConfirmationId
	} from './delivery-utils';
	import { CheckCircle2, XCircle, Circle, Copy, Check, RotateCcw } from 'lucide-svelte';
	import { slide } from 'svelte/transition';

	// ============================================================================
	// Props
	// ============================================================================

	interface Props {
		results: DeliveryResult[];
		expanded: boolean;
		/** Legislature configuration */
		config?: LegislatureConfig;
	}

	let { results, expanded, config = LEGISLATURE_CONFIGS.US_CONGRESS }: Props = $props();

	// ============================================================================
	// State
	// ============================================================================

	/**
	 * Track which confirmation IDs have been copied
	 * Key: confirmation ID, Value: timeout ID for resetting
	 */
	let copiedIds = $state<Set<string>>(new Set());

	// ============================================================================
	// Computed
	// ============================================================================

	/**
	 * Results grouped by body
	 */
	let grouped = $derived(groupByBody(results, config.bodies.map((b) => b.id)));

	// ============================================================================
	// Helpers
	// ============================================================================

	/**
	 * Get the appropriate icon component for an outcome
	 */
	function getIconComponent(outcome: DeliveryResult['outcome']) {
		switch (outcome) {
			case 'delivered':
				return CheckCircle2;
			case 'failed':
				return XCircle;
			case 'unavailable':
				return Circle;
		}
	}

	/**
	 * Get the CSS class for an outcome's color
	 */
	function getOutcomeColorClass(outcome: DeliveryResult['outcome']): string {
		switch (outcome) {
			case 'delivered':
				return 'outcome-delivered';
			case 'failed':
				return 'outcome-failed';
			case 'unavailable':
				return 'outcome-unavailable';
		}
	}

	/**
	 * Get detailed message for an outcome
	 */
	function getOutcomeMessage(result: DeliveryResult): string {
		switch (result.outcome) {
			case 'delivered':
				return 'Message delivered successfully';
			case 'failed':
				return result.error || 'Delivery failed';
			case 'unavailable':
				return 'Not accepting messages through this system';
		}
	}

	/**
	 * Copy confirmation ID to clipboard
	 */
	async function copyConfirmationId(id: string) {
		try {
			await navigator.clipboard.writeText(id);
			copiedIds.add(id);
			// Trigger reactivity
			copiedIds = new Set(copiedIds);

			// Reset after 2 seconds
			setTimeout(() => {
				copiedIds.delete(id);
				copiedIds = new Set(copiedIds);
			}, 2000);
		} catch {
			// Clipboard API might fail in some contexts
			console.error('Failed to copy confirmation ID');
		}
	}
</script>

<!-- ============================================================================
     Template
     ============================================================================ -->

{#if expanded}
	<div
		class="office-details"
		role="region"
		aria-label="Delivery details by office"
		transition:slide={{ duration: 300 }}
	>
		<!-- Body Results (dynamic from config) -->
		{#each config.bodies as bodyConfig}
			{@const bodyResults = grouped[bodyConfig.id] || []}
			{#if bodyResults.length > 0}
				<div class="body-group">
					<h3 class="body-heading">{bodyConfig.displayName}</h3>
					<ul class="office-list" role="list">
						{#each bodyResults as result (result.office)}
							<li class="office-item {getOutcomeColorClass(result.outcome)}">
								<div class="office-status">
									<span class="status-icon" aria-hidden="true">
										<svelte:component
											this={getIconComponent(result.outcome)}
											size={20}
											strokeWidth={2}
										/>
									</span>
								</div>

								<div class="office-info">
									<div class="office-header">
										<span class="office-name">{result.office}</span>
										<span class="office-location">{formatLocation(result)}</span>
									</div>

									<div class="office-outcome">
										<span class="outcome-label">{getOutcomeLabel(result.outcome)}</span>
										<span class="outcome-message">{getOutcomeMessage(result)}</span>
									</div>

									<!-- Confirmation ID for delivered -->
									{#if result.outcome === 'delivered' && result.confirmationId}
										<button
											class="confirmation-id"
											onclick={() => copyConfirmationId(result.confirmationId!)}
											title="Click to copy full confirmation ID"
											aria-label="Copy confirmation ID {result.confirmationId}"
										>
											<span class="confirmation-text">
												ID: {formatConfirmationId(result.confirmationId)}
											</span>
											<span class="copy-icon">
												{#if copiedIds.has(result.confirmationId)}
													<Check size={14} />
												{:else}
													<Copy size={14} />
												{/if}
											</span>
										</button>
									{/if}

									<!-- Retry indicator for failed -->
									{#if result.outcome === 'failed' && result.retryable !== false}
										<div class="retry-indicator">
											<RotateCcw size={14} />
											<span>Can be retried</span>
										</div>
									{/if}

									<!-- Permanent unavailable explanation -->
									{#if result.outcome === 'unavailable'}
										<div class="unavailable-note">
											<span>This is a permanent condition - not retryable</span>
										</div>
									{/if}
								</div>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		{/each}
	</div>
{/if}

<!-- ============================================================================
     Styles
     ============================================================================ -->

<style>
	.office-details {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg, 1.5rem);
		padding: var(--space-md, 1rem);
		background: oklch(0.98 0.005 250);
		border-radius: 12px;
		border: 1px solid oklch(0.92 0.01 250);
	}

	/* Body Groups */
	.body-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm, 0.5rem);
	}

	.body-heading {
		font-size: var(--text-detail, 0.875rem);
		font-weight: 600;
		color: var(--text-secondary, oklch(0.45 0.02 250));
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0;
		padding: 0 var(--space-xs, 0.25rem);
	}

	/* Office List */
	.office-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs, 0.25rem);
	}

	.office-item {
		display: flex;
		gap: var(--space-sm, 0.5rem);
		padding: var(--space-sm, 0.5rem) var(--space-md, 1rem);
		background: white;
		border-radius: 8px;
		border-left: 3px solid transparent;
		transition: background-color 150ms ease;
	}

	.office-item:hover {
		background: oklch(0.99 0.005 250);
	}

	/* Outcome color coding */
	.office-item.outcome-delivered {
		border-left-color: oklch(0.7 0.17 145); /* Green */
	}

	.office-item.outcome-failed {
		border-left-color: oklch(0.65 0.2 25); /* Red */
	}

	.office-item.outcome-unavailable {
		border-left-color: oklch(0.75 0.08 250); /* Gray-blue */
	}

	/* Status Icon */
	.office-status {
		flex-shrink: 0;
		display: flex;
		align-items: flex-start;
		padding-top: 2px;
	}

	.status-icon {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.outcome-delivered .status-icon {
		color: oklch(0.7 0.17 145); /* Green */
	}

	.outcome-failed .status-icon {
		color: oklch(0.65 0.2 25); /* Red */
	}

	.outcome-unavailable .status-icon {
		color: oklch(0.65 0.05 250); /* Gray */
	}

	/* Office Info */
	.office-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs, 0.25rem);
	}

	.office-header {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-sm, 0.5rem);
	}

	.office-name {
		font-size: var(--text-detail, 0.875rem);
		font-weight: 500;
		color: var(--text-primary, oklch(0.2 0.02 250));
	}

	.office-location {
		font-size: var(--text-micro, 0.75rem);
		color: var(--text-tertiary, oklch(0.6 0.01 250));
		font-variant-numeric: tabular-nums;
	}

	/* Outcome Details */
	.office-outcome {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-xs, 0.25rem);
	}

	.outcome-label {
		font-size: var(--text-micro, 0.75rem);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.outcome-delivered .outcome-label {
		color: oklch(0.55 0.14 145);
	}

	.outcome-failed .outcome-label {
		color: oklch(0.55 0.18 25);
	}

	.outcome-unavailable .outcome-label {
		color: oklch(0.55 0.04 250);
	}

	.outcome-message {
		font-size: var(--text-micro, 0.75rem);
		color: var(--text-tertiary, oklch(0.6 0.01 250));
	}

	/* Confirmation ID Button */
	.confirmation-id {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs, 0.25rem);
		padding: 2px 6px;
		background: oklch(0.96 0.02 145 / 0.5);
		border: 1px solid oklch(0.85 0.08 145);
		border-radius: 4px;
		cursor: pointer;
		transition: all 150ms ease;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		width: fit-content;
	}

	.confirmation-id:hover {
		background: oklch(0.93 0.04 145 / 0.7);
		border-color: oklch(0.75 0.12 145);
	}

	.confirmation-id:focus-visible {
		outline: 2px solid oklch(0.65 0.15 250);
		outline-offset: 2px;
	}

	.confirmation-text {
		font-size: var(--text-micro, 0.75rem);
		color: oklch(0.4 0.08 145);
	}

	.copy-icon {
		display: flex;
		align-items: center;
		color: oklch(0.5 0.1 145);
	}

	/* Retry Indicator */
	.retry-indicator {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs, 0.25rem);
		font-size: var(--text-micro, 0.75rem);
		color: oklch(0.55 0.15 60); /* Amber */
		padding: 2px 6px;
		background: oklch(0.96 0.04 60 / 0.4);
		border-radius: 4px;
		width: fit-content;
	}

	/* Unavailable Note */
	.unavailable-note {
		font-size: var(--text-micro, 0.75rem);
		color: oklch(0.55 0.03 250);
		font-style: italic;
	}

	/* Responsive Design */
	@media (max-width: 640px) {
		.office-details {
			padding: var(--space-sm, 0.5rem);
			gap: var(--space-md, 1rem);
		}

		.office-item {
			padding: var(--space-sm, 0.5rem);
		}

		.office-header {
			flex-direction: column;
			gap: 2px;
		}

		.office-outcome {
			flex-direction: column;
			gap: 2px;
		}
	}

	/* Accessibility - Reduced Motion */
	@media (prefers-reduced-motion: reduce) {
		.office-item {
			transition: none;
		}

		.confirmation-id {
			transition: none;
		}
	}
</style>
