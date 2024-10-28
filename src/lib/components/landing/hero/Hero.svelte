<script lang="ts">
    import { IdCard, Send } from 'lucide-svelte';
    import Button from '../../ui/Button.svelte';
    import HowItWorks from './HowItWorks.svelte';
</script>

<div class="space-y-8">
    <div>
        <h1 class="sm:text-5xl text-3xl font-bold tracking-tight text-slate-900 mb-6">
            Make Your Voice 
            <span class="text-blue-600">Count</span>
            <span class="block sm:text-3xl text-2xl font-normal text-slate-600 mt-2">
                On record.
            </span>
        </h1>

        <p class="sm:text-xl text-base text-slate-600 mb-8">
            Reach and influence decision makers at every level. From Congress to corporate 
            leaders, make your voice heard where it matters most.
        </p>
    </div>

    <div class="flex gap-4">
        <Button variant="primary">
            Start Writing
            <Send class="w-4 h-4" />
        </Button>
        <HowItWorks />
    </div>
</div>