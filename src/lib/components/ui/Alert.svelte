<script lang="ts">
    import type { ComponentType } from 'svelte';
    
    interface Props {
        variant?: 'default' | 'success' | 'info';
        icon?: ComponentType | null;
        title?: string | null;
        children?: unknown;
    }

    const { variant = 'default', icon = null, title = null, children }: Props = $props();
    
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
        {@render children?.()}
    </div>
</div>
