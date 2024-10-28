<script lang="ts">
    import { Shield, AtSign, MapPin, Building2 } from 'lucide-svelte';
    import type { Template } from '$lib/types/template';
    
    export let template: Template;
    
    const deliveryTypes = {
        certified: {
            icon: Shield,
            iconClass: 'text-green-600',
            textClass: 'text-green-700',
            label: 'Certified Congressional Delivery',
            MetricIcon: MapPin,
            metricValue: template.metrics.districts
        },
        direct: {
            icon: AtSign,
            iconClass: 'text-blue-600',
            textClass: 'text-blue-700',
            label: 'Direct Email Campaign',
            MetricIcon: Building2,
            metricValue: template.metrics.reach
        }
    };
    
    const delivery = deliveryTypes[template.type];
</script>

<div class="mb-4 md:mb-6 p-3 md:p-4 bg-slate-50 rounded-lg border border-slate-200">
    <div class="flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
        <div class="flex items-center gap-2">
            <svelte:component this={delivery.icon} class="w-4 h-4 {delivery.iconClass}" />
            <span class="text-xs md:text-sm {delivery.textClass}">
                {delivery.label}
            </span>
        </div>
        <div class="flex items-center gap-2">
            <svelte:component this={delivery.MetricIcon} class="w-4 h-4 text-slate-500" />
            <span class="text-xs md:text-sm text-slate-600">
                {delivery.metricValue}
            </span>
        </div>
    </div>
</div>
