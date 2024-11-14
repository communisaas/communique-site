<script lang="ts">
    import { createEventDispatcher, onMount, onDestroy } from 'svelte';
    import { scale } from 'svelte/transition';
    import { X } from 'lucide-svelte';
    import { tweened, spring } from 'svelte/motion';
    import { cubicOut, quadOut } from 'svelte/easing';
    import { fade } from 'svelte/transition';
    import type { ModalScrollState } from '$lib/types/modal';

    const dispatch = createEventDispatcher<{
        close: void;
        scrollStateChange: ModalScrollState;
    }>();

    let dialogElement: HTMLDialogElement;
    let isOpen = false;
    let scrollPosition: number;
    let modalContent: HTMLDivElement;
    let touchStart = 0;
    let currentTouchY = 0;
    let isDismissing = false;
    let swipeDirection: 'up' | 'down' | null = null;
    
    const translateY = spring(0, {
        stiffness: 0.35,
        damping: 0.4,
        precision: 0.0001
    });
    
    const dismissHintOpacity = tweened(0, {
        duration: 200,
        easing: cubicOut
    });

    let scrollState: ModalScrollState & {
        touchState?: {
            touchY: number;
            deltaY: number;
            isScrolling: boolean;
            isAtTop: boolean;
            isAtBottom: boolean;
        };
    } = {
        canDismissTop: true,
        canDismissBottom: true,
        scrollProgress: 0
    };

    let touchStartTarget: EventTarget | null = null;

    let viewportHeight: number;
    
    // Calculate thresholds based on viewport height
    $: dismissThreshold = viewportHeight * 0.05; // 5% of viewport height
    $: dismissHintThreshold = viewportHeight * 0.05; // 5% of viewport height
    $: dismissAnimationDistance = viewportHeight; // Full viewport height for dismiss animation
    
    // Update resistance based on viewport height
    $: resistance = Math.max(0.3, Math.min(0.5, viewportHeight / 1000));

    // Add a store for the hint scale animation
    const hintScale = tweened(0.8, {
        duration: 100,
        easing: cubicOut
    });

    // Add a store for the blur amount with shorter duration for smoother updates
    const blurAmount = tweened(0, {
        duration: 0,  // No duration for immediate response
        easing: cubicOut
    });

    let isPastThreshold = false;

    let lastTouchTime: number;
    let lastTouchY: number;
    let velocity = 0;

    function updateViewportHeight() {
        viewportHeight = window.innerHeight;
    }

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
        touchStartTarget = e.target;
        touchStart = e.touches[0].clientY;
        currentTouchY = touchStart;
        isDismissing = false;
        lastTouchTime = Date.now();
        lastTouchY = e.touches[0].clientY;
        velocity = 0;
    }

    function handleTouchMove(e: TouchEvent) {
        const currentTime = Date.now();
        const currentY = e.touches[0].clientY;
        const deltaTime = currentTime - lastTouchTime;
        
        // Calculate instantaneous velocity (pixels per millisecond)
        if (deltaTime > 0) {
            velocity = (currentY - lastTouchY) / deltaTime;
        }
        
        lastTouchTime = currentTime;
        lastTouchY = currentY;
        
        const previousTouchY = currentTouchY;
        currentTouchY = e.touches[0].clientY;
        const deltaY = currentTouchY - touchStart;
        const movementY = currentTouchY - previousTouchY;
        
        // Check if we're interacting with a scrollable element
        const isScrollableInteraction = touchStartTarget instanceof Element && 
            (touchStartTarget.closest('pre') || touchStartTarget.closest('[data-scrollable]'));

        // Determine if we should handle modal movement
        const shouldHandleModal = 
            isDismissing || // Already dismissing
            !isScrollableInteraction || // Not a scrollable interaction
            (scrollState.touchState?.isAtTop && deltaY < 0) || // At top and swiping up
            (scrollState.touchState?.isAtBottom && deltaY > 0); // At bottom and swiping down

        if (shouldHandleModal) {
            e.preventDefault();
            isDismissing = true;
            
            swipeDirection = deltaY < 0 ? 'up' : 'down';

            const newTranslateY = $translateY + (movementY * resistance);
            translateY.set(newTranslateY, { duration: 0 });
            
            // More gradual blur calculation
            const progress = Math.min(
                Math.abs(newTranslateY) / dismissHintThreshold,
                1
            );
            const dismissProgress = Math.pow(progress, 1.2);
            const blurProgress = Math.pow(progress, 2); // Square the progress for more gradual start
            
            dismissHintOpacity.set(dismissProgress, { duration: 0 });
            hintScale.set(0.8 + (dismissProgress * 0.2), { duration: 0 });
            blurAmount.set(blurProgress * 6, { duration: 0 }); // Remove duration for direct response

            // Update threshold state
            isPastThreshold = Math.abs(newTranslateY) > dismissThreshold;
        } else {
            // Reset state
            isDismissing = false;
            swipeDirection = null;
            if ($translateY !== 0) {
                translateY.set(0, { duration: 100 });
                dismissHintOpacity.set(0, { duration: 100 });
                hintScale.set(0.8, { duration: 100 });
                blurAmount.set(0, { duration: 150 }); // Keep smooth reset
            }
        }
    }

    function handleTouchEnd() {
        if (isDismissing) {
            if (Math.abs($translateY) > dismissThreshold) {
                const direction = $translateY > 0 ? 1 : -1;
                dismissHintOpacity.set(1);
                
                // Calculate dynamic duration based on velocity
                const absVelocity = Math.abs(velocity);
                const baseDuration = 100;
                const minDuration = 100;
                const maxDuration = 400;
                
                // Invert the logic: higher velocity = higher velocityFactor = shorter duration
                const velocityFactor = Math.min(Math.max(absVelocity * 1000, 0.5), 3);
                const dynamicDuration = Math.round(
                    Math.min(
                        Math.max(
                            baseDuration * velocityFactor,
                            minDuration
                        ),
                        maxDuration
                    )
                );
                
                const dismissTween = tweened($translateY, {
                    duration: dynamicDuration,
                    easing: quadOut
                });
                
                dismissTween.set(direction * dismissAnimationDistance)
                    .then(() => close());
                
                const unsubscribe = dismissTween.subscribe(value => {
                    translateY.set(value, { hard: true });
                });
                
                setTimeout(() => unsubscribe(), dynamicDuration);
            } else {
                // Reset position using spring for bounce-back
                translateY.set(0);
                dismissHintOpacity.set(0);
            }
        }
        
        velocity = 0;
        isDismissing = false;
        swipeDirection = null;
        isPastThreshold = false;
    }

    function updateScrollState(state: Partial<ModalScrollState>) {
        scrollState = { ...scrollState, ...state };
        dispatch('scrollStateChange', scrollState);
    }

    // Create a function to handle scroll state updates
    function handleScrollStateChange(event: CustomEvent) {
        scrollState = { ...scrollState, ...event.detail };
    }

    // Add a derived value for smoother blur
    $: blurStyle = `blur(${$blurAmount}px)`;

    onMount(() => {
        showModal();
        updateViewportHeight();
        window.addEventListener('resize', updateViewportHeight);
        document.addEventListener('keydown', handleModalInteraction);
        document.addEventListener('click', handleModalInteraction);
        modalContent?.addEventListener('scrollChange', (event: Event) => {
            handleScrollStateChange(event as CustomEvent);
        });
        lockScroll();
    });

    onDestroy(() => {
        window.removeEventListener('resize', updateViewportHeight);
        document.removeEventListener('keydown', handleModalInteraction);
        document.removeEventListener('click', handleModalInteraction);
        modalContent?.removeEventListener('scrollChange', (event: Event) => {
            handleScrollStateChange(event as CustomEvent);
        });
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
                <!-- Close button -->
                <button
                    on:click={close}
                    class="absolute right-2 top-2 z-20 p-2 hover:bg-gray-100 
                           rounded-full transition-colors bg-white/80 
                           backdrop-blur-sm shadow-sm"
                    aria-label="Close modal"
                >
                    <X class="w-5 h-5 text-gray-600" />
                </button>

                <!-- Content -->
                <div class="h-full max-h-[85vh] overflow-hidden">
                    <div class="relative h-full">
                        <slot />
                    </div>
                </div>

                <!-- Dismiss hints with dynamic height -->
                {#if $dismissHintOpacity > 0}
                    <div
                        class="absolute inset-0 pointer-events-none z-10 flex items-center justify-center"
                        style="opacity: {$dismissHintOpacity}"
                    >
                        <!-- Blur effect container -->
                        <div 
                            class="absolute inset-0 transition-[backdrop-filter] duration-75"
                            style="backdrop-filter: {blurStyle};
                                   background: rgba(241, 245, 249, {$dismissHintOpacity * 0.1})"
                        >
                            <!-- Background gradients -->
                            {#if swipeDirection === 'down'}
                                <div 
                                    class="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-slate-900/20 to-transparent"
                                    style="opacity: {$dismissHintOpacity}"
                                />
                            {:else if swipeDirection === 'up'}
                                <div 
                                    class="absolute inset-0 bg-gradient-to-b from-slate-900/40 via-slate-900/20 to-transparent"
                                    style="opacity: {$dismissHintOpacity}"
                                />
                            {/if}
                        </div>

                        <!-- Centered hint message -->
                        <div
                            class="px-4 py-2.5 rounded-lg
                                   bg-white shadow-lg
                                   flex items-center gap-3
                                   border border-slate-200"
                            style="transform: scale({$hintScale})
                                    translateY({swipeDirection === 'down' ? 20 : -20}px)"
                        >
                            <span class="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                            <div class="relative w-[180px] h-[20px]">
                                {#key isPastThreshold}
                                    <span 
                                        class="text-slate-900 text-sm font-medium absolute left-1/2 -translate-x-1/2 whitespace-nowrap"
                                        in:scale={{ duration: 100, start: 0.8 }}
                                        out:scale|local={{ duration: 100, start: 1.2 }}
                                    >
                                        {isPastThreshold ? 'Release to close' : 'Keep swiping to close'}
                                    </span>
                                {/key}
                            </div>
                            <span class="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                        </div>
                    </div>
                {/if}
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
