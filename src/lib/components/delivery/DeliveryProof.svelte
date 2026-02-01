<!--
  DeliveryProof.svelte

  Shareable proof/receipt card for congressional message delivery.
  Provides copy, share, and download functionality for delivery confirmation.

  Based on: docs/temp/CWC-FEEDBACK-REDESIGN.md (Section 5E)

  Design Principles:
  - Clean, professional aesthetic suitable for sharing
  - Card-like appearance with subtle border/shadow
  - Compact office list grouped by chamber
  - Multiple sharing options (copy, native share, download)
-->
<script lang="ts">
	import type { DeliveryResult } from './delivery-types';
	import {
		generateReceiptText,
		computeSummary,
		groupByChamber,
		formatLocation
	} from './delivery-utils';
	import { Copy, Share2, Download, Check, FileText } from 'lucide-svelte';

	// ============================================================================
	// Props
	// ============================================================================

	interface Props {
		/** Unique submission identifier */
		submissionId: string;

		/** Array of delivery results */
		results: DeliveryResult[];

		/** When submission was made */
		timestamp: Date;

		/** Optional title of the template used */
		templateTitle?: string;
	}

	let { submissionId, results, timestamp, templateTitle }: Props = $props();

	// ============================================================================
	// State
	// ============================================================================

	/** Whether copy action recently succeeded */
	let copySuccess = $state(false);

	/** Whether share API is available */
	let canShare = $state(false);

	// ============================================================================
	// Derived State
	// ============================================================================

	/** Compute delivery summary */
	let summary = $derived(computeSummary(results));

	/** Group results by chamber */
	let groupedResults = $derived(groupByChamber(results));

	/** Generate receipt text for sharing */
	let receiptText = $derived(generateReceiptText(submissionId, results, templateTitle, timestamp));

	/** Formatted date string */
	let formattedDate = $derived(
		timestamp.toLocaleDateString('en-US', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		})
	);

	/** Formatted time string */
	let formattedTime = $derived(
		timestamp.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		})
	);

	/** Truncated reference ID for display */
	let displayRefId = $derived(
		submissionId.length > 16 ? `${submissionId.slice(0, 8)}...${submissionId.slice(-6)}` : submissionId
	);

	// ============================================================================
	// Lifecycle
	// ============================================================================

	$effect(() => {
		// Check if Web Share API is available
		canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
	});

	// ============================================================================
	// Actions
	// ============================================================================

	/**
	 * Copy receipt text to clipboard
	 */
	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(receiptText);
			copySuccess = true;

			// Reset after 2 seconds
			setTimeout(() => {
				copySuccess = false;
			}, 2000);
		} catch (error) {
			console.error('Failed to copy receipt:', error);
		}
	}

	/**
	 * Share using native Web Share API
	 * Falls back to copy if share fails
	 */
	async function handleShare() {
		if (canShare) {
			try {
				await navigator.share({
					title: 'Congressional Message Receipt',
					text: receiptText
				});
			} catch (error) {
				// User cancelled or share failed - fallback to copy
				if ((error as Error).name !== 'AbortError') {
					await handleCopy();
				}
			}
		} else {
			// Fallback to copy
			await handleCopy();
		}
	}

	/**
	 * Download receipt as text file
	 */
	function handleDownload() {
		const blob = new Blob([receiptText], { type: 'text/plain;charset=utf-8' });
		const url = URL.createObjectURL(blob);

		const link = document.createElement('a');
		link.href = url;
		link.download = `congressional-receipt-${submissionId.slice(0, 8)}.txt`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);

		URL.revokeObjectURL(url);
	}

	/**
	 * Get status indicator for an outcome
	 */
	function getStatusIndicator(outcome: DeliveryResult['outcome']): string {
		switch (outcome) {
			case 'delivered':
				return 'delivered';
			case 'failed':
				return 'failed';
			case 'unavailable':
				return 'unavailable';
		}
	}
</script>

<!-- ============================================================================
     Template
     ============================================================================ -->

<article class="proof-card" aria-label="Congressional Message Receipt">
	<!-- Header -->
	<header class="proof-header">
		<div class="header-icon">
			<FileText size={20} strokeWidth={1.5} />
		</div>
		<h2 class="header-title">Your Congressional Message Receipt</h2>
	</header>

	<!-- Summary Section -->
	<section class="proof-summary">
		<div class="summary-row">
			<span class="summary-label">Date</span>
			<span class="summary-value">{formattedDate}</span>
		</div>
		<div class="summary-row">
			<span class="summary-label">Time</span>
			<span class="summary-value">{formattedTime}</span>
		</div>
		<div class="summary-row">
			<span class="summary-label">Reference</span>
			<span class="summary-value reference-id" title={submissionId}>{displayRefId}</span>
		</div>
		<div class="summary-row highlight">
			<span class="summary-label">Delivered</span>
			<span class="summary-value delivery-count">
				<span class="count-success">{summary.delivered}</span>
				<span class="count-separator">of</span>
				<span class="count-total">{summary.total}</span>
				<span class="count-label">{summary.total === 1 ? 'office' : 'offices'}</span>
			</span>
		</div>
	</section>

	<!-- Template Title (if provided) -->
	{#if templateTitle}
		<section class="proof-topic">
			<span class="topic-label">Topic</span>
			<span class="topic-value">{templateTitle}</span>
		</section>
	{/if}

	<!-- Office List (grouped by chamber) -->
	<section class="proof-offices">
		{#if groupedResults.senate.length > 0}
			<div class="chamber-group">
				<h3 class="chamber-title">Senate</h3>
				<ul class="office-list">
					{#each groupedResults.senate as result}
						<li class="office-item status-{getStatusIndicator(result.outcome)}">
							<span class="office-status-icon" aria-hidden="true">
								{#if result.outcome === 'delivered'}
									<Check size={14} strokeWidth={2.5} />
								{:else if result.outcome === 'failed'}
									<span class="status-x">x</span>
								{:else}
									<span class="status-circle">o</span>
								{/if}
							</span>
							<span class="office-name">{result.office}</span>
							<span class="office-location">({result.state})</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		{#if groupedResults.house.length > 0}
			<div class="chamber-group">
				<h3 class="chamber-title">House</h3>
				<ul class="office-list">
					{#each groupedResults.house as result}
						<li class="office-item status-{getStatusIndicator(result.outcome)}">
							<span class="office-status-icon" aria-hidden="true">
								{#if result.outcome === 'delivered'}
									<Check size={14} strokeWidth={2.5} />
								{:else if result.outcome === 'failed'}
									<span class="status-x">x</span>
								{:else}
									<span class="status-circle">o</span>
								{/if}
							</span>
							<span class="office-name">{result.office}</span>
							<span class="office-location">({formatLocation(result)})</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</section>

	<!-- Action Buttons -->
	<footer class="proof-actions">
		<button
			type="button"
			class="action-btn"
			onclick={handleCopy}
			aria-label={copySuccess ? 'Copied to clipboard' : 'Copy receipt text'}
		>
			{#if copySuccess}
				<Check size={18} strokeWidth={2} class="icon-success" />
				<span>Copied</span>
			{:else}
				<Copy size={18} strokeWidth={1.5} />
				<span>Copy</span>
			{/if}
		</button>

		<button
			type="button"
			class="action-btn"
			onclick={handleShare}
			aria-label="Share receipt"
		>
			<Share2 size={18} strokeWidth={1.5} />
			<span>Share</span>
		</button>

		<button
			type="button"
			class="action-btn"
			onclick={handleDownload}
			aria-label="Download receipt as text file"
		>
			<Download size={18} strokeWidth={1.5} />
			<span>Download</span>
		</button>
	</footer>

	<!-- Footer Branding -->
	<div class="proof-branding">
		<span>Sent via communi.email</span>
	</div>
</article>

<!-- ============================================================================
     Styles
     ============================================================================ -->

<style>
	/* Card Container */
	.proof-card {
		background: white;
		border: 1px solid oklch(0.90 0.01 250);
		border-radius: 12px;
		box-shadow:
			0 1px 3px rgba(0, 0, 0, 0.05),
			0 4px 12px rgba(0, 0, 0, 0.04);
		overflow: hidden;
		max-width: 420px;
		width: 100%;
	}

	/* Header */
	.proof-header {
		display: flex;
		align-items: center;
		gap: var(--space-sm, 0.5rem);
		padding: var(--space-md, 1rem) var(--space-lg, 1.5rem);
		background: linear-gradient(
			135deg,
			oklch(0.97 0.015 250) 0%,
			oklch(0.98 0.01 200) 100%
		);
		border-bottom: 1px solid oklch(0.92 0.01 250);
	}

	.header-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 8px;
		background: white;
		color: oklch(0.55 0.12 250);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
	}

	.header-title {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--text-primary, oklch(0.20 0.02 250));
		margin: 0;
	}

	/* Summary Section */
	.proof-summary {
		padding: var(--space-md, 1rem) var(--space-lg, 1.5rem);
		display: flex;
		flex-direction: column;
		gap: var(--space-xs, 0.25rem);
	}

	.summary-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-xs, 0.25rem) 0;
	}

	.summary-row.highlight {
		margin-top: var(--space-xs, 0.25rem);
		padding-top: var(--space-sm, 0.5rem);
		border-top: 1px solid oklch(0.94 0.005 250);
	}

	.summary-label {
		font-size: var(--text-detail, 0.875rem);
		color: var(--text-secondary, oklch(0.45 0.02 250));
	}

	.summary-value {
		font-size: var(--text-detail, 0.875rem);
		color: var(--text-primary, oklch(0.20 0.02 250));
		font-weight: 500;
	}

	.reference-id {
		font-family: ui-monospace, 'SF Mono', 'Cascadia Code', monospace;
		font-size: 0.8125rem;
		color: var(--text-tertiary, oklch(0.55 0.01 250));
	}

	.delivery-count {
		display: flex;
		align-items: baseline;
		gap: 0.25rem;
	}

	.count-success {
		font-size: 1.125rem;
		font-weight: 700;
		color: oklch(0.55 0.17 145);
	}

	.count-separator,
	.count-total,
	.count-label {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--text-secondary, oklch(0.45 0.02 250));
	}

	/* Topic Section */
	.proof-topic {
		padding: 0 var(--space-lg, 1.5rem) var(--space-md, 1rem);
		display: flex;
		flex-direction: column;
		gap: var(--space-xs, 0.25rem);
	}

	.topic-label {
		font-size: var(--text-micro, 0.75rem);
		color: var(--text-tertiary, oklch(0.60 0.01 250));
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.topic-value {
		font-size: var(--text-detail, 0.875rem);
		color: var(--text-primary, oklch(0.20 0.02 250));
		font-weight: 500;
		line-height: 1.4;
	}

	/* Office List */
	.proof-offices {
		padding: 0 var(--space-lg, 1.5rem) var(--space-md, 1rem);
		display: flex;
		flex-direction: column;
		gap: var(--space-md, 1rem);
	}

	.chamber-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs, 0.25rem);
	}

	.chamber-title {
		font-size: var(--text-micro, 0.75rem);
		font-weight: 600;
		color: var(--text-tertiary, oklch(0.60 0.01 250));
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0;
	}

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
		align-items: center;
		gap: var(--space-sm, 0.5rem);
		font-size: var(--text-detail, 0.875rem);
		padding: var(--space-xs, 0.25rem) 0;
	}

	.office-status-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		flex-shrink: 0;
	}

	.status-delivered .office-status-icon {
		color: oklch(0.55 0.17 145);
	}

	.status-failed .office-status-icon {
		color: oklch(0.55 0.20 25);
	}

	.status-unavailable .office-status-icon {
		color: oklch(0.60 0.02 250);
	}

	.status-x {
		font-size: 0.875rem;
		font-weight: 700;
		line-height: 1;
	}

	.status-circle {
		font-size: 0.75rem;
		font-weight: 500;
		line-height: 1;
	}

	.office-name {
		color: var(--text-primary, oklch(0.20 0.02 250));
		font-weight: 500;
	}

	.status-unavailable .office-name {
		color: var(--text-secondary, oklch(0.45 0.02 250));
	}

	.office-location {
		color: var(--text-tertiary, oklch(0.60 0.01 250));
		font-size: 0.8125rem;
	}

	/* Actions */
	.proof-actions {
		display: flex;
		gap: var(--space-sm, 0.5rem);
		padding: var(--space-md, 1rem) var(--space-lg, 1.5rem);
		border-top: 1px solid oklch(0.94 0.005 250);
		background: oklch(0.985 0.002 250);
	}

	.action-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-xs, 0.25rem);
		padding: var(--space-sm, 0.5rem) var(--space-md, 1rem);
		border: 1px solid oklch(0.88 0.01 250);
		border-radius: 8px;
		background: white;
		color: var(--text-secondary, oklch(0.45 0.02 250));
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		transition:
			background-color 150ms ease-out,
			border-color 150ms ease-out,
			color 150ms ease-out,
			transform 100ms ease-out;
	}

	.action-btn:hover {
		background: oklch(0.97 0.005 250);
		border-color: oklch(0.82 0.02 250);
		color: var(--text-primary, oklch(0.20 0.02 250));
	}

	.action-btn:active {
		transform: scale(0.98);
	}

	.action-btn:focus-visible {
		outline: 2px solid oklch(0.65 0.15 250);
		outline-offset: 2px;
	}

	/* Success state for copy button */
	.action-btn :global(.icon-success) {
		color: oklch(0.55 0.17 145);
	}

	/* Branding */
	.proof-branding {
		padding: var(--space-sm, 0.5rem) var(--space-lg, 1.5rem);
		text-align: center;
		font-size: var(--text-micro, 0.75rem);
		color: var(--text-tertiary, oklch(0.65 0.01 250));
		background: oklch(0.985 0.002 250);
		border-top: 1px solid oklch(0.95 0.002 250);
	}

	/* Responsive Design */
	@media (max-width: 480px) {
		.proof-card {
			border-radius: 8px;
		}

		.proof-header {
			padding: var(--space-sm, 0.5rem) var(--space-md, 1rem);
		}

		.header-title {
			font-size: 0.875rem;
		}

		.proof-summary,
		.proof-topic,
		.proof-offices,
		.proof-actions {
			padding-left: var(--space-md, 1rem);
			padding-right: var(--space-md, 1rem);
		}

		.action-btn {
			padding: var(--space-sm, 0.5rem);
			font-size: 0.75rem;
		}

		.action-btn span {
			display: none;
		}

		.action-btn :global(svg) {
			width: 20px;
			height: 20px;
		}
	}

	/* Print styles */
	@media print {
		.proof-card {
			box-shadow: none;
			border: 1px solid #ccc;
		}

		.proof-actions {
			display: none;
		}
	}

	/* Accessibility - Reduced Motion */
	@media (prefers-reduced-motion: reduce) {
		.action-btn {
			transition: none;
		}
	}

	/* High contrast mode */
	@media (prefers-contrast: high) {
		.proof-card {
			border-width: 2px;
			border-color: #000;
		}

		.action-btn {
			border-width: 2px;
		}
	}
</style>
