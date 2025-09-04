<script lang="ts">
	import { page } from '$app/stores';
	import { User, LogOut, ArrowLeft, Share2, Copy, CheckCircle, Send, Shield, AtSign } from '@lucide/svelte';
	import { coordinated } from '$lib/utils/timerCoordinator';
	import { createEventDispatcher } from 'svelte';
	import { analyzeEmailFlow } from '$lib/services/emailService';
	import SignInModal from '$lib/components/modals/SignInModal.svelte';
	
	const dispatch = createEventDispatcher();
	
	let { 
		user = null,
		template = null,
		context = 'discovery',
		onTemplateUse = null
	}: {
		user?: { id: string; name: string; address?: any } | null;
		template?: any | null;
		context?: 'discovery' | 'creation' | 'advocacy' | 'impact';
		onTemplateUse?: ((event: { template: any; requiresAuth: boolean }) => void) | null;
	} = $props();
	
	let showCopied = $state(false);
	let showShareMenu = $state(false);
	let showAuthModal = $state(false);
	let authModal: SignInModal;
	
	const componentId = 'AppHeader_' + Math.random().toString(36).substr(2, 9);
	const shareUrl = $derived($page.url.href);
	
	// Context-aware header configuration
	const headerConfig = $derived(() => {
		const isTemplate = $page.route.id === '/[slug]';
		const isHomepage = $page.route.id === '/';
		
		if (isTemplate && template) {
			return {
				type: 'advocacy',
				showBack: true,
				showShare: true,
				showCTA: true,
				title: template.title,
				backText: 'All Templates',
				backHref: '/'
			};
		}
		
		if (isHomepage) {
			return {
				type: 'discovery',
				showBack: false,
				showShare: false,
				showCTA: false,
				title: null,
				backText: null,
				backHref: null
			};
		}
		
		return {
			type: 'discovery',
			showBack: false,
			showShare: false,
			showCTA: false,
			title: null,
			backText: null,
			backHref: null
		};
	});
	
	// Smart CTA configuration for template actions
	const ctaConfig = $derived(() => {
		if (!template || !headerConfig.showCTA) return null;
		
		const emailFlow = analyzeEmailFlow(template, user);
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
	
	// Dynamic icon component for CTA
	const CtaIcon = $derived(ctaConfig?.icon);
	
	// Progressive user identity representation
	const userRepresentation = $derived(() => {
		if (!user || !user.name) return null;
		
		const firstName = user.name.split(' ')[0] || 'User';
		const hasAddress = user.address && (user.address.city || user.address.state);
		
		if (headerConfig.type === 'advocacy' && hasAddress) {
			return {
				greeting: `Hi ${firstName}!`,
				context: `${user.address.city || 'Your area'}, ${user.address.state || ''}`,
				status: 'Ready to advocate'
			};
		}
		
		if (headerConfig.type === 'discovery') {
			return {
				greeting: `Welcome back, ${firstName}!`,
				context: null,
				status: 'Signed in'
			};
		}
		
		return {
			greeting: `Hi ${firstName}!`,
			context: null,
			status: 'Signed in'
		};
	});
	
	function copyLink() {
		navigator.clipboard.writeText(shareUrl);
		showCopied = true;
		coordinated.setTimeout(() => showCopied = false, 2000, 'feedback', componentId);
	}
	
	function shareOnSocial(platform: 'twitter' | 'facebook' | 'linkedin') {
		const text = template ? 
			`Check out "${template.title}" on Communiqué - make your voice heard!` :
			`Check out Communiqué - make your voice heard!`;
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
	
	function handleTemplateUse() {
		if (!template || !onTemplateUse) return;
		
		const emailFlow = analyzeEmailFlow(template, user);
		onTemplateUse({ 
			template, 
			requiresAuth: emailFlow.requiresAuth
		});
	}

	function handleHeaderSignIn() {
		authModal.open();
	}
</script>

<!-- Ambient Header - Context-Aware Design -->
<header class="border-b border-slate-200 bg-white">
	<div class="mx-auto max-w-7xl px-4 sm:px-6">
		<div class="flex items-center justify-between py-3">
			
			<!-- Left: Context-dependent navigation -->
			<div class="flex items-center gap-4">
				{#if headerConfig.showBack}
					<a 
						href={headerConfig.backHref}
						class="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors group"
					>
						<ArrowLeft class="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
						<span class="text-sm font-medium">{headerConfig.backText}</span>
					</a>
				{:else}
					<!-- Brand/Context indicator for homepage -->
					<div class="text-slate-900 font-medium text-lg">
						Communiqué
					</div>
				{/if}
			</div>
			
			<!-- Right: Progressive user identity + contextual actions -->
			<div class="flex items-center gap-3">
				
				<!-- User authentication and welcome -->
				{#if user}
					<div class="flex items-center gap-3 text-sm">
						<!-- User icon with greeting -->
						<div class="flex items-center gap-1.5 text-green-600">
							<User class="h-3 w-3" />
							<span class="text-slate-600 hidden sm:inline">{userRepresentation?.greeting || `Welcome back, ${user.name?.split(' ')[0]}!`}</span>
							<span class="text-slate-600 sm:hidden">{user.name?.split(' ')[0] || 'User'}</span>
						</div>
						
						{#if userRepresentation?.context}
							<div class="text-xs text-slate-500 hidden lg:block">
								{userRepresentation.context}
							</div>
						{/if}
						
						<!-- Profile link -->
						<a 
							href="/profile" 
							class="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
							title="View profile"
						>
							<User class="h-3 w-3" />
							<span class="hidden sm:inline">Profile</span>
						</a>
						
						<!-- Sign out -->
						<a 
							href="/auth/logout" 
							class="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
							title="Sign out"
						>
							<LogOut class="h-3 w-3" />
							<span class="hidden sm:inline">Sign out</span>
						</a>
					</div>
				{:else}
					<!-- General sign-in for unauthenticated users when no template CTA -->
					<button
						onclick={handleHeaderSignIn}
						class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
						title="Sign in"
					>
						<User class="h-4 w-4" />
						<span class="hidden sm:inline">Sign In</span>
						<span class="sm:hidden">Sign In</span>
					</button>
				{/if}
				
				<!-- Primary CTA for template actions -->
				{#if ctaConfig}
					<div class="flex flex-col items-end gap-1">
						{#if ctaConfig.subtitle}
							<span class="hidden sm:block text-xs text-slate-500">
								{ctaConfig.subtitle}
							</span>
						{/if}
						
						<button
							onclick={handleTemplateUse}
							class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white rounded-lg transition-colors {ctaConfig.colors}"
						>
							{#if CtaIcon}
								<CtaIcon class="h-4 w-4" />
							{/if}
							
							<span class="hidden sm:inline">
								{ctaConfig.desktop}
							</span>
							<span class="sm:hidden">
								{ctaConfig.mobile}
							</span>
						</button>
					</div>
				{/if}
				
				<!-- Contextual share functionality -->
				{#if headerConfig.showShare}
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
				{/if}
			</div>
		</div>
	</div>
</header>

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

<!-- Sign In Modal -->
<SignInModal bind:this={authModal} />