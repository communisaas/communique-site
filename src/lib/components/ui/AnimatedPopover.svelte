<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { scale, fly } from 'svelte/transition';
	import { quintOut, expoOut } from 'svelte/easing';
	import { tick } from 'svelte';
	import type { PopoverSlots, TriggerAction } from '$lib/types/popover';
	import { addEventListener, addDocumentEventListener } from '$lib/utils/browserUtils';
	import { popover as popoverStore } from '$lib/stores/popover.svelte';

	interface Props {
		id: string;
		animationStyle?: 'scale' | 'fly' | 'expand';
		duration?: number;
	}

	const { id, animationStyle = 'expand', duration = 200 }: Props = $props();

	const dispatch = createEventDispatcher();
	let popoverElement: HTMLDivElement = $state();
	let containerElement: HTMLDivElement;
	let contentElement: HTMLDivElement = $state();
	let isAnimating = false;
	let position = 'bottom';
	let isPositioned = $state(false);

	let open = $state(false);

	interface $$Slots extends PopoverSlots {}

	// React to popover store changes
	$effect(() => {
		if (popoverStore.popover?.id === id) {
			switch (popoverStore.popover.state) {
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
	});

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

	// Event listener cleanup functions
	let cleanupFunctions: (() => void)[] = [];

	onMount(() => {
		// Listen to window scroll and resize events with automatic cleanup
		const scrollCleanup = addEventListener('scroll', handleScroll, true);
		const resizeCleanup = addEventListener('resize', handleResize);

		// Global click handler to close popover when clicking outside
		const handleGlobalClick = (event: MouseEvent) => {
			// Don't handle if this was a touch interaction
			if (isTouch) return;
			
			if (!containerElement || !popoverElement) return;

			const target = event.target as Node;
			
			// Don't close if clicking a form element inside the popover
			if (popoverElement.contains(target) && isFormElement(event.target)) {
				return;
			}
			
			// Close if clicking outside both container and popover
			if (!containerElement.contains(target) && !popoverElement.contains(target)) {
				if (popoverStore.popover?.id === id) {
					popoverStore.close(id);
				}
			}
		};

		const clickCleanup = addDocumentEventListener('click', handleGlobalClick, true);
		
		// Global touch handler to close popover when tapping outside
		const handleGlobalTouch = (event: TouchEvent) => {
			if (!isTouch || !containerElement || !popoverElement) return;
			
			const target = event.target as Node;
			
			// Don't close if touching a form element inside the popover
			if (popoverElement.contains(target) && isFormElement(event.target)) {
				return;
			}
			
			// Close if touching outside both container and popover
			if (!containerElement.contains(target) && !popoverElement.contains(target)) {
				if (popoverStore.popover?.id === id) {
					popoverStore.close(id);
				}
			}
		};
		
		const touchCleanup = addDocumentEventListener('touchstart', handleGlobalTouch, { capture: true, passive: false });

		// Store cleanup functions
		cleanupFunctions = [scrollCleanup, resizeCleanup, clickCleanup, touchCleanup].filter(Boolean) as (() => void)[];

		return () => {
			cleanupFunctions.forEach(cleanup => cleanup());
		};
	});

	onDestroy(() => {
		// Cleanup any remaining event listeners
		cleanupFunctions.forEach(cleanup => cleanup());
	});

	let isTouch = false;
	let touchTimeout: number | null = null;

	async function handleMouseEnter() {
		if (!isTouch) {
			popoverStore.open(id);
		}
	}

	async function handleMouseLeave() {
		if (!isTouch) {
			popoverStore.closeWithDelay(id, 150);
		}
	}

	function handlePopoverMouseEnter() {
		if (!isTouch) {
			// Cancel any pending close when mouse enters the popover
			popoverStore.cancelClose(id);
		}
	}

	function handlePopoverMouseLeave() {
		if (!isTouch) {
			// Close the popover when mouse leaves the popover itself
			popoverStore.closeWithDelay(id, 150);
		}
	}

	// Helper function to check if target is a form element
	function isFormElement(target: EventTarget | null): boolean {
		if (!target || !(target instanceof Element)) return false;
		
		const formTags = ['input', 'textarea', 'select', 'button'];
		const tagName = target.tagName.toLowerCase();
		
		return formTags.includes(tagName) || 
			   target.contentEditable === 'true' ||
			   target.closest('input, textarea, select, button') !== null;
	}

	function handleTouchStart(event: TouchEvent) {
		isTouch = true;
		
		// Check if the touch is on a form element INSIDE the popover content
		// (not the trigger button itself)
		const target = event.target as Element;
		if (popoverElement && popoverElement.contains(target) && isFormElement(event.target)) {
			// Don't close popover when interacting with form elements inside it
			return;
		}
		
		event.stopPropagation();
		
		// Clear any existing timeout
		if (touchTimeout) {
			clearTimeout(touchTimeout);
		}
		
		// Toggle popover on tap
		if (popoverStore.popover?.id === id) {
			popoverStore.close(id);
		} else {
			popoverStore.open(id);
		}
		
		// Reset touch flag after a longer delay to prevent immediate closure
		touchTimeout = setTimeout(() => {
			isTouch = false;
			touchTimeout = null;
		}, 1000) as unknown as number;
	}

	function handleTouchEnd(event: TouchEvent) {
		// Only prevent mouse events for non-form elements
		if (!isFormElement(event.target)) {
			event.preventDefault();
		}
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
	class="relative inline-block"
	style="touch-action: manipulation;"
	onmouseenter={handleMouseEnter}
	onmouseleave={handleMouseLeave}
	ontouchstart={handleTouchStart}
	ontouchend={handleTouchEnd}
	role="button"
	tabindex="0"
	aria-haspopup="true"
	aria-expanded={open}
>
	<slot name="trigger" {triggerAction}></slot>

	{#if open}
		<div
			bind:this={popoverElement}
			class="fixed z-[100] min-w-[200px] max-w-[280px] whitespace-normal
				   rounded-lg border border-gray-200 bg-white shadow-lg sm:max-w-[320px]
				   {isPositioned ? 'transition-opacity duration-150' : 'transition-none'}"
			style="top: 0; left: 0; touch-action: auto;"
			onmouseenter={handlePopoverMouseEnter}
			onmouseleave={handlePopoverMouseLeave}
			ontouchstart={(e) => {
				// Prevent popover from closing when touching inside it
				e.stopPropagation();
			}}
			onclick={(e) => {
				// Prevent popover from closing when clicking inside it
				e.stopPropagation();
			}}
			in:scale={{
				duration,
				start: animations[animationStyle].in.start,
				opacity: animations[animationStyle].in.opacity,
				easing: animations[animationStyle].easing
			}}
			onintrostart={handleAnimationIn}
			out:scale={{
				duration: duration * 0.8,
				start: animations[animationStyle].out.start,
				opacity: animations[animationStyle].out.opacity,
				easing: quintOut
			}}
			onoutroend={handleAnimationOut}
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
