<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { Users, Eye } from '@lucide/svelte';
	import TemplatePreview from '$lib/components/landing/template/TemplatePreview.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import SimpleAuthModal from '$lib/components/auth/SimpleAuthModal.svelte';
	import VerificationBadge from '$lib/components/ui/VerificationBadge.svelte';
	import { extractRecipientEmails } from '$lib/types/templateConfig';
	import { modalActions } from '$lib/stores/modalSystem';
	import { guestState } from '$lib/stores/guestState';
	import { analyzeEmailFlow, launchEmail } from '$lib/services/emailService';
	import { funnelAnalytics } from '$lib/analytics/funnel';
	import type { PageData } from './$types';
	import type { Template as TemplateType } from '$lib/types/template';

	let { data }: { data: PageData } = $props();

	// Simple modal state
	let showAuthModal = $state(false);
	let isUpdatingAddress = $state(false);

	const template: TemplateType = $derived(data.template as unknown as TemplateType);
	const channel = $derived(data.channel);
	const authRequired = $derived($page.url.searchParams.get('auth') === 'required');
	const source = $derived(
		($page.url.searchParams.get('source') || 'direct-link') as
			| 'social-link'
			| 'direct-link'
			| 'share'
	);
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
	const isCongressional = $derived(template.deliveryMethod === 'both');
	const addressRequired = $derived(isCongressional && !hasCompleteAddress);

	onMount(() => {
		// Track template view with source attribution
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
		}

		// Smart post-auth flow detection
		const actionParam =
			$page.url && $page.url.searchParams ? $page.url.searchParams.get('action') : null;
		if (actionParam === 'complete' && data.user) {
			// User just completed auth, check what they need next
			// Track auth completion (provider may or may not be present)
			const provider = $page.url.searchParams.get('provider') || 'unknown';
			funnelAnalytics.trackAuthCompleted(template.id, provider, data.user.id);
			handlePostAuthFlow();
		} else if (authRequired && !data.user) {
			// Show smart auth modal for unauthenticated users
			funnelAnalytics.trackOnboardingStarted(
				template.id,
				source as 'social-link' | 'direct-link' | 'share'
			);
			modalActions.open('auth-modal', 'auth', { template, source });
		}
	});

	function handlePostAuthFlow() {
		const flow = analyzeEmailFlow(template, data.user);

		if (flow.nextAction === 'address') {
			// Need address collection
			modalActions.open('address-modal', 'address', { template, source });
		} else if (flow.nextAction === 'email' && flow.mailtoUrl) {
			// Ready to send email
			modalActions.open('email-loading', 'email_loading', null, { autoClose: 1500 });
			setTimeout(() => launchEmail(flow.mailtoUrl!, '/'), 100);
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
			modalActions.close('address-modal');
			const flow = analyzeEmailFlow(template, data.user);
			if (flow.mailtoUrl) {
				modalActions.open('email-loading', 'email_loading', null, { autoClose: 1500 });
				setTimeout(() => launchEmail(flow.mailtoUrl!, '/'), 100);
			}
		} catch (error) {
			// TODO: Show error toast to user
			// For now, still proceed with email generation
			modalActions.close('address-modal');
			const flow = analyzeEmailFlow(template, data.user);
			if (flow.mailtoUrl) {
				modalActions.open('email-loading', 'email_loading', null, { autoClose: 1500 });
				setTimeout(() => launchEmail(flow.mailtoUrl!, '/'), 100);
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
			<h1 class="mb-3 text-3xl font-bold text-slate-900 sm:text-4xl">{template.title}</h1>
			<p class="mb-4 text-lg text-slate-600">{template.description}</p>

			<!-- Template metadata -->
			<div class="flex flex-wrap items-center gap-3">
				<Badge type={template.deliveryMethod === 'both' ? 'certified' : 'direct'} />
				<span class="rounded bg-slate-100 px-2 py-1 text-sm text-slate-600">
					{template.category}
				</span>
				{#if data.user?.is_verified && template.deliveryMethod === 'both'}
					<div class="flex items-center gap-1 rounded bg-green-50 px-2 py-1 text-sm text-green-700">
						<VerificationBadge showText={false} />
						<span>Enhanced Credibility</span>
					</div>
				{/if}
				<div class="flex items-center gap-6 text-sm text-slate-500">
					<div class="flex items-center gap-1.5">
						<Users class="h-4 w-4" />
						<span>{(template.metrics?.sent || 0).toLocaleString()} supporters</span>
					</div>
					<div class="flex items-center gap-1.5">
						<Eye class="h-4 w-4" />
						<span>{(template.metrics?.views || 0).toLocaleString()} views</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Template Action CTA -->
		<div class="flex flex-col items-start gap-3 sm:items-end">
			{#if data.user}
				<div class="flex items-center gap-2">
					<span class="text-sm text-slate-600">
						Hi {data.user.name?.split(' ')[0]}! Ready to send
					</span>
					{#if data.user.is_verified}
						<VerificationBadge />
					{/if}
				</div>
			{/if}

			{#if template.deliveryMethod === 'both'}
				<Button
					variant="primary"
					classNames="bg-green-600 hover:bg-green-700 focus:ring-green-600/50 w-full sm:w-auto"
					onclick={() => {
						if (!data.user) {
							showAuthModal = true;
							funnelAnalytics.trackOnboardingStarted(
								template.id,
								source as 'social-link' | 'direct-link' | 'share'
							);
						} else {
							handlePostAuthFlow();
						}
					}}
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 2.676-.732 5.162-2.217 7.162-4.416.43-.462.753-.96.938-1.49z"
						/>
					</svg>
					{#if !data.user}
						Sign in to Contact Congress
					{:else if addressRequired}
						Add Address to Contact Congress
					{:else}
						Contact Your Representatives
					{/if}
				</Button>
			{:else}
				<Button
					variant="primary"
					classNames="bg-blue-600 hover:bg-blue-700 focus:ring-blue-600/50 w-full sm:w-auto"
					onclick={() => {
						if (data.user) {
							handlePostAuthFlow();
						} else {
							showAuthModal = true;
							funnelAnalytics.trackOnboardingStarted(
								template.id,
								source as 'social-link' | 'direct-link' | 'share'
							);
						}
					}}
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
						/>
					</svg>
					{#if channel && channel.access_tier === 1}
						{data.user ? 'Send Email' : 'Sign in to Send'}
					{:else if channel && channel.country_code === 'US'}
						{data.user ? 'Contact Congress (Certified)' : 'Sign in to Contact Congress'}
					{:else}
						{data.user ? 'Share This Message' : 'Sign in to Share'}
					{/if}
				</Button>
			{/if}
		</div>
	</div>

	<!-- Template Preview -->
	<div class="min-h-[600px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
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
							Congressional templates need your address to route messages to the correct
							representatives.
						</p>
					</div>
					<Button
						variant="secondary"
						onclick={() => modalActions.open('address-modal', 'address', { template, source })}
						classNames="ml-auto"
					>
						Add Address
					</Button>
				</div>
			</div>
		{/if}

		<TemplatePreview
			{template}
			user={data.user as { id: string; name: string | null } | null}
			onScroll={() => {}}
			onOpenModal={() => {
				const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;
				if (isMobile) {
					modalActions.open('mobile-preview', 'mobile_preview', { template, user: data.user });
				}
			}}
			onSendMessage={async () => {
				console.log('🎯 onSendMessage called', {
					hasUser: !!data.user,
					accessTier: channel?.access_tier,
					countryCode: channel?.country_code,
					deliveryMethod: template.deliveryMethod
				});

				if (channel?.access_tier === 1) {
					const flow = analyzeEmailFlow(template, data.user);
					console.log('📊 Email flow analysis (tier 1):', flow);
					if (flow.nextAction === 'auth') {
						showAuthModal = true;
					} else if (flow.nextAction === 'address') {
						modalActions.open('address-modal', 'address', { template, source });
					} else if (flow.nextAction === 'email' && flow.mailtoUrl) {
						console.log('📧 Opening email loading modal and launching email');
						modalActions.open('email-loading', 'email_loading', null, { autoClose: 1500 });
						setTimeout(() => launchEmail(flow.mailtoUrl!, '/'), 100);
					}
					return;
				}

				// For now, treat US or certified templates as existing path
				if (data.user && (channel?.country_code === 'US' || template.deliveryMethod === 'both')) {
					const flow = analyzeEmailFlow(template, data.user);
					console.log('📊 Email flow analysis (US/both):', flow);
					if (flow.nextAction === 'address') {
						modalActions.open('address-modal', 'address', { template, source });
					} else if (flow.nextAction === 'email' && flow.mailtoUrl) {
						console.log('📧 Opening email loading modal and launching email');
						modalActions.open('email-loading', 'email_loading', null, { autoClose: 1500 });
						setTimeout(() => launchEmail(flow.mailtoUrl!, '/'), 100);
					} else {
						console.log('🔐 Showing auth modal');
						showAuthModal = true;
					}
					return;
				}

				// Default: prompt share (no modal implementation yet)
				console.log('📤 Opening share menu');
				modalActions.open('share-menu', 'share_menu', { template });
			}}
		/>
	</div>
</div>

<!-- Simple Auth Modal -->
<SimpleAuthModal isOpen={showAuthModal} onClose={() => (showAuthModal = false)} {template} />
