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
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Simple modal state
	let showAuthModal = $state(false);
	let isUpdatingAddress = $state(false);

	const template = $derived(data.template);
	const authRequired = $derived($page.url.searchParams.get('auth') === 'required');
	const source = $derived(
		($page.url.searchParams.get('source') || 'direct-link') as
			| 'social-link'
			| 'direct-link'
			| 'share'
	);
	const shareUrl = $derived($page.url.href);

	// Check if user has complete address for congressional templates
	const hasCompleteAddress = $derived(
		data.user && data.user.street && data.user.city && data.user.state && data.user.zip
	);
	const isCongressional = $derived(template.deliveryMethod === 'both');
	const addressRequired = $derived(isCongressional && !hasCompleteAddress);

	onMount(() => {
		// Store template context for guest users
		if (!data.user) {
			guestState.setTemplate(template.slug, template.title, source);
		}

		// Smart post-auth flow detection
		const actionParam = $page.url.searchParams.get('action');
		if (actionParam === 'complete' && data.user) {
			// User just completed auth, check what they need next
			handlePostAuthFlow();
		} else if (authRequired && !data.user) {
			// Show smart auth modal for unauthenticated users
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
			setTimeout(() => launchEmail(flow.mailtoUrl!), 100);
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
				setTimeout(() => launchEmail(flow.mailtoUrl!), 100);
			}
		} catch (error) {
			// TODO: Show error toast to user
			// For now, still proceed with email generation
			modalActions.close('address-modal');
			const flow = analyzeEmailFlow(template, data.user);
			if (flow.mailtoUrl) {
				modalActions.open('email-loading', 'email_loading', null, { autoClose: 1500 });
				setTimeout(() => launchEmail(flow.mailtoUrl!), 100);
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
						<VerificationBadge size="xs" showText={false} />
						<span>Enhanced Credibility</span>
					</div>
				{/if}
				<div class="flex items-center gap-6 text-sm text-slate-500">
					<div class="flex items-center gap-1.5">
						<Users class="h-4 w-4" />
						<span>{template.metrics.sent.toLocaleString()} supporters</span>
					</div>
					<div class="flex items-center gap-1.5">
						<Eye class="h-4 w-4" />
						<span>{(template.metrics.views || 0).toLocaleString()} views</span>
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
						<VerificationBadge size="xs" />
					{/if}
				</div>
			{/if}

			{#if template.deliveryMethod === 'both'}
				<Button
					variant="primary"
					size="lg"
					classNames="bg-green-600 hover:bg-green-700 focus:ring-green-600/50 w-full sm:w-auto"
					onclick={() => {
						if (!data.user) {
							showAuthModal = true;
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
					size="lg"
					classNames="bg-blue-600 hover:bg-blue-700 focus:ring-blue-600/50 w-full sm:w-auto"
					onclick={() => {
						if (data.user) {
							handlePostAuthFlow();
						} else {
							showAuthModal = true;
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
					{data.user ? 'Send This Message' : 'Sign in to Send'}
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
						size="sm"
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
			user={data.user}
			onScroll={() => {}}
			onOpenModal={() => {
				const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;
				if (isMobile) {
					modalActions.open('mobile-preview', 'mobile_preview', { template, user: data.user });
				}
			}}
			onSendMessage={() => {
				const flow = analyzeEmailFlow(template, data.user);
				
				if (flow.nextAction === 'auth') {
					showAuthModal = true;
				} else if (flow.nextAction === 'address') {
					modalActions.open('address-modal', 'address', { template, source });
				} else if (flow.nextAction === 'email' && flow.mailtoUrl) {
					modalActions.open('email-loading', 'email_loading', null, { autoClose: 1500 });
					setTimeout(() => launchEmail(flow.mailtoUrl!), 100);
				}
			}}
		/>
	</div>
</div>

<!-- Simple Auth Modal -->
<SimpleAuthModal isOpen={showAuthModal} onClose={() => (showAuthModal = false)} {template} />
