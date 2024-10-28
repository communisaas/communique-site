<script lang="ts">
    import { ChevronRight } from 'lucide-svelte';
    import type { Template } from '$lib/types/template';
    import Badge from '../../ui/Badge.svelte';
    import MessageMetrics from './MessageMetrics.svelte';
    
    export let templates: Template[];
    export let selectedId: number | null;
    export let onSelect: (id: number) => void;
</script>

<div class="space-y-3 sm:space-y-4">
    {#each templates as template (template.id)}
        <div
            class="p-3 sm:p-4 rounded-lg border cursor-pointer transition-all flex justify-between items-start gap-3"
            class:border-blue-400={selectedId === template.id}
            class:bg-blue-50={selectedId === template.id}
            class:border-slate-200={selectedId !== template.id}
            class:hover:border-blue-200={selectedId !== template.id}
            on:click={() => onSelect(template.id)}
        >
            <div class="flex-1 min-w-0"> <!-- Add min-w-0 to allow text truncation -->
                <Badge type={template.type} />
                
                <h3 class="font-medium text-slate-900 mt-2 sm:mt-3 truncate">
                    {template.title}
                </h3>
                <p class="text-xs sm:text-sm text-slate-600 mb-2 sm:mb-3 line-clamp-2">
                    {template.description}
                </p>
                
                <MessageMetrics {template} />
            </div>
            
            <!-- Mobile indicator -->
            <div class="sm:hidden text-slate-400 shrink-0">
                <ChevronRight class="w-5 h-5" />
            </div>
        </div>
    {/each}
</div>
