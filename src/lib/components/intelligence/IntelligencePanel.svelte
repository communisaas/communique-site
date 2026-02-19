<script lang="ts">
	/**
	 * IntelligencePanel: Main container for streaming intelligence
	 *
	 * PERCEPTUAL ENGINEERING PRINCIPLES:
	 * 1. Temporal awareness: New items fade in smoothly without jarring layout
	 * 2. Visual hierarchy: Relevance-sorted, with high-relevance items gently elevated
	 * 3. Category distinction: Filter chips provide instant category switching
	 * 4. Progressive loading: Skeleton states reduce perceived latency
	 * 5. Attention management: Streaming indicator shows activity without interrupting
	 *
	 * COGNITIVE LOAD REDUCTION:
	 * - Collapsible design respects screen real estate
	 * - Category filters reduce information overload
	 * - Max height with internal scroll prevents page disruption
	 * - Smooth animations signal state changes (not abrupt switches)
	 *
	 * REAL-TIME UX:
	 * - Live region announcements for accessibility
	 * - Items appear with fade-in animation as they stream
	 * - Deduplication happens silently (no visual jank)
	 * - Streaming indicator pulses during active fetch
	 */

	import type { IntelligenceItem, IntelligenceCategory } from '$lib/core/intelligence/types';
	import IntelligenceItemCard from './IntelligenceItem.svelte';
	import IntelligenceSkeleton from './IntelligenceSkeleton.svelte';
	import CategoryFilter from './CategoryFilter.svelte';
	import { ChevronDown, Sparkles, AlertCircle } from '@lucide/svelte';
	import { slide, fade } from 'svelte/transition';
	import { flip } from 'svelte/animate';

	interface Props {
		items?: IntelligenceItem[];
		streaming?: boolean;
		expanded?: boolean;
		maxItems?: number;
		onitemclick?: (item: IntelligenceItem) => void;
		onerror?: (error: string) => void;
	}

	let {
		items = [],
		streaming = false,
		expanded = $bindable(true),
		maxItems = 20,
		onitemclick,
		onerror
	}: Props = $props();

	// Filter state
	let selectedCategory = $state<IntelligenceCategory | 'all'>('all');

	// Compute category counts
	const categoryCounts = $derived(
		items.reduce(
			(acc, item) => {
				const existing = acc.find((c) => c.category === item.category);
				if (existing) {
					existing.count++;
				} else {
					acc.push({ category: item.category, count: 1 });
				}
				return acc;
			},
			[] as Array<{ category: IntelligenceCategory; count: number }>
		)
	);

	// Filter items by category
	const filteredItems = $derived(
		selectedCategory === 'all'
			? items.slice(0, maxItems)
			: items.filter((item) => item.category === selectedCategory).slice(0, maxItems)
	);

	// Sort by relevance (high to low), then by published date
	const sortedItems = $derived(
		[...filteredItems].sort((a, b) => {
			if (a.relevanceScore !== b.relevanceScore) {
				return b.relevanceScore - a.relevanceScore;
			}
			return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
		})
	);

	function handleItemClick(item: IntelligenceItem) {
		onitemclick?.(item);
	}

	function handleCategorySelect(category: IntelligenceCategory | 'all') {
		selectedCategory = category;
	}
</script>

<aside
	class="intelligence-panel rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden
		{expanded ? '' : 'max-h-14'} transition-all duration-300"
	role="region"
	aria-label="Issue Intelligence"
>
	<!-- Header -->
	<header class="panel-header border-b border-slate-200 bg-slate-50">
		<button
			type="button"
			onclick={() => (expanded = !expanded)}
			class="flex w-full items-center justify-between px-4 py-3 text-left
				transition-colors hover:bg-slate-100
				focus:outline-none focus-visible:ring-2 focus-visible:ring-inset
				focus-visible:ring-participation-primary-500"
			aria-expanded={expanded}
			aria-controls="intelligence-content"
		>
			<div class="flex items-center gap-2">
				<Sparkles class="h-5 w-5 text-participation-primary-600" strokeWidth={2} />
				<h2 class="text-sm font-semibold text-slate-900">
					{streaming ? 'Researching...' : 'Issue Intelligence'}
				</h2>
				{#if streaming}
					<span
						class="streaming-indicator inline-flex h-2 w-2 rounded-full bg-participation-primary-500 animate-pulse"
						aria-label="Loading"
					></span>
				{/if}
			</div>

			<div class="flex items-center gap-2">
				{#if items.length > 0 && !streaming}
					<span class="text-xs text-slate-500">
						{items.length} {items.length === 1 ? 'item' : 'items'}
					</span>
				{/if}
				<ChevronDown
					class="h-4 w-4 text-slate-400 transition-transform {expanded ? 'rotate-180' : ''}"
					strokeWidth={2}
				/>
			</div>
		</button>
	</header>

	<!-- Content -->
	{#if expanded}
		<div
			id="intelligence-content"
			class="panel-content"
			transition:slide={{ duration: 250 }}
		>
			<!-- Category Filter -->
			{#if categoryCounts.length > 1}
				<div class="category-filter-container border-b border-slate-200 bg-slate-50 px-4 py-3">
					<CategoryFilter
						categories={categoryCounts}
						bind:selected={selectedCategory}
						onselect={handleCategorySelect}
					/>
				</div>
			{/if}

			<!-- Items List -->
			<div
				class="items-list max-h-[32rem] overflow-y-auto p-4 space-y-3"
				role="feed"
				aria-busy={streaming}
				aria-live="polite"
				aria-relevant="additions"
			>
				{#if sortedItems.length > 0}
					{#each sortedItems as item (item.id)}
						<div
							in:fade={{ duration: 300, delay: 50 }}
							animate:flip={{ duration: 200 }}
						>
							<IntelligenceItemCard {item} onclick={handleItemClick} />
						</div>
					{/each}
				{/if}

				<!-- Loading skeleton (shown while streaming) -->
				{#if streaming && sortedItems.length === 0}
					<IntelligenceSkeleton count={3} />
				{/if}

				<!-- Empty state -->
				{#if !streaming && sortedItems.length === 0}
					<div class="empty-state py-8 text-center" transition:fade={{ duration: 200 }}>
						<AlertCircle class="mx-auto h-12 w-12 text-slate-300 mb-3" strokeWidth={1.5} />
						<p class="text-sm text-slate-600 font-medium mb-1">
							No intelligence found
						</p>
						<p class="text-xs text-slate-500">
							Try adjusting your topic or time frame
						</p>
					</div>
				{/if}

				<!-- Streaming indicator at bottom -->
				{#if streaming && sortedItems.length > 0}
					<div class="streaming-footer text-center py-3" transition:fade>
						<div class="inline-flex items-center gap-2 text-xs text-slate-500">
							<span class="inline-block h-1.5 w-1.5 rounded-full bg-participation-primary-500 animate-pulse"></span>
							<span>Finding more intelligence...</span>
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</aside>

<style>
	/* Smooth collapse/expand */
	.intelligence-panel {
		transition-property: max-height, box-shadow;
		transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
	}

	/* Custom scrollbar for items list */
	.items-list {
		scrollbar-width: thin;
		scrollbar-color: #cbd5e1 transparent;
	}

	.items-list::-webkit-scrollbar {
		width: 6px;
	}

	.items-list::-webkit-scrollbar-track {
		background: transparent;
	}

	.items-list::-webkit-scrollbar-thumb {
		background-color: #cbd5e1;
		border-radius: 3px;
	}

	.items-list::-webkit-scrollbar-thumb:hover {
		background-color: #94a3b8;
	}

	/* Streaming indicator pulse */
	@keyframes pulse {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}

	.animate-pulse {
		animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}
</style>
