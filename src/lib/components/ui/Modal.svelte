<script lang="ts">
    import { createEventDispatcher, onMount, onDestroy } from 'svelte';
    import { scale } from 'svelte/transition';
    import { X } from 'lucide-svelte';
    import { tweened } from 'svelte/motion';
    import { cubicOut, quadOut } from 'svelte/easing';
    import { fade } from 'svelte/transition';
    import type { ModalScrollState } from '$lib/types/modal';

    const dispatch = createEventDispatcher<{
        close: void;
        scrollStateChange: ModalScrollState & { scrollProgress?: number };
    }>();
    let dialogElement: HTMLDialogElement;
    let isOpen = false;
    let scrollPosition: number;
    let modalContent: HTMLDivElement;
    let touchStart = 0;
    let touchY = 0;
    const translateY = tweened(0, {
        duration: 300,
        easing: quadOut
    });
    let showDismissHint = false;
    let isAtTop = true;
    let dismissHintOpacity = tweened(0, {
        duration: 200,
        easing: cubicOut
    });
    let dismissHintText: HTMLDivElement;
    let scrollState: ModalScrollState = {
        canDismissTop: true,
        canDismissBottom: true
    };

    export let inModal = false;

    function handleModalInteraction(e: MouseEvent | KeyboardEvent) {
        if (!isOpen) return;
        
        if (e.type === 'click') {
            const mouseEvent = e as MouseEvent;
            const clickedElement = mouseEvent.target as HTMLElement;
            
            if (clickedElement === dialogElement) {
                close();
            }
        }
        
        if (e.type === 'keydown' && (e as KeyboardEvent).key === 'Escape') {
            close();
        }
    }

    function close() {
        dispatch('close');
        closeModal();
    }

    function showModal() {
        isOpen = true;
        setTimeout(() => {
            dialogElement?.showModal();
        }, 0);
    }

    function closeModal() {
        isOpen = false;
        dialogElement?.close();
    }

    function lockScroll() {
        scrollPosition = window.scrollY;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollPosition}px`;
        document.body.style.width = '100%';
    }

    function unlockScroll() {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollPosition);
    }

    function handleTouchStart(e: TouchEvent) {
        touchStart = e.touches[0].clientY;
    }

    function handleTouchMove(e: TouchEvent) {
        touchY = e.touches[0].clientY - touchStart;
        
        // Only handle modal movement if we're:
        // 1. Already showing dismiss hint
        // 2. At the top and swiping up
        // 3. At the bottom and have scroll progress
        const shouldHandleModal = 
            showDismissHint || 
            (touchY < 0 && scrollState.canDismissTop) ||
            (touchY > 0 && scrollState.scrollProgress !== undefined);
        
        if (!shouldHandleModal) {
            return; // Let the scroll event propagate to the content
        }
        
        e.preventDefault();
        
        if (touchY < 0 && scrollState.canDismissTop) {
            translateY.set(touchY * 0.5);
            dismissHintOpacity.set(Math.min(Math.abs(touchY) / 150, 0.95));
            showDismissHint = touchY < -30;
        } else if (touchY > 0 && scrollState.scrollProgress !== undefined) {
            const resistance = 0.3;
            const offset = touchY * resistance * (1 - scrollState.scrollProgress);
            translateY.set(offset, { duration: 0 });
        }
    }

    function handleTouchEnd() {
        if (showDismissHint) {
            dismissHintOpacity.set(1);
            translateY.set(-window.innerHeight, { duration: 400 }).then(() => {
                close();
            });
        } else {
            translateY.set(0, { duration: 200 });
            dismissHintOpacity.set(0);
        }
        showDismissHint = false;
    }

    export function updateScrollState(state: Partial<ModalScrollState>) {
        scrollState = { ...scrollState, ...state };
        dispatch('scrollStateChange', scrollState);
    }

    onMount(() => {
        showModal();
        document.addEventListener('keydown', handleModalInteraction);
        document.addEventListener('click', handleModalInteraction);
        lockScroll();
    });

    onDestroy(() => {
        document.removeEventListener('keydown', handleModalInteraction);
        document.removeEventListener('click', handleModalInteraction);
        unlockScroll();
    });
</script>

{#if isOpen}
    <dialog
        bind:this={dialogElement}
        class="fixed inset-0 w-full h-full bg-transparent p-0 m-0
               backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
        <div class="h-full w-full p-4 flex items-center justify-center">
            <div
                class="relative bg-white rounded-xl w-full max-w-2xl shadow-xl overflow-hidden
                       h-[85vh]"
                role="document"
                transition:scale={{ duration: 200, start: 0.95 }}
                style="transform: translateY({$translateY}px)"
                on:touchstart={handleTouchStart}
                on:touchmove={handleTouchMove}
                on:touchend={handleTouchEnd}
                bind:this={modalContent}
            >
                <!-- Floating close button -->
                <button
                    on:click={close}
                    class="absolute right-2 top-2 z-20 p-2 hover:bg-gray-100 
                           rounded-full transition-colors bg-white/80 
                           backdrop-blur-sm shadow-sm"
                    aria-label="Close modal"
                >
                    <X class="w-5 h-5 text-gray-600" />
                </button>

                <!-- Content container -->
                <div class="h-full max-h-[85vh] overflow-hidden">
                    <div class="relative h-full">
                        <slot />
                    </div>
                </div>

                <!-- Dismiss hint overlay -->
                <div
                    class="absolute inset-0 pointer-events-none z-10 flex items-end justify-center"
                    style="opacity: {$dismissHintOpacity}"
                >
                    <div
                        class="bg-gradient-to-t from-black/50 to-transparent h-32 w-full flex items-center justify-center"
                        bind:this={dismissHintText}
                    >
                        <span class="text-white/90 font-medium text-sm">
                            Release to close
                        </span>
                    </div>
                </div>
            </div>
        </div>
    </dialog>
{/if}

<style>
    dialog::backdrop {
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
    }
    
    dialog {
        max-width: 100vw;
        max-height: 100vh;
    }
    
    /* Customize scrollbar */
    div::-webkit-scrollbar {
        width: 8px;
    }

    div::-webkit-scrollbar-track {
        background: transparent;
    }

    div::-webkit-scrollbar-thumb {
        background-color: rgba(156, 163, 175, 0.5);
        border-radius: 4px;
    }

    div::-webkit-scrollbar-thumb:hover {
        background-color: rgba(156, 163, 175, 0.7);
    }
</style>
