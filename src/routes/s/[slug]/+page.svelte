<script lang="ts">
	import { page } from '$app/stores';
	import { onMount as _onMount } from 'svelte';
	import { Users, Eye } from '@lucide/svelte';
	import TemplatePreview from '$lib/components/template-browser/TemplatePreview.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import VerificationBadge from '$lib/components/ui/VerificationBadge.svelte';
	// import { extractRecipientEmails } from '$lib/types/templateConfig';
	import { modalActions, modalSystem } from '$lib/stores/modalSystem.svelte';
	import { guestState } from '$lib/stores/guestState.svelte';
	import { analyzeEmailFlow } from '$lib/services/emailService';
	import { toEmailServiceUser } from '$lib/types/user';
	import { trackTemplateView } from '$lib/core/analytics/client';
	// import ShareButton from '$lib/components/ui/ShareButton.svelte';
	import ActionBar from '$lib/components/template-browser/parts/ActionBar.svelte';

	import { spring } from 'svelte/motion';
	import { browser } from '$app/environment';
	import type { PageData } from './$types';
	import type { Template as TemplateType } from '$lib/types/template';
	import SocialProofBanner from '$lib/components/template/SocialProofBanner.svelte';

	let { data }: { data: PageData } = $props();

	// Simple modal state
	let _isUpdatingAddress = $state(false);

	// ActionBar state
	let personalConnectionValue = $state('');
	let actionProgress = $state(spring(0));

	// Template modal reference

	const template: TemplateType = $derived(data.template as unknown as TemplateType);
	const channel = $derived(data.channel);
	const topDistricts = $derived(data.topDistricts || []);
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

	// Enhanced description with social proof for Open Graph
	const socialProofDescription = $derived((() => {
		const sent = (template as any).verified_sends || template.metrics?.sent || 0;
		if (sent > 1000) {
			return `Join ${sent.toLocaleString()}+ constituents who took action. ${template.description}`;
		} else if (sent > 100) {
			return `${sent.toLocaleString()} people have taken action. ${template.description}`;
		}
		return template.description;
	})());

	// Check if user has complete address for congressional templates
	// Note: Address fields removed from User model per CYPHERPUNK-ARCHITECTURE.md
	const hasCompleteAddress = $derived(
		guestState.state?.address
	);
	const isCongressional = $derived(template.deliveryMethod === 'cwc');
	const addressRequired = $derived(isCongressional && !hasCompleteAddress);

	_onMount(() => {
		// Clean up OAuth redirect hash fragment from Facebook
		if (browser && window.location.hash === '#_=_') {
			history.replaceState(null, '', window.location.pathname + window.location.search);
		}

		// Track template view (aggregated, no source tracking - that's surveillance)
		trackTemplateView(template.id);

		// Store template context for guest users
		if (!data.user) {
			const safeSlug = (template.slug ?? template.id) as string;
			guestState.setTemplate(
				safeSlug,
				template.title,
				source as 'social-link' | 'direct-link' | 'share'
			);
			return;
		}

		// FOR AUTHENTICATED USERS:
		// Check if OAuth just completed → open modal immediately
		const oauthCompletion = getOAuthCompletionCookie();

		if (oauthCompletion) {
			// Just completed OAuth - open template modal IMMEDIATELY
			// No address wall, no interruptions
			// Address will be collected DURING modal flow if needed (congressional templates only)
			console.log('[Template Page] OAuth completion detected - opening modal immediately');

			modalSystem.openModal('template-modal', 'template_modal', {
				template,
				user: data.user
			});

			// Clean up the completion cookie
			clearOAuthCompletionCookie();
		}
		// Note: We removed the old "immediately trigger email flow" logic
		// Modal will now only open after OAuth or when user clicks "Send message"
	});

	/**
	 * Get OAuth completion cookie if it exists
	 * This cookie is set by oauth-callback-handler after successful auth
	 */
	function getOAuthCompletionCookie(): {
		provider: string;
		returnTo: string;
		completed: boolean;
		timestamp: number;
	} | null {
		if (!browser) return null;

		const cookie = document.cookie.split('; ').find((row) => row.startsWith('oauth_completion='));

		if (!cookie) return null;

		try {
			const value = decodeURIComponent(cookie.split('=')[1]);
			return JSON.parse(value);
		} catch (error) {
			console.error('[Template Page] Failed to parse oauth_completion cookie:', error);
			return null;
		}
	}

	/**
	 * Clear OAuth completion cookie after use
	 */
	function clearOAuthCompletionCookie(): void {
		if (!browser) return;
		document.cookie = 'oauth_completion=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
	}

	interface AddressModalDetail {
		address: string;
		[key: string]: unknown;
	}

	function handlePostAuthFlow() {
		const flow = analyzeEmailFlow(template, data.user);

		if (flow.nextAction === 'address') {
			// Need address collection
			modalActions.openModal('address-modal', 'address', {
				template,
				source,
				mode: 'collection',
				onComplete: async (detail: AddressModalDetail) => {
					await _handleAddressSubmit(detail.address);
				}
			});
		} else if (flow.nextAction === 'email' && flow.mailtoUrl) {
			// Open TemplateModal using modalActions
			modalActions.openModal('template-modal', 'template_modal', { template, user: data.user });
		}
	}

	async function _handleAddressSubmit(address: string) {
		console.log('[TemplateFlow] _handleAddressSubmit called with:', address);
		try {
			_isUpdatingAddress = true;

			// Client-side caching only - Cypherpunk ethos
			// No backend call here
			guestState.setAddress(address);
			console.log('[TemplateFlow] Address cached locally via guestState');

			// Update local user data to reflect the new address (mock update for UI)
			if (data.user) {
				// We don't have the full parsed address, but we can set what we have
				// or just rely on guestState check in hasCompleteAddress
				// data.user.street = ... // We only have the raw string or detail object if we changed the signature
			}

			// Close address modal and proceed to email generation
			modalActions.closeModal('address-modal');
			// Open TemplateModal using modalActions
			console.log('[TemplateFlow] Opening template modal...');
			modalActions.openModal('template-modal', 'template_modal', {
				template,
				user: { ...data.user, address }
			});
		} catch (error) {
			console.error('[TemplateFlow] Error in _handleAddressSubmit:', error);
			// Error occurred during address update, but we'll still proceed with email
			// In production, consider showing a warning about unverified address
			modalActions.closeModal('address-modal');

			// Clear any stored intent even on error
			sessionStorage.removeItem(`template_${template.id}_intent`);

			const flow = analyzeEmailFlow(template, toEmailServiceUser(data.user));
			if (flow.mailtoUrl) {
				// Open TemplateModal using modalActions
				modalActions.openModal('template-modal', 'template_modal', { template, user: data.user });
			}
		} finally {
			_isUpdatingAddress = false;
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
	<meta property="og:description" content={socialProofDescription} />
	<meta property="og:site_name" content="Communiqué" />
	<meta property="og:image" content="{shareUrl.split('?')[0]}/og-image" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content="{template.title} - Join the movement on Communiqué" />

	<!-- Twitter -->
	<meta property="twitter:card" content="summary_large_image" />
	<meta property="twitter:url" content={shareUrl} />
	<meta property="twitter:title" content={template.title} />
	<meta property="twitter:description" content={socialProofDescription} />
	<meta property="twitter:image" content="{shareUrl.split('?')[0]}/og-image" />
	<meta property="twitter:image:alt" content="{template.title} - Join the movement on Communiqué" />
</svelte:head>

<!-- Template content with integrated header -->
<div class="py-6">
	<!-- Template Header with Action -->
	<div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
		<div class="min-w-0 flex-1">
			<!-- Template title as primary header -->
			<h1 class="mb-3 text-3xl font-bold text-slate-900 sm:text-4xl">
				{template.title}
			</h1>
			<p class="mb-4 text-lg text-slate-600">{template.description}</p>

			<!-- Template metadata -->
			<div class="flex flex-wrap items-center gap-3">
				<Badge variant={template.deliveryMethod === 'cwc' ? 'congressional' : 'direct'}>
					{template.deliveryMethod === 'cwc' ? 'Congressional Delivery' : 'Direct Outreach'}
				</Badge>
				<span class="rounded bg-slate-100 px-2 py-1 text-sm text-slate-600">
					{template.category}
				</span>
				{#if data.user?.is_verified && template.deliveryMethod === 'cwc'}
					<div class="flex items-center gap-1 rounded bg-green-50 px-2 py-1 text-sm text-green-700">
						<VerificationBadge showText={false} />
						<span>Enhanced Credibility</span>
					</div>
				{/if}
				<div class="flex items-center gap-6 text-sm text-slate-500">
					<div class="flex items-center gap-1.5">
						<Users class="h-4 w-4" />
						<span
							>{((template as any).verified_sends || template.metrics?.sent || 0).toLocaleString()} sent this</span
						>
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
							(template as any).verified_sends ||
							template.metrics?.sent ||
							0
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
							// DEMO MODE: Skip auth wall on template landing, go straight to modal
							// User is already on the template page, let them proceed
							modalActions.openModal('template-modal', 'template_modal', { template, user: null });
						} else {
							// For authenticated users, use TemplateModal for the entire flow
							handlePostAuthFlow();
						}
					}}
					localShowEmailModal={false}
					bind:actionProgress
					onEmailModalClose={() => {
						/* Intentionally empty - modal close handled elsewhere */
					}}
					componentId="template-page-action"
				/>
			</div>
		</div>
	</div>

	<!-- Social Proof Banner (show if > 10 actions) -->
	{#if ((template as any).verified_sends || template.metrics?.sent || 0) > 10}
		<div class="mb-6">
			<SocialProofBanner
				totalActions={(template as any).verified_sends || template.metrics?.sent || 0}
				{topDistricts}
			/>
		</div>
	{/if}

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
						onclick={() =>
							modalActions.openModal('address-modal', 'address', {
								template,
								source,
								mode: 'collection',
								onComplete: async (detail: AddressModalDetail) => {
									await _handleAddressSubmit(detail.address);
								}
							})}
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
			onEmailModalClose={() => {
				/* Intentionally empty - modal close handled elsewhere */
			}}
			onScroll={() => {
				/* Intentionally empty - scroll handling not needed */
			}}
			expandToContent={true}
			onOpenModal={() => {
				const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;
				if (isMobile) {
					modalActions.openModal('mobile-preview', 'mobile_preview', { template, user: data.user });
				}
			}}
			onSendMessage={async () => {
				if (channel?.access_tier === 1) {
					const flow = analyzeEmailFlow(template, toEmailServiceUser(data.user));
					if (flow.nextAction === 'auth') {
						modalActions.openModal('onboarding-modal', 'onboarding', { template, source });
					} else if (flow.nextAction === 'address') {
						modalActions.openModal('address-modal', 'address', {
							template,
							source,
							mode: 'collection',
							onComplete: async (detail: AddressModalDetail) => {
								await _handleAddressSubmit(detail.address);
							}
						});
					} else if (flow.nextAction === 'email' && flow.mailtoUrl) {
						// Open TemplateModal using modalActions
						modalActions.openModal('template-modal', 'template_modal', {
							template,
							user: data.user
						});
					}
					return;
				}

				// For now, treat US or certified templates as existing path
				if (data.user && (channel?.country_code === 'US' || template.deliveryMethod === 'cwc')) {
					const flow = analyzeEmailFlow(template, toEmailServiceUser(data.user));

					// Check if we have a cached address from guestState (Cypherpunk flow)
					if (guestState.state?.address && flow.nextAction === 'address') {
						// We have the address locally! We can proceed to email generation
						// But we might need to verify it first or just pass it through.
						// For now, let's open the address modal in 'verify' mode or just skip to template modal
						// if we trust the cached address.

						// Better UX: Open address modal pre-filled? Or just use it?
						// "Securely cache the address so users don't constantly reenter it"
						// Let's pass it to the address modal to pre-fill/verify, OR just consider it done.

						// If we consider it done:
						modalActions.openModal('template-modal', 'template_modal', {
							template,
							user: { ...data.user, address: guestState.state.address } // Mock user with address
						});
						return;
					}

					if (flow.nextAction === 'address') {
						modalActions.openModal('address-modal', 'address', {
							template,
							source,
							mode: 'collection',
							onComplete: async (detail: AddressModalDetail) => {
								// Client-side caching only
								if (detail?.address) {
									guestState.setAddress(detail.address);
								}
								// No backend save here either

								// Proceed to template modal
								modalActions.openModal('template-modal', 'template_modal', {
									template,
									user: data.user
								});
							}
						});
					} else if (flow.nextAction === 'email' && flow.mailtoUrl) {
						// Open TemplateModal using modalActions
						modalActions.openModal('template-modal', 'template_modal', {
							template,
							user: data.user
						});
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
