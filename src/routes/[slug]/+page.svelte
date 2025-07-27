<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { Users, Eye } from '@lucide/svelte';
	import TemplatePreview from '$lib/components/landing/template/TemplatePreview.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import SmartAuthModal from '$lib/components/auth/SmartAuthModal.svelte';
	import SmartAddressModal from '$lib/components/auth/SmartAddressModal.svelte';
	import UnifiedModal from '$lib/components/ui/UnifiedModal.svelte';
	import { modalActions } from '$lib/stores/modalSystem';
	import { guestState } from '$lib/stores/guestState';
	import { extractRecipientEmails } from '$lib/types/templateConfig';
	import type { PageData } from './$types';
	
	let { data }: { data: PageData } = $props();
	
	// Modal system - centralized state management (refs not needed with new system)
	// Modal instances managed by modalSystem store
	
	let isUpdatingAddress = $state(false);
	
	const template = $derived(data.template);
	const authRequired = $derived($page.url.searchParams.get('auth') === 'required');
	const source = $derived(($page.url.searchParams.get('source') || 'direct-link') as 'social-link' | 'direct-link' | 'share');
	const shareUrl = $derived($page.url.href);
	
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
		const isCongressional = template.deliveryMethod === 'both';
		
		if (isCongressional && data.user && !data.user.address) {
			// Show loading modal while we launch mailto
			modalActions.open('email-loading', 'email_loading', null, { autoClose: 2000 });
			generateCongressionalEmail();
		} else if (isCongressional && data.user?.address) {
			// Congressional template with address - direct to action with loading modal
			modalActions.open('email-loading', 'email_loading', null, { autoClose: 2000 });
			generateCongressionalEmail();
		} else {
			// Direct email template - immediate mailto with loading modal
			modalActions.open('email-loading', 'email_loading', null, { autoClose: 2000 });
			generateDirectEmail();
		}
	}
	
	function generateCongressionalEmail() {
		// Generate congressional routing email
		const routingEmail = `congress+${template.id}-${data.user?.id}@communique.org`;
		const subject = encodeURIComponent(template.title);
		const body = encodeURIComponent(fillTemplateVariables(template.preview || ''));
		
		window.location.href = `mailto:${routingEmail}?subject=${subject}&body=${body}`;
	}
	
	function generateDirectEmail() {
		// Generate direct mailto link
		const recipients = extractRecipientEmails(template.recipient_config).join(',');
		const subject = encodeURIComponent(template.title);  
		const body = encodeURIComponent(fillTemplateVariables(template.preview || ''));
		
		window.location.href = `mailto:${recipients}?subject=${subject}&body=${body}`;
	}
	
	function fillTemplateVariables(bodyText: string): string {
		if (!data.user) return bodyText;
		
		let filledBody = bodyText;
		
		// Replace [Name] with user's name
		if (data.user.name) {
			filledBody = filledBody.replace(/\[Name\]/g, data.user.name);
		}
		
		// Replace [Address] with user's address if available
		if (data.user.street && data.user.city && data.user.state && data.user.zip) {
			const userAddress = `${data.user.street}, ${data.user.city}, ${data.user.state} ${data.user.zip}`;
			filledBody = filledBody.replace(/\[Address\]/g, userAddress);
		} else {
			// Remove lines that contain only [Address] 
			filledBody = filledBody.replace(/^[ \t]*\[Address\][ \t]*\r?\n/gm, '');
			// Remove remaining inline [Address] 
			filledBody = filledBody.replace(/\[Address\]/g, '');
		}
		
		// For congressional templates, [Representative Name] gets filled server-side
		// Remove [Representative Name] for now - server will fill it
		filledBody = filledBody.replace(/^[ \t]*\[Representative Name\][ \t]*\r?\n/gm, '');
		filledBody = filledBody.replace(/\[Representative Name\]/g, 'Representative');
		
		// Remove empty [Personal Connection] blocks and lines
		filledBody = filledBody.replace(/^[ \t]*\[Personal Connection\][ \t]*\r?\n/gm, '');
		filledBody = filledBody.replace(/\[Personal Connection\]/g, '');
		
		// Clean up any extra newlines that might result from empty variables
		filledBody = filledBody.replace(/\n{3,}/g, '\n\n').trim();
		
		return filledBody;
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
			generateCongressionalEmail();
			
		} catch (error) {
			// TODO: Show error toast to user
			// For now, still proceed with email generation
			modalActions.close('address-modal');
			generateCongressionalEmail();
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
					<span class="text-sm text-slate-600">
						Hi {data.user.name?.split(' ')[0]}! Ready to send
					</span>
				{/if}
				
				{#if template.deliveryMethod === 'both'}
					<Button 
						variant="primary" 
						size="lg"
						classNames="bg-green-600 hover:bg-green-700 focus:ring-green-600/50 w-full sm:w-auto"
						onclick={() => {
							if (data.user) {
								handlePostAuthFlow();
							} else {
								modalActions.open('auth-modal', 'auth', { template, source });
							}
						}}
					>
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 2.676-.732 5.162-2.217 7.162-4.416.43-.462.753-.96.938-1.49z"/>
						</svg>
						{data.user ? 'Contact Your Representatives' : 'Sign in to Contact Congress'}
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
								modalActions.open('auth-modal', 'auth', { template, source });
							}
						}}
					>
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"/>
						</svg>
						{data.user ? 'Send This Message' : 'Sign in to Send'}
					</Button>
				{/if}
			</div>
		</div>
		
		<!-- Template Preview -->
		<div class="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden min-h-[600px]">
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
					if (data.user) {
						handlePostAuthFlow();
					} else {
						modalActions.open('auth-modal', 'auth', { template, source });
					}
				}}
			/>
		</div>
		
</div>

<!-- Smart Cognitive Flow Modals - Now managed by modalSystem -->
<!-- UnifiedModal handles all modal display based on modalSystem state -->


<!-- All modals now managed by UnifiedModal system -->