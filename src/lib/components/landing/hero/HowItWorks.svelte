<script lang="ts">
    import Button from '../../ui/Button.svelte';
    import Popover from '../../ui/Popover.svelte';
    import { onMount } from 'svelte';
    import { steps } from '$lib/data/steps';
    let alignment: 'left' | 'right' = 'right';
    $: origin = alignment === 'left' ? 'origin-top-left' : 'origin-top-right';

    onMount(() => {
        const mediaQuery = window.matchMedia('(min-width: 768px)');
        const updateAlignment = (e: MediaQueryList | MediaQueryListEvent) => {
            alignment = e.matches ? 'left' : 'right';
        };
        
        updateAlignment(mediaQuery);
        mediaQuery.onchange = updateAlignment;
        
        return () => {
            mediaQuery.onchange = null;
        };
    });
</script>

<Popover let:open>
    <Button 
        slot="trigger"
        variant="secondary" 
        cursor="alias"
        classNames="transition-all duration-200 hover:scale-[1.02] hover:shadow-md hover:border-slate-300"
    >
        How It Works
    </Button>

    <div class={`w-[280px] md:w-[480px] p-4 max-w-[calc(100vw-2rem)] ${origin} cursor-text`}>
        <div class="space-y-6">
            {#each steps as step, i}
                <div 
                    class="flex items-start gap-4 sm:text-base text-sm"
                    class:opacity-0={!open}
                >
                    <div class="p-2 bg-blue-50 rounded-lg">
                        <svelte:component this={step.icon} class="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                        <h3 class="font-medium text-slate-900 mb-1">
                            {step.title}
                        </h3>
                        <p class="text-slate-600 text-sm">
                            {step.desc}
                        </p>
                    </div>
                </div>
            {/each}
        </div>
    </div>
</Popover>
