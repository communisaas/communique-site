<script lang="ts">
    import { Mail } from 'lucide-svelte';
    import { selectedTemplate } from '$lib/stores/templates';
    import TemplateHeader from './TemplateHeader.svelte';
    import DeliveryInfo from './DeliveryInfo.svelte';
    import TemplateTips from './TemplateTips.svelte';
    import MessagePreview from './MessagePreview.svelte';

    export let template;
    export let inModal = false;
</script>

<div class="bg-white rounded-xl border border-slate-200 
            {inModal ? 'p-2' : 'p-3 sm:p-4 md:p-6 lg:p-8'} 
            {inModal ? '' : 'sm:sticky sm:top-8'}
            {inModal ? '' : 'h-[calc(100vh-4rem)]'}
            flex flex-col">
    {#if template}
        <div class={inModal ? 'hidden' : 'shrink-0'}>
            <TemplateHeader {template} />
        </div>
        <div class="shrink-0">
            <DeliveryInfo {template} />
        </div>
        <div class="flex-1 min-h-0 my-4"> <!-- Added vertical margin -->
            <MessagePreview 
                title={template.title}
                preview={template.preview}
            />
        </div>
        <div class="shrink-0">
            <TemplateTips isCertified={template.type === 'certified'} />
        </div>
    {:else}
        <div class="text-center text-slate-500 py-12">
            Select a template to preview
        </div>
    {/if}
</div>
