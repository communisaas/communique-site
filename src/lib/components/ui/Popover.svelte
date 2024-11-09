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
    let triggerElement: HTMLElement;
    
    async function handleMouseEnter() {
        open = true;
        dispatch('open');
        await tick();
        updatePosition();
    }
    
    function handleMouseLeave() {
        if (!document.activeElement?.contains(containerElement)) {
            open = false;
            dispatch('close');
        }
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

    function handleFocus(event: FocusEvent) {
        open = true;
        dispatch('open');
        updatePosition();
    }

    function handleBlur(event: FocusEvent) {
        const currentTarget = event.currentTarget as HTMLElement;
        const relatedTarget = event.relatedTarget as Node | null;
        
        if (!currentTarget.contains(relatedTarget as Node)) {
            open = false;
            dispatch('close');
        }
    }

    function handleKeydown(event: KeyboardEvent) {
        switch (event.key) {
            case 'Escape':
                if (open) {
                    open = false;
                    dispatch('close');
                    triggerElement?.focus();
                }
                break;
            case 'Tab':
                if (open && popoverElement) {
                    const focusableElements = popoverElement.querySelectorAll(
                        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                    );
                    
                    if (focusableElements.length === 0) return;
                    
                    const firstFocusable = focusableElements[0] as HTMLElement;
                    const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;
                    
                    if (event.shiftKey && document.activeElement === firstFocusable) {
                        lastFocusable.focus();
                        event.preventDefault();
                    } else if (!event.shiftKey && document.activeElement === lastFocusable) {
                        firstFocusable.focus();
                        event.preventDefault();
                    }
                }
                break;
        }
    }

    function bindTrigger(node: HTMLElement) {
        triggerElement = node;
        node.addEventListener('mouseenter', handleMouseEnter);
        node.addEventListener('mouseleave', handleMouseLeave);
        node.addEventListener('keydown', handleKeydown);
        node.addEventListener('focusin', handleFocus);
        node.addEventListener('focusout', handleBlur);
        
        return {
            destroy() {
                node.removeEventListener('mouseenter', handleMouseEnter);
                node.removeEventListener('mouseleave', handleMouseLeave);
                node.removeEventListener('keydown', handleKeydown);
                node.removeEventListener('focusin', handleFocus);
                node.removeEventListener('focusout', handleBlur);
            }
        };
    }
</script>

<div 
    bind:this={containerElement}
    class="relative inline-block"
>
    <div 
        use:bindTrigger
        aria-haspopup="true"
        aria-expanded={open}
    >
        <slot name="trigger" aria-controls={id} />
    </div>
    
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
            <div class="absolute left-0 w-full h-2 -top-2"></div>
            <slot {open} />
        </div>
    {/if}
</div>