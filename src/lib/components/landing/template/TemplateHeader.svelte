<script lang="ts">
	/// <reference types="@sveltejs/kit" />
	import { createEventDispatcher } from 'svelte';
	import { Send } from '@lucide/svelte';
	import type { Template } from '$lib/types/template';
	import type { SvelteComponent } from 'svelte';
	import Badge from '../../ui/Badge.svelte';
	import Button from '../../ui/Button.svelte';
	import { page } from '$app/stores';

	export let template: Template;
	export let user: { id: string; name: string } | null = null;
	
	const dispatch = createEventDispatcher<{
		useTemplate: { template: Template; requiresAuth: boolean };
	}>();

	// Always generate mailto link - route congressional templates through our domain
	$: mailtoLink = generateMailtoLink(template);

	function generateMailtoLink(template: Template): string {
		const subject = encodeURIComponent(template.title);

		let bodyForMailto = template.preview || '';

		// Remove any placeholder variables that are on their own lines (block)
		const blockRegex = new RegExp(`^[ \t]*\\[.*?\\][ \t]*\\r?\\n`, 'gm');
		bodyForMailto = bodyForMailto.replace(blockRegex, '');

		// Remove any remaining inline placeholder variables
		const inlineRegex = new RegExp(`\\[.*?\\]`, 'g');
		bodyForMailto = bodyForMailto.replace(inlineRegex, '');

		// Clean up any extra newlines that might result from empty variables
		bodyForMailto = bodyForMailto.replace(/\n{3,}/g, '\n\n').trim();

		const body = encodeURIComponent(bodyForMailto);

		if (template.deliveryMethod === 'both') {
			// Congressional templates: route through communique domain
			const routingEmail = generateCongressionalRoutingEmail(template);
			return `mailto:${routingEmail}?subject=${subject}&body=${body}`;
		} else {
			// Direct email templates: use recipient emails directly
			const recipients = template.recipientEmails?.join(',') || '';
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
	
	function handleUseTemplate() {
		// All templates now require auth for enhanced experience and tracking
		// Congressional templates need address, direct outreach needs profile/credentials
		const requiresAuth = !user;
		
		dispatch('useTemplate', { 
			template, 
			requiresAuth 
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
		
		<Button
			variant="primary"
			classNames="w-full sm:w-auto shrink-0 focus:ring-green-600/50"
			on:click={handleUseTemplate}
		>
			<span class="hidden sm:inline">
				{#if template.deliveryMethod === 'both'}
					Contact Congress
				{:else}
					{user ? 'Send Message' : 'Make Your Voice Heard'}
				{/if}
			</span>
			<span class="sm:hidden">
				{#if template.deliveryMethod === 'both'}
					Contact
				{:else}
					{user ? 'Send' : 'Speak Up'}
				{/if}
			</span>
			<Send class="ml-2 h-4 w-4" />
		</Button>
		
	</div>
</div>
