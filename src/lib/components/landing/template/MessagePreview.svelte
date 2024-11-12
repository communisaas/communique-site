<script lang="ts">
    import { Mail } from 'lucide-svelte';
    
    export let preview: string;
    export let onScroll: (isAtBottom: boolean, scrollProgress?: number) => void = () => {};
    
    let preElement: HTMLPreElement;
    let touchStartY = 0;
    
    function handleScroll() {
        const isAtBottom = preElement.scrollHeight - preElement.scrollTop <= preElement.clientHeight + 1;
        onScroll(isAtBottom);
    }

    function handleTouchStart(e: TouchEvent) {
        touchStartY = e.touches[0].clientY;
    }

    function handleTouchMove(e: TouchEvent) {
        const touchY = e.touches[0].clientY;
        const deltaY = touchY - touchStartY;
        const isAtBottom = preElement.scrollHeight - preElement.scrollTop <= preElement.clientHeight + 1;
        
        // Calculate scroll progress (0 when at bottom, 1 when scrolled up)
        const scrollProgress = Math.max(0, 
            (preElement.scrollHeight - preElement.scrollTop - preElement.clientHeight) / 
            Math.max(1, preElement.scrollHeight - preElement.clientHeight)
        );
        
        // Let modal handle swipe up when at bottom
        if (deltaY < 0 && isAtBottom) {
            onScroll(true, 0);
            // Don't stop propagation here - let the modal handle it
            return;
        }
        
        // Share scroll state with modal
        onScroll(isAtBottom, scrollProgress);
        // Only stop propagation if we're actually scrolling
        if (!isAtBottom || deltaY > 0) {
            e.stopPropagation();
        }
    }
</script>

<div class="h-full flex flex-col">
    <div class="flex items-center gap-2 mb-2 shrink-0">
        <Mail class="w-4 h-4 text-slate-500 shrink-0" />
        <h3 class="font-medium text-slate-900 text-sm sm:text-base">Message Preview</h3>
    </div>
    <div class="flex-1 min-h-0">
        <pre 
            bind:this={preElement}
            on:scroll={handleScroll}
            on:touchstart={handleTouchStart}
            on:touchmove={handleTouchMove}
            class="h-full p-2 sm:p-4 
                   bg-slate-50 rounded-lg text-slate-600 
                   whitespace-pre-wrap font-mono text-xs sm:text-sm 
                   border border-slate-200 overflow-y-auto"
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
