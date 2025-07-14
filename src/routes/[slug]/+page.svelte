<script lang="ts">
	import { page } from '$app/stores';
	import { ArrowLeft, Users, Clock, Eye, Share2, Copy, CheckCircle } from '@lucide/svelte';
	import TemplateHeader from '$lib/components/landing/template/TemplateHeader.svelte';
	import MessagePreview from '$lib/components/landing/template/MessagePreview.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import type { PageData } from './$types';
	
	export let data: PageData;
	
	let showCopied = false;
	let showShareMenu = false;
	
	$: template = data.template;
	$: shareUrl = `${$page.url.origin}/${template.slug}`;
	
	function copyLink() {
		navigator.clipboard.writeText(shareUrl);
		showCopied = true;
		setTimeout(() => showCopied = false, 2000);
	}
	
	function shareOnTwitter() {
		const text = `Join me in supporting "${template.title}" - make your voice heard!`;
		const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
		window.open(url, '_blank');
	}
	
	function shareOnFacebook() {
		const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
		window.open(url, '_blank');
	}
	
	function shareOnLinkedIn() {
		const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
		window.open(url, '_blank');
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

<div class="min-h-screen bg-gradient-to-b from-slate-50 to-white">
	<!-- Header -->
	<header class="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
		<div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
			<div class="flex items-center justify-between py-4">
				<a href="/" class="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors">
					<ArrowLeft class="h-4 w-4" />
					<span class="text-sm font-medium">All Templates</span>
				</a>
				
				<div class="flex items-center gap-3">
					<!-- Share button -->
					<div class="relative">
						<button
							on:click={() => showShareMenu = !showShareMenu}
							on:blur={() => setTimeout(() => showShareMenu = false, 200)}
							class="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
						>
							<Share2 class="h-4 w-4" />
							Share
						</button>
						
						{#if showShareMenu}
							<div class="absolute right-0 mt-2 w-48 rounded-lg border border-slate-200 bg-white shadow-lg">
								<button
									on:click={copyLink}
									class="flex w-full items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
								>
									{#if showCopied}
										<CheckCircle class="h-4 w-4 text-green-600" />
										<span>Copied!</span>
									{:else}
										<Copy class="h-4 w-4" />
										<span>Copy link</span>
									{/if}
								</button>
								<button
									on:click={shareOnTwitter}
									class="flex w-full items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
								>
									<span class="text-[#1DA1F2]">𝕏</span>
									<span>Share on X</span>
								</button>
								<button
									on:click={shareOnFacebook}
									class="flex w-full items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
								>
									<span class="text-[#1877F2]">f</span>
									<span>Share on Facebook</span>
								</button>
								<button
									on:click={shareOnLinkedIn}
									class="flex w-full items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
								>
									<span class="text-[#0A66C2]">in</span>
									<span>Share on LinkedIn</span>
								</button>
							</div>
						{/if}
					</div>
					
					{#if data.user}
						<span class="text-sm text-slate-600">Welcome back!</span>
					{:else}
						<Button href="/auth/login?returnTo=/{template.slug}" variant="primary" size="sm">
							Sign in to save
						</Button>
					{/if}
				</div>
			</div>
		</div>
	</header>
	
	<!-- Main Content -->
	<main class="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
		<!-- Campaign Header -->
		<div class="mb-8 text-center">
			<h1 class="mb-4 text-3xl font-bold text-slate-900 sm:text-4xl">{template.title}</h1>
			<p class="mx-auto max-w-2xl text-lg text-slate-600">{template.description}</p>
			
			<!-- Stats -->
			<div class="mt-6 flex items-center justify-center gap-6 text-sm text-slate-500">
				<div class="flex items-center gap-1.5">
					<Users class="h-4 w-4" />
					<span>{template.metrics.sent.toLocaleString()} supporters</span>
				</div>
				<div class="flex items-center gap-1.5">
					<Eye class="h-4 w-4" />
					<span>{(template.metrics.views || 0).toLocaleString()} views</span>
				</div>
				{#if template.author}
					<div class="flex items-center gap-1.5">
						<span>Created by {template.author.name}</span>
					</div>
				{/if}
			</div>
		</div>
		
		<!-- Template Card -->
		<div class="rounded-xl border border-slate-200 bg-white shadow-sm">
			<div class="p-6">
				<TemplateHeader {template} />
				<MessagePreview {template} />
			</div>
		</div>
		
		<!-- Call to Action -->
		<div class="mt-8 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-8 text-center">
			<h2 class="mb-3 text-xl font-semibold text-slate-900">Ready to make a difference?</h2>
			<p class="mb-6 text-slate-600">
				Click "Use Template" above to send your personalized message. Every voice matters!
			</p>
			
			{#if !data.user}
				<p class="text-sm text-slate-500">
					<a href="/auth/login" class="text-blue-600 hover:text-blue-700">Sign in</a> to track your impact and save templates
				</p>
			{/if}
		</div>
	</main>
</div>