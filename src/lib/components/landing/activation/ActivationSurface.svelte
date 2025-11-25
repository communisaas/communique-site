<script lang="ts">
	/**
	 * ActivationSurface - Perceptual Engineering
	 *
	 * The split-screen activation pattern that makes both primary affordances
	 * immediately visible and actionable:
	 *
	 * LEFT: Creation Spark (write something new)
	 * RIGHT: Template Stream (join existing campaigns)
	 *
	 * Cognitive principle: Spatial encoding
	 * Left = your voice (creation), Right = together (joining)
	 * Maps directly to "Your voice. Sent together."
	 *
	 * On mobile: Stacked vertically with creation spark collapsed
	 * by default, templates immediately visible.
	 */

	import { createEventDispatcher } from 'svelte';
	import { ChevronDown, PenLine } from '@lucide/svelte';
	import CreationSpark from './CreationSpark.svelte';
	import TemplateList from '../template/TemplateList.svelte';
	import LocationFilter from '../template/LocationFilter.svelte';
	import type { Template, TemplateGroup, TemplateCreationContext } from '$lib/types/template';

	const dispatch = createEventDispatcher<{
		selectTemplate: { id: string };
		createTemplate: { context: TemplateCreationContext; initialText?: string };
	}>();

	interface Props {
		templates: Template[];
		groups: TemplateGroup[];
		selectedId: string | null;
		loading?: boolean;
		onFilterChange?: (groups: TemplateGroup[]) => void;
		onNextUnlockChange?: (unlock: { level: 'city' | 'district'; count: number } | null) => void;
		onAddressModalOpen?: (handler: () => void) => void;
	}

	let {
		templates,
		groups,
		selectedId,
		loading = false,
		onFilterChange,
		onNextUnlockChange,
		onAddressModalOpen
	}: Props = $props();

	// Mobile: collapse creation spark by default
	let mobileSparkExpanded = $state(false);

	function handleSparkActivate(event: CustomEvent<{ initialText: string }>) {
		dispatch('createTemplate', {
			context: {
				channelId: 'direct',
				channelTitle: 'Direct Outreach',
				isCongressional: false
			},
			initialText: event.detail.initialText
		});
	}

	function handleTemplateSelect(id: string) {
		dispatch('selectTemplate', { id });
	}

	function handleMobileSparkToggle() {
		mobileSparkExpanded = !mobileSparkExpanded;
	}
</script>

<div class="activation-surface">
	<!-- Desktop: Side-by-side layout -->
	<div class="desktop-layout">
		<!-- Left: Creation Spark -->
		<div class="creation-column">
			<CreationSpark on:activate={handleSparkActivate} />
		</div>

		<!-- Right: Template Stream -->
		<div class="stream-column">
			<div class="stream-header">
				<LocationFilter {templates} {onFilterChange} {onNextUnlockChange} {onAddressModalOpen} />
			</div>

			<div class="stream-content">
				<TemplateList {groups} {selectedId} onSelect={handleTemplateSelect} {loading} />
			</div>
		</div>
	</div>

	<!-- Mobile: Stacked layout with collapsible creation spark -->
	<div class="mobile-layout">
		<!-- Collapsed creation spark toggle -->
		<button
			type="button"
			class="mobile-spark-toggle"
			class:expanded={mobileSparkExpanded}
			onclick={handleMobileSparkToggle}
		>
			<div class="toggle-content">
				<PenLine class="toggle-icon" />
				<span class="toggle-text">
					{mobileSparkExpanded ? 'Writing something new' : 'Start something new'}
				</span>
			</div>
			<ChevronDown class="toggle-chevron {mobileSparkExpanded ? 'rotated' : ''}" />
		</button>

		<!-- Expandable creation spark -->
		{#if mobileSparkExpanded}
			<div class="mobile-spark-container">
				<CreationSpark on:activate={handleSparkActivate} />
			</div>
		{/if}

		<!-- Headline (when spark collapsed) -->
		{#if !mobileSparkExpanded}
			<div class="mobile-headline">
				<p class="brand-mark">communiqué</p>
				<h1 class="headline">
					Your voice.
					<span class="accent">Sent together.</span>
				</h1>
			</div>
		{/if}

		<!-- Location filter -->
		<div class="mobile-filter">
			<LocationFilter {templates} {onFilterChange} {onNextUnlockChange} {onAddressModalOpen} />
		</div>

		<!-- Template stream -->
		<div class="mobile-stream">
			<TemplateList {groups} {selectedId} onSelect={handleTemplateSelect} {loading} />
		</div>
	</div>
</div>

<style>
	/*
	 * ActivationSurface Layout
	 *
	 * Desktop (>= 1024px): Side-by-side split
	 * Tablet (640-1023px): Side-by-side with adjusted proportions
	 * Mobile (< 640px): Stacked with collapsible creation spark
	 */

	.activation-surface {
		width: 100%;
		max-width: 1400px;
		margin: 0 auto;
	}

	/* Desktop Layout */
	.desktop-layout {
		display: none;
	}

	@media (min-width: 1024px) {
		.desktop-layout {
			display: grid;
			grid-template-columns: minmax(320px, 420px) 1fr;
			gap: 3rem;
			align-items: start;
		}
	}

	@media (min-width: 1280px) {
		.desktop-layout {
			grid-template-columns: minmax(380px, 480px) 1fr;
			gap: 4rem;
		}
	}

	.creation-column {
		position: sticky;
		top: 2rem;
	}

	.stream-column {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		min-height: 0;
	}

	.stream-header {
		flex-shrink: 0;
	}

	.stream-content {
		flex: 1;
		min-height: 0;
		/* Allow internal scrolling if needed */
		max-height: calc(100vh - 12rem);
		overflow-y: auto;
		padding-right: 0.5rem;

		/* Subtle scrollbar styling */
		scrollbar-width: thin;
		scrollbar-color: oklch(0.8 0.02 250) transparent;
	}

	.stream-content::-webkit-scrollbar {
		width: 6px;
	}

	.stream-content::-webkit-scrollbar-track {
		background: transparent;
	}

	.stream-content::-webkit-scrollbar-thumb {
		background-color: oklch(0.8 0.02 250);
		border-radius: 3px;
	}

	/* Mobile Layout */
	.mobile-layout {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	@media (min-width: 1024px) {
		.mobile-layout {
			display: none;
		}
	}

	/* Mobile spark toggle */
	.mobile-spark-toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 1rem 1.25rem;
		border: 2px dashed oklch(0.8 0.02 250);
		border-radius: 12px;
		background: oklch(0.98 0.005 250);
		cursor: pointer;
		transition:
			border-color 200ms ease-out,
			background 200ms ease-out;
	}

	.mobile-spark-toggle:hover {
		border-color: oklch(0.65 0.12 195);
		background: oklch(0.97 0.01 195);
	}

	.mobile-spark-toggle.expanded {
		border-color: oklch(0.65 0.12 195);
		border-style: solid;
		background: white;
	}

	.toggle-content {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.toggle-content :global(.toggle-icon) {
		width: 1.25rem;
		height: 1.25rem;
		color: oklch(0.55 0.12 195);
	}

	.toggle-text {
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.9375rem;
		font-weight: 600;
		color: oklch(0.3 0.02 250);
	}

	.mobile-spark-toggle :global(.toggle-chevron) {
		width: 1.25rem;
		height: 1.25rem;
		color: oklch(0.5 0.02 250);
		transition: transform 200ms ease-out;
	}

	.mobile-spark-toggle :global(.toggle-chevron.rotated) {
		transform: rotate(180deg);
	}

	/* Mobile spark container */
	.mobile-spark-container {
		padding: 1.5rem;
		border: 1px solid oklch(0.88 0.02 250);
		border-radius: 12px;
		background: white;
	}

	/* Mobile headline (when spark collapsed) */
	.mobile-headline {
		text-align: center;
		padding: 0.5rem 0;
	}

	.mobile-headline .brand-mark {
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.8125rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		text-transform: lowercase;
		color: oklch(0.42 0.08 55);
		margin: 0 0 0.25rem 0;
	}

	.mobile-headline .headline {
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 1.75rem;
		font-weight: 700;
		line-height: 1.15;
		letter-spacing: -0.02em;
		color: oklch(0.15 0.02 250);
		margin: 0;
	}

	.mobile-headline .accent {
		color: oklch(0.55 0.15 195);
	}

	.mobile-filter {
		/* LocationFilter handles its own spacing */
	}

	.mobile-stream {
		/* TemplateList handles its own spacing */
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.mobile-spark-toggle :global(.toggle-chevron) {
			transition: none;
		}

		.mobile-spark-toggle {
			transition: none;
		}
	}
</style>
