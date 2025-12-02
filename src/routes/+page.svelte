<script lang="ts">
	/**
	 * Landing Page - Activation Surface Pattern
	 *
	 * Perceptual Engineering Principles:
	 * - Recognition > Recall: Both primary affordances (create/browse) immediately visible
	 * - Spatial encoding: Left = create (your voice), Right = join (together)
	 * - Progressive disclosure: "How it works" available but not blocking action
	 * - Direct manipulation: No abstract buttons, visible writing surface
	 */

	import { templateStore } from '$lib/stores/templates.svelte';
	import TemplatePreview from '$lib/components/template-browser/TemplatePreview.svelte';
	import LocationFilter from '$lib/components/template-browser/LocationFilter.svelte';
	import TemplateList from '$lib/components/template-browser/TemplateList.svelte';
	import TouchModal from '$lib/components/ui/TouchModal.svelte';
	import SimpleModal from '$lib/components/modals/SimpleModal.svelte';
	import TemplateSuccessModal from '$lib/components/modals/TemplateSuccessModal.svelte';
	import { modalActions } from '$lib/stores/modalSystem.svelte';
	import { isMobile, navigateTo } from '$lib/utils/browserUtils';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { goto, preloadData, onNavigate } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { Template, TemplateCreationContext, TemplateGroup } from '$lib/types/template';
	import type { PageData } from './$types';
	import { coordinated } from '$lib/utils/timerCoordinator';
	import { analyzeEmailFlow } from '$lib/services/emailService';
	import { toEmailServiceUser } from '$lib/types/user';
	import { trackTemplateView } from '$lib/core/location/behavioral-tracker';
	import type { TemplateJurisdiction } from '$lib/core/location/types';
	import type { ModalComponent } from '$lib/types/component-props';

	import TemplateCreator from '$lib/components/template/TemplateCreator.svelte';
	import { CreationSpark, CoordinationExplainer } from '$lib/components/activation';
	import { guestState } from '$lib/stores/guestState.svelte';

	let { data }: { data: PageData } = $props();

	const componentId = 'HomePage_' + Math.random().toString(36).substr(2, 9);

	// Create derived values from the store using Svelte 5 runes
	const selectedTemplate = $derived(
		templateStore.templates.find((t) => t.id === templateStore.selectedId)
	);
	const isLoading = $derived(templateStore.loading);
	const hasError = $derived(!!templateStore.error);

	let showMobilePreview = $state(false);
	let showTemplateCreator = $state(false);
	let showTemplateAuthModal = $state(false);
	let showTemplateSuccess = $state(false);
	let modalComponent = $state<ModalComponent>();
	let creationContext: TemplateCreationContext | null = $state(null);
	let creationInitialText = $state<string>('');
	let pendingTemplateToSave: Record<string, unknown> | null = $state(null);
	let savedTemplate = $state<Template | null>(null);
	let userInitiatedSelection = $state(false);
	let locationFilteredGroups = $state<TemplateGroup[]>([]);
	let nextUnlock = $state<{ level: 'city' | 'district'; count: number } | null>(null);
	let openAddressModal = $state<(() => void) | null>(null);

	// Handle OAuth return for template creation and URL parameter initialization
	onMount(() => {
		if (browser && $page.url.searchParams.get('template_saved') === 'pending') {
			const pendingData = sessionStorage.getItem('pending_template_save');
			if (pendingData) {
				try {
					const { templateData } = JSON.parse(pendingData);
					templateStore
						.addTemplate(templateData)
						.then(() => {
							sessionStorage.removeItem('pending_template_save');
						})
						.catch((_error) => {
							// Template save failed - user can retry later
						});
				} catch {
					// Invalid pending template data - ignore
				}
			}
		}

		// Initialize template store
		templateStore.fetchTemplates();

		// Check for template creation parameter
		const createTemplate = $page.url.searchParams.get('create');
		if (createTemplate === 'true') {
			coordinated.setTimeout(
				() => {
					creationContext = {
						channelId: 'direct',
						channelTitle: 'Direct Outreach',
						isCongressional: false
					};
					showTemplateCreator = true;
					window.history.replaceState({}, '', '/');
				},
				100,
				'open-creator',
				componentId
			);
		}
	});

	// Enable smooth page transitions (browser only)
	if (browser) {
		onNavigate((navigation) => {
			if (!document.startViewTransition || !navigation.to?.url.pathname.includes('/s/')) {
				return;
			}
			return new Promise((resolve) => {
				document.startViewTransition(async () => {
					resolve();
				});
			});
		});
	}

	function handleTemplateSelect(id: string) {
		userInitiatedSelection = true;
		templateStore.selectTemplate(id);

		const template = templateStore.templates.find((t) => t.id === id);
		if (template && 'jurisdictions' in template && Array.isArray(template.jurisdictions)) {
			trackTemplateView(
				template.id,
				template.slug,
				template.jurisdictions as TemplateJurisdiction[]
			).catch((error) => {
				console.warn('[HomePage] Failed to track template view:', error);
			});
		}

		if (isMobile()) {
			showMobilePreview = true;
		}
	}

	function handleSparkActivate(event: CustomEvent<{ initialText: string }>) {
		creationInitialText = event.detail.initialText;
		creationContext = {
			channelId: 'direct',
			channelTitle: 'Direct Outreach',
			isCongressional: false
		};
		showTemplateCreator = true;
	}

	function handleTemplateCreatorAuth(_event: CustomEvent) {
		const { name, email } = _event.detail;

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

		fetch('/auth/prepare', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ returnTo: '/?template_saved=pending' })
		}).finally(() => {
			navigateTo(`/auth/google`);
		});
	}

	// Show all templates (congressional + direct email)
	const allTemplates = $derived(
		templateStore.templates.filter(
			(t) =>
				t.deliveryMethod === 'cwc' || t.deliveryMethod === 'email' || t.deliveryMethod === 'direct'
		)
	);

	// Use location-filtered groups if available, otherwise show all templates
	const filteredGroups = $derived(
		locationFilteredGroups.length > 0
			? locationFilteredGroups
			: [
					{
						title: 'All Templates',
						templates: allTemplates,
						minScore: 0,
						level: 'nationwide' as const,
						coordinationCount: allTemplates.reduce((sum, t) => sum + (t.send_count || 0), 0)
					}
				]
	);

	function handleLocationFilterChange(groups: TemplateGroup[]) {
		locationFilteredGroups = groups;
	}

	function handleNextUnlockChange(unlock: { level: 'city' | 'district'; count: number } | null) {
		nextUnlock = unlock;
	}

	function handleAddressModalHandler(handler: () => void) {
		openAddressModal = handler;
	}

	// Handle URL parameter initialization when templates load
	$effect(() => {
		if (browser && templateStore.templates.length > 0 && !userInitiatedSelection) {
			const templateParam = $page.url.searchParams.get('template');
			if (templateParam) {
				const targetTemplate = templateStore.templates.find((t) => t.slug === templateParam);
				if (targetTemplate && targetTemplate.id !== templateStore.selectedId) {
					templateStore.selectTemplateBySlug(templateParam);
				}
			}
		}
	});

	async function handleSendMessage(template: Template) {
		if (!data.user) {
			modalActions.openModal('onboarding-modal', 'onboarding', {
				template,
				source: 'featured',
				onComplete: async (detail: any) => {
					// If address was collected during onboarding (unlikely but possible depending on flow), save it
					if (detail?.address) {
						// Client-side caching only - Cypherpunk ethos
						guestState.setAddress(detail.address);
					}

					const templateUrl = `/s/${template.slug}`;
					preloadData(templateUrl);
					setTimeout(() => {
						goto(templateUrl);
					}, 500);
				}
			});
			return;
		}

		const flow = analyzeEmailFlow(template, toEmailServiceUser(data.user));

		if (flow.nextAction === 'address') {
			modalActions.openModal('address-modal', 'address', {
				template,
				source: 'featured',
				user: data.user,
				onComplete: async (detail: any) => {
					if (detail?.address) {
						// Client-side caching only - Cypherpunk ethos
						guestState.setAddress(detail.address);
					}

					const templateUrl = `/s/${template.slug}`;
					preloadData(templateUrl);
					setTimeout(() => {
						goto(templateUrl);
					}, 500);
				}
			});
		} else {
			const templateUrl = `/s/${template.slug}`;
			preloadData(templateUrl);
			setTimeout(() => {
				goto(templateUrl);
			}, 500);
		}
	}
</script>

<svelte:head>
	<title>Communiqué - Your voice. Sent together.</title>
	<meta
		name="description"
		content="Write once, share the link, everyone can send it. Coordinated messages make impact."
	/>
</svelte:head>

<!-- Activation Surface - Primary Affordances Immediately Visible -->
<section class="activation-page">
	<!-- Main Content: Split Layout -->
	<div class="activation-container">
		<!-- Left Column: Creation Spark + Minimal Footer -->
		<div class="creation-column">
			<CreationSpark on:activate={handleSparkActivate}>
				{#snippet context()}
					<footer class="creation-footer">
						<a href="mailto:hello@communi.email" class="contact-link">
							<span class="link-text">hello@communi.email</span>
							<svg
								class="link-arrow"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<line x1="5" y1="12" x2="19" y2="12"></line>
								<polyline points="12 5 19 12 12 19"></polyline>
							</svg>
						</a>
					</footer>
				{/snippet}
			</CreationSpark>
		</div>

		<!-- Right Column: Template Stream + Preview -->
		<div class="stream-column">
			<!-- How It Works - Spatially Adjacent to Coordination Signals -->
			<div class="stream-explainer">
				<CoordinationExplainer />
			</div>

			<!-- Location Filter -->
			<div class="stream-header">
				<LocationFilter
					templates={allTemplates}
					onFilterChange={handleLocationFilterChange}
					onNextUnlockChange={handleNextUnlockChange}
					onAddressModalOpen={handleAddressModalHandler}
				/>
			</div>

			<!-- Template Browser: List + Preview Grid -->
			<div class="template-browser" id="template-browser">
				<!-- Template List -->
				<div class="template-list-column">
					<TemplateList
						groups={filteredGroups}
						selectedId={templateStore.selectedId}
						onSelect={handleTemplateSelect}
						loading={isLoading}
					/>
				</div>

				<!-- Template Preview (desktop only) -->
				<div class="template-preview-column">
					{#if hasError}
						<div class="rounded-xl border border-orange-200 bg-orange-50 p-6 text-center">
							<div class="mb-4 flex justify-center">
								<div class="flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
									<svg
										class="h-8 w-8 text-orange-600"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M12 8v4m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"
										/>
									</svg>
								</div>
							</div>
							<h3 class="mb-2 text-lg font-medium text-gray-900">
								Templates temporarily unavailable
							</h3>
							<p class="mb-4 text-sm text-gray-600">
								We're having trouble loading templates right now.
							</p>
							<button
								onclick={() => templateStore.fetchTemplates()}
								data-testid="retry-templates-button"
								class="inline-flex items-center rounded-lg bg-orange-600 px-4 py-2 text-white transition-colors hover:bg-orange-700"
							>
								Try Again
							</button>
						</div>
					{:else if isLoading && !selectedTemplate}
						<div class="rounded-xl border border-slate-200 bg-white p-6">
							<div class="animate-pulse">
								<div class="mb-6 h-6 w-64 rounded bg-slate-200"></div>
								<div class="mb-3 h-4 w-full rounded bg-slate-200"></div>
								<div class="mb-6 h-4 w-3/4 rounded bg-slate-200"></div>
								<div class="h-64 rounded bg-slate-200"></div>
							</div>
						</div>
					{:else if selectedTemplate}
						<TemplatePreview
							template={selectedTemplate}
							user={data.user}
							onSendMessage={async () => handleSendMessage(selectedTemplate)}
						/>
					{:else}
						<div class="rounded-xl border border-slate-200 bg-slate-50 p-12 text-center">
							<div class="mb-4 text-slate-400">
								<svg
									class="mx-auto h-16 w-16"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="1.5"
										d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
									/>
								</svg>
							</div>
							<h3 class="mb-2 text-lg font-medium text-slate-900">No campaigns running yet</h3>
							<p class="text-slate-600">Someone has to move first. Start one.</p>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</section>

<!-- Mobile Preview Modal -->
{#if showMobilePreview && selectedTemplate}
	<TouchModal
		bind:this={modalComponent}
		on:close={() => (showMobilePreview = false)}
		inModal={true}
	>
		<div class="h-full">
			<TemplatePreview
				template={selectedTemplate}
				inModal={true}
				user={data.user}
				onSendMessage={async () => {
					if (!data.user) {
						modalActions.openModal('onboarding-modal', 'onboarding', {
							template: selectedTemplate,
							source: 'mobile'
						});
						showMobilePreview = false;
						return;
					}

					const flow = analyzeEmailFlow(selectedTemplate, toEmailServiceUser(data.user));

					if (flow.nextAction === 'address') {
						modalActions.openModal('address-modal', 'address', {
							template: selectedTemplate,
							source: 'mobile',
							user: data.user
						});
						showMobilePreview = false;
					} else {
						const templateUrl = `/s/${selectedTemplate.slug}`;
						preloadData(templateUrl);
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
			creationInitialText = '';
		}}
	>
		<TemplateCreator
			context={creationContext}
			on:close={() => {
				showTemplateCreator = false;
				creationContext = null;
				creationInitialText = '';
			}}
			on:save={async (_event) => {
				if (data.user) {
					try {
						const newTemplate = await templateStore.addTemplate(_event.detail);
						showTemplateCreator = false;
						creationContext = null;
						creationInitialText = '';
						savedTemplate = newTemplate;
						showTemplateSuccess = true;
					} catch {
						console.error('Template save failed');
					}
				} else {
					pendingTemplateToSave = _event.detail;
					showTemplateAuthModal = true;
				}
			}}
		/>
	</SimpleModal>
{/if}

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
			if (creationContext) {
				showTemplateCreator = true;
			}
		}}
	/>
{/if}

<style>
	/*
	 * Activation Surface Layout
	 *
	 * Perceptual Engineering:
	 * - Split layout puts both affordances in immediate view
	 * - Creation on left (your voice), templates on right (together)
	 * - "How it works" below as progressive disclosure
	 *
	 * Responsive:
	 * - Desktop (>=1280px): Side-by-side split with full preview
	 * - Tablet/Mobile (<1280px): Stacked layout with full-width stream
	 *
	 * Key insight: Nested grids (activation-container > template-browser)
	 * need room to breathe. At 1024px, splitting creates cramped columns.
	 * Solution: delay split until 1280px where both grids have room.
	 */

	/*
	 * STICKY FIX: Container top padding for mobile/tablet only.
	 * Desktop (>=1280px): NO top padding - creation-column sticky locks at viewport edge.
	 * Mobile/tablet (<1280px): Top padding matches horizontal padding at each breakpoint.
	 */
	.activation-page {
		display: flex;
		flex-direction: column;
		gap: 3rem;
		min-height: 100vh;
		padding: 1rem 1rem 0; /* Top matches horizontal (1rem); no bottom padding */
		max-width: 1600px;
		margin: 0 auto;
	}

	@media (min-width: 640px) {
		.activation-page {
			padding: 1.5rem 1.5rem 0; /* Top matches horizontal (1.5rem) */
			gap: 4rem;
		}
	}

	@media (min-width: 1024px) {
		.activation-page {
			padding: 2rem 2rem 0; /* Top matches horizontal (2rem) */
		}
	}

	@media (min-width: 1280px) {
		.activation-page {
			padding: 0 2rem 0; /* NO top padding - sticky sidebar takes over */
		}
	}

	/* Main Container: Split Layout
	 *
	 * Key insight: The nested grids (activation-container > template-browser)
	 * need room to breathe. At tablet widths (1024-1279px), the split creates
	 * cramped nested columns. Solution: delay split until 1280px.
	 *
	 * Breakpoints:
	 * - <1280px: Stacked (mobile/tablet)
	 * - >=1280px: Side-by-side split
	 */
	.activation-container {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	@media (min-width: 1280px) {
		.activation-container {
			display: grid;
			grid-template-columns: minmax(340px, 420px) 1fr;
			gap: 3rem;
			align-items: start;
		}
	}

	@media (min-width: 1440px) {
		.activation-container {
			grid-template-columns: minmax(380px, 480px) 1fr;
			gap: 4rem;
		}
	}

	/* Creation Column */
	.creation-column {
		/* Mobile/Tablet: show as expandable card */
		padding: 1.5rem;
		border-radius: 16px;
		border: 1px solid oklch(0.9 0.02 250);
		background: white;
		box-shadow:
			0 1px 3px oklch(0 0 0 / 0.05),
			0 10px 30px -10px oklch(0.3 0.05 250 / 0.1);
	}

	@media (min-width: 1280px) {
		.creation-column {
			/* Desktop: sticky sidebar - locks immediately at viewport edge */
			position: sticky;
			top: 0;
			padding: 3rem 0 2rem 0; /* Top spacing + bottom for absolutely positioned footer */
			border: none;
			background: transparent;
			box-shadow: none;
			z-index: 10; /* Stay above scrolling content */
			overflow: visible; /* Allow RelayLoom expanded nodes to overflow */
		}
	}

	/* Stream Column */
	.stream-column {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
	}

	@media (min-width: 1280px) {
		.stream-column {
			padding-top: 3rem; /* Match creation-column top spacing on desktop */
		}
	}

	.stream-header {
		flex-shrink: 0;
	}

	/* Template Browser Grid */
	.template-browser {
		display: grid;
		gap: 1.5rem;
		padding-bottom: 1.5rem;
	}

	@media (min-width: 768px) {
		.template-browser {
			grid-template-columns: 1fr 1.5fr;
			gap: 2rem;
			padding-bottom: 2rem;
		}
	}

	@media (min-width: 1024px) {
		.template-browser {
			grid-template-columns: minmax(280px, 340px) 1fr;
		}
	}

	.template-list-column {
		min-width: 0;
		position: relative;
		z-index: 20;
	}

	.template-preview-column {
		display: none;
	}

	@media (min-width: 768px) {
		.template-preview-column {
			display: block;
			min-width: 0;
		}
	}

	/* Stream Explainer - Spatially adjacent to coordination signals */
	.stream-explainer {
		margin-bottom: 0.5em;
	}

	@media (min-width: 640px) {
		.stream-explainer {
			margin-bottom: 1.5rem;
		}
	}

	/* Creation Footer & Contact Link */
	.creation-footer {
		margin-top: auto;
		padding-top: 1.5rem;
	}

	.contact-link {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		text-decoration: none;
		color: oklch(0.55 0.02 250);
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.875rem;
		font-weight: 500;
		transition: color 200ms ease-out;
	}

	.link-arrow {
		width: 1em;
		height: 1em;
		opacity: 0;
		transform: translateX(-4px);
		transition:
			opacity 200ms ease-out,
			transform 200ms ease-out;
	}

	.contact-link:hover {
		color: oklch(0.55 0.15 195); /* Cyan */
	}

	.contact-link:hover .link-arrow {
		opacity: 1;
		transform: translateX(0);
	}
</style>
