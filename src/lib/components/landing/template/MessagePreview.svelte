<script lang="ts">
    import { Mail } from 'lucide-svelte';
    import { createEventDispatcher, onMount } from 'svelte';
    import { browser } from '$app/environment';

    export let preview: string;
    export let onScroll: (isAtBottom: boolean, scrollProgress?: number) => void;

    const dispatch = createEventDispatcher();
    let scrollContainer: HTMLDivElement;
    let isAtTop = true;
    let isAtBottom = false;
    let isScrollable = false;
    let activeVariable: string | null = null;

    interface Segment {
        type: 'text' | 'variable';
        content: string;
        name?: string;
    }

    interface DismissStateEvent {
        isDismissing: boolean;
    }

    let debugInfo = {
        scrollHeight: 0,
        clientHeight: 0,
        isScrollable: false,
        isAtTop: true,
        isAtBottom: true
    };

    let modalDismissing = false;

    // Parse template content into segments
    function parseTemplate(text: string): Segment[] {
        const segments: Segment[] = [];
        let currentIndex = 0;
        const variablePattern = /\[(.*?)\]/g;
        let match: RegExpExecArray | null;
        
        while ((match = variablePattern.exec(text)) !== null) {
            // Add text before variable if exists
            if (match.index > currentIndex) {
                segments.push({
                    type: 'text',
                    content: text.slice(currentIndex, match.index)
                });
            }
            
            // Add variable
            segments.push({
                type: 'variable',
                name: match[1],
                content: match[0]
            });
            
            currentIndex = match.index + match[0].length;
        }
        
        // Add remaining text if exists
        if (currentIndex < text.length) {
            segments.push({
                type: 'text',
                content: text.slice(currentIndex)
            });
        }
        
        return segments;
    }

    // Reactive declaration for parsed segments
    $: templateSegments = parseTemplate(preview);

    onMount(() => {
        const handleDismissState = (e: CustomEvent<DismissStateEvent>) => {
            modalDismissing = e.detail.isDismissing;
        };
        
        const handleTouchEnd = () => {
            if (modalDismissing) {
                modalDismissing = false;
            }
        };
        
        document.addEventListener('dismissStateChange', handleDismissState as EventListener);
        document.addEventListener('touchend', handleTouchEnd);
        
        return () => {
            document.removeEventListener('dismissStateChange', handleDismissState as EventListener);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    });

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

        if (!modalDismissing && touchState.isScrollable && 
            !((touchState.isAtTop && touchY > touchStartY) || 
              (touchState.isAtBottom && touchY < touchStartY))) {
            event.stopPropagation();
        }

        dispatch('touchStateChange', touchState);
    }

    function handleTouchEnd() {
        if (modalDismissing) {
            modalDismissing = false;
        }
    }

    function handleVariableClick(variableName: string) {
        activeVariable = activeVariable === variableName ? null : variableName;
        dispatch('variableSelect', { variableName, active: activeVariable === variableName });
    }

    $: if (browser && preview) {
        setTimeout(() => {
            updateScrollState();
        }, 0);
    }

    // Update variable styling to be more subtle by default
    function getVariableClasses(isActive: boolean): string {
        return `
            inline-flex justify-center
            px-1 -my-0.5
            rounded-full
            font-mono text-sm
            leading-normal
            cursor-pointer
            transition-all duration-150
            ${isActive 
                ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300' 
                : 'bg-blue-50/40 text-blue-600/90 hover:bg-blue-50 hover:text-blue-600 ring-1 ring-blue-200/60'}
            focus:outline-none focus:ring-2 
            focus:ring-blue-200 focus:ring-offset-1
            cursor-pointer
            align-baseline
            max-w-full
        `;
    }
</script>

<div class="h-full flex flex-col cursor-text relative">
    <div class="flex items-center gap-2 mb-2 shrink-0">
        <Mail class="w-4 h-4 text-slate-500 shrink-0" />
        <h3 class="font-medium text-slate-900 text-sm sm:text-base">Message Preview</h3>
    </div>
    <div class="flex-1 min-h-0 relative">
        <div 
            bind:this={scrollContainer}
            on:scroll={handleScroll}
            on:touchstart={handleTouchStart}
            on:touchmove={handleTouch}
            on:touchend={handleTouchEnd}
            data-scrollable={isScrollable}
            class="absolute inset-0 p-2 sm:p-4 
                   bg-slate-50 rounded-lg
                   font-mono text-sm
                   text-slate-600 leading-normal
                   border border-slate-200 overflow-y-auto
                   touch-pan-y overscroll-contain
                   whitespace-pre-line break-words"
        >
            {#each templateSegments as segment, i (i)}
                {#if segment.type === 'text'}
                    <span class="align-baseline leading-normal">{segment.content}</span>
                {:else}
                    <button
                        on:click={() => handleVariableClick(segment.name ?? '')}
                        class={getVariableClasses(activeVariable === segment.name)}
                    >
                        <div class="flex justify-center leading-normal">
                            <span class="break-words leading-normal">
                                {segment.name}
                            </span>
                        </div>
                    </button>
                {/if}
            {/each}
        </div>
    </div>
</div>

<style>
    /* Custom scrollbar styling */
    div[data-scrollable]::-webkit-scrollbar {
        width: 8px;
    }

    div[data-scrollable]::-webkit-scrollbar-track {
        background: transparent;
    }

    div[data-scrollable]::-webkit-scrollbar-thumb {
        background-color: rgba(156, 163, 175, 0.5);
        border-radius: 4px;
    }

    div[data-scrollable]::-webkit-scrollbar-thumb:hover {
        background-color: rgba(156, 163, 175, 0.7);
    }
</style>
