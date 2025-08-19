<script lang="ts">
	/// <reference types="@sveltejs/kit" />
	import { Send, Shield, AtSign } from '@lucide/svelte';
	import type { Template } from '$lib/types/template';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { page } from '$app/stores';
	import { analyzeEmailFlow } from '$lib/services/emailService';

	let { 
		template,
		user = null,
		onuseTemplate
	}: {
		template: Template;
		user?: { id: string; name: string } | null;
		onuseTemplate: (event: { template: Template; requiresAuth: boolean }) => void;
	} = $props();

	// Use unified email service to determine flow
	const emailFlow = $derived(analyzeEmailFlow(template, user));

	
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
		// Use unified email flow analysis
		onuseTemplate({ 
			template, 
			requiresAuth: emailFlow.requiresAuth
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
				<span>{(template.metrics?.sent || 0).toLocaleString()} sent</span>
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
