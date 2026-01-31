<script lang="ts">
	/**
	 * DistrictBreadcrumb: Polymorphic terminal breadcrumb segment
	 *
	 * PERCEPTUAL ENGINEERING:
	 * Three states, one position. Instant content swap - no competing transitions.
	 * Animations that fight for layout space are worse than no animation.
	 *
	 * States:
	 * 1. Known district: Breadcrumb segment with edit affordance on hover
	 * 2. Unknown: Dashed extension affordance ("Your District")
	 * 3. Editing: Inline address collection form
	 *
	 * INTERNATIONAL SUPPORT:
	 * - US: Congressional Districts (Census Bureau API)
	 * - UK: Parliamentary Constituencies (Postcode lookup)
	 * - FR: Circonscriptions (Commune lookup)
	 * - JP: 選挙区 (Address lookup)
	 * - BR: Distritos Eleitorais (Address lookup)
	 */

	import { createEventDispatcher } from 'svelte';
	import {
		type DistrictConfig,
		formatDistrictLabel
	} from '$lib/core/location/district-config';
	import InlineAddressResolver from './InlineAddressResolver.svelte';

	interface Props {
		/** Current district (null if unknown) */
		district: string | null;

		/** District configuration for this country */
		config: DistrictConfig;

		/** Current locality (city) for pre-filling */
		currentLocality?: string | null;

		/** Current state code for pre-filling */
		currentState?: string | null;

		/** Whether this breadcrumb is currently filtering */
		isSelected?: boolean;

		/** Whether parent is currently resolving (from LocationFilter) */
		parentIsResolving?: boolean;

		/** Error from parent resolution attempt */
		parentError?: string | null;
	}

	let {
		district,
		config,
		currentLocality,
		currentState,
		isSelected = false,
		parentIsResolving = false,
		parentError = null
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		filter: void;
		resolve: {
			street?: string;
			city?: string;
			state?: string;
			postalCode: string;
		};
	}>();

	// Simple state: are we showing the form?
	let isExpanded = $state(false);

	// Track the district value when we started editing (to detect changes)
	let districtWhenExpanded = $state<string | null>(null);

	// Track if we've submitted (waiting for parent to resolve)
	let hasSubmitted = $state(false);

	// Hover state for edit affordance
	let isHovering = $state(false);

	// Derived: Use parent's resolving/error state after submission
	const isResolving = $derived(hasSubmitted && parentIsResolving);
	const resolveError = $derived(hasSubmitted ? parentError : null);

	// Derived: formatted district label
	const formattedDistrict = $derived(
		district ? formatDistrictLabel(district, config) : null
	);

	// Handle filter click (when district is known)
	function handleFilterClick() {
		if (!isExpanded) {
			dispatch('filter');
		}
	}

	// Expand to show form
	function expand(e?: Event) {
		e?.stopPropagation();
		districtWhenExpanded = district; // Snapshot current value
		hasSubmitted = false; // Reset submission state (clears resolveError via derivation)
		isExpanded = true;
	}

	// Collapse back
	function collapse() {
		isExpanded = false;
		hasSubmitted = false;
		districtWhenExpanded = null;
	}

	// Handle address submission
	function handleAddressSubmit(
		event: CustomEvent<{
			street?: string;
			city?: string;
			state?: string;
			postalCode: string;
		}>
	) {
		hasSubmitted = true;
		dispatch('resolve', event.detail);
		// Parent handles API call and sets parentIsResolving/parentError
	}

	// Collapse when district CHANGES (successful resolution)
	$effect(() => {
		if (isExpanded && district !== districtWhenExpanded) {
			collapse();
		}
	});

	// Also collapse when parent finishes resolving successfully (no error, district set)
	$effect(() => {
		if (hasSubmitted && !parentIsResolving && !parentError && district) {
			collapse();
		}
	});
</script>

<!--
  PERCEPTUAL ENGINEERING:
  Instant swap between states. No competing fade transitions.
  The form appears immediately when requested - respect user intent.
-->
{#if isExpanded}
	<!-- EXPANDED: Address collection form -->
	<div class="resolver-wrapper">
		<InlineAddressResolver
			{config}
			locality={currentLocality}
			stateCode={currentState}
			{isResolving}
			error={resolveError}
			on:submit={handleAddressSubmit}
			on:cancel={collapse}
		/>
	</div>
{:else if district}
	<!-- KNOWN DISTRICT: Label + edit affordance -->
	<div
		class="segment-wrapper"
		role="group"
		onmouseenter={() => isHovering = true}
		onmouseleave={() => isHovering = false}
	>
		<button
			onclick={handleFilterClick}
			class="breadcrumb-segment"
			class:selected={isSelected}
			aria-label="Filter by {formattedDistrict}"
			title={config.label}
		>
			<span>{formattedDistrict}</span>
		</button>
		<button
			onclick={expand}
			class="edit-button"
			class:visible={isHovering}
			aria-label="Change your {config.label}"
			title="Change address"
		>
			<svg
				class="edit-icon"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
				aria-hidden="true"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
			</svg>
		</button>
	</div>
{:else}
	<!-- UNKNOWN: Extension affordance -->
	<button
		onclick={expand}
		class="breadcrumb-extension"
		aria-label="Find your {config.label}"
		title="Enter address to find your {config.label}"
	>
		<svg
			class="plus-icon"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="2"
			aria-hidden="true"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
		</svg>
		<span>{config.placeholder}</span>
	</button>
{/if}

<style>
	/* Wrapper for known district segment */
	.segment-wrapper {
		display: inline-flex;
		align-items: center;
		gap: 2px;
	}

	/* Known district: standard breadcrumb styling */
	.breadcrumb-segment {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		border-radius: 6px;
		border: none;
		background: transparent;
		color: var(--color-text-secondary, #475569);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 150ms ease-out, color 150ms ease-out;
	}

	.breadcrumb-segment:hover {
		background: var(--color-bg-hover, #f1f5f9);
		color: var(--color-text-primary, #1e293b);
	}

	.breadcrumb-segment.selected {
		background: var(--color-bg-selected, #f1f5f9);
		color: var(--color-text-primary, #1e293b);
	}

	.breadcrumb-segment:focus-visible {
		outline: 2px solid var(--color-primary, #3b82f6);
		outline-offset: 2px;
	}

	/* Edit button (pencil) - appears on hover */
	.edit-button {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 4px;
		border: none;
		border-radius: 4px;
		background: transparent;
		color: var(--color-text-tertiary, #94a3b8);
		cursor: pointer;
		opacity: 0;
		transition: opacity 150ms ease-out, background 150ms ease-out, color 150ms ease-out;
	}

	.edit-button.visible {
		opacity: 1;
	}

	.edit-button:hover {
		background: var(--color-bg-hover, #f1f5f9);
		color: var(--color-text-secondary, #475569);
	}

	.edit-button:focus-visible {
		opacity: 1;
		outline: 2px solid var(--color-primary, #3b82f6);
		outline-offset: 1px;
	}

	.edit-icon {
		width: 14px;
		height: 14px;
	}

	/* Extension affordance: dashed border */
	.breadcrumb-extension {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		border: 1.5px dashed var(--color-border-muted, #cbd5e1);
		border-radius: 9999px;
		background: transparent;
		color: var(--color-text-tertiary, #64748b);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: border-color 150ms ease-out, background 150ms ease-out, color 150ms ease-out;
	}

	.breadcrumb-extension:hover {
		border-color: var(--color-border-strong, #94a3b8);
		background: var(--color-bg-hover, #f8fafc);
		color: var(--color-text-secondary, #475569);
	}

	.breadcrumb-extension:focus-visible {
		outline: 2px solid var(--color-primary, #3b82f6);
		outline-offset: 2px;
	}

	/* Subtle attention pulse on first view */
	@keyframes gentle-pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.7; }
	}

	.breadcrumb-extension:not(:hover):not(:focus) {
		animation: gentle-pulse 2.5s ease-in-out 1;
	}

	.plus-icon {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
	}

	/* Resolver wrapper */
	.resolver-wrapper {
		display: inline-flex;
	}

	/* Mobile: form takes full width below breadcrumb */
	@media (max-width: 640px) {
		.resolver-wrapper {
			width: 100%;
			margin-top: 8px;
		}
	}
</style>
