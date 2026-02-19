<script lang="ts">
	/**
	 * CategoryFilter: Category selection chips for intelligence filtering
	 *
	 * PERCEPTUAL ENGINEERING:
	 * - Color-coded chips match item category colors (consistency)
	 * - "All" is always first (Fitts's law - most common action)
	 * - Count badges provide information scent
	 * - Selected state is clear through solid background
	 * - Smooth transitions reduce jarring switches
	 */

	import type { IntelligenceCategory } from '$lib/core/intelligence/types';
	import { Newspaper, Scale, Gavel, Building2, Users } from '@lucide/svelte';

	interface Props {
		categories: Array<{ category: IntelligenceCategory; count: number }>;
		selected: IntelligenceCategory | 'all';
		onselect?: (category: IntelligenceCategory | 'all') => void;
	}

	let { categories, selected = $bindable('all'), onselect }: Props = $props();

	// Category visual config
	const categoryConfig = {
		news: {
			icon: Newspaper,
			label: 'News',
			color: 'cyan',
			solidBg: 'bg-cyan-500',
			solidText: 'text-white',
			outlineBg: 'bg-white hover:bg-cyan-50',
			outlineText: 'text-cyan-700',
			outlineBorder: 'border-cyan-300'
		},
		legislative: {
			icon: Gavel,
			label: 'Legislative',
			color: 'blue',
			solidBg: 'bg-blue-500',
			solidText: 'text-white',
			outlineBg: 'bg-white hover:bg-blue-50',
			outlineText: 'text-blue-700',
			outlineBorder: 'border-blue-300'
		},
		regulatory: {
			icon: Scale,
			label: 'Regulatory',
			color: 'purple',
			solidBg: 'bg-purple-500',
			solidText: 'text-white',
			outlineBg: 'bg-white hover:bg-purple-50',
			outlineText: 'text-purple-700',
			outlineBorder: 'border-purple-300'
		},
		corporate: {
			icon: Building2,
			label: 'Corporate',
			color: 'gray',
			solidBg: 'bg-slate-500',
			solidText: 'text-white',
			outlineBg: 'bg-white hover:bg-slate-50',
			outlineText: 'text-slate-700',
			outlineBorder: 'border-slate-300'
		},
		social: {
			icon: Users,
			label: 'Social',
			color: 'green',
			solidBg: 'bg-green-500',
			solidText: 'text-white',
			outlineBg: 'bg-white hover:bg-green-50',
			outlineText: 'text-green-700',
			outlineBorder: 'border-green-300'
		}
	};

	// Total count for "All" button
	const totalCount = $derived(categories.reduce((sum, c) => sum + c.count, 0));

	function handleSelect(category: IntelligenceCategory | 'all') {
		selected = category;
		onselect?.(category);
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<nav
	class="category-filter flex flex-wrap gap-2"
	role="tablist"
	aria-label="Filter intelligence by category"
>
	<!-- All button -->
	<button
		type="button"
		role="tab"
		aria-selected={selected === 'all'}
		onclick={() => handleSelect('all')}
		class="chip {selected === 'all'
			? 'bg-participation-primary-500 text-white border-participation-primary-600'
			: 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'}
			inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5
			text-sm font-medium transition-all duration-200
			focus:outline-none focus-visible:ring-2 focus-visible:ring-participation-primary-500
			focus-visible:ring-offset-2"
	>
		<span>All</span>
		{#if totalCount > 0}
			<span class="chip-count {selected === 'all' ? 'bg-white/20' : 'bg-slate-200'}
				rounded-full px-1.5 py-0.5 text-xs">
				{totalCount}
			</span>
		{/if}
	</button>

	<!-- Category chips -->
	{#each categories as { category, count }}
		{@const config = categoryConfig[category]}
		{@const IconComponent = config.icon}
		<button
			type="button"
			role="tab"
			aria-selected={selected === category}
			onclick={() => handleSelect(category)}
			class="chip {selected === category
				? `${config.solidBg} ${config.solidText}`
				: `${config.outlineBg} ${config.outlineText} border-${config.color}-300`}
				inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5
				text-sm font-medium transition-all duration-200
				focus:outline-none focus-visible:ring-2 focus-visible:ring-{config.color}-500
				focus-visible:ring-offset-2"
		>
			<IconComponent class="h-3.5 w-3.5" strokeWidth={2} />
			<span>{config.label}</span>
			{#if count > 0}
				<span class="chip-count {selected === category ? 'bg-white/20' : `bg-${config.color}-100`}
					rounded-full px-1.5 py-0.5 text-xs">
					{count}
				</span>
			{/if}
		</button>
	{/each}
</nav>

<style>
	.chip {
		/* Smooth state transitions */
		transition-property: background-color, border-color, color, transform;
		transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
	}

	.chip:hover:not([aria-selected='true']) {
		transform: translateY(-1px);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
	}

	.chip:active {
		transform: translateY(0);
	}

	.chip-count {
		min-width: 1.25rem;
		text-align: center;
		transition: background-color 200ms;
	}

	/* Horizontal scroll on mobile if needed */
	.category-filter {
		overflow-x: auto;
		overflow-y: hidden;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none; /* Firefox */
	}

	.category-filter::-webkit-scrollbar {
		display: none; /* Chrome, Safari */
	}
</style>
