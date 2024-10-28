<script lang="ts">
    import { createEventDispatcher, onMount, onDestroy } from 'svelte';
    import { scale } from 'svelte/transition';

    export let title: string;
    
    const dispatch = createEventDispatcher();
    let dialogElement: HTMLDialogElement;
    let isOpen = false;
    let scrollPosition: number;

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
        document.body.style.top = `-${scrollPosition}px`;
        document.body.classList.add('modal-open');
    }

    function unlockScroll() {
        document.body.classList.remove('modal-open');
        document.body.style.top = '';
        window.scrollTo(0, scrollPosition);
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
        class="backdrop:bg-black/50 backdrop:backdrop-blur-sm p-4 md:p-0 bg-transparent w-full max-w-2xl fixed"
    >
        <div
            class="relative bg-white rounded-xl w-[calc(100%-2rem)] md:w-full mx-auto shadow-xl overflow-hidden"
            style="max-height: calc(var(--vh,1vh)*90);"
            role="document"
            transition:scale={{ duration: 200, start: 0.95 }}
        >
            <!-- Modal header -->
            <div class="p-4 pb-0 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
                <div class="flex justify-between items-center mb-6">
                    <h2 id="modal-title" class="text-2xl font-bold text-gray-900">{title}</h2>
                    <button
                        on:click={close}
                        class="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        aria-label="Close modal"
                    >
                        <svg class="w-6 h-6 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Scrollable content -->
            <div 
                class="pt-1 px-6 pb-6 overflow-y-scroll" 
                style="height: calc(var(--vh,1vh)*90 - 8rem);"
            >
                <slot />
            </div>
        </div>
    </dialog>
{/if}

<style>
    /* ... keep existing styles ... */
</style>
