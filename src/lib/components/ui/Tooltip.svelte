<script lang="ts">
	import { Info } from "lucide-svelte";

    export let content: string;
    
    let show = false;
</script>

<div 
    class="relative inline-flex items-center group cursor-help"
    on:mouseenter={() => show = true}
    on:mouseleave={() => show = false}
>
    <slot />
    <Info class="w-4 h-4 text-slate-400 ml-1" />
    
    <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 
                bg-slate-800 text-white text-sm rounded-lg whitespace-nowrap transition-all duration-150"
         class:opacity-0={!show}
         class:opacity-100={show}
         class:pointer-events-none={!show}>
        {content}
        <div class="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1.5 
                    border-4 border-transparent border-t-slate-800" />
    </div>
</div>
