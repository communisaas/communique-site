<script lang="ts">
    import { createEventDispatcher, onMount, onDestroy } from 'svelte';
    import { scale } from 'svelte/transition';
    import { X } from 'lucide-svelte';

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
                class="relative bg-white rounded-xl w-full max-w-2xl shadow-xl overflow-hidden"
                role="document"
                transition:scale={{ duration: 200, start: 0.95 }}
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
                <div class="max-h-[90vh] overflow-y-auto">
                    <div class="relative">
                        <slot />
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
