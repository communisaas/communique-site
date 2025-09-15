<script lang="ts">
	import { templateStore } from '$lib/stores/templates.svelte';
	import Hero from '$lib/components/landing/hero/Hero.svelte';
	import ActivityFeed from '$lib/components/landing/activity/ActivityFeed.svelte';
	import ChannelExplainer from '$lib/components/landing/channel/ChannelExplainer.svelte';
	import TemplateList from '$lib/components/landing/template/TemplateList.svelte';
	import TemplatePreview from '$lib/components/landing/template/TemplatePreview.svelte';
	import TouchModal from '$lib/components/ui/TouchModal.svelte';
import SimpleModal from '$lib/components/modals/SimpleModal.svelte';
import TemplateSuccessModal from '$lib/components/modals/TemplateSuccessModal.svelte';
	import UnifiedOnboardingModal from '$lib/components/modals/UnifiedOnboardingModal.svelte';
	import { modalActions } from '$lib/stores/modalSystem.svelte';
	import UnifiedProgressiveFormModal from '$lib/components/modals/UnifiedProgressiveFormModal.svelte';
	import UnifiedAddressModal from '$lib/components/modals/UnifiedAddressModal.svelte';
	import { resolveTemplate } from '$lib/utils/templateResolver';
	import { isMobile, navigateTo } from '$lib/utils/browserUtils';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { goto, preloadData, onNavigate } from '$app/navigation';
	import type { TemplateCreationContext } from '$lib/types/template';
	import type { PageData } from './$types';
	import { coordinated } from '$lib/utils/timerCoordinator';
	import { analyzeEmailFlow, launchEmail } from '$lib/services/emailService';

	import TemplateCreator from '$lib/components/template/TemplateCreator.svelte';

	let { data }: { data: PageData } = $props();

	const componentId = 'HomePage_' + Math.random().toString(36).substr(2, 9);
	
	// Create derived values from the store using Svelte 5 runes
	const selectedTemplate = $derived(templateStore.templates.find((t) => t.id === templateStore.selectedId));
	const isLoading = $derived(templateStore.loading);
	const hasError = $derived(!!templateStore.error);

	let showMobilePreview = $state(false);
	let showTemplateCreator = $state(false);
	// Removed showTemplateModal - now using persistent modalState store
	let showTemplateAuthModal = $state(false);
	let showTemplateSuccess = $state(false);
	let modalComponent = $state<TouchModal>();
	let selectedChannel: string | null = $state(null);
	let creationContext: TemplateCreationContext | null = $state(null);
	let pendingTemplateToSave: Record<string, unknown> | null = $state(null);
	let savedTemplate = $state<any>(null);
	let userInitiatedSelection = $state(false); // Track if selection was user-initiated
	let initialLoadComplete = $state(false); // Track initial load completion

	// Handle OAuth return for template creation and URL parameter initialization
	onMount(() => {
		if (browser && $page.url.searchParams.get('template_saved') === 'pending') {
			// User returned from OAuth, check for pending template
			const pendingData = sessionStorage.getItem('pending_template_save');
			if (pendingData) {
				try {
					const { templateData } = JSON.parse(pendingData);
					// Now that user is authenticated, save the template
					templateStore
						.addTemplate(templateData)
						.then(() => {
							sessionStorage.removeItem('pending_template_save');
						})
						.catch((error) => {
							// Template save failed - user can retry later
						});
				} catch (error) {
					// Invalid pending template data - ignore
				}
			}
		}

		// Initialize template store - try database first, fallback to static
		templateStore.fetchTemplates();

		// Check for template creation parameter
		const createTemplate = $page.url.searchParams.get('create');
		if (createTemplate === 'true') {
			// Scroll to channel selector and open template creator
			coordinated.setTimeout(
				() => {
					// First scroll to the channel explainer section
					const channelSection = document.querySelector('.w-full.max-w-4xl');
					if (channelSection) {
						channelSection.scrollIntoView({
							behavior: 'smooth',
							block: 'center'
						});
					}

					// Then open the template creator modal after a brief delay
					coordinated.setTimeout(
						() => {
							creationContext = {
								channelId: 'direct',
								channelTitle: 'Direct Outreach',
								isCongressional: false
							};
							showTemplateCreator = true;
							// Clean up URL
							window.history.replaceState({}, '', '/');
						},
						800,
						'open-creator',
						componentId
					);
				},
				100,
				'scroll-to-channel',
				componentId
			);
		}


		// Mark initial load as complete after a short delay
		coordinated.setTimeout(
			() => {
				initialLoadComplete = true;
			},
			100,
			'dom',
			componentId
		);
	});

	// Enable smooth page transitions using View Transitions API
	onNavigate((navigation) => {
		// Only use view transitions for template navigation and if supported by browser
		if (!document.startViewTransition || !navigation.to?.url.pathname.includes('/s/')) {
			return;
		}
		
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
			});
		});
	});

	// No need for manual onMount template selection anymore -
	// the store handles auto-selection when templates load

	function handleTemplateSelect(id: string) {
		userInitiatedSelection = true;
		templateStore.selectTemplate(id);

		if (isMobile()) {
			showMobilePreview = true;
		}
	}

	function handleChannelSelect(event: CustomEvent<string>) {
		selectedChannel = event.detail;
		userInitiatedSelection = true;
		const matchingTemplates = templateStore.templates.filter((t) => {
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


	function handleTemplateCreatorAuth(event: CustomEvent) {
		const { name, email } = event.detail;

		// For template creators, we need actual authentication to save templates
		// Store the template data and redirect to OAuth
		if (typeof window !== 'undefined') {
			sessionStorage.setItem(
				'pending_template_save',
				JSON.stringify({
					templateData: pendingTemplateToSave,
					creatorInfo: { name, email },
					timestamp: Date.now()
				})
			);
		}

		// Redirect to OAuth - we'll use Google as the primary option for creators
		fetch('/auth/prepare', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ returnTo: '/?template_saved=pending' })
		}).finally(() => {
			navigateTo(`/auth/google`);
		});
	}

	const filteredTemplates = $derived(
		selectedChannel
			? templateStore.templates.filter((t) => {
					if (selectedChannel === 'certified') {
						// Congressional delivery under construction - show nothing for now
						return false;
					} else if (selectedChannel === 'direct') {
						return t.deliveryMethod === 'email' || t.deliveryMethod === 'direct';
					}
					return false;
				})
			: // For MVP: Only show direct email templates
				templateStore.templates.filter(
					(t) => t.deliveryMethod === 'email' || t.deliveryMethod === 'direct'
				)
	);

	// Handle URL parameter initialization when templates load (legacy support)
	$effect(() => {
		if (browser && templateStore.templates.length > 0 && !userInitiatedSelection) {
			const templateParam = $page.url.searchParams.get('template');
			if (templateParam) {
				// Find template by slug
				const targetTemplate = templateStore.templates.find((t) => t.slug === templateParam);
				if (targetTemplate && targetTemplate.id !== templateStore.selectedId) {
					templateStore.selectTemplateBySlug(templateParam);
				}
			}
		}
	});
</script>

<svelte:head>
	<title>Communiqué</title>
	<meta name="description" content="Coordinate campaigns that actually move decisions" />
</svelte:head>

<!-- Hero Section - Simple Badge -->
<section class="pt-12">
	<div class="mx-auto mb-6 flex max-w-6xl flex-row flex-wrap items-center justify-center gap-8">
		<span class="relative w-9/12 md:w-7/12">
			<Hero />
		</span>
		<ChannelExplainer
			on:channelSelect={handleChannelSelect}
			on:createTemplate={handleCreateTemplate}
		/>
	</div>

	<div
		id="template-section"
		data-testid="template-section"
		class="mx-auto grid max-w-6xl grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3 md:gap-8"
	>
		<div class="md:col-span-1">
			<h2 class="mb-3 text-xl font-semibold text-gray-900" data-testid="templates-heading">
				Active Campaigns
			</h2>
			<TemplateList
				templates={filteredTemplates}
				selectedId={templateStore.selectedId}
				onSelect={handleTemplateSelect}
				loading={isLoading}
			/>
		</div>

		<!-- Desktop/Tablet Preview -->
		<div class="hidden md:col-span-2 md:block">
			{#if hasError}
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
						onclick={() => templateStore.fetchTemplates()}
						data-testid="retry-templates-button"
						class="inline-flex items-center rounded-lg bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
					>
						Try Again
					</button>
				</div>
			{:else if isLoading && !selectedTemplate}
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
			{:else if selectedTemplate}
				<TemplatePreview
					template={selectedTemplate}
					user={data.user}
					onSendMessage={async () => {
						if (!selectedTemplate) {
							return;
						}

						const flow = analyzeEmailFlow(selectedTemplate, data.user);

						if (flow.nextAction === 'auth') {
							modalActions.openModal('onboarding-modal', 'onboarding', { template: selectedTemplate, source: 'featured' });
						} else if (flow.nextAction === 'address') {
							modalActions.openModal('address-modal', 'address', { template: selectedTemplate, source: 'featured', user: data.user });
						} else {
							// Preload the template page data immediately
							const templateUrl = `/s/${selectedTemplate.slug}`;
							preloadData(templateUrl);
							
							// Let button animation play briefly - just the takeoff (500ms)
							// This shows the plane launching without the full flight path
							setTimeout(() => {
								goto(templateUrl);
							}, 500);
						}
					}}
				/>
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
					<h3 class="mb-2 text-lg font-medium text-slate-900">No campaigns running yet</h3>
					<p class="text-slate-600">
						Someone has to move first. Start one.
					</p>
				</div>
			{/if}
		</div>
	</div>

	<!-- Mobile Preview Modal -->
	{#if showMobilePreview && selectedTemplate}
		<TouchModal bind:this={modalComponent} on:close={() => (showMobilePreview = false)} inModal={true}>
			<div class="h-full">
				<TemplatePreview
					template={selectedTemplate}
					inModal={true}
					user={data.user}
					onSendMessage={async () => {
						const flow = analyzeEmailFlow(selectedTemplate, data.user);
						
						if (flow.nextAction === 'auth') {
							modalActions.openModal('onboarding-modal', 'onboarding', { template: selectedTemplate, source: 'mobile' });
							showMobilePreview = false;
						} else if (flow.nextAction === 'address') {
							modalActions.openModal('address-modal', 'address', { template: selectedTemplate, source: 'mobile', user: data.user });
							showMobilePreview = false;
						} else {
							// Preload the template page
							const templateUrl = `/s/${selectedTemplate.slug}`;
							preloadData(templateUrl);
							
							// Let button animation play until plane is off-screen (1200ms)
							// This avoids showing the reset animation
							setTimeout(() => {
								goto(templateUrl);
							}, 1200);
						}
					}}
				/>
			</div>
		</TouchModal>
	{/if}

	<!-- Template Creator Modal -->
	{#if showTemplateCreator && creationContext}
		<SimpleModal
			maxWidth="max-w-4xl"
			showClose={false}
			onclose={() => {
				showTemplateCreator = false;
				creationContext = null;
			}}
		>
			<TemplateCreator
				context={creationContext}
				on:close={() => {
					showTemplateCreator = false;
					creationContext = null;
				}}
				on:save={async (event) => {
					// Handle template save
					if (data.user) {
						// Authenticated user - save directly
						try {
							const newTemplate = await templateStore.addTemplate(event.detail);
							showTemplateCreator = false;
							creationContext = null;
							savedTemplate = newTemplate;
							showTemplateSuccess = true;
						} catch (error) {
							// Template save failed - user can retry
							console.error('Failed to save template:', error);
							// You could add a toast notification here
						}
					} else {
						// Guest user - show progressive auth modal
						pendingTemplateToSave = event.detail;
						showTemplateAuthModal = true;
					}
				}}
			/>
		</SimpleModal>
	{/if}

	<!-- Auth Modals -->
	<UnifiedOnboardingModal />

	<!-- Template Creator Auth Modal -->
	{#if showTemplateAuthModal && pendingTemplateToSave}
		<UnifiedProgressiveFormModal
			template={{
				id: 'template-creation',
				title: 'Save Your Template',
				description: 'Create an account to save your template and track its impact',
				slug: 'template-creation',
				deliveryMethod: 'auth',
				preview: 'Sign up to save your advocacy template and help others make their voices heard.'
			}}
			user={data.user}
			on:close={() => {
				showTemplateAuthModal = false;
				pendingTemplateToSave = null;
			}}
			on:send={handleTemplateCreatorAuth}
		/>
	{/if}

	<!-- Address Collection Modal -->
	<UnifiedAddressModal />

	<!-- Template Success Modal -->
	{#if showTemplateSuccess && savedTemplate}
		<TemplateSuccessModal
			template={savedTemplate}
			onclose={() => {
				showTemplateSuccess = false;
				savedTemplate = null;
			}}
			on:createAnother={() => {
				showTemplateSuccess = false;
				savedTemplate = null;
				// Re-open creator with same context
				if (creationContext) {
					showTemplateCreator = true;
				}
			}}
		/>
	{/if}
</section>
