<script lang="ts">
    import { Mail } from 'lucide-svelte';
    import { createEventDispatcher, onMount } from 'svelte';
    import { browser } from '$app/environment';

    export let preview: string;
    export let onScroll: (isAtBottom: boolean, scrollProgress?: number) => void;

    const dispatch = createEventDispatcher();
    let scrollContainer: HTMLPreElement;
    let isAtTop = true;
    let isAtBottom = false;
    let isScrollable = false;

    let debugInfo = {
        scrollHeight: 0,
        clientHeight: 0,
        isScrollable: false,
        isAtTop: true,
        isAtBottom: true
    };

    let modalDismissing = false;

    // Add this interface near the top of the script
    interface DismissStateEvent {
        isDismissing: boolean;
    }

    onMount(() => {
        // Update the event handler type
        const handleDismissState = (e: CustomEvent<DismissStateEvent>) => {
            modalDismissing = e.detail.isDismissing;
        };
        
        // Add touchend listener to reset state
        const handleTouchEnd = () => {
            if (modalDismissing) {
                modalDismissing = false;
            }
        };
        
        // Cast the event listener to handle the custom event type
        document.addEventListener('dismissStateChange', handleDismissState as EventListener);
        document.addEventListener('touchend', handleTouchEnd);
        
        return () => {
            document.removeEventListener('dismissStateChange', handleDismissState as EventListener);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    });

    // Update debug info whenever scroll container changes
    function updateDebugInfo() {
        if (!scrollContainer) return;
        
        const { scrollHeight, clientHeight, scrollTop } = scrollContainer;
        debugInfo = {
            scrollHeight,
            clientHeight,
            isScrollable: scrollHeight > clientHeight,
            isAtTop: scrollTop <= 0,
            isAtBottom: Math.abs(scrollHeight - clientHeight - scrollTop) < 1
        };
    }

    // Check if content is scrollable and dispatch initial state
    function updateScrollState() {
        if (!scrollContainer) return;
        
        const { scrollHeight, clientHeight, scrollTop } = scrollContainer;
        isScrollable = scrollHeight > clientHeight;
        isAtTop = scrollTop <= 0;
        isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 1;

        updateDebugInfo();

        dispatch('scrollStateChange', {
            isScrollable,
            isAtTop,
            isAtBottom,
            scrollProgress: scrollTop / (scrollHeight - clientHeight)
        });
    }

    function handleScroll() {
        updateScrollState();
        onScroll(isAtBottom);
    }

    let touchStartY = 0;

    function handleTouchStart(event: TouchEvent) {
        touchStartY = event.touches[0].clientY;
        handleTouch(event);
    }

    function handleTouch(event: TouchEvent) {
        if (!scrollContainer) return;
        
        const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
        const touchY = event.touches[0].clientY;
        
        const touchState = {
            touchY,
            touchStartY,
            isScrollable: scrollHeight > clientHeight,
            isAtTop: scrollTop <= 0,
            isAtBottom: Math.abs(scrollHeight - clientHeight - scrollTop) < 1,
            scrollPosition: scrollTop,
            maxScroll: scrollHeight - clientHeight,
            isDismissing: modalDismissing
        };

        // Only stop propagation if we're not dismissing and need to handle scroll
        if (!modalDismissing && touchState.isScrollable && 
            !((touchState.isAtTop && touchY > touchStartY) || 
              (touchState.isAtBottom && touchY < touchStartY))) {
            event.stopPropagation();
        }

        dispatch('touchStateChange', touchState);
    }

    // Add explicit touch end handler
    function handleTouchEnd() {
        if (modalDismissing) {
            modalDismissing = false;
        }
    }

    $: if (browser && preview) {
        setTimeout(() => {
            updateScrollState();
        }, 0);
    }
</script>

<div class="h-full flex flex-col cursor-text relative">
    <div class="flex items-center gap-2 mb-2 shrink-0">
        <Mail class="w-4 h-4 text-slate-500 shrink-0" />
        <h3 class="font-medium text-slate-900 text-sm sm:text-base">Message Preview</h3>
    </div>
    <div class="flex-1 min-h-0 relative">
        <pre 
            bind:this={scrollContainer}
            on:scroll={handleScroll}
            on:touchstart={handleTouchStart}
            on:touchmove={handleTouch}
            on:touchend={handleTouchEnd}
            data-scrollable={isScrollable}
            class="absolute inset-0 p-2 sm:p-4 
                   bg-slate-50 rounded-lg text-slate-600 
                   whitespace-pre-wrap font-mono text-xs sm:text-sm 
                   border border-slate-200 overflow-y-auto
                   touch-pan-y overscroll-contain"
        >{preview}</pre>
    </div>
</div>

<style>
    /* Custom scrollbar styling */
    pre::-webkit-scrollbar {
        width: 8px;
    }

    pre::-webkit-scrollbar-track {
        background: transparent;
    }

    pre::-webkit-scrollbar-thumb {
        background-color: rgba(156, 163, 175, 0.5);
        border-radius: 4px;
    }

    pre::-webkit-scrollbar-thumb:hover {
        background-color: rgba(156, 163, 175, 0.7);
    }
</style>
