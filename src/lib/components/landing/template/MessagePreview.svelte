<script lang="ts">
    import { Mail, ChevronDown, ChevronUp, Users } from 'lucide-svelte';
    
    export let preview: string;
    export let recipientEmails: string[] | undefined = undefined;
    
    let showAllRecipients = false;
    let recipientsContainer: HTMLDivElement;
    
    $: visibleEmails = recipientEmails 
        ? showAllRecipients 
            ? recipientEmails 
            : recipientEmails.slice(0, 3)
        : [];
    
    $: hasMoreEmails = recipientEmails && recipientEmails.length > 3;
</script>

<div class="h-full flex flex-col">
    <div class="flex items-center gap-2 mb-2 shrink-0">
        <Mail class="w-4 h-4 text-slate-500 shrink-0" />
        <h3 class="font-medium text-slate-900 text-sm sm:text-base">Message Preview</h3>
    </div>
    
    {#if recipientEmails?.length}
        <div class="mb-2 flex flex-col">
            <div class="flex items-center gap-2 mb-1">
                <Users class="w-4 h-4 text-slate-500" />
                <span class="text-sm text-slate-700">Recipients</span>
            </div>
            <div 
                bind:this={recipientsContainer}
                class="pl-6 transition-all duration-300"
                class:max-h-[120px]={!showAllRecipients}
                class:overflow-hidden={!showAllRecipients}
            >
                {#each visibleEmails as email}
                    <div class="text-xs sm:text-sm text-slate-600 py-0.5">{email}</div>
                {/each}
            </div>
            {#if hasMoreEmails}
                <button
                    on:click={() => showAllRecipients = !showAllRecipients}
                    class="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 pl-6 mt-1"
                >
                    <span>{showAllRecipients ? 'Show less' : `Show ${recipientEmails.length - 3} more`}</span>
                    {#if showAllRecipients}
                        <ChevronUp class="w-3 h-3" />
                    {:else}
                        <ChevronDown class="w-3 h-3" />
                    {/if}
                </button>
            {/if}
        </div>
    {/if}
    
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
