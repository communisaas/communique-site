<script lang="ts">
	/**
	 * TargetCard: Individual target type selection card
	 *
	 * PERCEPTUAL ENGINEERING:
	 * - Icon creates instant recognition (pre-attentive processing)
	 * - Color coding reduces cognitive load through perceptual grouping
	 * - Hover state signals affordance before interaction
	 * - Selected state provides clear feedback
	 *
	 * ACCESSIBILITY:
	 * - Full keyboard navigation
	 * - ARIA attributes for screen readers
	 * - Focus visible ring for keyboard users
	 * - Touch-friendly 44px minimum target size
	 */

	import type { Component } from 'svelte';
	import type { Icon as LucideIcon } from '@lucide/svelte';

	interface Props {
		label: string;
		description: string;
		icon: Component<LucideIcon>;
		selected?: boolean;
		disabled?: boolean;
		colorScheme: 'blue' | 'gray' | 'green' | 'purple' | 'red' | 'orange' | 'cyan';
		onclick?: () => void;
	}

	let {
		label,
		description,
		icon: Icon,
		selected = false,
		disabled = false,
		colorScheme,
		onclick
	}: Props = $props();

	// Color scheme mappings
	const colorSchemes = {
		blue: {
			base: 'bg-blue-50 border-blue-200 text-blue-700',
			hover: 'hover:bg-blue-100 hover:border-blue-300 hover:shadow-md',
			selected:
				'border-blue-500 bg-blue-100 shadow-md ring-2 ring-blue-500/20 text-blue-900 font-semibold',
			icon: 'text-blue-600'
		},
		gray: {
			base: 'bg-slate-50 border-slate-200 text-slate-700',
			hover: 'hover:bg-slate-100 hover:border-slate-300 hover:shadow-md',
			selected:
				'border-slate-500 bg-slate-100 shadow-md ring-2 ring-slate-500/20 text-slate-900 font-semibold',
			icon: 'text-slate-600'
		},
		green: {
			base: 'bg-emerald-50 border-emerald-200 text-emerald-700',
			hover: 'hover:bg-emerald-100 hover:border-emerald-300 hover:shadow-md',
			selected:
				'border-emerald-500 bg-emerald-100 shadow-md ring-2 ring-emerald-500/20 text-emerald-900 font-semibold',
			icon: 'text-emerald-600'
		},
		purple: {
			base: 'bg-purple-50 border-purple-200 text-purple-700',
			hover: 'hover:bg-purple-100 hover:border-purple-300 hover:shadow-md',
			selected:
				'border-purple-500 bg-purple-100 shadow-md ring-2 ring-purple-500/20 text-purple-900 font-semibold',
			icon: 'text-purple-600'
		},
		red: {
			base: 'bg-rose-50 border-rose-200 text-rose-700',
			hover: 'hover:bg-rose-100 hover:border-rose-300 hover:shadow-md',
			selected:
				'border-rose-500 bg-rose-100 shadow-md ring-2 ring-rose-500/20 text-rose-900 font-semibold',
			icon: 'text-rose-600'
		},
		orange: {
			base: 'bg-orange-50 border-orange-200 text-orange-700',
			hover: 'hover:bg-orange-100 hover:border-orange-300 hover:shadow-md',
			selected:
				'border-orange-500 bg-orange-100 shadow-md ring-2 ring-orange-500/20 text-orange-900 font-semibold',
			icon: 'text-orange-600'
		},
		cyan: {
			base: 'bg-cyan-50 border-cyan-200 text-cyan-700',
			hover: 'hover:bg-cyan-100 hover:border-cyan-300 hover:shadow-md',
			selected:
				'border-cyan-500 bg-cyan-100 shadow-md ring-2 ring-cyan-500/20 text-cyan-900 font-semibold',
			icon: 'text-cyan-600'
		}
	};

	const scheme = colorSchemes[colorScheme];
</script>

<button
	type="button"
	{onclick}
	{disabled}
	class="target-card group flex min-h-[44px] flex-col items-center gap-2 rounded-lg border-2 p-4 text-center
		transition-all duration-200 ease-out
		focus:outline-none focus-visible:ring-2 focus-visible:ring-participation-primary-500 focus-visible:ring-offset-2
		disabled:cursor-not-allowed disabled:opacity-50
		{selected ? scheme.selected : `${scheme.base} ${!disabled ? scheme.hover : ''}`}"
	aria-pressed={selected}
	aria-disabled={disabled}
>
	<!-- Icon with color coding -->
	<div
		class="flex h-10 w-10 items-center justify-center rounded-full transition-transform duration-200
		{selected ? 'scale-110' : 'group-hover:scale-105'}"
	>
		<Icon {...({ class: `h-6 w-6 ${scheme.icon}`, strokeWidth: 2 } as Record<string, unknown>)} />
	</div>

	<!-- Label -->
	<div class="space-y-0.5">
		<span class="block text-sm font-medium leading-tight">
			{label}
		</span>

		<!-- Description -->
		<span class="block text-xs leading-tight opacity-80">
			{description}
		</span>
	</div>
</button>

<style>
	/* Smooth hover lift effect */
	.target-card:not(:disabled):hover {
		transform: translateY(-2px);
	}

	.target-card:not(:disabled):active {
		transform: translateY(0);
	}

	/* Ensure consistent layout even with varying text lengths */
	.target-card {
		min-width: 140px;
	}
</style>
