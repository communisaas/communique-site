<script lang="ts">
	import '../../app.css';
	import { page } from '$app/stores';
	import { ArrowLeft, Share2, Copy, CheckCircle, LogOut, User } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import ErrorBoundary from '$lib/components/error/ErrorBoundary.svelte';
	import { coordinated } from '$lib/utils/timerCoordinator';
	
	let { children, data } = $props();
	
	let showCopied = $state(false);
	let showShareMenu = $state(false);
	
	const shareUrl = $derived($page.url.href);
	const template = $derived(data.template);
	
	const componentId = 'TemplateLayout_' + Math.random().toString(36).substr(2, 9);
	
	function copyLink() {
		navigator.clipboard.writeText(shareUrl);
		showCopied = true;
		coordinated.setTimeout(() => showCopied = false, 2000, 'feedback', componentId);
	}
	
	function shareOnSocial(platform: 'twitter' | 'facebook' | 'linkedin') {
		const text = `Check out "${template?.title}" on Communiqué - make your voice heard!`;
		const encodedUrl = encodeURIComponent(shareUrl);
		const encodedText = encodeURIComponent(text);
		
		const urls = {
			twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
			facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
			linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
		};
		
		window.open(urls[platform], '_blank');
		showShareMenu = false;
	}
</script>

<!-- Full-screen template layout with integrated header -->
<div class="min-h-screen bg-gradient-to-b from-slate-50 to-white">
	<!-- Integrated Header - single clean header for templates -->
	<header class="border-b border-slate-200 bg-white/90 backdrop-blur-sm sticky top-0 z-20">
		<div class="mx-auto max-w-4xl px-4 sm:px-6">
			<div class="flex items-center justify-between py-3">
				<!-- Left: Back navigation -->
				<a 
					href="/" 
					class="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors group"
				>
					<ArrowLeft class="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
					<span class="text-sm font-medium">All Templates</span>
				</a>
				
				<!-- Right: User + Share -->
				<div class="flex items-center gap-3">
					<!-- User status (compact) -->
					{#if data.user}
						<div class="flex items-center gap-2 text-xs text-slate-600">
							<User class="h-3 w-3 text-green-600" />
							<span class="hidden sm:inline">Hi {data.user.name?.split(' ')[0]}!</span>
							<a 
								href="/auth/logout" 
								class="text-slate-400 hover:text-slate-600 transition-colors ml-1"
								title="Sign out"
							>
								<LogOut class="h-3 w-3" />
							</a>
						</div>
					{:else}
						<div class="text-xs text-slate-500">
							<span class="hidden sm:inline">Not signed in</span>
						</div>
					{/if}
					
					<!-- Share dropdown -->
					<div class="relative">
						<button
							onclick={() => showShareMenu = !showShareMenu}
							class="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-all"
						>
							<Share2 class="h-3 w-3" />
							<span class="hidden sm:inline">Share</span>
						</button>
						
						{#if showShareMenu}
							<div class="absolute right-0 mt-1 w-44 rounded-lg border border-slate-200 bg-white shadow-lg py-1 z-10">
								<button
									onclick={copyLink}
									class="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
								>
									{#if showCopied}
										<CheckCircle class="h-3 w-3 text-green-600" />
										<span class="text-green-600">Copied!</span>
									{:else}
										<Copy class="h-3 w-3" />
										<span>Copy link</span>
									{/if}
								</button>
								<button
									onclick={() => shareOnSocial('twitter')}
									class="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
								>
									<span class="text-black font-bold">𝕏</span>
									<span>Share on X</span>
								</button>
								<button
									onclick={() => shareOnSocial('facebook')}
									class="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
								>
									<span class="text-[#1877F2] font-bold">f</span>
									<span>Share on Facebook</span>
								</button>
								<button
									onclick={() => shareOnSocial('linkedin')}
									class="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
								>
									<span class="text-[#0A66C2] font-bold">in</span>
									<span>Share on LinkedIn</span>
								</button>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</header>
	
	<!-- Template content with proper spacing -->
	<main class="mx-auto max-w-4xl px-4 sm:px-6">
		<ErrorBoundary fallback="detailed" showRetry={true}>
			{@render children()}
		</ErrorBoundary>
	</main>
</div>

<!-- Click outside to close share menu -->
{#if showShareMenu}
	<div 
		class="fixed inset-0 z-0" 
		onclick={() => showShareMenu = false}
		onkeydown={(e) => { if (e.key === 'Escape') showShareMenu = false; }}
		role="button"
		tabindex="-1"
		aria-label="Close share menu"
	></div>
{/if}