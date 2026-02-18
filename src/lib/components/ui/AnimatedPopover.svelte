<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { scale } from 'svelte/transition';
	import { quintOut, expoOut } from 'svelte/easing';
	import { tick as _tick } from 'svelte';
	import type { PopoverSlots as _PopoverSlots, TriggerAction } from '$lib/types/popover';
	import type { Snippet } from 'svelte';
	import { addEventListener, addDocumentEventListener } from '$lib/utils/browserUtils';
	interface Props {
		id: string;
		animationStyle?: 'scale' | 'fly' | 'expand';
		duration?: number;
		trigger?: Snippet<[{ triggerAction: TriggerAction }]>;
		children?: Snippet<[{ open: boolean }]>;
	}

	const { id, animationStyle = 'expand', duration = 200, trigger, children }: Props = $props();

	let popoverElement: HTMLDivElement | undefined = $state();
	let containerElement: HTMLDivElement;
	let contentElement: HTMLDivElement | undefined = $state();
	let isAnimating = false;
	let _position = 'bottom';
	let isPositioned = $state(false);

	// Independent state for each popover - no shared store
	let open = $state(false);
	let closeTimeout: number | null = null;

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
	const triggerAction: TriggerAction = (_node) => {
		return {
			destroy: () => {
				/* Cleanup if needed */
			}
		};
	};

	// Enhanced scroll handling with position updates
	function handleScroll(__event: Event) {
		if (open && !isAnimating) {
			// Close popover on scroll to prevent it from becoming detached
			open = false;
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
		const handleGlobalClick = (__event: MouseEvent) => {
			// Don't handle if this was a touch interaction
			if (isTouch) return;

			if (!containerElement || !popoverElement) return;

			const target = __event.target as Node;

			// Don't close if clicking a form element inside the popover
			if (popoverElement.contains(target) && isFormElement(__event.target)) {
				return;
			}

			// Close if clicking outside both container and popover
			if (!containerElement.contains(target) && !popoverElement.contains(target)) {
				open = false;
			}
		};

		const clickCleanup = addDocumentEventListener('click', handleGlobalClick, true);

		// Global touch handler to close popover when tapping outside
		const handleGlobalTouch = (__event: TouchEvent) => {
			if (!isTouch || !containerElement || !popoverElement) return;

			const target = __event.target as Node;

			// Don't close if touching a form element inside the popover
			if (popoverElement.contains(target) && isFormElement(__event.target)) {
				return;
			}

			// Close if touching outside both container and popover
			if (!containerElement.contains(target) && !popoverElement.contains(target)) {
				open = false;
			}
		};

		const touchCleanup = addDocumentEventListener('touchstart', handleGlobalTouch, {
			capture: true,
			passive: false
		});

		// Store cleanup functions
		cleanupFunctions = [scrollCleanup, resizeCleanup, clickCleanup, touchCleanup].filter(
			Boolean
		) as (() => void)[];

		return () => {
			cleanupFunctions.forEach((cleanup) => cleanup());
		};
	});

	onDestroy(() => {
		// Cleanup any remaining event listeners
		cleanupFunctions.forEach((cleanup) => cleanup());
		// Clean up any pending close timeout
		if (closeTimeout) {
			clearTimeout(closeTimeout);
		}
		if (touchTimeout) {
			clearTimeout(touchTimeout);
		}
	});

	let isTouch = false;
	let touchTimeout: number | null = null;

	async function handleMouseEnter() {
		if (!isTouch) {
			// Cancel any pending close
			if (closeTimeout) {
				clearTimeout(closeTimeout);
				closeTimeout = null;
			}
			// Open immediately
			open = true;
			// Don't call updatePosition here - let handleAnimationIn do it
		}
	}

	async function handleMouseLeave() {
		if (!isTouch) {
			// Small delay before closing to allow moving to popover content
			closeTimeout = setTimeout(() => {
				open = false;
				closeTimeout = null;
			}, 100) as unknown as number;
		}
	}

	function handlePopoverMouseEnter() {
		if (!isTouch) {
			// Cancel any pending close when mouse enters the popover
			if (closeTimeout) {
				clearTimeout(closeTimeout);
				closeTimeout = null;
			}
		}
	}

	function handlePopoverMouseLeave() {
		if (!isTouch) {
			// Close the popover when mouse leaves the popover itself
			closeTimeout = setTimeout(() => {
				open = false;
				closeTimeout = null;
			}, 100) as unknown as number;
		}
	}

	// Helper function to check if target is a form element
	function isFormElement(target: EventTarget | null): boolean {
		if (!target || !(target instanceof Element)) return false;

		const formTags = ['input', 'textarea', 'select', 'button'];
		const tagName = target.tagName.toLowerCase();

		return (
			formTags.includes(tagName) ||
			(target as HTMLElement).contentEditable === 'true' ||
			target.closest('input, textarea, select, button') !== null
		);
	}

	function handleTouchStart(__event: TouchEvent) {
		isTouch = true;

		// Check if the touch is on a form element INSIDE the popover content
		// (not the trigger button itself)
		const target = __event.target as Element;
		if (popoverElement && popoverElement.contains(target) && isFormElement(__event.target)) {
			// Don't close popover when interacting with form elements inside it
			return;
		}

		__event.stopPropagation();

		// Clear any existing timeout
		if (touchTimeout) {
			clearTimeout(touchTimeout);
		}

		// Toggle popover on tap
		open = !open;
		if (open) {
			_tick().then(updatePosition);
		}

		// Reset touch flag after a longer delay to prevent immediate closure
		touchTimeout = setTimeout(() => {
			isTouch = false;
			touchTimeout = null;
		}, 1000) as unknown as number;
	}

	function handleTouchEnd(__event: TouchEvent) {
		// Only prevent mouse events for non-form elements
		if (!isFormElement(__event.target)) {
			__event.preventDefault();
		}
	}

	async function handleAnimationOut() {
		isPositioned = false;
		isAnimating = false;
	}

	async function updatePosition() {
		if (!popoverElement || !containerElement) return;

		// Wait for the popover to have dimensions
		if (popoverElement.offsetWidth === 0 || popoverElement.offsetHeight === 0) {
			// Try again after a frame
			requestAnimationFrame(() => updatePosition());
			return;
		}

		const triggerRect = containerElement.getBoundingClientRect();
		const viewportHeight = window.innerHeight;
		const viewportWidth = window.innerWidth;
		const margin = 8;

		// Get popover dimensions
		const popoverWidth = popoverElement.offsetWidth;
		const popoverHeight = popoverElement.offsetHeight;

		console.log('AnimatedPopover positioning debug:', {
			id,
			triggerRect: {
				top: triggerRect.top,
				left: triggerRect.left,
				bottom: triggerRect.bottom,
				right: triggerRect.right,
				width: triggerRect.width,
				height: triggerRect.height
			},
			popoverDimensions: {
				width: popoverWidth,
				height: popoverHeight
			}
		});

		// Calculate available space in each direction
		const spaceAbove = triggerRect.top;
		const spaceBelow = viewportHeight - triggerRect.bottom;

		// Determine vertical position - prefer bottom, but use top if more space
		let verticalPosition: 'top' | 'bottom' =
			spaceBelow >= popoverHeight + margin || spaceBelow > spaceAbove ? 'bottom' : 'top';

		// Calculate positions for fixed positioning
		let top: number;
		let left: number;

		// Vertical positioning
		if (verticalPosition === 'bottom') {
			top = triggerRect.bottom + 6;
			_position = 'bottom';
		} else {
			top = triggerRect.top - popoverHeight - 6;
			_position = 'top';
		}

		// Horizontal positioning - center on trigger, but keep in viewport
		const idealLeft = triggerRect.left + triggerRect.width / 2 - popoverWidth / 2;

		if (idealLeft < margin) {
			left = margin;
		} else if (idealLeft + popoverWidth > viewportWidth - margin) {
			left = viewportWidth - popoverWidth - margin;
		} else {
			left = idealLeft;
		}

		// Ensure tooltip stays within viewport bounds
		top = Math.max(margin, Math.min(top, viewportHeight - popoverHeight - margin));

		console.log('AnimatedPopover final position:', { top, left });

		// Apply fixed positioning
		popoverElement.style.top = `${top}px`;
		popoverElement.style.left = `${left}px`;
	}

	async function handleAnimationIn() {
		isAnimating = true;

		await _tick();
		await updatePosition();
		isPositioned = true;

		setTimeout(() => {
			isAnimating = false;
		}, duration);
	}
</script>

<div class="contents">
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
		{#if trigger}
			{@render trigger({ triggerAction })}
		{/if}
	</div>

	{#if open}
		<div
			bind:this={popoverElement}
			class="fixed z-[100] min-w-[200px] max-w-[280px] whitespace-normal
				   rounded-lg border border-gray-200 bg-white shadow-lg sm:max-w-[320px]
				   {isPositioned ? 'transition-opacity duration-150' : 'transition-none'}"
			style="visibility: {isPositioned ? 'visible' : 'hidden'}; touch-action: auto;"
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
			onkeydown={(e) => {
				if (e.key === 'Escape') {
					open = false;
				}
			}}
			role="dialog"
			aria-modal="false"
			tabindex="0"
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
				{#if children}
					{@render children({ open })}
				{/if}
			</div>
		</div>
	{/if}
</div>
