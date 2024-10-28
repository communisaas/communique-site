<script lang="ts">
    import { Shield, Info } from 'lucide-svelte';
    import Tooltip from '../ui/Tooltip.svelte';
</script>

<div class="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 border 
            border-green-100 rounded-lg text-green-700">
    <Shield class="w-4 h-4" />
    <span class="text-xs md:text-sm font-medium">Verified User Platform</span>
    <Tooltip content="All users verified through ID.me">
        <Info class="w-4 h-4 text-green-600" />
    </Tooltip>
</div>