<script lang="ts">
    import { Megaphone, Shield, AtSign } from 'lucide-svelte';
    import type { Template } from '$lib/types/template';
    
    export let templates: Template[];
    export let messageCount: number;

    const activityTypes = {
        certified: {
            icon: Shield,
            iconClass: 'text-green-500',
            textClass: 'text-green-600 sm:text-base text-sm',
            label: 'Certified Delivery'
        },
        direct: {
            icon: AtSign,
            iconClass: 'text-blue-500',
            textClass: 'text-blue-600 sm:text-base text-sm',
            label: 'Direct Outreach'
        }
    };

    let itemsToShow = 2;

    // function updateItemsToShow() {
    //     itemsToShow = window.innerWidth >= 640 ? 3 : 2;
    // }

    // $: if (typeof window !== 'undefined') {
    //     window.addEventListener('resize', updateItemsToShow);
    //     updateItemsToShow();
    // }
</script>

<div class="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
    <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-3">
            <Megaphone class="w-5 h-5 text-slate-600" />
            <h3 class="sm:text-base text-sm font-medium text-slate-900">Recent Messages</h3>
        </div>
        <span class="sm:text-sm text-xs text-slate-500">Latest Activity</span>
    </div>
    
    <div class="space-y-4">
        {#each templates.slice(0, itemsToShow) as template (template.id)}
            {@const activity = activityTypes[template.type]}
            <div class="flex items-center justify-between p-3 sm:text-sm text-xs bg-slate-50 rounded-lg border border-slate-100">
                <div class="flex items-center gap-3">
                    <svelte:component 
                        this={activity.icon} 
                        class="w-4 h-4 {activity.iconClass}" 
                    />
                    <div>
                        <div class="sm:text-sm text-xs font-medium">
                            <span class={activity.textClass}>
                                {activity.label}
                            </span>
                        </div>
                        <div class="text-slate-900">{template.title}</div>
                        <div class="sm:text-sm text-xs text-slate-500">
                            {template.type === 'certified' 
                                ? template.metrics.districts 
                                : template.metrics.reach}
                        </div>
                    </div>
                </div>
            </div>
        {/each}
    </div>
</div>
