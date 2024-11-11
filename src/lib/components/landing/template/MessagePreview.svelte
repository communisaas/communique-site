<script lang="ts">
    import { Mail } from 'lucide-svelte';
    
    export let preview: string;
</script>

<div class="h-full flex flex-col">
    <div class="flex items-center gap-2 mb-2 shrink-0">
        <Mail class="w-4 h-4 text-slate-500 shrink-0" />
        <h3 class="font-medium text-slate-900 text-sm sm:text-base">Message Preview</h3>
    </div>
    <div class="flex-1 min-h-0">
        <pre 
            class="h-full p-2 sm:p-4 
                   bg-slate-50 rounded-lg text-slate-600 
                   whitespace-pre-wrap font-mono text-xs sm:text-sm 
                   border border-slate-200 overflow-y-auto"
        >{preview}</pre>
    </div>
</div>

<style>
    /* Custom scrollbar styling */
    pre::-webkit-scrollbar {
        width: 8px;
    }

    pre::-webkit-scrollbar-track {
        background: transparent;
    }

    pre::-webkit-scrollbar-thumb {
        background-color: rgba(156, 163, 175, 0.5);
        border-radius: 4px;
    }

    pre::-webkit-scrollbar-thumb:hover {
        background-color: rgba(156, 163, 175, 0.7);
    }
</style>
