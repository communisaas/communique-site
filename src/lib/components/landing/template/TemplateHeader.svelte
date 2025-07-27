<script lang="ts">
	/// <reference types="@sveltejs/kit" />
	import { Send, Shield, AtSign } from '@lucide/svelte';
	import type { Template } from '$lib/types/template';
	import { extractRecipientEmails } from '$lib/types/templateConfig';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { page } from '$app/stores';

	let { 
		template,
		user = null,
		onuseTemplate
	}: {
		template: Template;
		user?: { id: string; name: string } | null;
		onuseTemplate: (event: { template: Template; requiresAuth: boolean }) => void;
	} = $props();

	// Always generate mailto link - route congressional templates through our domain
	const mailtoLink = $derived(generateMailtoLink(template));

	function generateMailtoLink(template: Template): string {
		const subject = encodeURIComponent(template.title);

		let bodyForMailto = template.preview || '';
		
		// Get user from page data if available (authenticated user)
		const currentUser = $page.data?.user;

		// If user is authenticated, auto-fill their variables
		if (currentUser) {
			// Replace [Name] with user's name
			bodyForMailto = bodyForMailto.replace(/\[Name\]/g, currentUser.name || 'Your Name');
			
			// Replace [Address] with user's address if available, otherwise remove the line
			if (currentUser.street && currentUser.city && currentUser.state && currentUser.zip) {
				const userAddress = `${currentUser.street}, ${currentUser.city}, ${currentUser.state} ${currentUser.zip}`;
				bodyForMailto = bodyForMailto.replace(/\[Address\]/g, userAddress);
			} else {
				// Remove lines that contain only [Address] 
				bodyForMailto = bodyForMailto.replace(/^[ \t]*\[Address\][ \t]*\r?\n/gm, '');
				// Remove remaining inline [Address] 
				bodyForMailto = bodyForMailto.replace(/\[Address\]/g, '');
			}
			
			// Remove [Representative Name] - this gets filled server-side or remove if empty
			bodyForMailto = bodyForMailto.replace(/^[ \t]*\[Representative Name\][ \t]*\r?\n/gm, '');
			bodyForMailto = bodyForMailto.replace(/\[Representative Name\]/g, 'Representative');
			
			// Remove empty [Personal Connection] blocks and lines
			bodyForMailto = bodyForMailto.replace(/^[ \t]*\[Personal Connection\][ \t]*\r?\n/gm, '');
			bodyForMailto = bodyForMailto.replace(/\[Personal Connection\]/g, '');
		} else {
			// For unauthenticated users, remove all variables and their lines
			const blockRegex = new RegExp(`^[ \t]*\\[.*?\\][ \t]*\\r?\\n`, 'gm');
			bodyForMailto = bodyForMailto.replace(blockRegex, '');
			const inlineRegex = new RegExp(`\\[.*?\\]`, 'g');
			bodyForMailto = bodyForMailto.replace(inlineRegex, '');
		}

		// Clean up any extra newlines that might result from empty variables
		bodyForMailto = bodyForMailto.replace(/\n{3,}/g, '\n\n').trim();

		const body = encodeURIComponent(bodyForMailto);

		if (template.deliveryMethod === 'both') {
			// Congressional templates: route through communique domain
			const routingEmail = generateCongressionalRoutingEmail(template);
			return `mailto:${routingEmail}?subject=${subject}&body=${body}`;
		} else {
			// Direct email templates: use recipient emails directly
			const recipients = extractRecipientEmails(template.recipient_config).join(',');
			return `mailto:${recipients}?subject=${subject}&body=${body}`;
		}
	}

	function generateCongressionalRoutingEmail(template: Template): string {
		// Get user from page data if available (authenticated user)
		const user = $page.data?.user;

		if (user?.id) {
			// Authenticated user: congress+{templateId}-{userId}@communique.org
			return `congress+${template.id}-${user.id}@communique.org`;
		} else {
			// Anonymous user: Use session-based routing or trigger onboarding
			// Format: congress+guest-{templateId}-{sessionToken}@communique.org
			const sessionToken = generateGuestSessionToken();
			return `congress+guest-${template.id}-${sessionToken}@communique.org`;
		}
	}

	function generateGuestSessionToken(): string {
		// Generate a temporary session identifier for anonymous users
		// This will be used to track the request and trigger account creation flow
		const timestamp = Date.now().toString(36);
		const random = Math.random().toString(36).substring(2, 8);
		return `${timestamp}-${random}`;
	}
	
	// Smart CTA configuration based on template type and user state
	const ctaConfig = $derived(() => {
		const isCongressional = template.deliveryMethod === 'both';
		
		if (isCongressional) {
			return {
				icon: Shield,
				colors: 'bg-green-600 hover:bg-green-700 focus:ring-green-600/50',
				desktop: user ? 'Contact Your Representatives' : 'Sign in to Contact Congress',
				mobile: user ? 'Contact' : 'Sign in',
				subtitle: user ? 'Ready to send' : null
			};
		} else {
			return {
				icon: AtSign,
				colors: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-600/50',
				desktop: user ? 'Send This Message' : 'Sign in to Send',
				mobile: user ? 'Send' : 'Sign in',
				subtitle: user ? 'Ready to send' : null
			};
		}
	});

	function handleUseTemplate() {
		// Always dispatch to show the smart modal flow
		onuseTemplate({ 
			template, 
			requiresAuth: !user,
			mailtoLink: user ? mailtoLink : null
		});
	}
</script>

<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
	<div class="min-w-0 flex-1">
		<h2 class="mb-2 truncate text-lg font-semibold text-slate-900 sm:text-xl">
			{template.title}
		</h2>
		<div class="flex flex-wrap items-center gap-2 sm:gap-4">
			<span class="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 sm:text-sm">
				{template.category}
			</span>
			<Badge type={template.deliveryMethod === 'both' ? 'certified' : 'direct'} />
			<div class="flex items-center gap-1.5 text-xs text-slate-500 sm:text-sm">
				<Send class="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
				<span>{template.metrics.sent.toLocaleString()} sent</span>
			</div>
		</div>
	</div>
	<div class="flex items-center gap-3">
		{#if user}
			<span class="hidden sm:block text-sm text-slate-600">
				Hi {user.name?.split(' ')[0]}!
			</span>
		{/if}
		
		<div class="flex flex-col items-end gap-2">
			{#if ctaConfig.subtitle}
				<span class="hidden sm:block text-xs text-slate-500">
					{ctaConfig.subtitle}
				</span>
			{/if}
			
			<Button
				variant="primary"
				classNames="w-full sm:w-auto shrink-0 {ctaConfig.colors}"
				onclick={handleUseTemplate}
			>
				<ctaConfig.icon class="h-4 w-4" />
				
				<span class="hidden sm:inline">
					{ctaConfig.desktop}
				</span>
				<span class="sm:hidden">
					{ctaConfig.mobile}
				</span>
			</Button>
		</div>
		
	</div>
</div>
