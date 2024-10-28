<script lang="ts">
    import { IdCard, Shield, Scan, Users2 } from 'lucide-svelte';
    import Popover from '../ui/Popover.svelte';
    
    const idChecks = [
        {
            icon: IdCard,
            title: 'Government ID Check',
            description: 'Federal-grade identity verification'
        },
        {
            icon: Scan,
            title: 'Biometric Verification',
            description: 'Liveliness check'
        },
        {
            icon: Users2,
            title: 'One Person, One Voice',
            description: 'No duplicate or anonymous messages'
        }
    ];
</script>

<div class="inline-block">
    <Popover let:open>
        <!-- Trigger styling matches HowItWorks button style -->
        <div class="relative group" slot="trigger">
            <div class="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 border 
                        border-slate-200 rounded-lg text-slate-700 cursor-help">
                <IdCard class="w-4 h-4" />
                <span class="text-xs md:text-sm font-medium">Government ID Required</span>
            </div>
            <div class="absolute w-full h-4 bottom-0 translate-y-full" />
        </div>

        <!-- Popover content styling matches HowItWorks -->
        <div class="w-[280px] md:w-[320px] p-4 max-w-[calc(100vw-2rem)] origin-top-left">
            <div class="space-y-6"> <!-- Changed from grid to space-y-6 to match HowItWorks -->
                {#each idChecks as check}
                    <div 
                        class="flex items-start gap-4 sm:text-base text-sm"
                        class:opacity-0={!open}
                    >
                        <div class="p-2 bg-blue-50 rounded-lg">
                            <svelte:component this={check.icon} class="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <h3 class="font-medium text-slate-900 mb-1">
                                {check.title}
                            </h3>
                            <p class="text-slate-600 text-sm">
                                {check.description}
                            </p>
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    </Popover>
</div>
