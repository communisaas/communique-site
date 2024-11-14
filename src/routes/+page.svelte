<script lang="ts">
    import { onMount } from 'svelte';
    import { templateStore, selectedTemplate } from '$lib/stores/templates';
    import Hero from '$lib/components/landing/hero/Hero.svelte';
    import ActivityFeed from '$lib/components/landing/activity/ActivityFeed.svelte';
    import ChannelExplainer from '$lib/components/landing/channel/ChannelExplainer.svelte';
    import TemplateList from '$lib/components/landing/template/TemplateList.svelte';
    import TemplatePreview from '$lib/components/landing/template/TemplatePreview.svelte';
    import Modal from '$lib/components/ui/Modal.svelte';
    import { browser } from '$app/environment';
	import { IdCard, Shield } from 'lucide-svelte';
    
    let showMobilePreview = false;
    let modalComponent: Modal;
    let selectedChannel: string | null = null;

    onMount(() => {
        if (!selectedChannel && $templateStore.templates.length > 0) {
            templateStore.selectTemplate($templateStore.templates[0].id);
        }
    });

    function handleTemplateSelect(id: number) {
        templateStore.selectTemplate(id);
        if (browser && window.innerWidth < 768) { // md breakpoint is 768px
            showMobilePreview = true;
        }
    }

    function handleChannelSelect(event: CustomEvent<string>) {
        selectedChannel = event.detail;
        const matchingTemplates = $templateStore.templates.filter(t => t.type === selectedChannel);
        if (matchingTemplates.length > 0) {
            templateStore.selectTemplate(matchingTemplates[0].id);
        }
    }

    $: filteredTemplates = selectedChannel 
        ? $templateStore.templates.filter(t => t.type === selectedChannel)
        : $templateStore.templates;
</script>

<svelte:head>
    <title>Communiqué</title>
    <meta name="description" content="Reach and influence decision makers at every level" />
</svelte:head>

<!-- Hero Section - Simple Badge -->
<section class="pt-12">
    <div class="flex flex-row justify-center flex-wrap gap-8 items-center mb-6 max-w-6xl mx-auto">
        <span class="w-9/12 md:w-7/12">
            <Hero />
        </span>
        <ChannelExplainer on:channelSelect={handleChannelSelect} />
    </div>

    <div id="template-section" class="grid md:grid-cols-3 grid-cols-1 gap-4 sm:gap-6 md:gap-8 max-w-6xl mx-auto">
        <div class="md:col-span-1">
            <h2 class="text-xl font-semibold text-slate-900 mb-3">
                Message Templates
            </h2>
            <div class="inline-flex items-center gap-2 px-3 bg-slate-100 rounded-full text-sm text-slate-600 mb-3">
                <IdCard class="w-4 h-4" />
                Every voice verified. Every message counted.
            </div>
            <TemplateList 
                templates={filteredTemplates}
                selectedId={$templateStore.selectedId}
                onSelect={handleTemplateSelect}
            />
        </div>

        <!-- Desktop/Tablet Preview -->
        <div class="md:col-span-2 hidden md:block">
            {#if $selectedTemplate}
                <TemplatePreview template={$selectedTemplate} />
            {/if}
        </div>
    </div>

    <!-- Mobile Preview Modal -->
    {#if showMobilePreview && $selectedTemplate}
        <Modal
            bind:this={modalComponent}
            on:close={() => showMobilePreview = false}
            inModal={true}
        >
            <div class="h-full">
                <TemplatePreview 
                    template={$selectedTemplate}
                    inModal={true}
                />
            </div>
        </Modal>
    {/if}
</section>
