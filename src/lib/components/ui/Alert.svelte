<script lang="ts">
    import type { ComponentType } from 'svelte';
    
    export let variant: 'default' | 'success' | 'info' = 'default';
    export let icon: ComponentType | null = null;
    export let title: string | null = null;
    
    const variants = {
        default: 'bg-white border-slate-200',
        success: 'bg-green-50 border-green-200',
        info: 'bg-blue-50 border-blue-200'
    };
</script>

<div class="rounded-lg border p-4 {variants[variant]}">
    {#if title}
        <h3 class="flex items-center gap-2 font-medium mb-2">
            {#if icon}
                <svelte:component this={icon} class="w-4 h-4" />
            {/if}
            {title}
        </h3>
    {/if}
    <div class="text-sm">
        <slot />
    </div>
</div>
