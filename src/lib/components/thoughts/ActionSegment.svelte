<script lang="ts">
	/**
	 * ActionSegment: Research/retrieval action visualization
	 *
	 * PERCEPTUAL ENGINEERING:
	 * - Pending state shows spinner + target name (clear progress indicator)
	 * - Complete state collapses to summary with chevron (progressive disclosure)
	 * - Findings revealed on expansion (reducing visual noise)
	 * - Color coding: teal for research (routes), indigo for retrieval (sharing)
	 *
	 * ACCESSIBILITY:
	 * - Button for expansion (keyboard navigable)
	 * - ARIA expanded state for screen readers
	 * - Focus visible ring
	 * - Clear status indicators
	 */

	import type { ActionTrace } from '$lib/core/thoughts/types';
	import { ChevronDown, ChevronRight, Search, Database, Loader2 } from 'lucide-svelte';

	interface Props {
		action: ActionTrace;
		onexpand?: (action: ActionTrace) => void;
	}

	let { action, onexpand }: Props = $props();

	// Local expansion state
	let expanded = $state(false);

	// Derived state
	const isPending = $derived(action.status === 'pending');
	const isComplete = $derived(action.status === 'complete');
	const isError = $derived(action.status === 'error');
	const hasFindings = $derived(action.findings && action.findings.length > 0);
	const canExpand = $derived(isComplete && hasFindings);

	// Duration calculation
	const duration = $derived(
		action.endTime && action.startTime
			? `${((action.endTime - action.startTime) / 1000).toFixed(1)}s`
			: null
	);

	// Icon selection
	const ActionIcon = $derived(action.type === 'research' ? Search : Database);

	// Color scheme based on action type
	const colorScheme = $derived(
		action.type === 'research'
			? {
					bg: 'bg-teal-50/80',
					border: 'border-teal-200/60',
					text: 'text-teal-700',
					icon: 'text-teal-600'
				}
			: {
					bg: 'bg-indigo-50/80',
					border: 'border-indigo-200/60',
					text: 'text-indigo-700',
					icon: 'text-indigo-600'
				}
	);

	function toggleExpand() {
		if (!canExpand) return;
		expanded = !expanded;
		if (expanded) {
			onexpand?.(action);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!canExpand) return;
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			toggleExpand();
		}
	}
</script>

<div
	class="action-segment rounded-lg border {colorScheme.bg} {colorScheme.border} px-3 py-2 transition-all duration-200"
>
	{#if isPending}
		<!-- Pending state: Show spinner + target -->
		<div class="flex items-center gap-2">
			<Loader2 class="h-4 w-4 animate-spin {colorScheme.icon}" />
			<span class="text-sm font-medium {colorScheme.text}">
				{action.type === 'research' ? 'Researching' : 'Retrieving'}
				<span class="font-semibold">{action.target}</span>...
			</span>
		</div>
	{:else if isComplete}
		<!-- Complete state: Collapsible summary -->
		<button
			type="button"
			class="action-header group flex w-full items-start gap-2 text-left
				focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 {canExpand
				? 'cursor-pointer focus-visible:ring-coord-route-solid/30'
				: 'cursor-default'}"
			onclick={toggleExpand}
			onkeydown={handleKeydown}
			aria-expanded={expanded}
			aria-label={`${action.type === 'research' ? 'Research' : 'Retrieval'} action for ${action.target}`}
			disabled={!canExpand}
		>
			<!-- Icon -->
			<div class="flex-shrink-0 pt-0.5">
				<ActionIcon class="h-4 w-4 {colorScheme.icon}" strokeWidth={2} />
			</div>

			<!-- Content -->
			<div class="flex-1 space-y-1">
				<div class="flex items-baseline gap-2">
					<span class="text-sm font-medium {colorScheme.text}">
						{action.type === 'research' ? 'Researched' : 'Retrieved'}:
						<span class="font-semibold">{action.target}</span>
					</span>
					{#if duration}
						<span class="text-xs text-text-quaternary">({duration})</span>
					{/if}
				</div>

				{#if hasFindings && !expanded}
					<span class="text-xs text-text-tertiary">
						{action.findings?.length} finding{action.findings?.length === 1 ? '' : 's'}
					</span>
				{/if}
			</div>

			<!-- Chevron (if expandable) -->
			{#if canExpand}
				<div class="flex-shrink-0 pt-1 transition-transform duration-200">
					{#if expanded}
						<ChevronDown class="h-4 w-4 text-text-quaternary group-hover:text-text-tertiary" />
					{:else}
						<ChevronRight class="h-4 w-4 text-text-quaternary group-hover:text-text-tertiary" />
					{/if}
				</div>
			{/if}
		</button>

		<!-- Expanded findings -->
		{#if expanded && hasFindings}
			<div class="findings-list mt-2 space-y-1.5 border-l-2 border-surface-border pl-3">
				{#each (action.findings || []) as finding}
					<div class="flex items-start gap-2">
						<span class="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-coord-route-solid/70"></span>
						<span class="text-sm text-text-secondary">{finding}</span>
					</div>
				{/each}
			</div>
		{/if}
	{:else if isError}
		<!-- Error state -->
		<div class="flex items-center gap-2">
			<ActionIcon class="h-4 w-4 text-status-error-500" strokeWidth={2} />
			<span class="text-sm font-medium text-status-error-700">
				{action.type === 'research' ? 'Research' : 'Retrieval'} failed
				{#if action.error}
					<span class="text-status-error-600">: {action.error}</span>
				{/if}
			</span>
		</div>
	{/if}
</div>

<style>
	/* Smooth slide animation for findings */
	.findings-list {
		animation: slideDown 200ms ease-out;
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Hover effect for expandable actions */
	.action-header:not(:disabled):hover {
		opacity: 0.9;
	}
</style>
