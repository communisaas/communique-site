<script lang="ts">
	/**
	 * IntelligenceItem: Individual intelligence card component
	 *
	 * PERCEPTUAL ENGINEERING PRINCIPLES:
	 * 1. Category-coded left border for instant recognition (pre-attentive processing)
	 * 2. Visual hierarchy: title > metadata > summary > topics
	 * 3. Relevance score determines prominence (opacity, border weight)
	 * 4. Temporal awareness: "time ago" relative timestamps
	 * 5. Progressive disclosure: summary truncation with expansion
	 *
	 * COGNITIVE LOAD REDUCTION:
	 * - Icon + color create category recognition in <100ms
	 * - Metadata scanline (source • time • relevance) is a single visual unit
	 * - Topics as small chips reduce text parsing load
	 * - Click affordance through hover elevation
	 */

	import type { IntelligenceItem as ItemType } from '$lib/core/intelligence/types';
	import { Newspaper, Scale, Gavel, Building2, Users } from '@lucide/svelte';
	import { formatDistanceToNow } from 'date-fns';

	interface Props {
		item: ItemType;
		onclick?: (item: ItemType) => void;
	}

	let { item, onclick }: Props = $props();

	// Category visual config (icons + colors)
	const categoryConfig = {
		news: {
			icon: Newspaper,
			color: 'cyan',
			borderColor: 'border-l-cyan-500',
			iconColor: 'text-cyan-600',
			bgColor: 'bg-cyan-50'
		},
		legislative: {
			icon: Gavel,
			color: 'blue',
			borderColor: 'border-l-blue-500',
			iconColor: 'text-blue-600',
			bgColor: 'bg-blue-50'
		},
		regulatory: {
			icon: Scale,
			color: 'purple',
			borderColor: 'border-l-purple-500',
			iconColor: 'text-purple-600',
			bgColor: 'bg-purple-50'
		},
		corporate: {
			icon: Building2,
			color: 'gray',
			borderColor: 'border-l-slate-500',
			iconColor: 'text-slate-600',
			bgColor: 'bg-slate-50'
		},
		social: {
			icon: Users,
			color: 'green',
			borderColor: 'border-l-green-500',
			iconColor: 'text-green-600',
			bgColor: 'bg-green-50'
		}
	};

	const config = $derived(categoryConfig[item.category]);
	const IconComponent = $derived(config.icon);

	// Format time ago
	const timeAgo = $derived(
		formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true })
	);

	// Relevance badge style
	const relevanceClass = $derived(
		item.relevanceScore >= 0.8
			? 'bg-emerald-100 text-emerald-700 border-emerald-300'
			: item.relevanceScore >= 0.5
				? 'bg-blue-100 text-blue-700 border-blue-300'
				: 'bg-slate-100 text-slate-600 border-slate-300'
	);

	// Card opacity based on relevance
	const cardOpacity = $derived(item.relevanceScore < 0.5 ? 'opacity-70' : 'opacity-100');

	// Summary expansion state
	let expanded = $state(false);
	const summaryPreview = $derived(
		item.summary.length > 140 && !expanded ? item.summary.slice(0, 140) + '...' : item.summary
	);
	const showExpandButton = $derived(item.summary.length > 140);

	function handleClick() {
		if (onclick) {
			onclick(item);
		} else {
			// Default: open in new tab
			window.open(item.sourceUrl, '_blank', 'noopener,noreferrer');
		}
	}

	function toggleExpanded(event: Event) {
		event.stopPropagation();
		expanded = !expanded;
	}
</script>

<article
	class="intelligence-item group {config.borderColor} {cardOpacity}
		relative cursor-pointer overflow-hidden rounded-lg border border-l-4 border-slate-200
		bg-white shadow-sm transition-all duration-200
		hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5
		focus-visible:outline-none focus-visible:ring-2
		focus-visible:ring-participation-primary-500 focus-visible:ring-offset-2"
	onclick={handleClick}
	onkeydown={(e) => e.key === 'Enter' && handleClick()}
	role="button"
	tabindex="0"
	aria-label="Intelligence item: {item.title}"
>
	<!-- Category indicator stripe (already handled by border-l-4) -->

	<div class="p-4 space-y-3">
		<!-- Header: Icon + Title + Relevance -->
		<header class="flex items-start gap-3">
			<div class="{config.bgColor} rounded-md p-2 shrink-0">
				<IconComponent class="{config.iconColor} h-4 w-4" strokeWidth={2} />
			</div>

			<div class="flex-1 min-w-0">
				<h3 class="font-semibold text-slate-900 leading-snug line-clamp-2
					group-hover:text-participation-primary-700 transition-colors">
					{item.title}
				</h3>
			</div>

			<!-- Relevance badge -->
			<div
				class="shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium {relevanceClass}"
				title="Relevance score: {Math.round(item.relevanceScore * 100)}%"
			>
				{Math.round(item.relevanceScore * 100)}%
			</div>
		</header>

		<!-- Metadata scanline: Source • Time -->
		<div class="flex items-center gap-2 text-xs text-slate-500">
			<span class="font-medium text-slate-700">{item.sourceName}</span>
			<span class="text-slate-300">•</span>
			<time datetime={new Date(item.publishedAt).toISOString()}>{timeAgo}</time>
		</div>

		<!-- Summary -->
		<p class="text-sm text-slate-600 leading-relaxed">
			{summaryPreview}
		</p>

		{#if showExpandButton}
			<button
				type="button"
				onclick={toggleExpanded}
				class="text-xs font-medium text-participation-primary-600
					hover:text-participation-primary-700 transition-colors
					focus:outline-none focus-visible:underline"
			>
				{expanded ? 'Show less' : 'Read more'}
			</button>
		{/if}

		<!-- Topics -->
		{#if item.topics.length > 0}
			<div class="flex flex-wrap gap-1.5" role="list">
				{#each item.topics.slice(0, 4) as topic}
					<span
						class="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5
							text-xs text-slate-700 border border-slate-200"
						role="listitem"
					>
						{topic}
					</span>
				{/each}
				{#if item.topics.length > 4}
					<span class="inline-flex items-center text-xs text-slate-500">
						+{item.topics.length - 4} more
					</span>
				{/if}
			</div>
		{/if}

		<!-- Entities (optional, shown only if present) -->
		{#if item.entities.length > 0}
			<div class="flex flex-wrap gap-1.5 text-xs text-slate-500" aria-label="Mentioned entities">
				{#each item.entities.slice(0, 3) as entity}
					<span class="inline-flex items-center gap-1">
						<span class="h-1 w-1 rounded-full bg-slate-400"></span>
						{entity.name}
					</span>
				{/each}
			</div>
		{/if}
	</div>

	<!-- High-relevance indicator (visual accent for important items) -->
	{#if item.relevanceScore >= 0.8}
		<div class="absolute top-0 right-0 h-full w-1 bg-gradient-to-b from-emerald-400 to-transparent opacity-40"></div>
	{/if}
</article>

<style>
	.intelligence-item {
		/* Ensure smooth border transition */
		transition-property: border-color, box-shadow, transform, opacity;
		transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
	}

	/* Line clamping for multi-line truncation */
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
