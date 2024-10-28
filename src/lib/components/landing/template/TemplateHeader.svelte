<script lang="ts">
    import { Send } from 'lucide-svelte';
    import type { Template } from '$lib/types/template';
    import Badge from '../../ui/Badge.svelte';
    import Button from '../../ui/Button.svelte';
    
    export let template: Template;
</script>

<div class="flex justify-between items-start gap-4 mb-6">
    <div class="min-w-0">
        <h2 class="text-lg sm:text-xl font-semibold text-slate-900 mb-2 truncate">
            {template.title}
        </h2>
        <div class="flex items-center gap-2 sm:gap-4 flex-wrap">
            <span class="bg-blue-100 text-blue-600 px-2 py-1 rounded text-xs sm:text-sm">
                {template.category}
            </span>
            <Badge type={template.type} />
        </div>
    </div>
    <Button variant="primary" classNames="shrink-0">
        <span class="hidden sm:inline">Use Template</span>
        <span class="sm:hidden">Use</span>
        <Send class="w-4 h-4" />
    </Button>
</div>
