<script lang="ts">
    import { createEventDispatcher, onMount, onDestroy } from 'svelte';
    import { fade } from 'svelte/transition';
    import { tick } from 'svelte';
    import type { PopoverSlots, TriggerAction } from '$lib/types/popover';
	import { browser } from '$app/environment';
    
    export let open = false;
    export let id = crypto.randomUUID();
    
    const dispatch = createEventDispatcher();
    let popoverElement: HTMLDivElement;
    let containerElement: HTMLDivElement;
    
    interface $$Slots extends PopoverSlots {}

    // Create the trigger action
    const triggerAction: TriggerAction = (node) => {
        return {
            destroy: () => {} // Cleanup if needed
        };
    };
    
    // Track events that should trigger position updates
    function handleScroll() {
        if (open) {
            open = false;
            dispatch('close');
        }
    }

    function handleResize() {
        if (open) {
            requestAnimationFrame(updatePosition);
        }
    }

    onMount(() => {
        // Add event listeners
        window.addEventListener('scroll', handleScroll, true); // true for capture phase to catch all scroll events
        window.addEventListener('resize', handleResize);
    });

    onDestroy(() => {
        // Clean up event listeners
        if (browser) {
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleResize);
        }
    });

    async function handleMouseEnter() {
        open = true;
        dispatch('open');
        await tick();
        updatePosition();
    }
    
    function handleMouseLeave() {
        open = false;
        dispatch('close');
    }

    function updatePosition() {
        if (!popoverElement || !containerElement) return;
        
        const triggerRect = containerElement.getBoundingClientRect();
        const popoverRect = popoverElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Calculate available space in each direction
        const spaceAbove = triggerRect.top;
        const spaceBelow = viewportHeight - triggerRect.bottom;

        // Determine vertical position
        let verticalPosition: 'top' | 'bottom' = spaceBelow >= popoverRect.height || spaceBelow > spaceAbove 
            ? 'bottom' 
            : 'top';

        // Calculate initial positions
        let top: number;
        let left: number;

        // Vertical positioning
        if (verticalPosition === 'bottom') {
            top = triggerRect.bottom + 8;
        } else {
            top = triggerRect.top - popoverRect.height - 8;
        }

        // Always try to align with trigger first
        left = triggerRect.left;

        // If popover would overflow right edge
        if (left + popoverRect.width > viewportWidth - 16) {
            // Align right edge of popover with right edge of trigger
            left = triggerRect.right - popoverRect.width;
        }

        // If popover would overflow left edge after right alignment
        if (left < 16) {
            // Align with trigger center if possible
            left = triggerRect.left + (triggerRect.width / 2) - (popoverRect.width / 2);
            
            // If still overflowing left, align with left viewport edge
            if (left < 16) {
                left = 16;
            }
            
            // If now overflowing right, align with right viewport edge
            if (left + popoverRect.width > viewportWidth - 16) {
                left = viewportWidth - popoverRect.width - 16;
            }
        }

        // Ensure vertical bounds
        top = Math.max(16, Math.min(top, viewportHeight - popoverRect.height - 16));

        // Apply positions
        popoverElement.style.position = 'fixed';
        popoverElement.style.top = `${top}px`;
        popoverElement.style.left = `${left}px`;
        popoverElement.style.maxWidth = `${viewportWidth - 32}px`;
    }

    function handleFocus() {
        open = true;
        dispatch('open');
    }

    function handleBlur(event: FocusEvent) {
        const currentTarget = event.currentTarget as HTMLElement;
        const relatedTarget = event.relatedTarget as Node | null;
        
        if (currentTarget && relatedTarget && !currentTarget.contains(relatedTarget)) {
            open = false;
            dispatch('close');
        }
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape' && open) {
            open = false;
            dispatch('close');
        }
    }

    let isTouch = false;
    let touchTimeout: number;

    function handleTouchStart(event: TouchEvent) {
        // Don't handle touch events from within the popover content
        if (popoverElement?.contains(event.target as Node)) {
            return;
        }

        isTouch = true;
        // Clear any existing timeout
        if (touchTimeout) {
            clearTimeout(touchTimeout);
        }
        
        open = !open;
        if (open) {
            dispatch('open');
            tick().then(updatePosition);
        } else {
            dispatch('close');
        }

        // Reset isTouch after a delay to allow mouse events again
        touchTimeout = window.setTimeout(() => {
            isTouch = false;
        }, 500);
    }
</script>

<div 
    bind:this={containerElement}
    class="relative inline-block"
    role="button"
    tabindex="-1"
    on:mouseenter={handleMouseEnter}
    on:mouseleave={handleMouseLeave}
    on:touchstart={handleTouchStart}
    on:keydown={handleKeydown}
    on:focusin={handleFocus}
    on:focusout={handleBlur}
    aria-haspopup="true"
    aria-expanded={open}
>
    <slot 
        name="trigger" 
        trigger={triggerAction}
        aria-controls={id} 
    />
    
    {#if open}
        <!-- Add hover bridge that connects trigger to popover -->
        <div 
            class="fixed z-[69]"
            role="presentation"
            on:mouseenter={handleMouseEnter}
            on:mouseleave={handleMouseLeave}
            style="
                left: {containerElement?.getBoundingClientRect().left}px;
                width: {containerElement?.getBoundingClientRect().width}px;
                top: {containerElement?.getBoundingClientRect().bottom}px;
                height: 8px;
            "
        ></div>
        
        <div 
            bind:this={popoverElement}
            {id}
            role="tooltip"
            class="bg-white rounded-xl shadow-xl border border-slate-200 z-[70]"
            transition:fade={{ duration: 200 }}
            style="position: fixed; isolation: isolate;"
            on:mouseenter={handleMouseEnter}
            on:mouseleave={handleMouseLeave}
        >
            <slot {open} />
        </div>
    {/if}
</div>