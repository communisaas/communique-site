<script lang="ts">
    import { IdCard, Shield, Scan, Users2 } from 'lucide-svelte';

    const idChecks = [
        {
            icon: IdCard,
            title: 'Government ID Check',
            description: 'Federal-grade identity verification'
        },
        {
            icon: Scan,
            title: 'Biometric Verification',
            description: 'Real person confirmation'
        },
        {
            icon: Users2,
            title: 'One Person, One Voice',
            description: 'No duplicate or anonymous messages'
        }
    ];
</script>

<div class="bg-slate-50 rounded-lg p-4 space-y-4 border border-slate-200">
    <div class="flex items-center gap-2 border-b border-slate-200 pb-2">
        <IdCard class="w-5 h-5 text-slate-700" />
        <h4 class="font-medium text-slate-900">ID Protected Platform</h4>
    </div>
    
    <div class="grid gap-3">
        {#each idChecks as check}
            <div class="flex items-start gap-3">
                <div class="p-1.5 bg-white rounded border border-slate-100">
                    <svelte:component this={check.icon} class="w-4 h-4 text-slate-600" />
                </div>
                <div>
                    <div class="text-sm font-medium text-slate-900">{check.title}</div>
                    <div class="text-sm text-slate-600">{check.description}</div>
                </div>
            </div>
        {/each}
    </div>
</div>