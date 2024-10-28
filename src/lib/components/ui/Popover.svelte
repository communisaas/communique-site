<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { fade } from 'svelte/transition';
    
    export let open = false;
    
    const dispatch = createEventDispatcher();
    
    function handleMouseEnter() {
        open = true;
        dispatch('open');
    }
    
    function handleMouseLeave() {
        open = false;
        dispatch('close');
    }
</script>

<div 
    class="relative"
    role="tooltip"
    on:mouseenter={handleMouseEnter}
    on:mouseleave={handleMouseLeave}
>
    <div class="inline-block">
        <slot name="trigger" />
    </div>
    
    {#if open}
        <div 
            class="absolute top-full mt-4 bg-white rounded-xl shadow-xl border border-slate-200 z-10 right-0 md:right-auto md:left-0"
            transition:fade={{ duration: 200 }}
        >
            <slot {open} />
        </div>
    {/if}
</div>
