<script lang="ts">
	/**
	 * CoordinationExplainer - Perceptual Engineering
	 *
	 * The "how it works" section containing the RelayLoom visualization.
	 * This is CONTEXTUAL content - users who want to understand the
	 * coordination mechanism can expand this section.
	 *
	 * Cognitive principle: Progressive disclosure
	 * Primary affordances (create/browse) are immediately visible.
	 * The "why" explanation is available but not required for action.
	 *
	 * The collapsed state shows a compelling teaser. Expansion
	 * reveals the full RelayLoom with narrative content.
	 */

import { ChevronDown } from '@lucide/svelte';
import RelayLoom from '../hero/RelayLoom.svelte';

let isExpanded = $state(false);
let loomEpoch = $state(0);

function toggleExpanded() {
	const willExpand = !isExpanded;
	isExpanded = willExpand;

	// Force the loom to remount whenever we open the explainer so
	// the edge choreography plays from frame zero instead of staying paused
	if (willExpand) {
		loomEpoch += 1;
	}
}
</script>

<section class="coordination-explainer" class:expanded={isExpanded}>
	<!-- Teaser header - always visible -->
	<button
		type="button"
		class="explainer-header"
		onclick={toggleExpanded}
		aria-expanded={isExpanded}
		aria-controls="explainer-content"
	>
		<div class="header-content">
			<h2 class="header-title">How coordination works</h2>
			<p class="header-teaser">
				{isExpanded
					? 'Click any node to learn more'
					: 'One complaint gets buried. Coordinated messages make impact.'}
			</p>
		</div>
		<div class="header-toggle">
			<span class="toggle-label">{isExpanded ? 'Collapse' : 'See how'}</span>
			<ChevronDown class="toggle-icon {isExpanded ? 'rotated' : ''}" />
		</div>
	</button>

	<!-- Expandable content -->
	<div
		id="explainer-content"
		class="explainer-content"
		class:visible={isExpanded}
		aria-hidden={!isExpanded}
	>
		<!-- Single inner wrapper for proper grid collapse -->
		<div class="content-inner">
			<div class="loom-container">
				{#if isExpanded}
					{@key loomEpoch}
						<RelayLoom embedded={true} />
				{/if}
			</div>

			<!-- Summary points -->
			<div class="summary-points">
				<div class="point">
					<span class="point-number">1</span>
					<div class="point-content">
						<strong>Write once</strong>
						<span>Describe your grievance. Pick who decides.</span>
					</div>
				</div>
				<div class="point">
					<span class="point-number">2</span>
					<div class="point-content">
						<strong>Share the link</strong>
						<span>Anyone who shares your problem can send it too.</span>
					</div>
				</div>
				<div class="point">
					<span class="point-number">3</span>
					<div class="point-content">
						<strong>Impact together</strong>
						<span>Decision-makers see coordinated pressure, not isolated complaints.</span>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>

<style>
	/*
	 * CoordinationExplainer Styles
	 *
	 * Collapsed: Minimal teaser with subtle invitation
	 * Expanded: Full loom visualization with summary points
	 */

	.coordination-explainer {
		border-radius: 16px;
		border: 1px solid oklch(0.88 0.02 250);
		background: oklch(0.99 0.005 250);
		overflow: hidden;
		transition: box-shadow 300ms ease-out;
	}

	/*
	 * Allow expanded nodes to overflow container bounds.
	 * CRITICAL: Must use :global() because .is-expanded is in RelayLoom.svelte
	 * which has a different Svelte scope hash. Without :global(), selector never matches.
	 */
	.coordination-explainer:has(:global(.is-expanded)) {
		overflow: visible;
	}

	.coordination-explainer.expanded {
		box-shadow:
			0 4px 20px -4px oklch(0.5 0.05 250 / 0.12),
			0 12px 40px -8px oklch(0.4 0.08 250 / 0.08);
	}

	/* Header - always visible */
	.explainer-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 1.25rem 1.5rem;
		border: none;
		background: transparent;
		cursor: pointer;
		text-align: left;
		transition: background 200ms ease-out;
	}

	.explainer-header:hover {
		background: oklch(0.97 0.01 250);
	}

	.header-content {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.header-title {
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 1rem;
		font-weight: 600;
		color: oklch(0.25 0.02 250);
		margin: 0;
	}

	.header-teaser {
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.875rem;
		color: oklch(0.5 0.02 250);
		margin: 0;
	}

	.header-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.toggle-label {
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.8125rem;
		font-weight: 500;
		color: oklch(0.55 0.1 195);
	}

	.header-toggle :global(.toggle-icon) {
		width: 1.25rem;
		height: 1.25rem;
		color: oklch(0.55 0.1 195);
		transition: transform 300ms ease-out;
	}

	.header-toggle :global(.toggle-icon.rotated) {
		transform: rotate(180deg);
	}

	/* Content - expandable */
	.explainer-content {
		display: grid;
		grid-template-rows: 0fr;
		opacity: 0;
		transition:
			grid-template-rows 400ms cubic-bezier(0.4, 0, 0.2, 1),
			opacity 300ms ease-out;
	}

	.explainer-content.visible {
		grid-template-rows: 1fr;
		opacity: 1;
	}

	/* Single wrapper gets overflow hidden for proper collapse */
	.content-inner {
		overflow: hidden;
	}

	/*
	 * When a node is expanded, allow it to overflow the container.
	 * CRITICAL: Must use :global() - same scoping issue as above.
	 */
	.content-inner:has(:global(.is-expanded)) {
		overflow: visible;
	}

	.loom-container {
		padding: 0 0.75rem;
	}

	@media (min-width: 640px) {
		.loom-container {
			padding: 0 1rem;
		}
	}

	/* Summary points */
	.summary-points {
		display: grid;
		gap: 1rem;
		padding: 1rem 1.5rem;
		border-top: 1px solid oklch(0.92 0.01 250);
		background: oklch(0.98 0.005 250);
	}

	@media (min-width: 640px) {
		.summary-points {
			grid-template-columns: repeat(3, 1fr);
			gap: 1.5rem;
		}
	}

	.point {
		display: flex;
		gap: 0.75rem;
	}

	.point-number {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		flex-shrink: 0;
		border-radius: 50%;
		background: oklch(0.6 0.12 195);
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.75rem;
		font-weight: 700;
		color: white;
	}

	.point-content {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.point-content strong {
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.875rem;
		font-weight: 600;
		color: oklch(0.25 0.02 250);
	}

	.point-content span {
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.8125rem;
		color: oklch(0.5 0.02 250);
		line-height: 1.4;
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.explainer-content {
			transition: none;
		}

		.header-toggle :global(.toggle-icon) {
			transition: none;
		}
	}
</style>
