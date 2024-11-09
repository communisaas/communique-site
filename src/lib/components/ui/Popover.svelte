<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { fade } from 'svelte/transition';
    import { tick } from 'svelte';
    
    export let open = false;
    export let id = crypto.randomUUID();
    export let sticky = false;
    
    const dispatch = createEventDispatcher();
    let popoverElement: HTMLDivElement;
    let containerElement: HTMLDivElement;
    
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
        const viewportWidth = window.innerWidth;
        
        if (sticky) {
            popoverElement.style.position = 'fixed';
            popoverElement.style.top = `${triggerRect.bottom + 8}px`;
            popoverElement.style.left = `${triggerRect.left}px`;
            popoverElement.style.maxWidth = `${viewportWidth - triggerRect.left - 16}px`;
        }
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
</script>

<div 
    bind:this={containerElement}
    class="relative inline-block"
    role="button"
    tabindex="0"
    on:mouseenter={handleMouseEnter}
    on:mouseleave={handleMouseLeave}
    on:keydown={handleKeydown}
    on:focusin={handleFocus}
    on:focusout={handleBlur}
    aria-haspopup="true"
    aria-expanded={open}
>
    <slot name="trigger" aria-controls={id} />
    
    {#if open}
        <div class="absolute left-0 w-full h-2 bottom-0 translate-y-full"></div>
    {/if}
    
    {#if open}
        <div 
            bind:this={popoverElement}
            {id}
            role="tooltip"
            class="bg-white rounded-xl shadow-xl border border-slate-200 z-50
                   {sticky ? 'fixed' : 'absolute top-full mt-2'}
                   {sticky ? '' : 'left-0'}"
            transition:fade={{ duration: 200 }}
        >
            <div class="absolute left-0 w-full h-3 -top-3 cursor-default"></div>
            <slot {open} />
        </div>
    {/if}
</div>