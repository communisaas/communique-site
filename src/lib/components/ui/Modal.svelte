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
    $: dismissThreshold = viewportHeight * 0.15; // 15% of viewport height
    $: dismissHintThreshold = viewportHeight * 0.15; // 15% of viewport height
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

    let scrollableContent = {
        isScrollable: false,
        isAtTop: true,
        isAtBottom: true,
        touchY: 0,
        touchStartY: 0,
        scrollPosition: 0,
        maxScroll: 0
    };

    // Add new state for tracking dismissal transition
    let initialDismissY: number | null = null;
    let dismissStartTranslateY = 0;  // Track where the modal was when dismissal started

    // Add gesture state tracking
    let isInDismissalGesture = false;

    // Add a new store for gesture progress at the top with other stores
    const gestureProgress = tweened(0, {
        duration: 0,  // No duration for immediate response
        easing: cubicOut
    });

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
        if (isDismissing) {
            preventScroll(false);  // Re-enable scrolling
        }
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
        currentTouchY = touchStart;
        isInDismissalGesture = isDismissing;  // Track if we started in dismissal
        initialDismissY = null;  // Reset the initial dismiss position
        dismissStartTranslateY = $translateY;  // Capture starting position
        
        // Reset velocity tracking
        lastTouchTime = Date.now();
        lastTouchY = touchStart;
        velocity = 0;
    }

    function preventScroll(prevent: boolean) {
        // Find all scrollable elements within the modal
        const scrollableElements = modalContent?.querySelectorAll('.overflow-y-auto, .overflow-auto');
        
        scrollableElements?.forEach(element => {
            if (prevent) {
                (element as HTMLElement).style.overflow = 'hidden';
            } else {
                (element as HTMLElement).style.overflow = '';
            }
        });
    }

    function handleTouchMove(e: TouchEvent) {
        const isPopoverTrigger = (e.target as HTMLElement).closest('[aria-haspopup="true"]');
        console.log('Modal touch move:', {
            target: e.target,
            isPopoverTrigger,
            isDismissing,
            isInDismissalGesture
        });
        // Check if the touch started on a popover trigger
        if (isPopoverTrigger) {
            return; // Let the popover handle its own touch events
        }

        const currentTime = Date.now();
        const currentY = e.touches[0].clientY;
        
        const deltaTime = currentTime - lastTouchTime;
        
        if (deltaTime > 0) {
            velocity = (currentY - lastTouchY) / deltaTime;
        }
        
        lastTouchTime = currentTime;
        lastTouchY = currentY;

        const shouldHandleModal = 
            isInDismissalGesture ||  // If we're in a dismissal gesture, keep control
            isDismissing || 
            !scrollableContent.isScrollable || 
            (!isDismissing && (
                (scrollableContent.isAtTop && currentY > touchStart) || 
                (scrollableContent.isAtBottom && currentY < touchStart)
            ));

        if (shouldHandleModal) {
            isInDismissalGesture = true;  // Set when we take control
            // Calculate the current movement direction
            const currentDeltaY = currentY - (initialDismissY ?? currentY);
            const newDirection = currentDeltaY > 0 ? 'down' : 'up';
            
            // CHANGE: Separate the scroll-to-dismiss transition logic
            if (!isDismissing) {
                // Initial transition from scroll to dismiss
                initialDismissY = currentY;
                dismissStartTranslateY = $translateY;
                isDismissing = true;
                swipeDirection = newDirection;
                preventScroll(true);
                // Add touchStart reset to align with new gesture
                touchStart = currentY; 
                // Notify child components of dismissal state
                modalContent?.dispatchEvent(new CustomEvent('dismissStateChange', {
                    detail: { isDismissing: true },
                    bubbles: true
                }));
            } else if (swipeDirection && newDirection !== swipeDirection && 
                Math.abs(currentDeltaY) > dismissHintThreshold * 0.5) {
                // Direction reversal during dismissal
                initialDismissY = currentY;
                dismissStartTranslateY = $translateY;
                swipeDirection = newDirection;
                touchStart = currentY;
            }

            e.preventDefault();
            
            // Calculate movement relative to where dismissal started
            const dismissDeltaY = currentY - (initialDismissY ?? currentY);
            
            // Apply resistance and add to the starting position
            const resistanceFactor = resistance;
            const newTranslateY = dismissStartTranslateY + (dismissDeltaY * resistanceFactor);
            
            translateY.set(newTranslateY, { 
                hard: isPastThreshold  // Use hard animation when past threshold
            });
            
            // Calculate and update gesture progress independently
            const progress = Math.abs(newTranslateY) / dismissHintThreshold;
            gestureProgress.set(progress);
            
            // Update other visual feedback
            const dismissProgress = Math.pow(progress, 1.2);
            dismissHintOpacity.set(dismissProgress);
            hintScale.set(0.8 + (dismissProgress * 0.2));
            blurAmount.set(Math.pow(progress, 2) * 6);
            
            isPastThreshold = Math.abs(newTranslateY) > dismissThreshold;
        }
    }

    function handleTouchEnd(e: TouchEvent) {
        if (isDismissing) {
            // Release touch capture and restore scrolling
            modalContent?.releasePointerCapture?.(e.changedTouches[0].identifier);
            document.body.style.overflow = '';
            modalContent.style.touchAction = '';

            // Calculate final velocity and direction
            const endTime = Date.now();
            const deltaTime = endTime - lastTouchTime;
            if (deltaTime > 0) {
                velocity = (e.changedTouches[0].clientY - lastTouchY) / deltaTime;
            }

            const finalVelocity = Math.abs(velocity);
            const velocityThreshold = 0.5;
            
            if (isPastThreshold || finalVelocity > velocityThreshold) {
                // Direct dismissal without spring animation
                const dismissDistance = swipeDirection === 'down' ? 
                    dismissAnimationDistance : 
                    -dismissAnimationDistance;
                    
                translateY.set(dismissDistance, {
                    hard: true
                });
                
                dismissHintOpacity.set(0);
                hintScale.set(0.8);
                blurAmount.set(0);
                gestureProgress.set(0);
                
                setTimeout(() => {
                    close();
                }, 200);
            } else {
                // Always reset to 0 (initial position) regardless of swipe direction
                translateY.set(0);
                dismissHintOpacity.set(0);
                blurAmount.set(0);
                gestureProgress.set(0);
                preventScroll(false);
            }
        }
        
        velocity = 0;
        isDismissing = false;
        initialDismissY = null;
        swipeDirection = null;
        isPastThreshold = false;
        isInDismissalGesture = false;  // Reset only when touch ends
        
        // Reset gesture progress
        gestureProgress.set(0);
    }


    // Create a function to handle scroll state updates
    function handleScrollStateChange(event: CustomEvent) {
        scrollableContent = { ...scrollableContent, ...event.detail };
    }

    function handleTouchStateChange(event: CustomEvent) {
        const newState = event.detail;
        scrollableContent = { ...scrollableContent, ...newState };
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
        preventScroll(false);  // Ensure scrolling is re-enabled when component is destroyed
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
                bind:this={modalContent}
                class="modal-content relative bg-white rounded-xl w-full max-w-2xl shadow-xl 
                       h-[85vh] overflow-hidden touch-pan-y"
                style="transform: translateY({$translateY}px)"
                on:touchstart={handleTouchStart}
                on:touchmove={handleTouchMove}
                on:touchend={handleTouchEnd}
                on:touchcancel={handleTouchEnd}
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

                <!-- Blur effect container - positioned after content -->
                <div 
                    class="absolute inset-0 transition-[backdrop-filter] duration-75 pointer-events-none"
                    style="backdrop-filter: {blurStyle};
                           background: rgba(241, 245, 249, {$gestureProgress * 0.1})"
                >
                    <!-- Background gradients -->
                    {#if swipeDirection === 'down'}
                        <div 
                            class="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-slate-900/20 to-transparent"
                            style="opacity: {$dismissHintOpacity}"
                        ></div>
                    {:else if swipeDirection === 'up'}
                        <div 
                            class="absolute inset-0 bg-gradient-to-b from-slate-900/40 via-slate-900/20 to-transparent"
                            style="opacity: {$dismissHintOpacity}"
                        ></div>
                    {/if}
                </div>

                <!-- Dismissal hint -->
                {#if $dismissHintOpacity > 0}
                    <div
                        class="absolute inset-0 pointer-events-none z-10 flex items-center justify-center"
                        style="opacity: {$dismissHintOpacity}"
                    >
                        <!-- Centered hint message -->
                        <div
                            class="px-4 py-2.5 rounded-lg
                                   bg-white shadow-lg
                                   flex items-center gap-3
                                   border border-slate-200"
                            style="transform: scale({$hintScale})
                                    translateY({swipeDirection === 'down' ? 20 : -20}px)"
                        >
                            <span class="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
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
                            <span class="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
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
