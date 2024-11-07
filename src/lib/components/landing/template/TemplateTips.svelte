<script lang="ts">
    import { Info } from 'lucide-svelte';
    export let isCertified = false;
</script>

<div class="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
    <ul class="text-sm text-blue-700 space-y-2">
        {#if isCertified}
            <li class="flex items-center gap-2">
                <Info class="w-4 h-4" />
                Address verification required for Congressional delivery
            </li>
        {/if}
        <li class="flex items-center gap-2">
            <Info class="w-4 h-4" />
            Adding personal experience increases message impact
        </li>
    </ul>
</div>
