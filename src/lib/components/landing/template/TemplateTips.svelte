<script lang="ts">
    import { Info } from 'lucide-svelte';
    export let isCertified = false;
</script>

<div class="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
    <h4 class="text-sm font-medium text-blue-800 mb-2">
        Customization Tips
    </h4>
    <ul class="text-sm text-blue-700 space-y-2">
        <li class="flex items-center gap-2">
            <Info class="w-4 h-4" />
            Replace [bracketed text] with your personal details
        </li>
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
