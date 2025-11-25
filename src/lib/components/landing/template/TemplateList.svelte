<script lang="ts">
	import { ChevronRight, PenLine, Landmark, Building2, Mail, Users, Search } from '@lucide/svelte';
	// import { spring } from 'svelte/motion';
	import { preloadData } from '$app/navigation';
	import type { Template, TemplateGroup } from '$lib/types/template';
	// import ChannelBadge from '$lib/components/ui/ChannelBadge.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import MessageMetrics from './MessageMetrics.svelte';
	import SkeletonTemplate from '$lib/components/ui/SkeletonTemplate.svelte';
	import { deriveTargetPresentation } from '$lib/utils/deriveTargetPresentation';
	import { scoreTemplate, sortTemplatesByScore } from '$lib/utils/template-scoring';

	interface Props {
		groups: TemplateGroup[];
		selectedId: string | null;
		onSelect: (id: string) => void;
		onCreateTemplate?: () => void;
		loading?: boolean;
	}

	let { groups, selectedId, onSelect, onCreateTemplate, loading = false }: Props = $props();

	// Progressive disclosure constant
	const INITIAL_VISIBLE = 8;

	// Search state
	let searchQuery = $state('');

	// Enrich templates with scoring metrics and sort by displayScore
	const scoredGroups = $derived.by(() => {
		const now = new Date();

		return groups.map((group) => {
			// Enrich each template with scoring metrics
			const enriched = group.templates.map((t) => ({
				...t,
				...scoreTemplate(
					{
						send_count: t.send_count || 0,
						created_at: new Date(t.created_at),
						updated_at: new Date(t.updated_at)
					},
					now
				)
			}));

			// Sort by displayScore (descending)
			const sorted = sortTemplatesByScore(enriched);

			return {
				...group,
				templates: sorted
			};
		});
	});

	// Client-side filter (instant - no debounce needed)
	const filteredGroups = $derived.by(() => {
		if (!searchQuery.trim()) return scoredGroups;

		const query = searchQuery.toLowerCase();

		return scoredGroups
			.map((group) => ({
				...group,
				templates: group.templates.filter(
					(t) =>
						t.title.toLowerCase().includes(query) ||
						t.description?.toLowerCase().includes(query) ||
						t.category?.toLowerCase().includes(query)
				)
			}))
			.filter((group) => group.templates.length > 0); // Remove empty groups
	});

	// Match count for feedback
	const matchCount = $derived(filteredGroups.reduce((sum, g) => sum + g.templates.length, 0));

	// Track expansion state per group (by title)
	let expandedGroups = $state<Set<string>>(new Set());

	// Flatten groups into single array for keyboard navigation
	const allTemplates = $derived(filteredGroups.flatMap((g) => g.templates));

	let hoveredTemplate = $state<string | null>(null);

	function toggleGroupExpansion(groupTitle: string): void {
		const newExpanded = new Set(expandedGroups);
		if (newExpanded.has(groupTitle)) {
			newExpanded.delete(groupTitle);
		} else {
			newExpanded.add(groupTitle);
		}
		expandedGroups = newExpanded;
	}

	function getVisibleCount(group: TemplateGroup): number {
		const isExpanded = expandedGroups.has(group.title);
		return isExpanded ? group.templates.length : Math.min(INITIAL_VISIBLE, group.templates.length);
	}

	function handleTemplateHover(templateId: string, isHovering: boolean) {
		hoveredTemplate = isHovering ? templateId : null;

		// Preload template page on hover
		if (isHovering) {
			const template = allTemplates.find((t) => t.id === templateId);
			if (template?.slug) {
				preloadData(`/s/${template.slug}`);
			}
		}
	}

	function handleKeydown(__event: KeyboardEvent, templateId: string, index: number) {
		if (__event.key === 'Enter' || __event.key === ' ') {
			__event.preventDefault();
			onSelect(templateId);
			// Dispatch custom event to notify parent to move focus
			const customEvent = new CustomEvent('movePreviewFocus');
			window.dispatchEvent(customEvent);
		} else if (__event.key === 'Tab' && __event.shiftKey) {
			// If we're at the first template and shift+tab, let it go to previous element
			if (index === 0) return;

			// Otherwise, prevent default to handle our own focus management
			__event.preventDefault();
			const buttons = document.querySelectorAll('[data-template-button]');
			const prevButton = buttons[index - 1] as HTMLElement;
			prevButton?.focus();
		} else if (__event.key === 'Tab' && !__event.shiftKey) {
			// When reaching the last template
			if (index === allTemplates.length - 1) {
				// If this template is selected, let focus continue naturally
				if (templateId === selectedId) return;

				// Otherwise, dispatch event to move focus to current preview
				__event.preventDefault();
				const customEvent = new CustomEvent('movePreviewFocus');
				window.dispatchEvent(customEvent);
				return;
			}

			// Otherwise continue with template list navigation
			__event.preventDefault();
			const buttons = document.querySelectorAll('[data-template-button]');
			const nextButton = buttons[index + 1] as HTMLElement;
			nextButton?.focus();
		}
	}
</script>

<div class="space-y-6 md:space-y-8" data-testid="template-list">
	{#if loading}
		<!-- Loading State using SkeletonTemplate -->
		{#each Array(3) as _, index}
			<SkeletonTemplate variant="list" animate={true} classNames="template-loading-{index}" />
		{/each}
	{:else}
		<!-- Search UI -->
		<div class="search-container">
			<div class="search-input-wrapper">
				<Search class="search-icon" size={18} />
				<input
					type="search"
					class="search-input"
					placeholder="Search templates..."
					bind:value={searchQuery}
				/>
			</div>

			{#if searchQuery && matchCount > 0}
				<p class="search-results-count">
					{matchCount}
					{matchCount === 1 ? 'template' : 'templates'} match "{searchQuery}"
				</p>
			{/if}

			{#if searchQuery && matchCount === 0}
				<p class="no-results">No templates match "{searchQuery}"</p>
			{/if}
		</div>

		<!-- Create New Template Card -->
		{#if onCreateTemplate}
			<button
				type="button"
				onclick={onCreateTemplate}
				class="group relative flex w-full items-center gap-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-4 text-left transition-all duration-300 hover:border-cyan-400 hover:bg-cyan-50/50 hover:shadow-md md:p-5"
			>
				<div
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 transition-colors group-hover:bg-cyan-100"
				>
					<PenLine class="h-5 w-5 text-slate-500 transition-colors group-hover:text-cyan-600" />
				</div>
				<div>
					<h3 class="font-medium text-slate-700 transition-colors group-hover:text-cyan-700">
						Start something new
					</h3>
					<p class="text-sm text-slate-500">Write the message others will send</p>
				</div>
			</button>
		{/if}

		{#each filteredGroups as group, groupIndex (group.title)}
			<!-- Section Header -->
			<div class="space-y-3 md:space-y-4">
				<div class="flex items-center justify-between">
					<h3 class="text-sm font-semibold uppercase tracking-wide text-slate-700">
						{group.title}
					</h3>
					<span class="text-xs font-medium text-slate-500">
						{group.templates.length}
						{group.templates.length === 1 ? 'template' : 'templates'}
					</span>
				</div>

				<!-- Templates in this group (with progressive disclosure) -->
				{#each group.templates.slice(0, getVisibleCount(group)) as template, templateIndex (template.id)}
					{@const isCongressional = template.deliveryMethod === 'cwc'}
					{@const isHovered = hoveredTemplate === template.id}
					{@const globalIndex = allTemplates.findIndex((t) => t.id === template.id)}
					{@const targetInfo = deriveTargetPresentation(template)}
					<button
						type="button"
						data-template-button
						data-template-id={template.id}
						data-testid="template-button-{template.id}"
						class="relative flex w-full items-start justify-between gap-3 rounded-xl border border-l-4 bg-white/80 p-3 text-left shadow-atmospheric-card backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-atmospheric-card-hover md:p-4"
						class:!bg-direct-50={selectedId === template.id && !isCongressional}
						class:!bg-congressional-50={selectedId === template.id && isCongressional}
						style="will-change: transform; backface-visibility: hidden; border-width: 1px; border-left-width: 4px;"
						class:cursor-pointer={selectedId !== template.id}
						class:cursor-default={selectedId === template.id}
						class:border-direct-400={selectedId === template.id && !isCongressional}
						class:border-congressional-400={selectedId === template.id && isCongressional}
						class:border-slate-200={selectedId !== template.id && !isHovered}
						class:border-violet-200={selectedId !== template.id && isHovered}
						class:border-l-congressional-500={isCongressional}
						class:border-l-direct-500={!isCongressional}
						onmouseenter={() => handleTemplateHover(template.id, true)}
						onmouseleave={() => handleTemplateHover(template.id, false)}
						onclick={() => onSelect(template.id)}
						onkeydown={(e) => handleKeydown(e, template.id, globalIndex)}
					>
						<div class="min-w-0 flex-1">
							<!-- Perceptual Decision-Maker Representation -->
							{#if targetInfo.type === 'multi-level'}
								<!-- Multi-Level Coordination: Vertical Stack -->
								<!-- Peripheral detection: 2 rows = broader coordination scope -->
								<div class="mb-2 space-y-1">
									{#each targetInfo.targets as target}
										<div class="flex items-center gap-2">
											{#if target.icon === 'Capitol'}
												<Landmark class="h-4 w-4 text-congressional-600" />
											{:else if target.icon === 'Building'}
												<Building2 class="h-4 w-4 text-emerald-600" />
											{:else if target.icon === 'Users'}
												<Users class="h-4 w-4 text-slate-600" />
											{:else}
												<Mail class="h-4 w-4 text-slate-600" />
											{/if}
											<span
												class="text-sm font-medium"
												class:text-congressional-700={target.emphasis === 'federal'}
												class:text-blue-700={target.emphasis === 'state'}
												class:text-emerald-700={target.emphasis === 'local'}
												class:text-slate-700={target.emphasis === 'neutral'}
											>
												{target.primary}
											</span>
											{#if target.secondary}
												<span class="text-xs text-slate-500">{target.secondary}</span>
											{/if}
										</div>
									{/each}
								</div>
							{:else}
								<!-- Single-Level Coordination -->
								<div class="mb-2 flex items-center gap-2">
									{#if targetInfo.icon === 'Capitol'}
										<Landmark class="h-4 w-4 text-congressional-600" />
									{:else if targetInfo.icon === 'Building'}
										<Building2 class="h-4 w-4 text-emerald-600" />
									{:else if targetInfo.icon === 'Users'}
										<Users class="h-4 w-4 text-slate-600" />
									{:else}
										<Mail class="h-4 w-4 text-slate-600" />
									{/if}
									<span
										class="text-sm font-medium"
										class:text-congressional-700={targetInfo.emphasis === 'federal'}
										class:text-blue-700={targetInfo.emphasis === 'state'}
										class:text-emerald-700={targetInfo.emphasis === 'local'}
										class:text-slate-700={targetInfo.emphasis === 'neutral'}
									>
										{targetInfo.primary}
									</span>
									{#if targetInfo.secondary}
										<span class="text-xs text-slate-500">{targetInfo.secondary}</span>
									{/if}
								</div>
							{/if}

							<h3 class="truncate font-medium text-gray-900">
								{template.title}
							</h3>

							<p class="mb-2 line-clamp-2 text-xs text-gray-600 md:mb-3 md:text-sm">
								{template.description}
							</p>

							<MessageMetrics {template} />
						</div>

						<!-- Mobile indicator -->
						<div class="shrink-0 text-slate-400 md:hidden">
							<ChevronRight class="h-5 w-5" />
						</div>
					</button>
				{/each}

				<!-- Show more/less button -->
				{#if group.templates.length > INITIAL_VISIBLE}
					{@const isExpanded = expandedGroups.has(group.title)}
					{@const visibleCount = getVisibleCount(group)}
					{@const hiddenCount = group.templates.length - visibleCount}

					<button
						type="button"
						class="show-more-button"
						onclick={() => toggleGroupExpansion(group.title)}
					>
						{#if isExpanded}
							Show fewer
						{:else}
							Show {hiddenCount} more in {group.title}
						{/if}
					</button>
				{/if}
			</div>
		{/each}
	{/if}
</div>

<style>
	/* Search UI Styles */
	.search-container {
		margin-bottom: 1.5rem;
	}

	.search-input-wrapper {
		position: relative;
		display: flex;
		align-items: center;
	}

	.search-input-wrapper :global(.search-icon) {
		position: absolute;
		left: 1rem;
		color: oklch(0.5 0.02 250);
		pointer-events: none;
	}

	.search-input {
		width: 100%;
		padding: 0.75rem 1rem 0.75rem 2.75rem;
		border: 1px solid oklch(0.85 0.02 250);
		border-radius: 8px;
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.9375rem;
		background: white;
		transition: border-color 150ms ease-out;
	}

	.search-input:focus {
		outline: none;
		border-color: oklch(0.65 0.12 195);
		box-shadow: 0 0 0 3px oklch(0.65 0.12 195 / 0.1);
	}

	.search-results-count {
		margin-top: 0.5rem;
		font-size: 0.875rem;
		color: oklch(0.5 0.02 250);
	}

	.no-results {
		margin-top: 0.5rem;
		font-size: 0.875rem;
		color: oklch(0.45 0.02 250);
		font-style: italic;
	}

	/* Progressive Disclosure Button */
	.show-more-button {
		width: 100%;
		padding: 0.75rem;
		margin-top: 0.75rem;
		border: 1px dashed oklch(0.8 0.02 250);
		border-radius: 8px;
		background: oklch(0.98 0.005 250);
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.875rem;
		font-weight: 500;
		color: oklch(0.45 0.02 250);
		cursor: pointer;
		transition: all 150ms ease-out;
	}

	.show-more-button:hover {
		border-color: oklch(0.65 0.12 195);
		background: oklch(0.97 0.01 195);
		color: oklch(0.35 0.02 250);
	}
</style>
