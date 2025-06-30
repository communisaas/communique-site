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
	import type { TemplateCreationContext } from '$lib/types/template';
	import { IdCard } from 'lucide-svelte';
	import TemplateCreator from '$lib/components/template/TemplateCreator.svelte';

	let showMobilePreview = false;
	let showTemplateCreator = false;
	let modalComponent: Modal;
	let selectedChannel: string | null = null;
	let creationContext: TemplateCreationContext | null = null;

	onMount(() => {
		if (!selectedChannel && $templateStore.templates.length > 0) {
			templateStore.selectTemplate($templateStore.templates[0].id);
		}
	});

	function handleTemplateSelect(id: string) {
		templateStore.selectTemplate(id);
		if (browser && window.innerWidth < 768) {
			// md breakpoint is 768px
			showMobilePreview = true;
		}
	}

	function handleChannelSelect(event: CustomEvent<string>) {
		selectedChannel = event.detail;
		const matchingTemplates = $templateStore.templates.filter((t) => {
			if (selectedChannel === 'certified') {
				return t.deliveryMethod === 'both';
			} else if (selectedChannel === 'direct') {
				return t.deliveryMethod === 'email';
			}
			return false;
		});
		if (matchingTemplates.length > 0) {
			templateStore.selectTemplate(matchingTemplates[0].id);
		}
	}

	function handleCreateTemplate(event: CustomEvent<TemplateCreationContext>) {
		creationContext = event.detail;
		showTemplateCreator = true;
	}

	$: filteredTemplates = selectedChannel
		? $templateStore.templates.filter((t) => {
				if (selectedChannel === 'certified') {
					return t.deliveryMethod === 'both';
				} else if (selectedChannel === 'direct') {
					return t.deliveryMethod === 'email';
				}
				return false;
			})
		: $templateStore.templates;
</script>

<svelte:head>
	<title>Communiqué</title>
	<meta name="description" content="Reach and influence decision makers at every level" />
</svelte:head>

<!-- Hero Section - Simple Badge -->
<section class="pt-12">
	<div class="mx-auto mb-6 flex max-w-6xl flex-row flex-wrap items-center justify-center gap-8">
		<span class="relative w-9/12 md:w-7/12">
			<span class="text-xl"> Communiqué </span>
			<Hero />
		</span>
		<ChannelExplainer
			on:channelSelect={handleChannelSelect}
			on:createTemplate={handleCreateTemplate}
		/>
	</div>

	<div
		id="template-section"
		class="mx-auto grid max-w-6xl grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3 md:gap-8"
	>
		<div class="md:col-span-1">
			<h2 class="mb-3 text-xl font-semibold text-slate-900">Message Templates</h2>
			<TemplateList
				templates={filteredTemplates}
				selectedId={$templateStore.selectedId}
				onSelect={handleTemplateSelect}
			/>
		</div>

		<!-- Desktop/Tablet Preview -->
		<div class="hidden md:col-span-2 md:block">
			{#if $selectedTemplate}
				<TemplatePreview template={$selectedTemplate} />
			{/if}
		</div>
	</div>

	<!-- Mobile Preview Modal -->
	{#if showMobilePreview && $selectedTemplate}
		<Modal bind:this={modalComponent} on:close={() => (showMobilePreview = false)} inModal={true}>
			<div class="h-full">
				<TemplatePreview template={$selectedTemplate} inModal={true} />
			</div>
		</Modal>
	{/if}

	<!-- Template Creator Modal -->
	{#if showTemplateCreator && creationContext}
		<Modal
			bind:this={modalComponent}
			on:close={() => {
				showTemplateCreator = false;
				creationContext = null;
			}}
		>
			<div class="h-full">
				<TemplateCreator
					context={creationContext}
					on:close={() => {
						showTemplateCreator = false;
						creationContext = null;
					}}
					on:save={async (event) => {
						// Handle template save
						try {
							await templateStore.addTemplate(event.detail);
							showTemplateCreator = false;
							creationContext = null;
						} catch (error) {
							console.error('Failed to save template:', error);
							// You might want to show an error message to the user here
						}
					}}
				/>
			</div>
		</Modal>
	{/if}
</section>
