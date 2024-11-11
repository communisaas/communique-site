<script lang="ts">
    import { ChevronRight } from 'lucide-svelte';
    import type { Template } from '$lib/types/template';
    import Badge from '../../ui/Badge.svelte';
    import MessageMetrics from './MessageMetrics.svelte';
    
    export let templates: Template[];
    export let selectedId: number | null;
    export let onSelect: (id: number) => void;
    
    function handleKeydown(event: KeyboardEvent, templateId: number, index: number) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect(templateId);
            // Dispatch custom event to notify parent to move focus
            const customEvent = new CustomEvent('movePreviewFocus');
            window.dispatchEvent(customEvent);
        } else if (event.key === 'Tab' && event.shiftKey) {
            // If we're at the first template and shift+tab, let it go to previous element
            if (index === 0) return;
            
            // Otherwise, prevent default to handle our own focus management
            event.preventDefault();
            const buttons = document.querySelectorAll('[data-template-button]');
            const prevButton = buttons[index - 1] as HTMLElement;
            prevButton?.focus();
        } else if (event.key === 'Tab' && !event.shiftKey) {
            // When reaching the last template
            if (index === templates.length - 1) {
                // If this template is selected, let focus continue naturally
                if (templateId === selectedId) return;
                
                // Otherwise, dispatch event to move focus to current preview
                event.preventDefault();
                const customEvent = new CustomEvent('movePreviewFocus');
                window.dispatchEvent(customEvent);
                return;
            }
            
            // Otherwise continue with template list navigation
            event.preventDefault();
            const buttons = document.querySelectorAll('[data-template-button]');
            const nextButton = buttons[index + 1] as HTMLElement;
            nextButton?.focus();
        }
    }
</script>

<div class="space-y-3 md:space-y-4">
    {#each templates as template, index (template.id)}
        <button
            type="button"
            data-template-button
            data-template-id={template.id}
            class="w-full p-3 md:p-4 rounded-lg border cursor-pointer transition-all flex justify-between items-start gap-3 text-left"
            class:border-blue-400={selectedId === template.id}
            class:bg-blue-50={selectedId === template.id}
            class:border-slate-200={selectedId !== template.id}
            class:hover:border-blue-200={selectedId !== template.id}
            on:click={() => onSelect(template.id)}
            on:keydown={(e) => handleKeydown(e, template.id, index)}
        >
            <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                    <Badge type={template.type} />
                    <span class="bg-blue-100 text-blue-600 px-2 py-1 rounded text-xs md:text-sm">
                        {template.category}
                    </span>
                </div>
                
                <h3 class="font-medium text-slate-900 mt-2 md:mt-3 truncate">
                    {template.title}
                </h3>

                <p class="text-xs md:text-sm text-slate-600 mb-2 md:mb-3 line-clamp-2">
                    {template.description}
                </p>
                
                <MessageMetrics {template} />
            </div>
            
            <!-- Mobile indicator -->
            <div class="md:hidden text-slate-400 shrink-0">
                <ChevronRight class="w-5 h-5" />
            </div>
        </button>
    {/each}
</div>
