<script lang="ts">
    import { Shield, UserCheck, CheckCircle2 } from 'lucide-svelte';
    import { benefits } from '$lib/data/verification';
</script>

<div class="bg-slate-50 rounded-lg p-4 space-y-4 border border-slate-200">
    <div class="flex items-center gap-2 border-b border-slate-200 pb-2">
        <Shield class="w-5 h-5 text-slate-700" />
        <h4 class="font-medium text-slate-900">Verified Platform</h4>
    </div>
    
    <div class="grid gap-3">
        {#each benefits as benefit}
            <div class="flex items-start gap-3">
                <div class="p-1.5 bg-white rounded border border-slate-100">
                    <svelte:component this={benefit.icon} class="w-4 h-4 text-slate-600" />
                </div>
                <div>
                    <div class="text-sm font-medium text-slate-900">{benefit.title}</div>
                    <div class="text-sm text-slate-600">{benefit.description}</div>
                </div>
            </div>
        {/each}
    </div>
</div>