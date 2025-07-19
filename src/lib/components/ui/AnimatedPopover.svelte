<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { scale, fly } from 'svelte/transition';
	import { quintOut, expoOut } from 'svelte/easing';
	import { tick } from 'svelte';
	import type { PopoverSlots, TriggerAction } from '$lib/types/popover';
	import { browser } from '$app/environment';
	import { popover as popoverStore } from '$lib/stores/popover';

	export let id = crypto.randomUUID();
	export let animationStyle: 'scale' | 'fly' | 'expand' = 'expand';
	export let duration = 200;

	const dispatch = createEventDispatcher();
	let popoverElement: HTMLDivElement;
	let containerElement: HTMLDivElement;
	let contentElement: HTMLDivElement;
	let isAnimating = false;
	let position = 'bottom';
	let isPositioned = false;

	let open = false;

	interface $$Slots extends PopoverSlots {}

	// React to popover store changes
	$: {
		if ($popoverStore?.id === id) {
			switch ($popoverStore.state) {
				case 'opening':
					if (!open) {
						open = true;
					}
					break;
				case 'open':
					if (!open) {
						open = true;
					}
					break;
				case 'closing':
					if (open) {
						open = false;
					}
					break;
			}
		} else if (open) {
			// If this popover is open but the store changed to another one, close this one
			open = false;
		}
	}

	// Enhanced animation configurations
	const animations = {
		scale: {
			in: { start: 0.95, opacity: 0 },
			out: { start: 0.95, opacity: 0 },
			easing: quintOut
		},
		fly: {
			in: { start: 0.9, opacity: 0 },
			out: { start: 0.9, opacity: 0 },
			easing: expoOut
		},
		expand: {
			in: { start: 0.9, opacity: 0 },
			out: { start: 0.9, opacity: 0 },
			easing: quintOut
		}
	};

	// Create the trigger action
	const triggerAction: TriggerAction = (node) => {
		return {
			destroy: () => {} // Cleanup if needed
		};
	};

	// Enhanced scroll handling with position updates
	function handleScroll(event: Event) {
		if (open && !isAnimating) {
			// Close popover on scroll to prevent it from becoming detached
			popoverStore.close(id);
		}
	}

	function handleResize() {
		if (open && isPositioned) {
			requestAnimationFrame(updatePosition);
		}
	}

	onMount(() => {
		// Listen to window scroll and resize events
		window.addEventListener('scroll', handleScroll, true);
		window.addEventListener('resize', handleResize);

		// Global click handler to close popover when clicking outside
		const handleGlobalClick = (event: MouseEvent) => {
			if (!containerElement || !popoverElement) return;

			const target = event.target as Node;
			if (!containerElement.contains(target) && !popoverElement.contains(target)) {
				if ($popoverStore?.id === id) {
					popoverStore.close(id);
				}
			}
		};

		document.addEventListener('click', handleGlobalClick, true);

		return () => {
			window.removeEventListener('scroll', handleScroll, true);
			window.removeEventListener('resize', handleResize);
			document.removeEventListener('click', handleGlobalClick, true);
		};
	});

	onDestroy(() => {
		if (browser) {
			window.removeEventListener('scroll', handleScroll, true);
			window.removeEventListener('resize', handleResize);
		}
	});

	async function handleMouseEnter() {
		popoverStore.open(id);
	}

	async function handleMouseLeave() {
		popoverStore.close(id);
	}

	async function handleAnimationOut() {
		isPositioned = false;
		isAnimating = false;
		popoverStore.closed(id);
		dispatch('close');
	}

	async function updatePosition() {
		if (!popoverElement || !containerElement) return;

		const triggerRect = containerElement.getBoundingClientRect();
		const viewportHeight = window.innerHeight;
		const viewportWidth = window.innerWidth;
		const margin = 8;

		// Calculate available space in each direction
		const spaceAbove = triggerRect.top;
		const spaceBelow = viewportHeight - triggerRect.bottom;

		// Determine vertical position - prefer bottom, but use top if more space
		let verticalPosition: 'top' | 'bottom' =
			spaceBelow >= 60 || spaceBelow > spaceAbove ? 'bottom' : 'top';

		// Calculate positions for fixed positioning
		let top: number;
		let left = triggerRect.left;

		// Vertical positioning
		if (verticalPosition === 'bottom') {
			top = triggerRect.bottom + 6;
			position = 'bottom';
		} else {
			top = triggerRect.top - popoverElement.offsetHeight - 6;
			position = 'top';
		}

		// Horizontal positioning - center on trigger, but keep in viewport
		const popoverWidth = popoverElement.offsetWidth;
		const idealLeft = triggerRect.left + triggerRect.width / 2 - popoverWidth / 2;

		if (idealLeft < margin) {
			left = margin;
		} else if (idealLeft + popoverWidth > viewportWidth - margin) {
			left = viewportWidth - popoverWidth - margin;
		} else {
			left = idealLeft;
		}

		// Ensure tooltip stays within viewport bounds
		top = Math.max(margin, Math.min(top, viewportHeight - popoverElement.offsetHeight - margin));

		// Apply fixed positioning
		popoverElement.style.top = `${top}px`;
		popoverElement.style.left = `${left}px`;
	}

	async function handleAnimationIn() {
		isAnimating = true;
		dispatch('open');

		await tick();
		await updatePosition();
		isPositioned = true;

		setTimeout(() => {
			isAnimating = false;
		}, duration);
	}
</script>

<div
	bind:this={containerElement}
	class="relative inline-block touch-manipulation"
	on:mouseenter={handleMouseEnter}
	on:mouseleave={handleMouseLeave}
>
	<slot name="trigger" {triggerAction}></slot>

	{#if open}
		<div
			bind:this={popoverElement}
			class="fixed z-[100] min-w-[200px] max-w-[280px] whitespace-normal
				   rounded-lg border border-gray-200 bg-white shadow-lg sm:max-w-[320px]
				   {isPositioned ? 'transition-opacity duration-150' : 'transition-none'}"
			style="top: 0; left: 0;"
			in:scale={{
				duration,
				start: animations[animationStyle].in.start,
				opacity: animations[animationStyle].in.opacity,
				easing: animations[animationStyle].easing
			}}
			on:introstart={handleAnimationIn}
			out:scale={{
				duration: duration * 0.8,
				start: animations[animationStyle].out.start,
				opacity: animations[animationStyle].out.opacity,
				easing: quintOut
			}}
			on:outroend={handleAnimationOut}
		>
			<div bind:this={contentElement} class="px-3 py-2 text-sm">
				<slot {open}></slot>
			</div>
		</div>
	{/if}
</div>

<style>
	.popover-container {
		/* Ensure proper rendering on mobile */
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
	}

	.popover-content {
		/* Optimize text rendering */
		text-rendering: optimizeLegibility;
	}

	/* Mobile-specific touch handling */
	@media (max-width: 640px) {
		.popover-container {
			/* Improve touch responsiveness */
			touch-action: manipulation;
		}
	}

	/* Tablet and desktop optimizations */
	@media (min-width: 641px) {
		.popover-container {
			/* Better hover effects on devices with precise pointers */
			transition: filter 0.2s ease;
		}

		.popover-container:hover {
			filter: drop-shadow(0 10px 8px rgb(0 0 0 / 0.04)) drop-shadow(0 4px 3px rgb(0 0 0 / 0.1));
		}
	}
</style>
