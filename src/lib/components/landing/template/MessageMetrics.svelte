<script lang="ts">
    import { Send, MapPin, Building2 } from 'lucide-svelte';
    import Tooltip from '../../ui/Tooltip.svelte';
    import type { Template } from '$lib/types/template';
    
    export let template: Template;

    const metrics = {
        certified: {
            icon: MapPin,
            tooltip: "Congressional districts reached through this template",
            value: template.metrics.districts
        },
        direct: {
            icon: Building2,
            tooltip: "Primary campaign targets",
            value: template.metrics.reach
        }
    };

    const currentMetric = metrics[template.type];
</script>

<div class="space-y-2 text-sm">
    <div class="flex items-center gap-2 text-slate-500">
        <Send class="w-4 h-4" />
        <Tooltip content={template.metrics.tooltip}>
            {template.metrics.messages}
        </Tooltip>
    </div>
    
    <div class="flex items-center gap-2 text-slate-500">
        <svelte:component this={currentMetric.icon} class="w-4 h-4" />
        <Tooltip content={currentMetric.tooltip}>
            {currentMetric.value}
        </Tooltip>
    </div>
</div>
