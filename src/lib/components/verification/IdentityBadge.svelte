<script lang="ts">
    import { IdCard, Scan, UsersRound } from 'lucide-svelte';
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
            icon: UsersRound,
            title: 'One Person, One Voice',
            description: 'No duplicate or anonymous messages'
        }
    ];
</script>

<div class="flex">
    <Popover let:open>
        <button 
            slot="trigger"
            class="inline-flex items-center gap-2 px-2 sm:px-3 py-1.5 bg-slate-50 border 
                   border-slate-200 rounded-lg text-slate-700 cursor-alias
                   transition-all duration-200 hover:scale-[1.02] hover:shadow-md hover:border-slate-300"
        >
            <IdCard class="w-4 h-4 shrink-0" />
            <span class="text-xs md:text-sm font-medium whitespace-nowrap">ID Required</span>
        </button>

        <div class="w-[280px] md:w-[320px] p-3 sm:p-4 max-w-[calc(100vw-2rem)] cursor-text">
            <div class="space-y-6">
                {#each idChecks as check}
                    <div 
                        class="flex items-start gap-4 sm:text-base text-sm tracking-normal"
                        class:opacity-0={!open}
                    >
                        <div class="p-2 bg-blue-50 rounded-lg">
                            <svelte:component this={check.icon} class="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <h3 class="font-medium text-slate-900 mb-1">
                                {check.title}
                            </h3>
                            <p class="text-slate-600 text-sm font-normal">
                                {check.description}
                            </p>
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    </Popover>
</div>
