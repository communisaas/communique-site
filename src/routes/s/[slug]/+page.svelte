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
	import { analyzeEmailFlow, generatePersonalizedMailto } from '$lib/services/emailService';
	import { resolveTemplate } from '$lib/utils/templateResolver';
	import { trackTemplateView, trackDeliveryAttempt } from '$lib/core/analytics/client';
	import ShareButton from '$lib/components/ui/ShareButton.svelte';
	import ActionBar from '$lib/components/template-browser/parts/ActionBar.svelte';
	import TrustJourney from '$lib/components/trust/TrustJourney.svelte';
	import DebateSurface from '$lib/components/debate/DebateSurface.svelte';
	import DebateSignal from '$lib/components/debate/DebateSignal.svelte';
	import MobileDebateBanner from '$lib/components/debate/MobileDebateBanner.svelte';
	import type { DebateData } from '$lib/stores/debateState.svelte';
	import StanceRegistration from '$lib/components/action/StanceRegistration.svelte';
	import PowerLandscape from '$lib/components/action/PowerLandscape.svelte';
	import { positionState } from '$lib/stores/positionState.svelte';
	import { mergeLandscape, type LandscapeMember, type DistrictOfficialInput } from '$lib/utils/landscapeMerge';
	import type { ProcessedDecisionMaker } from '$lib/types/template';

	import { spring } from 'svelte/motion';
	import { browser } from '$app/environment';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import type { Template as TemplateType } from '$lib/types/template';
	import { FEATURES } from '$lib/config/features';

	let { data }: { data: PageData } = $props();

	// Simple modal state
	let _isUpdatingAddress = $state(false);

	// ActionBar state
	let personalConnectionValue = $state('');
	let actionProgress = $state(spring(0));

	// Template modal reference

	const template: TemplateType = $derived(data.template as unknown as TemplateType);
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
		const sent = template.metrics?.sent || 0;
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
	const isCongressional = $derived(
		FEATURES.CONGRESSIONAL && (
			template.deliveryMethod === 'cwc' ||
			!!(data as unknown as PowerLandscapeData).recipientConfig?.cwcRouting
		)
	);
	const addressRequired = $derived(
		FEATURES.ADDRESS_VERIFICATION && isCongressional && !hasCompleteAddress && (data.user?.trust_tier ?? 0) < 2
	);

	// Debate resolution signal for message preview banner
	const debateResolution = $derived(
		FEATURES.DEBATE && data.debate && (data.debate as DebateData).status === 'resolved' && (data.debate as DebateData).winningStance
			? {
					winningStance: (data.debate as DebateData).winningStance as string,
					participants: (data.debate as DebateData).uniqueParticipants
				}
			: null
	);

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
		const trustTier = data.user?.trust_tier ?? 0;

		// CWC templates: TemplateModal handles tier-based routing in onMount
		// (trust-upgrade for Tier 1-2, ZKP flow for Tier 3+)
		// Skip address gate — it shows the old NFC/Gov ID modal which is wrong here
		if (FEATURES.CONGRESSIONAL && template.deliveryMethod === 'cwc' && data.user) {
			modalActions.openModal('template-modal', 'template_modal', { template, user: data.user });
			return;
		}

		// Tier 2+ already verified — skip address gate entirely
		// guestState address also counts (Cypherpunk: no PII on User model)
		if (trustTier >= 2 || guestState.state?.address) {
			modalActions.openModal('template-modal', 'template_modal', { template, user: data.user });
			return;
		}

		const flow = analyzeEmailFlow(template, data.user, { trustTier });

		if (flow.nextAction === 'address') {
			// Need address collection (non-CWC templates only)
			modalActions.openModal('address-modal', 'address', {
				template,
				source,
				mode: 'collection',
				onComplete: async (detail: AddressModalDetail) => {
					await _handleAddressSubmit(detail.address);
				}
			});
		} else {
			// Ready to send (or any other state) — open template modal
			modalActions.openModal('template-modal', 'template_modal', { template, user: data.user });
		}
	}

	// === Power Landscape state ===

	// Access server data with proper types (PageData doesn't include PL fields yet)
	interface PowerLandscapeData {
		positionCounts?: { support: number; oppose: number; districts: number };
		existingPosition?: { stance: string; registrationId: string } | null;
		deliveredRecipients?: string[];
		districtOfficials?: DistrictOfficialInput[];
		recipientConfig?: { decisionMakers?: ProcessedDecisionMaker[]; personalPrompt?: string; cwcRouting?: boolean };
	}
	const pl = $derived(data as unknown as PowerLandscapeData);

	// Landscape computation
	const landscape = $derived(
		mergeLandscape(
			pl.recipientConfig?.decisionMakers ?? [],
			pl.districtOfficials ?? []
		)
	);

	// Identity commitment for position registration
	const identityCommitment = $derived(
		data.user?.identity_commitment ?? (data.user ? `demo-${data.user.id}` : null)
	);

	// UI state
	let landscapeRevealed = $state(false);
	let contactedRecipients = $state(new Set<string>());
	let departingRecipients = $state(new Set<string>());
	let batchRegistrationState = $state<'idle' | 'registering' | 'complete'>('idle');

	// Mail app handoff detection — settle departing cards when user returns
	$effect(() => {
		if (departingRecipients.size === 0 || !browser) return;

		const settle = () => {
			if (departingRecipients.size > 0) {
				departingRecipients = new Set();
			}
		};

		const onFocus = () => settle();
		const onVisible = () => { if (!document.hidden) settle(); };

		window.addEventListener('focus', onFocus);
		document.addEventListener('visibilitychange', onVisible);
		const timer = setTimeout(settle, 3000);

		return () => {
			window.removeEventListener('focus', onFocus);
			document.removeEventListener('visibilitychange', onVisible);
			clearTimeout(timer);
		};
	});

	// Initialize positionState from server data on template change
	$effect(() => {
		const tmplId = template.id;
		const existing = pl.existingPosition ?? null;
		const counts = pl.positionCounts;

		if (!FEATURES.STANCE_POSITIONS) {
			// No stance gate — show decision-makers immediately
			landscapeRevealed = true;
		} else if (existing) {
			// Returning user — restore registered state, skip stance buttons
			positionState.restore(
				tmplId,
				existing.stance as 'support' | 'oppose',
				existing.registrationId,
				counts ?? { support: 0, oppose: 0, districts: 0 }
			);
			landscapeRevealed = true;
		} else {
			positionState.init(tmplId, counts);
			landscapeRevealed = false;
		}

		// Restore sent recipients from delivery records
		contactedRecipients = new Set(pl.deliveredRecipients ?? []);
	});

	function handleRegistered(_stance: 'support' | 'oppose') {
		landscapeRevealed = true;
	}

	function handleWriteTo(member: LandscapeMember) {
		if (member.deliveryRoute === 'cwc') {
			// Congressional officials: route through existing CWC modal infrastructure
			// TemplateModal handles tier-based routing (mailto for T1-2, ZKP for T3+)
			modalActions.openModal('template-modal', 'template_modal', {
				template,
				user: data.user
			});
		} else if (member.deliveryRoute === 'email' && member.email) {
			// Direct mailto — opener + resolved template body, no intermediate compose view
			const districtName = data.userDistrictCode ?? '';
			const subject = template.subject
				? `[${template.slug}] ${template.subject}`
				: `[${template.slug}] ${template.title}`;

			const trustTier = data.user?.trust_tier ?? 0;
			const attestation = trustTier >= 2
				? `Verified resident, ${districtName}\nCryptographic proof of residency`
				: undefined;

			// Resolve all template placeholders ([Name], [Representative], [Personal Connection], etc.)
			const resolved = resolveTemplate(template as any, data.user as any ?? null);
			const resolvedBody = resolved.body.replace(/\[District\]/g, districtName);

			const result = generatePersonalizedMailto({
				recipient: {
					name: member.name,
					email: member.email,
					title: member.title,
					organization: member.organization
				},
				subject,
				opener: member.accountabilityOpener ?? '',
				templateBody: resolvedBody,
				attestation
			});

			if ('url' in result) {
				// Measurement before action — the click is the outreach event
				contactedRecipients = new Set([...contactedRecipients, member.id]);
				departingRecipients = new Set([...departingRecipients, member.id]);
				trackDeliveryAttempt(template.id, 'email');

				// Persist outreach record (fire-and-forget)
				if (positionState.registrationId) {
					fetch('/api/positions/batch-register', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							registrationId: positionState.registrationId,
							recipients: [{
								name: member.name,
								email: member.email,
								deliveryMethod: 'email'
							}]
						}),
						keepalive: true
					}).catch(() => {}); // Fire-and-forget — UI already updated
				}

				window.location.href = result.url;
			}
		} else if (member.deliveryRoute === 'form' && member.contactFormUrl) {
			// Web contact form: open in new tab
			window.open(member.contactFormUrl, '_blank', 'noopener,noreferrer');
		}
	}

	async function handleBatchRegister(memberIds: string[]) {
		if (!positionState.registrationId || batchRegistrationState === 'registering') return;
		batchRegistrationState = 'registering';

		const allMembers = [
			...landscape.roleGroups.flatMap((g) => g.members),
			...(landscape.districtGroup?.members ?? [])
		];

		const members = memberIds
			.map((id) => allMembers.find((m) => m.id === id))
			.filter((m): m is LandscapeMember => m != null);

		// Build single mailto with all email-bearing members in To:
		const emailMembers = members.filter(m => m.email && m.deliveryRoute === 'email');
		if (emailMembers.length > 0) {
			const districtName = data.userDistrictCode ?? '';
			const subject = template.subject
				? `[${template.slug}] ${template.subject}`
				: `[${template.slug}] ${template.title}`;

			const trustTier = data.user?.trust_tier ?? 0;
			const attestation = trustTier >= 2
				? `Verified resident, ${districtName}\nCryptographic proof of residency`
				: undefined;

			// Resolve all template placeholders ([Name], [Representative], [Personal Connection], etc.)
			const resolved = resolveTemplate(template as any, data.user as any ?? null);
			const resolvedBody = resolved.body.replace(/\[District\]/g, districtName).trim();

			const bodyParts: string[] = [];
			if (resolvedBody) bodyParts.push(resolvedBody);
			if (attestation?.trim()) {
				bodyParts.push('---');
				bodyParts.push(attestation.trim());
			}

			const emails = emailMembers.map(m => m.email!).join(',');
			const url = `mailto:${encodeURIComponent(emails)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyParts.join('\n\n'))}`;

			if (url.length <= 8000) {
				departingRecipients = new Set([...departingRecipients, ...emailMembers.map(m => m.id)]);
				trackDeliveryAttempt(template.id, 'email');
				window.location.href = url;
			}
		}

		// Persist delivery records for ALL members (fire-and-forget for mailto, blocking for state)
		const recipients = members.map((m) => ({
			name: m.name,
			email: m.email ?? undefined,
			deliveryMethod: m.deliveryRoute === 'cwc' ? 'cwc' : m.deliveryRoute === 'email' ? 'email' : 'recorded'
		}));

		try {
			const res = await fetch('/api/positions/batch-register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					registrationId: positionState.registrationId,
					recipients
				})
			});

			if (res.ok) {
				contactedRecipients = new Set([...contactedRecipients, ...memberIds]);
				batchRegistrationState = 'complete';
			} else {
				batchRegistrationState = 'idle';
			}
		} catch {
			batchRegistrationState = 'idle';
		}
	}

	async function _handleAddressSubmit(address: string) {
		try {
			_isUpdatingAddress = true;

			// Cache address locally (Cypherpunk: no PII on User model)
			guestState.setAddress(address);

			// Bump trust_tier to 2 (Constituent) on the server
			// Production: mDL Digital Credentials API does this via callback
			// Demo: explicit endpoint
			if (data.user) {
				await fetch('/demo/verify-address', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ address })
				});
			}

			// Close address modal and proceed to template modal
			modalActions.closeModal('address-modal');
			modalActions.openModal('template-modal', 'template_modal', {
				template,
				user: data.user
			});

			// Refresh page data so trust tier updates everywhere
			await invalidateAll();
		} catch (error) {
			console.error('[TemplateFlow] Error in _handleAddressSubmit:', error);
			// Proceed anyway — address is cached locally
			modalActions.closeModal('address-modal');
			modalActions.openModal('template-modal', 'template_modal', { template, user: data.user });
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

<!-- Template content with zoned layout: Orient → Commit → Act -->
<div class="py-6 overflow-x-hidden">
	<!-- ORIENT: Template header (single column, clean context) -->
	<div class="mb-2">
		<h1 class="mb-3 text-3xl font-bold text-slate-900 sm:text-4xl">
			{template.title}
		</h1>
		<p class="mb-4 text-lg text-slate-600">{template.description}</p>

		<!-- Template metadata -->
		<div class="flex flex-wrap items-center gap-3">
			<Badge variant={isCongressional ? 'congressional' : 'direct'}>
				{isCongressional ? 'Congressional Delivery' : 'Direct Outreach'}
			</Badge>
			<span class="rounded bg-slate-100 px-2 py-1 text-sm text-slate-600">
				{template.category}
			</span>
			{#if FEATURES.CONGRESSIONAL && (data.user?.trust_tier ?? 0) >= 2 && template.deliveryMethod === 'cwc'}
				<div class="flex items-center gap-1 rounded bg-green-50 px-2 py-1 text-sm text-green-700">
					<VerificationBadge showText={false} />
					<span>Enhanced Credibility</span>
				</div>
			{/if}
			<div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500">
				<div class="flex items-center gap-1.5">
					<Users class="h-4 w-4" />
					<span>{(template.metrics?.sent || 0).toLocaleString()} sent this</span>
				</div>
				<div class="flex items-center gap-1.5">
					<Eye class="h-4 w-4" />
					<span>{(template.metrics?.views || 0).toLocaleString()} views</span>
				</div>
				<ShareButton url={shareUrl} _title={template.title} variant="secondary" size="sm" />
			</div>
		</div>
	</div>

	<!-- COMMIT: Stance registration / action — the page's experiential pivot -->
	{#if FEATURES.STANCE_POSITIONS}
		<div class="border-y border-slate-200/80 py-4 my-6">
			<!-- Debate signal — contextualizes the support/oppose decision -->
			{#if FEATURES.DEBATE}
				<DebateSignal debate={(data.debate as DebateData) ?? null} variant="inline" />
			{/if}

			{#if data.user && identityCommitment}
				<!-- Authenticated: real stance registration -->
				<StanceRegistration
					templateId={template.id}
					{identityCommitment}
					districtCode={data.userDistrictCode ?? undefined}
					onRegistered={handleRegistered}
					recipientCount={landscape.totalCount}
					{isCongressional}
				/>
			{:else}
				<!-- Guest / no identity: stance-first framing that routes to auth -->
				{@const rcLabel = landscape.totalCount > 0
					? isCongressional
						? landscape.totalCount === 1 ? '1 representative' : `${landscape.totalCount} representatives`
						: landscape.totalCount === 1 ? '1 decision-maker' : `${landscape.totalCount} decision-makers`
					: isCongressional
						? 'your representatives'
						: 'decision-makers'}
				<div class="space-y-3">
					<p class="flex items-center gap-1.5 text-sm text-slate-600">
						<span>Contact {rcLabel}</span>
						<span class="text-slate-400">&rarr;</span>
						<span class="text-slate-500">first, where do you stand?</span>
					</p>
					<div class="flex flex-wrap items-center gap-3">
						<button
							class="flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-participation-primary-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-participation-primary-700 sm:flex-none"
							onclick={() => {
								if (!data.user) {
									modalActions.openModal('template-modal', 'template_modal', { template, user: null });
								} else {
									handlePostAuthFlow();
								}
							}}
						>
							I support this
						</button>
						<button
							class="flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 sm:flex-none"
							onclick={() => {
								if (!data.user) {
									modalActions.openModal('template-modal', 'template_modal', { template, user: null });
								} else {
									handlePostAuthFlow();
								}
							}}
						>
							I oppose this
						</button>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- ACT: Two-column field — message left, action space right -->
	<div class="lg:grid lg:grid-cols-[3fr_2fr] lg:gap-8 lg:items-start overflow-hidden">
		<!-- LEFT: Message preview — flows naturally with page scroll -->
		<div class="min-w-0">
			<div class="rounded-xl border border-slate-200 bg-white shadow-sm">
				{#if addressRequired && !landscapeRevealed}
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
					user={data.user as { id: string; name: string | null; trust_tier?: number } | null}
					showEmailModal={false}
					{debateResolution}
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
						if (!data.user) {
							// Guest: straight to template modal (mailto relay)
							modalActions.openModal('template-modal', 'template_modal', { template, user: null });
							return;
						}

						// Authenticated user: use unified post-auth flow
						// (checks trust_tier/guestState before address gate)
						handlePostAuthFlow();
					}}
				/>
			</div>
		</div>

		<!-- RIGHT: Signal strength + Power Landscape + Deliberation -->
		<div class="mt-8 lg:mt-0 space-y-8 min-w-0">
			<!-- Trust Journey — signal strength contextualizes the action space below -->
			{#if FEATURES.STANCE_POSITIONS && data.user}
				<TrustJourney
					trustTier={data.user.trust_tier ?? 1}
					onVerifyAddress={FEATURES.ADDRESS_VERIFICATION ? () => {
						modalActions.openModal('address-modal', 'address', {
							template,
							source,
							mode: 'collection',
							onComplete: async (detail: AddressModalDetail) => {
								guestState.setAddress(detail.address);
								await fetch('/demo/verify-address', {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({ address: detail.address })
								});
								modalActions.closeModal('address-modal');
								await invalidateAll();
							}
						});
					} : undefined}
					onVerifyIdentity={async () => {
						const res = await fetch('/demo/verify-identity', { method: 'POST' });
						const result = await res.json();
						if (result.identity_commitment && data.user?.id) {
							try {
								const { bootstrapDemoCredential } = await import('$lib/core/demo/bootstrap-credential');
								await bootstrapDemoCredential(data.user.id, result.identity_commitment);
							} catch (e) {
								console.error('[Demo] Credential bootstrap failed:', e);
							}
						}
						await invalidateAll();
					}}
					onGenerateProof={FEATURES.CONGRESSIONAL ? () => {
						modalActions.openModal('template-modal', 'template_modal', {
							template,
							user: data.user,
							initialState: 'cwc-submission'
						});
					} : undefined}
				/>
			{/if}

			<!-- Power Landscape: visible after position registration -->
			{#if landscapeRevealed}
				<PowerLandscape
					{template}
					decisionMakers={pl.recipientConfig?.decisionMakers ?? []}
					districtOfficials={pl.districtOfficials ?? []}
					{contactedRecipients}
					{departingRecipients}
					onWriteTo={handleWriteTo}
					onBatchRegister={handleBatchRegister}
					{isCongressional}
					onVerifyAddress={addressRequired ? () => {
						modalActions.openModal('address-modal', 'address', {
							template,
							source,
							mode: 'collection',
							onComplete: async (detail: AddressModalDetail) => {
								await _handleAddressSubmit(detail.address);
							}
						});
					} : undefined}
					registrationState={batchRegistrationState}
				/>
			{/if}

			<!-- Debate surface -->
			{#if FEATURES.DEBATE}
				<DebateSurface
					debate={(data.debate as DebateData) ?? null}
					userTrustTier={data.user?.trust_tier ?? 0}
					onInitiateDebate={() => {
						modalActions.openModal('debate-modal', 'debate', {
							template,
							user: data.user,
							mode: 'initiate'
						});
					}}
					onParticipate={() => {
						modalActions.openModal('debate-modal', 'debate', {
							template,
							user: data.user,
							debate: data.debate,
							mode: 'participate'
						});
					}}
					onCoSign={(argumentIndex) => {
						modalActions.openModal('debate-modal', 'debate', {
							template,
							user: data.user,
							debate: data.debate,
							mode: 'cosign',
							cosignArgumentIndex: argumentIndex
						});
					}}
					onVerifyIdentity={async () => {
						if (data.user?.trust_tier != null && data.user.trust_tier < 2) {
							// Tier 0-1: need address first
							modalActions.openModal('address-modal', 'address', {
								template,
								user: data.user,
								context: 'debate'
							});
						} else {
							// Tier 2: identity verification
							const res = await fetch('/demo/verify-identity', { method: 'POST' });
							const result = await res.json();
							if (result.identity_commitment && data.user?.id) {
								try {
									const { bootstrapDemoCredential } = await import('$lib/core/demo/bootstrap-credential');
									await bootstrapDemoCredential(data.user.id, result.identity_commitment);
								} catch (e) {
									console.error('[Demo] Credential bootstrap failed:', e);
								}
							}
							await invalidateAll();
						}
					}}
				/>
			{/if}
		</div>
	</div>
</div>

<!-- Mobile debate awareness — sticky banner below lg: breakpoint -->
{#if FEATURES.DEBATE}
	<MobileDebateBanner debate={(data.debate as DebateData) ?? null} />
{/if}
