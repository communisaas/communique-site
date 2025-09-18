<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { Users, Eye } from '@lucide/svelte';
	import TemplatePreview from '$lib/components/landing/template/TemplatePreview.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import VerificationBadge from '$lib/components/ui/VerificationBadge.svelte';
	import { extractRecipientEmails } from '$lib/types/templateConfig';
	import { modalActions, modalSystem } from '$lib/stores/modalSystem.svelte';
	import { guestState } from '$lib/stores/guestState.svelte';
	import { analyzeEmailFlow, launchEmail } from '$lib/services/emailService';
	import { toEmailServiceUser } from '$lib/types/user';
	import { funnelAnalytics } from '$lib/core/analytics/funnel';
	import ShareButton from '$lib/components/ui/ShareButton.svelte';
	import ActionBar from '$lib/components/landing/template/parts/ActionBar.svelte';
	import UnifiedTemplateModal from '$lib/components/modals/UnifiedTemplateModal.svelte';
	import UnifiedOnboardingModal from '$lib/components/modals/UnifiedOnboardingModal.svelte';
	import UnifiedAddressModal from '$lib/components/modals/UnifiedAddressModal.svelte';
	import { spring } from 'svelte/motion';
	import { browser } from '$app/environment';
	import type { PageData } from './$types';
	import type { Template as TemplateType } from '$lib/types/template';

	let { data }: { data: PageData } = $props();

	// Simple modal state
	let isUpdatingAddress = $state(false);

	// ActionBar state
	let personalConnectionValue = $state('');
	let actionProgress = $state(spring(0));

	// Template modal reference
	let templateModal: UnifiedTemplateModal;

	const template: TemplateType = $derived(data.template as unknown as TemplateType);
	const channel = $derived(data.channel);
	// Simplified - no query parameters needed, default to direct-link
	const source = 'direct-link';
	const shareUrl = $derived(
		(() => {
			try {
				return $page.url?.href ?? '';
			} catch {
				return '';
			}
		})()
	);

	// Check if user has complete address for congressional templates
	const hasCompleteAddress = $derived(
		data.user && data.user.street && data.user.city && data.user.state && data.user.zip
	);
	const isCongressional = $derived(template.deliveryMethod === 'certified');
	const addressRequired = $derived(isCongressional && !hasCompleteAddress);

	onMount(() => {
		// Clean up OAuth redirect hash fragment from Facebook
		if (browser && window.location.hash === '#_=_') {
			history.replaceState(null, '', window.location.pathname + window.location.search);
		}

		// Normal template view - track with default source
		// Share links now land here directly, no redirect needed
		funnelAnalytics.trackTemplateView(
			template.id,
			source as 'social-link' | 'direct-link' | 'share'
		);

		// Store template context for guest users
		if (!data.user) {
			const safeSlug = (template.slug ?? template.id) as string;
			guestState.setTemplate(
				safeSlug,
				template.title,
				source as 'social-link' | 'direct-link' | 'share'
			);
		} else {
			// For authenticated users, immediately trigger email flow on share link landing
			// Use the same TemplateModal as homepage for consistency
			const flow = analyzeEmailFlow(template, toEmailServiceUser(data.user));

			if (flow.nextAction === 'address') {
				// Need address - show modal
				modalActions.openModal('address-modal', 'address', { template, source });
			} else if (flow.nextAction === 'email' && flow.mailtoUrl) {
				// Use modalSystem directly since component may not be mounted yet
				modalSystem.openModal('template-modal', 'template_modal', { template, user: data.user });
			}
		}
	});

	function handlePostAuthFlow() {
		const flow = analyzeEmailFlow(template, data.user);

		if (flow.nextAction === 'address') {
			// Need address collection
			modalActions.openModal('address-modal', 'address', { template, source });
		} else if (flow.nextAction === 'email' && flow.mailtoUrl) {
			// Open TemplateModal using component method for consistency
			templateModal?.open(template, data.user);
		}
	}

	async function handleAddressSubmit(address: string) {
		try {
			isUpdatingAddress = true;

			// Call API to update user address
			const response = await fetch('/api/user/address', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ address })
			});

			if (!response.ok) {
				throw new Error('Failed to save address');
			}

			const result = await response.json();

			// Update local user data to reflect the new address
			if (data.user) {
				data.user.street = result.user.street;
				data.user.city = result.user.city;
				data.user.state = result.user.state;
				data.user.zip = result.user.zip;
			}

			// Close address modal and proceed to email generation
			modalActions.closeModal('address-modal');

			// Clear any stored intent after successful address submission
			sessionStorage.removeItem(`template_${template.id}_intent`);

			const flow = analyzeEmailFlow(template, toEmailServiceUser(data.user));
			if (flow.mailtoUrl) {
				// Open TemplateModal using component method for consistency
				templateModal?.open(template, data.user);
			}
		} catch (error) {
			// Error occurred during address update, but we'll still proceed with email
			// In production, consider showing a warning about unverified address
			modalActions.closeModal('address-modal');

			// Clear any stored intent even on error
			sessionStorage.removeItem(`template_${template.id}_intent`);

			const flow = analyzeEmailFlow(template, toEmailServiceUser(data.user));
			if (flow.mailtoUrl) {
				// Open TemplateModal using component method for consistency
				templateModal?.open(template, data.user);
			}
		} finally {
			isUpdatingAddress = false;
		}
	}
</script>

<svelte:head>
	<title>{template.title} - Communiqué</title>
	<meta name="description" content={template.description} />

	<!-- Open Graph / Facebook -->
	<meta property="og:type" content="website" />
	<meta property="og:url" content={shareUrl} />
	<meta property="og:title" content={template.title} />
	<meta property="og:description" content={template.description} />
	<meta property="og:site_name" content="Communiqué" />

	<!-- Twitter -->
	<meta property="twitter:card" content="summary_large_image" />
	<meta property="twitter:url" content={shareUrl} />
	<meta property="twitter:title" content={template.title} />
	<meta property="twitter:description" content={template.description} />
</svelte:head>

<!-- Template content with integrated header -->
<div class="py-6">
	<!-- Template Header with Action -->
	<div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
		<div class="min-w-0 flex-1">
			<!-- Use subject as primary title, fall back to title if no subject -->
			<h1 class="mb-3 text-3xl font-bold text-slate-900 sm:text-4xl">
				{template.subject || template.title}
			</h1>
			<!-- Show the longer title as supporting text if we're using subject as h1 -->
			{#if template.subject && template.title}
				<p class="mb-2 text-xl text-slate-700">{template.title}</p>
			{/if}
			<p class="mb-4 text-lg text-slate-600">{template.description}</p>

			<!-- Template metadata -->
			<div class="flex flex-wrap items-center gap-3">
				<Badge variant={template.deliveryMethod === 'certified' ? 'congressional' : 'direct'}>
					{template.deliveryMethod === 'certified' ? 'Certified Delivery' : 'Direct Outreach'}
				</Badge>
				<span class="rounded bg-slate-100 px-2 py-1 text-sm text-slate-600">
					{template.category}
				</span>
				{#if data.user?.is_verified && template.deliveryMethod === 'certified'}
					<div class="flex items-center gap-1 rounded bg-green-50 px-2 py-1 text-sm text-green-700">
						<VerificationBadge showText={false} />
						<span>Enhanced Credibility</span>
					</div>
				{/if}
				<div class="flex items-center gap-6 text-sm text-slate-500">
					<div class="flex items-center gap-1.5">
						<Users class="h-4 w-4" />
						<span>{(template.metrics?.sent || 0).toLocaleString()} sent this</span>
					</div>
					<div class="flex items-center gap-1.5">
						<Eye class="h-4 w-4" />
						<span>{(template.metrics?.views || 0).toLocaleString()} views</span>
					</div>
				</div>
			</div>
		</div>

		<!-- User greeting and Action Button -->
		<div class="flex flex-col items-start gap-3 sm:items-end">
			{#if data.user}
				<div class="flex items-center gap-2">
					<span class="text-sm text-slate-600">
						Hi {data.user.name?.split(' ')[0]} - join the {(
							template.metrics?.sent || 0
						).toLocaleString()} who sent this
					</span>
					{#if data.user.is_verified}
						<VerificationBadge />
					{/if}
				</div>
			{/if}

			<!-- ActionBar positioned in header -->
			<div class="w-full sm:w-auto [&>div]:mt-0">
				<ActionBar
					{template}
					user={data.user as { id: string; name: string | null } | null}
					{personalConnectionValue}
					onSendMessage={() => {
						if (!data.user) {
							// Use UnifiedOnboardingModal for consistency with landing page
							modalActions.openModal('onboarding-modal', 'onboarding', {
								template,
								source: source as 'social-link' | 'direct-link' | 'share'
							});
							funnelAnalytics.trackOnboardingStarted(
								template.id,
								source as 'social-link' | 'direct-link' | 'share'
							);
						} else {
							// For authenticated users, use TemplateModal for the entire flow
							handlePostAuthFlow();
						}
					}}
					localShowEmailModal={false}
					bind:actionProgress
					onEmailModalClose={() => {}}
					componentId="template-page-action"
				/>
			</div>
		</div>
	</div>

	<!-- Template Preview -->
	<div class="rounded-xl border border-slate-200 bg-white shadow-sm">
		{#if addressRequired}
			<!-- Address Required Notice -->
			<div class="border-b border-amber-200 bg-amber-50 px-6 py-4">
				<div class="flex items-center gap-3">
					<div class="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
						<svg class="h-4 w-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
							<path
								fill-rule="evenodd"
								d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
								clip-rule="evenodd"
							/>
						</svg>
					</div>
					<div>
						<h3 class="text-sm font-semibold text-amber-900">Address Required</h3>
						<p class="text-xs text-amber-700">
							They only count messages from their district. No address = no impact.
						</p>
					</div>
					<Button
						variant="secondary"
						onclick={() => modalActions.openModal('address-modal', 'address', { template, source })}
						classNames="ml-auto"
					>
						Add Address
					</Button>
				</div>
			</div>
		{/if}

		<TemplatePreview
			{template}
			context="page"
			user={data.user as { id: string; name: string | null } | null}
			showEmailModal={false}
			onEmailModalClose={() => {}}
			onScroll={() => {}}
			expandToContent={true}
			onOpenModal={() => {
				const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;
				if (isMobile) {
					modalActions.open('mobile-preview', 'mobile_preview', { template, user: data.user });
				}
			}}
			onSendMessage={async () => {
				if (channel?.access_tier === 1) {
					const flow = analyzeEmailFlow(template, toEmailServiceUser(data.user));
					if (flow.nextAction === 'auth') {
						modalActions.openModal('onboarding-modal', 'onboarding', { template, source });
					} else if (flow.nextAction === 'address') {
						modalActions.openModal('address-modal', 'address', { template, source });
					} else if (flow.nextAction === 'email' && flow.mailtoUrl) {
						// Open TemplateModal using component method for consistency
						templateModal?.open(template, data.user);
					}
					return;
				}

				// For now, treat US or certified templates as existing path
				if (
					data.user &&
					(channel?.country_code === 'US' || template.deliveryMethod === 'certified')
				) {
					const flow = analyzeEmailFlow(template, toEmailServiceUser(data.user));
					if (flow.nextAction === 'address') {
						modalActions.openModal('address-modal', 'address', { template, source });
					} else if (flow.nextAction === 'email' && flow.mailtoUrl) {
						// Open TemplateModal using component method for consistency
						templateModal?.open(template, data.user);
					} else {
						modalActions.openModal('onboarding-modal', 'onboarding', { template, source });
					}
					return;
				}

				// Default: prompt share (no modal implementation yet)
				modalActions.openModal('share-menu', 'share_menu', { template });
			}}
		/>
	</div>
</div>

<!-- Modal Components -->
<UnifiedOnboardingModal />
<UnifiedAddressModal />
<UnifiedTemplateModal bind:this={templateModal} />
