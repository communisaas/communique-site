<script lang="ts">
	import { Info } from '@lucide/svelte';
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
	activeTooltipId.subscribe((activeId) => {
		show = activeId === id;
	});

	let isTouchInteraction = false;

	function handleTouch(event: TouchEvent | MouseEvent) {
		if (event instanceof MouseEvent) {
			if (!window.matchMedia('(hover: hover)').matches) {
				event.preventDefault();
				event.stopPropagation();
				toggleTooltip();
			}
		} else if (event.type === 'touchstart') {
			isTouchInteraction = true;
			toggleTooltip();
		}
	}

	function toggleTooltip() {
		if (get(activeTooltipId) === id) {
			activeTooltipId.set(null);
		} else {
			activeTooltipId.set(id);
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

		// If this is a touch event and we're in a touch interaction, only handle touchstart
		if (event instanceof TouchEvent) {
			if (event.type !== 'touchstart') return;

			const target = event.target as HTMLElement;
			if (!target.closest(`[data-tooltip-id="${id}"]`) && !target.closest('[role="tooltip"]')) {
				activeTooltipId.set(null);
			}
			return;
		}

		// For mouse clicks, close if clicking outside
		const target = event.target as HTMLElement;
		if (!target.closest('[role="tooltip"]')) {
			activeTooltipId.set(null);
		}
	}

	function handleTouchEnd(event: TouchEvent) {
		// Prevent touchend from triggering click events
		if (isTouchInteraction) {
			event.preventDefault();
			isTouchInteraction = false;
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
		const referenceRect =
			showInfoIcon && infoIconElement
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

		position = spaces.reduce((prev, curr) => (curr.space > prev.space ? curr : prev))
			.dir as typeof position;

		// Reset styles for recalculation
		tooltipElement.style.width = 'fit-content';
		tooltipElement.style.maxWidth = '';

		// Get the natural content width
		const tooltipRect = tooltipElement.getBoundingClientRect();
		const contentWidth = tooltipRect.width;

		// Calculate optimal width based on position
		const isVertical = position === 'top' || position === 'bottom';
		if (isVertical) {
			const referenceCenterX = referenceRect.left + referenceRect.width / 2;
			const maxLeftWidth = referenceCenterX - margin;
			const maxRightWidth = viewportWidth - referenceCenterX - margin;

			const maxWidth = Math.min(
				Math.max(maxLeftWidth, maxRightWidth) * 2,
				viewportWidth - margin * 2
			);

			tooltipElement.style.maxWidth = `${Math.max(contentWidth, maxWidth)}px`;
		} else {
			// For left/right positioning, use most of the available space
			const availableWidth =
				position === 'left'
					? referenceRect.left - margin
					: viewportWidth - referenceRect.right - margin;
			tooltipElement.style.maxWidth = `${Math.max(
				contentWidth,
				availableWidth * 0.9 // Use 90% of available space
			)}px`;
		}

		// Calculate position coordinates for fixed positioning
		let top = 0;
		let left = 0;

		if (position === 'top') {
			top = referenceRect.top - tooltipElement.offsetHeight - 8;
			left = referenceRect.left + referenceRect.width / 2 - tooltipElement.offsetWidth / 2;
		} else if (position === 'bottom') {
			top = referenceRect.bottom + 8;
			left = referenceRect.left + referenceRect.width / 2 - tooltipElement.offsetWidth / 2;
		} else if (position === 'left') {
			top = referenceRect.top + referenceRect.height / 2 - tooltipElement.offsetHeight / 2;
			left = referenceRect.left - tooltipElement.offsetWidth - 8;
		} else if (position === 'right') {
			top = referenceRect.top + referenceRect.height / 2 - tooltipElement.offsetHeight / 2;
			left = referenceRect.right + 8;
		}

		// Ensure tooltip stays within viewport bounds
		top = Math.max(margin, Math.min(top, viewportHeight - tooltipElement.offsetHeight - margin));
		left = Math.max(margin, Math.min(left, viewportWidth - tooltipElement.offsetWidth - margin));

		tooltipElement.style.top = `${top}px`;
		tooltipElement.style.left = `${left}px`;
	}

	$: if (show) {
		setTimeout(updatePosition, 0);
	}

	function handleScroll() {
		if (show) {
			// Hide tooltip on scroll to prevent it from becoming detached
			activeTooltipId.set(null);
		}
	}

	onMount(() => {
		window.addEventListener('resize', updatePosition);
		window.addEventListener('scroll', handleScroll, true);
		document.addEventListener('touchstart', handleGlobalClick, true);
		document.addEventListener('touchend', handleTouchEnd, true);
		document.addEventListener('click', handleGlobalClick, true);

		return () => {
			window.removeEventListener('resize', updatePosition);
			window.removeEventListener('scroll', handleScroll, true);
			document.removeEventListener('touchstart', handleGlobalClick, true);
			document.removeEventListener('touchend', handleTouchEnd, true);
			document.removeEventListener('click', handleGlobalClick, true);
		};
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
	data-tooltip-id={id}
	aria-label={content}
	class="group relative inline-flex cursor-help items-center {containerClass}"
	on:mouseenter={handleMouseEnter}
	on:mouseleave={handleMouseLeave}
	on:click={handleTouch}
	on:touchstart={handleTouch}
	on:touchend|preventDefault
	on:keydown={handleKeyDown}
>
	<div class="min-w-0 truncate">
		<slot />
	</div>
	{#if showInfoIcon}
		<div bind:this={infoIconElement} class="relative">
			<Info class="ml-1 h-4 w-4 shrink-0 text-slate-400" />

			<div
				bind:this={tooltipElement}
				class="fixed z-[100] min-w-[12rem] whitespace-normal rounded-lg bg-slate-800 px-3 py-2 text-sm
                       text-white shadow-lg
                       {show ? 'opacity-100' : 'pointer-events-none opacity-0'}
                       {isPositioned ? 'transition-opacity duration-150' : 'transition-none'}"
				style="top: 0; left: 0;"
			>
				{content}

				<div
					class="absolute h-0 w-0 border-[6px] border-transparent
                            {position === 'top'
						? 'left-1/2 top-full -translate-x-1/2 border-t-slate-800'
						: ''}
                            {position === 'bottom'
						? 'bottom-full left-1/2 -translate-x-1/2 border-b-slate-800'
						: ''}
                            {position === 'left'
						? 'left-full top-1/2 -translate-y-1/2 border-l-slate-800'
						: ''}
                            {position === 'right'
						? 'right-full top-1/2 -translate-y-1/2 border-r-slate-800'
						: ''}"
				></div>
			</div>
		</div>
	{:else}
		<div
			bind:this={tooltipElement}
			class="fixed z-[100] min-w-[12rem] whitespace-normal rounded-lg bg-slate-800 px-3 py-2 text-sm
                   text-white shadow-lg
                   {show ? 'opacity-100' : 'pointer-events-none opacity-0'}
                   {isPositioned ? 'transition-opacity duration-150' : 'transition-none'}"
			style="top: 0; left: 0;"
		>
			{content}

			<div
				class="absolute h-0 w-0 border-[6px] border-transparent
                        {position === 'top'
					? 'left-1/2 top-full -translate-x-1/2 border-t-slate-800'
					: ''}
                        {position === 'bottom'
					? 'bottom-full left-1/2 -translate-x-1/2 border-b-slate-800'
					: ''}
                        {position === 'left'
					? 'left-full top-1/2 -translate-y-1/2 border-l-slate-800'
					: ''}
                        {position === 'right'
					? 'right-full top-1/2 -translate-y-1/2 border-r-slate-800'
					: ''}"
			></div>
		</div>
	{/if}
</span>
