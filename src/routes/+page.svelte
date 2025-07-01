<script lang="ts">
	import { templateStore, selectedTemplate, isLoading, hasError } from '$lib/stores/templates';
	import Hero from '$lib/components/landing/hero/Hero.svelte';
	import ActivityFeed from '$lib/components/landing/activity/ActivityFeed.svelte';
	import ChannelExplainer from '$lib/components/landing/channel/ChannelExplainer.svelte';
	import TemplateList from '$lib/components/landing/template/TemplateList.svelte';
	import TemplatePreview from '$lib/components/landing/template/TemplatePreview.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import { browser } from '$app/environment';
	import type { TemplateCreationContext } from '$lib/types/template';

	import TemplateCreator from '$lib/components/template/TemplateCreator.svelte';

	let showMobilePreview = false;
	let showTemplateCreator = false;
	let modalComponent: Modal;
	let selectedChannel: string | null = null;
	let creationContext: TemplateCreationContext | null = null;

	// No need for manual onMount template selection anymore -
	// the store handles auto-selection when templates load

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
			{#if $hasError}
				<div class="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
					<div class="mb-2 text-red-600">
						<svg class="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z"
							/>
						</svg>
					</div>
					<h3 class="mb-1 text-lg font-medium text-red-900">Unable to load templates</h3>
					<p class="mb-4 text-sm text-red-700">
						There was a problem fetching the latest templates.
					</p>
					<button
						on:click={() => templateStore.fetchTemplates()}
						class="inline-flex items-center rounded-lg bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
					>
						Try Again
					</button>
				</div>
			{:else if $isLoading && !$selectedTemplate}
				<!-- Skeleton loader for first load -->
				<div class="rounded-xl border border-slate-200 bg-white p-6">
					<div class="animate-pulse">
						<div class="mb-6 flex items-center justify-between">
							<div>
								<div class="mb-2 h-6 w-64 rounded bg-slate-200"></div>
								<div class="flex gap-2">
									<div class="h-6 w-20 rounded bg-slate-200"></div>
									<div class="h-6 w-24 rounded bg-slate-200"></div>
									<div class="h-6 w-16 rounded bg-slate-200"></div>
								</div>
							</div>
							<div class="h-10 w-32 rounded bg-slate-200"></div>
						</div>
						<div class="mb-3 h-4 w-full rounded bg-slate-200"></div>
						<div class="mb-6 h-4 w-3/4 rounded bg-slate-200"></div>
						<div class="h-64 rounded bg-slate-200"></div>
					</div>
				</div>
			{:else if $selectedTemplate}
				<TemplatePreview template={$selectedTemplate} />
			{:else}
				<!-- Empty state -->
				<div class="rounded-xl border border-slate-200 bg-slate-50 p-12 text-center">
					<div class="mb-4 text-slate-400">
						<svg class="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="1.5"
								d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							/>
						</svg>
					</div>
					<h3 class="mb-2 text-lg font-medium text-slate-900">No templates available</h3>
					<p class="text-slate-600">
						Create your first template to get started with advocacy campaigns.
					</p>
				</div>
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
