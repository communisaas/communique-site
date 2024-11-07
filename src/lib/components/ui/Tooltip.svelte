<script lang="ts">
	import { Info } from "lucide-svelte";
	import { onMount, onDestroy, tick } from 'svelte';
	import { get } from 'svelte/store';
	import { activeTooltipId } from '$lib/stores/tooltip';

	export let content: string;
	export let containerClass = '';
	export let showInfoIcon = true;

	// Generate unique ID for this tooltip instance
	const id = crypto.randomUUID();
	let show = false;

	// Update show state based on active tooltip
	activeTooltipId.subscribe(activeId => {
		show = activeId === id;
	});

	function handleTouch(event: TouchEvent | MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		
		if (event.type === 'touchstart' || !window.matchMedia('(hover: hover)').matches) {
			// If this tooltip is already active, close it
			if (get(activeTooltipId) === id) {
				activeTooltipId.set(null);
			} else {
				// Otherwise, make this the active tooltip
				activeTooltipId.set(id);
			}
		}
	}

	let isPositioned = false;

	async function handleMouseEnter() {
		// Calculate position before showing
		show = true;
		isPositioned = false;
		
		// Wait for next tick to ensure DOM is updated
		await tick();
		updatePosition();
		isPositioned = true;
	}

	function handleMouseLeave() {
		show = false;
		isPositioned = false;
	}

	// Handle clicks/touches outside of tooltips
	function handleGlobalClick(event: MouseEvent | TouchEvent) {
		// Don't handle if the event was already handled by a tooltip
		if (event.defaultPrevented) return;
		
		const target = event.target as HTMLElement;
		// Close tooltip if click/touch is outside any tooltip
		if (!target.closest('[role="tooltip"]')) {
			activeTooltipId.set(null);
		}
	}

	// Add keyboard handler
	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			if (get(activeTooltipId) === id) {
				activeTooltipId.set(null);
			} else {
				activeTooltipId.set(id);
			}
		}
	}

	let tooltipElement: HTMLDivElement;
	let containerElement: HTMLSpanElement;
	let infoIconElement: HTMLDivElement;
	let position: 'top' | 'bottom' | 'left' | 'right' = 'top';
	
	function updatePosition() {
		if (!tooltipElement || !containerElement) return;
		
		// Get the reference element for positioning
		const referenceRect = showInfoIcon && infoIconElement 
			? infoIconElement.getBoundingClientRect()
			: containerElement.getBoundingClientRect();

		const viewportHeight = window.innerHeight;
		const viewportWidth = window.innerWidth;
		const margin = 16;
		
		// Calculate available space in each direction from the reference center
		const spaceAbove = referenceRect.top;
		const spaceBelow = viewportHeight - referenceRect.bottom;
		const spaceLeft = referenceRect.left;
		const spaceRight = viewportWidth - referenceRect.right;
		
		// Find the direction with most space
		const spaces = [
			{ dir: 'top', space: spaceAbove },
			{ dir: 'bottom', space: spaceBelow },
			{ dir: 'left', space: spaceLeft },
			{ dir: 'right', space: spaceRight }
		];
		
		position = spaces.reduce((prev, curr) => 
			curr.space > prev.space ? curr : prev
		).dir as typeof position;

		// Reset styles for recalculation
		tooltipElement.style.width = 'fit-content';
		tooltipElement.style.maxWidth = '';
		
		// Get the natural content width
		const tooltipRect = tooltipElement.getBoundingClientRect();
		const contentWidth = tooltipRect.width;
		
		// Calculate optimal width based on position
		const isVertical = position === 'top' || position === 'bottom';
		if (isVertical) {
			const referenceCenterX = referenceRect.left + (referenceRect.width / 2);
			const maxLeftWidth = referenceCenterX - margin;
			const maxRightWidth = viewportWidth - referenceCenterX - margin;
			
			const maxWidth = Math.min(
				Math.max(maxLeftWidth, maxRightWidth) * 2,
				viewportWidth - (margin * 2)
			);
			
			tooltipElement.style.maxWidth = `${Math.max(contentWidth, maxWidth)}px`;
		} else {
			// For left/right positioning, use most of the available space
			const availableWidth = position === 'left' 
				? referenceRect.left - margin 
				: viewportWidth - referenceRect.right - margin;
			tooltipElement.style.maxWidth = `${Math.max(
				contentWidth,
				availableWidth * 0.9 // Use 90% of available space
			)}px`;
		}
	}

	$: if (show) {
		setTimeout(updatePosition, 0);
	}

	onMount(() => {
		window.addEventListener('resize', updatePosition);
		return () => window.removeEventListener('resize', updatePosition);
	});

	onDestroy(() => {
		document.removeEventListener('touchstart', handleGlobalClick, true);
		document.removeEventListener('click', handleGlobalClick, true);
	});
</script>

<!-- 
  Using span with ARIA attributes for tooltip functionality.
  We're ignoring a11y warnings because this is a custom tooltip implementation
  that needs to work both standalone and nested within interactive elements.
-->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<span 
    bind:this={containerElement}
    role="tooltip"
    aria-label={content}
    class="relative inline-flex items-center group cursor-help {containerClass}"
    on:mouseenter={handleMouseEnter}
    on:mouseleave={handleMouseLeave}
    on:click={handleTouch}
    on:touchstart={handleTouch}
    on:keydown={handleKeyDown}
>
    <div class="truncate min-w-0"> 
        <slot />
    </div>
    {#if showInfoIcon}
        <div bind:this={infoIconElement} class="relative">
            <Info class="w-4 h-4 text-slate-400 ml-1 shrink-0" />
            
            <div
                bind:this={tooltipElement}
                class="absolute z-50 px-3 py-2 bg-slate-800 text-white text-sm rounded-lg shadow-lg
                       min-w-[12rem] whitespace-normal
                       {show ? 'opacity-100' : 'opacity-0 pointer-events-none'}
                       {isPositioned ? 'transition-opacity duration-150' : 'transition-none'}
                       {position === 'top' ? 'bottom-[calc(100%+0.5rem)] left-1/2 -translate-x-1/2' : ''}
                       {position === 'bottom' ? 'top-[calc(100%+0.5rem)] left-1/2 -translate-x-1/2' : ''}
                       {position === 'left' ? 'right-[calc(100%+0.5rem)] top-1/2 -translate-y-1/2' : ''}
                       {position === 'right' ? 'left-[calc(100%+0.5rem)] top-1/2 -translate-y-1/2' : ''}"
            >
                {content}
                
                <div class="absolute w-0 h-0 border-[6px] border-transparent
                            {position === 'top' ? 'top-full left-1/2 -translate-x-1/2 border-t-slate-800' : ''}
                            {position === 'bottom' ? 'bottom-full left-1/2 -translate-x-1/2 border-b-slate-800' : ''}
                            {position === 'left' ? 'left-full top-1/2 -translate-y-1/2 border-l-slate-800' : ''}
                            {position === 'right' ? 'right-full top-1/2 -translate-y-1/2 border-r-slate-800' : ''}"
                ></div>
            </div>
        </div>
    {:else}
        <div bind:this={tooltipElement} class="absolute z-50 px-3 py-2 bg-slate-800 text-white text-sm rounded-lg shadow-lg
                   min-w-[12rem] whitespace-normal
                   {show ? 'opacity-100' : 'opacity-0 pointer-events-none'}
                   {isPositioned ? 'transition-opacity duration-150' : 'transition-none'}
                   {position === 'top' ? 'bottom-[calc(100%+0.5rem)] left-1/2 -translate-x-1/2' : ''}
                   {position === 'bottom' ? 'top-[calc(100%+0.5rem)] left-1/2 -translate-x-1/2' : ''}
                   {position === 'left' ? 'right-[calc(100%+0.5rem)] top-1/2 -translate-y-1/2' : ''}
                   {position === 'right' ? 'left-[calc(100%+0.5rem)] top-1/2 -translate-y-1/2' : ''}"
        >
            {content}
            
            <div class="absolute w-0 h-0 border-[6px] border-transparent
                        {position === 'top' ? 'top-full left-1/2 -translate-x-1/2 border-t-slate-800' : ''}
                        {position === 'bottom' ? 'bottom-full left-1/2 -translate-x-1/2 border-b-slate-800' : ''}
                        {position === 'left' ? 'left-full top-1/2 -translate-y-1/2 border-l-slate-800' : ''}
                        {position === 'right' ? 'right-full top-1/2 -translate-y-1/2 border-r-slate-800' : ''}"
            ></div>
        </div>
    {/if}
</span>
