<script lang="ts">
    import { onMount } from 'svelte';
    import { templateStore, selectedTemplate } from '$lib/stores/templates';
    import { messageCount } from '$lib/stores/messageCount';
    import Hero from '$lib/components/landing/hero/Hero.svelte';
    import ActivityFeed from '$lib/components/landing/activity/ActivityFeed.svelte';
    import ChannelExplainer from '$lib/components/landing/channel/ChannelExplainer.svelte';
    import TemplateList from '$lib/components/landing/template/TemplateList.svelte';
    import TemplatePreview from '$lib/components/landing/template/TemplatePreview.svelte';
    import Modal from '$lib/components/ui/Modal.svelte';
    import { browser } from '$app/environment';
	import { IdCard, Shield } from 'lucide-svelte';
    import IdentityDetail from '$lib/components/verification/IdentityDetail.svelte';
    
    // Start message counter on mount
    onMount(() => {
        messageCount.startCounting();
        return () => messageCount.stopCounting();
    });
    
    let showMobilePreview = false;
    
    function handleTemplateSelect(id: number) {
        templateStore.selectTemplate(id);
        if (browser && window.innerWidth < 640) { // sm breakpoint is 640px
            showMobilePreview = true;
        }
    }
</script>

<svelte:head>
    <title>Communiqué</title>
    <meta name="description" content="Reach and influence decision makers at every level" />
</svelte:head>

<!-- Hero Section - Simple Badge -->
<section class="pt-20">
    <div class="flex flex-row justify-center flex-wrap gap-8 items-center mb-6 max-w-6xl mx-auto">
        <span class="w-9/12 md:w-3/4 lg:w-7/12">
            <Hero />
        </span>
        <ChannelExplainer />
    </div>

    <div class="grid sm:grid-cols-3 grid-cols-1 gap-4 sm:gap-6 md:gap-8">
        <div class="sm:col-span-1">
            <h2 class="text-xl font-semibold text-slate-900 mb-3">
                Message Templates
            </h2>
            <div class="inline-flex items-center gap-2 px-3 bg-slate-100 rounded-full text-sm text-slate-600 mb-3">
                <IdCard class="w-4 h-4" />
                Every voice verified. Every message counted.
            </div>
            <TemplateList 
                templates={$templateStore.templates}
                selectedId={$templateStore.selectedId}
                onSelect={handleTemplateSelect}
            />
        </div>

        <!-- Desktop/Tablet Preview -->
        <div class="sm:col-span-2 hidden sm:block">
            <TemplatePreview template={$selectedTemplate} />
        </div>
    </div>

    <!-- Mobile Preview Modal -->
    {#if showMobilePreview && $selectedTemplate}
        <Modal 
            title={$selectedTemplate.title}
            on:close={() => showMobilePreview = false}
        >
            <TemplatePreview 
                template={$selectedTemplate}
                inModal={true}
            />
        </Modal>
    {/if}
</section>

<!-- Trust Section - Detailed Information -->
<section class="bg-slate-50 border-y border-slate-200 py-16 mt-16">
    <div class="container mx-auto px-4">
        <div class="max-w-3xl mx-auto">
            <div class="text-center mb-12">
                <div class="inline-flex items-center justify-center gap-2 mb-4">
                    <Shield class="w-5 h-5 text-slate-600" />
                    <h2 class="text-2xl font-light">Built on Trust</h2>
                </div>
                <p class="text-slate-600">
                    Every message carries the weight of a verified voice. 
                    Our platform ensures authentic communication between citizens and representatives.
                </p>
            </div>
            
            <div class="max-w-2xl mx-auto">
                <IdentityDetail />
            </div>
        </div>
    </div>
</section>
