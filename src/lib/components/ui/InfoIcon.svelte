<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	let {
		tooltip,
		position = 'top',
		maxWidth = 280
	}: {
		tooltip: string;
		position?: 'top' | 'bottom' | 'left' | 'right';
		maxWidth?: number;
	} = $props();

	let showTooltip = $state(false);
	let iconRef: HTMLButtonElement | undefined = $state();
	let tooltipRef: HTMLDivElement | undefined = $state();

	function handleMouseEnter() {
		showTooltip = true;
	}

	function handleMouseLeave() {
		showTooltip = false;
	}

	function handleClick(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		showTooltip = !showTooltip;
	}

	// Close on outside click
	function handleOutsideClick(e: MouseEvent) {
		if (
			showTooltip &&
			iconRef &&
			tooltipRef &&
			!iconRef.contains(e.target as Node) &&
			!tooltipRef.contains(e.target as Node)
		) {
			showTooltip = false;
		}
	}

	onMount(() => {
		document.addEventListener('click', handleOutsideClick);
	});

	onDestroy(() => {
		document.removeEventListener('click', handleOutsideClick);
	});

	// Position classes based on prop
	const positionClasses = {
		top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
		bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
		left: 'right-full top-1/2 -translate-y-1/2 mr-2',
		right: 'left-full top-1/2 -translate-y-1/2 ml-2'
	};

	const arrowClasses = {
		top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-slate-800',
		bottom:
			'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-slate-800',
		left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-slate-800',
		right:
			'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-slate-800'
	};
</script>

<span class="relative inline-flex items-center">
	<button
		bind:this={iconRef}
		type="button"
		class="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
		onmouseenter={handleMouseEnter}
		onmouseleave={handleMouseLeave}
		onclick={handleClick}
		aria-label="More information"
	>
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
			<path
				fill-rule="evenodd"
				d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
				clip-rule="evenodd"
			/>
		</svg>
	</button>

	{#if showTooltip}
		<div
			bind:this={tooltipRef}
			class="absolute z-50 {positionClasses[position]} pointer-events-auto"
			style="max-width: {maxWidth}px"
		>
			<div class="rounded-lg bg-slate-800 px-3 py-2 text-xs text-white shadow-lg">
				{tooltip}
				<!-- Arrow -->
				<div class="absolute h-0 w-0 border-4 {arrowClasses[position]}"></div>
			</div>
		</div>
	{/if}
</span>

<style>
	/* Ensure tooltip is above other content */
	:global(.relative) {
		z-index: 1;
	}
</style>
