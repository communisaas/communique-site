<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { fade, fly, scale, slide } from 'svelte/transition';
	import { quintOut, backOut, elasticOut } from 'svelte/easing';
	import { spring } from 'svelte/motion';
	import { page } from '$app/stores';
	import { coordinated, useTimerCleanup } from '$lib/utils/timerCoordinator';
	import { 
		X, 
		Send, 
		Users, 
		Eye, 
		Share2, 
		Copy,
		CheckCircle2,
		ExternalLink,
		Sparkles,
		ArrowRight,
		Zap,
		Heart,
		Trophy,
		Flame
	} from '@lucide/svelte';
	import TemplateHeader from '$lib/components/landing/template/TemplateHeader.svelte';
	import MessagePreview from '$lib/components/landing/template/MessagePreview.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { guestState } from '$lib/stores/guestState';
	import { analyzeEmailFlow, launchEmail } from '$lib/services/emailService';
	
	let { 
		template,
		user = null
	}: {
		template: {
			id: string;
			slug: string;
			title: string;
			description: string;
			deliveryMethod: string;
			metrics: { sent: number; views?: number };
			[key: string]: unknown;
		};
		user?: { id: string; name: string } | null;
	} = $props();
	
	const dispatch = createEventDispatcher<{ 
		close: void;
		used: { templateId: string; action: 'mailto_opened' };
	}>();
	
	// Component ID for timer coordination
	const componentId = 'template-modal-' + Math.random().toString(36).substring(2, 15);
	
	// Modal States
	type ModalState = 'auth_required' | 'loading' | 'success' | 'celebration';
	let currentState: ModalState = $state(user ? 'loading' : 'auth_required');
	
	let showCopied = $state(false);
	let showShareMenu = $state(false);
	let actionProgress = spring(0, { stiffness: 0.2, damping: 0.8 });
	let celebrationScale = spring(1, { stiffness: 0.3, damping: 0.6 });
	
	// Generate share URL for template
	const shareUrl = $derived(`${$page.url.origin}/${template.slug}`);
	
	// Auto-trigger mailto for authenticated users
	onMount(() => {
		document.body.style.overflow = 'hidden';
		
		if (user) {
			// For authenticated users, immediately start the mailto flow
			handleUnifiedEmailFlow();
		}
		
		// Track modal opened
		trackEvent('template_modal_opened', {
			template_id: template.id,
			user_id: user?.id,
			state: currentState
		});
	});
	
	onDestroy(() => {
		document.body.style.overflow = 'auto';
		useTimerCleanup(componentId)();
	});
	
	function handleClose() {
		dispatch('close');
	}
	
	async function handleUnifiedEmailFlow() {
		currentState = 'loading';
		actionProgress.set(1);
		
		// Use unified email service
		const currentUser = $page.data?.user || user;
		const flow = analyzeEmailFlow(template as any, currentUser);
		
		// Show loading state briefly to let user understand what's happening
		coordinated.setTimeout(() => {
			if (flow.mailtoUrl) {
				// Launch email using unified service
				launchEmail(flow.mailtoUrl);
				
				// Track usage
				trackEvent('template_used', {
					template_id: template.id,
					user_id: user?.id,
					delivery_method: template.deliveryMethod
				});
				
				// Dispatch for analytics
				dispatch('used', { templateId: template.id, action: 'mailto_opened' });
			}
			
			// Transition to success state
			currentState = 'success';
			celebrationScale.set(1.1).then(() => celebrationScale.set(1));
			
			// Auto-transition to celebration after brief success
			coordinated.setTimeout(() => {
				currentState = 'celebration';
				celebrationScale.set(1.05).then(() => celebrationScale.set(1));
			}, 2000, 'transition', componentId);
			
		}, 1200, 'modal', componentId); // Brief loading to show intent
	}
	
	function handleAuth() {
		// Trigger auth flow - this would redirect to login
		window.location.href = `/auth/login?returnTo=${encodeURIComponent(window.location.pathname)}`;
	}
	
	function copyShareLink() {
		navigator.clipboard.writeText(shareUrl);
		showCopied = true;
		coordinated.setTimeout(() => showCopied = false, 2000, 'feedback', componentId);
		
		trackEvent('template_link_copied', {
			template_id: template.id,
			user_id: user?.id,
			context: 'celebration_modal'
		});
	}
	
	function shareOnSocial(platform: 'twitter' | 'facebook' | 'linkedin') {
		const text = `Just took action on "${template.title}" - every voice matters! Join the movement 🔥`;
		const encodedUrl = encodeURIComponent(shareUrl);
		const encodedText = encodeURIComponent(text);
		
		const urls = {
			twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
			facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
			linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
		};
		
		window.open(urls[platform], '_blank', 'width=600,height=400');
		
		trackEvent('template_shared', {
			template_id: template.id,
			platform,
			user_id: user?.id,
			context: 'celebration_modal'
		});
		
		showShareMenu = false;
	}
	
	// Analytics helper
	function trackEvent(eventName: string, properties: Record<string, any>) {
		if (typeof window !== 'undefined' && window.gtag) {
			window.gtag('event', eventName, properties);
		}
	}
</script>

<!-- Modal Backdrop -->
<div 
	class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
	onclick={handleClose}
	onkeydown={(e) => { if (e.key === 'Escape') handleClose(); }}
	role="dialog"
	aria-modal="true"
	aria-label="Template modal"
	tabindex="0"
	in:fade={{ duration: 200 }}
	out:fade={{ duration: 200 }}
>
	<!-- Modal Container -->
	<div 
		class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
		onclick={(e) => { e.stopPropagation(); }}
		onkeydown={(e) => { e.stopPropagation(); }}
		role="document"
		in:scale={{ duration: 300, start: 0.9, easing: backOut }}
		out:scale={{ duration: 200, start: 1, easing: quintOut }}
	>
		<!-- Dynamic Content Based on State -->
		{#if currentState === 'auth_required'}
			<!-- Auth Required State -->
			<div class="p-8 text-center">
				<div class="mb-6">
					<div class="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
						<Zap class="h-8 w-8 text-blue-600" />
					</div>
					<h2 class="text-2xl font-bold text-slate-900 mb-2">Ready to make your voice heard?</h2>
					<p class="text-slate-600 mb-6">
						Sign in to auto-fill your information and join {template.metrics.sent.toLocaleString()} others taking action.
					</p>
				</div>
				
				<div class="space-y-4">
					<Button 
						variant="primary" 
						size="lg" 
						classNames="w-full"
						onclick={handleAuth}
					>
						<Send class="mr-2 h-5 w-5" />
						Sign In & Send Message
					</Button>
					
					<button
						onclick={handleClose}
						class="text-sm text-slate-500 hover:text-slate-700"
					>
						Maybe later
					</button>
				</div>
			</div>
			
		{:else if currentState === 'loading'}
			<!-- Loading State - mailto is being resolved -->
			<div 
				class="p-8 text-center" 
				in:scale={{ duration: 500, easing: backOut }}
			>
				<div 
					class="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6"
					style="transform: scale({$celebrationScale})"
				>
					<Send class="h-10 w-10 text-blue-600" />
				</div>
				<h3 class="text-2xl font-bold text-slate-900 mb-2">
					Opening your email app...
				</h3>
				<p class="text-slate-600 mb-6">
					Your message is ready with your information pre-filled. 
				</p>
				
				<!-- Animated progress indicator -->
				<div class="w-32 h-2 bg-slate-200 rounded-full mx-auto overflow-hidden">
					<div 
						class="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-1000 ease-out"
						style="width: {$actionProgress * 100}%"
					></div>
				</div>
			</div>
			
		{:else if currentState === 'success'}
			<!-- Success State - mailto opened successfully -->
			<div 
				class="p-8 text-center" 
				in:scale={{ duration: 500, easing: backOut }}
			>
				<div 
					class="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6"
					style="transform: scale({$celebrationScale})"
				>
					<CheckCircle2 class="h-10 w-10 text-green-600" />
				</div>
				<h3 class="text-2xl font-bold text-slate-900 mb-2">
					Perfect! Your email is ready
				</h3>
				<p class="text-slate-600">
					Review your message and hit send when you're ready.
				</p>
			</div>
			
		{:else if currentState === 'celebration'}
			<!-- Celebration State - after-send care -->
			<div class="flex flex-col h-full">
				<!-- Header -->
				<div class="p-6 border-b border-slate-100 relative overflow-hidden">
					<!-- Celebration background effect -->
					<div class="absolute inset-0 bg-gradient-to-br from-amber-50 via-orange-50 to-red-50"></div>
					<div class="relative flex items-center justify-between">
						<div class="flex items-center gap-3">
							<div 
								class="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full"
								style="transform: scale({$celebrationScale})"
							>
								<Trophy class="h-6 w-6 text-white" />
							</div>
							<div>
								<h2 class="text-xl font-bold text-slate-900">You're making a difference!</h2>
								<p class="text-sm text-slate-600">Your voice is part of the movement</p>
							</div>
						</div>
						<button
							onclick={handleClose}
							class="rounded-full p-2 text-slate-400 hover:bg-white/50 hover:text-slate-600 transition-all duration-200"
						>
							<X class="h-5 w-5" />
						</button>
					</div>
				</div>
				
				<!-- Content -->
				<div class="flex-1 p-6 space-y-6">
					<!-- Impact Stats -->
					<div class="text-center">
						<div class="flex items-center justify-center gap-6 mb-4">
							<div class="text-center">
								<div class="text-2xl font-bold text-slate-900">{(template.metrics.sent + 1).toLocaleString()}</div>
								<div class="text-xs text-slate-500">voices heard</div>
							</div>
							<div class="w-px h-8 bg-slate-200"></div>
							<div class="text-center">
								<div class="text-2xl font-bold text-orange-600">1</div>
								<div class="text-xs text-slate-500">your impact</div>
							</div>
						</div>
						<p class="text-sm text-slate-600">
							You just joined thousands making their voices heard on issues that matter.
						</p>
					</div>
					
					<!-- Amplify Section -->
					<div class="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-100">
						<div class="flex items-center gap-2 mb-3">
							<Flame class="h-5 w-5 text-purple-600" />
							<h3 class="font-semibold text-slate-900">Amplify your impact</h3>
						</div>
						<p class="text-sm text-slate-600 mb-4">
							Share this campaign to multiply your voice and inspire others to take action.
						</p>
						
						<!-- Share Actions -->
						<div class="flex gap-2">
							<button
								onclick={copyShareLink}
								class="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-white border border-purple-200 rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-all duration-200"
							>
								{#if showCopied}
									<CheckCircle2 class="h-4 w-4 text-green-600" />
									<span class="text-green-600 font-medium">Copied!</span>
								{:else}
									<Copy class="h-4 w-4" />
									<span>Copy link</span>
								{/if}
							</button>
							
							<button
								onclick={() => shareOnSocial('twitter')}
								class="flex items-center justify-center p-2 bg-white border border-purple-200 rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-all duration-200"
								title="Share on X"
							>
								<span class="text-black font-bold text-sm">𝕏</span>
							</button>
							
							<button
								onclick={() => shareOnSocial('facebook')}
								class="flex items-center justify-center p-2 bg-white border border-purple-200 rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-all duration-200"
								title="Share on Facebook"
							>
								<span class="text-[#1877F2] font-bold text-sm">f</span>
							</button>
							
							<button
								onclick={() => shareOnSocial('linkedin')}
								class="flex items-center justify-center p-2 bg-white border border-purple-200 rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-all duration-200"
								title="Share on LinkedIn"
							>
								<span class="text-[#0A66C2] font-bold text-sm">in</span>
							</button>
						</div>
					</div>
					
					<!-- Next Steps -->
					<div class="p-4 bg-slate-50 rounded-xl">
						<div class="flex items-center gap-2 mb-3">
							<Heart class="h-5 w-5 text-red-500" />
							<h3 class="font-semibold text-slate-900">Keep the momentum</h3>
						</div>
						<p class="text-sm text-slate-600 mb-3">
							Your community needs voices like yours on other important issues too.
						</p>
						<a 
							href="/" 
							class="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
						>
							Explore more campaigns
							<ArrowRight class="h-3 w-3" />
						</a>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>