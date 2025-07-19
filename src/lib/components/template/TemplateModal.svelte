<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { fade, fly, scale, slide } from 'svelte/transition';
	import { quintOut, backOut, elasticOut } from 'svelte/easing';
	import { spring } from 'svelte/motion';
	import { page } from '$app/stores';
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
		Zap
	} from '@lucide/svelte';
	import TemplateHeader from '../landing/template/TemplateHeader.svelte';
	import MessagePreview from '../landing/template/MessagePreview.svelte';
	import Button from '../ui/Button.svelte';
	import { guestState } from '$lib/stores/guestState';
	
	export let template: {
		id: string;
		slug: string;
		title: string;
		description: string;
		deliveryMethod: string;
		metrics: { sent: number; views?: number };
		[key: string]: any;
	};
	export let user: { id: string; name: string } | null = null;
	
	const dispatch = createEventDispatcher<{ 
		close: void;
		used: { templateId: string; action: 'mailto_opened' };
	}>();
	
	let showCopied = false;
	let showSuccess = false;
	let actionProgress = spring(0, { stiffness: 0.2, damping: 0.8 });
	let pulseAnimation = spring(1, { stiffness: 0.3, damping: 0.6 });
	
	// Animate action button on mount
	onMount(() => {
		// Prevent background scrolling when modal is open
		document.body.style.overflow = 'hidden';
		
		actionProgress.set(1);
		
		// Track that user opened the modal
		trackEvent('template_modal_opened', {
			template_id: template.id,
			user_authenticated: !!user
		});
		
		// Clear guest state if user is now authenticated
		if (user) {
			guestState.clear();
		}
	});
	
	onDestroy(() => {
		document.body.style.overflow = '';
	});
	
	function handleUseTemplate() {
		// Track conversion
		trackEvent('template_used', {
			template_id: template.id,
			delivery_method: template.deliveryMethod,
			user_id: user?.id
		});
		
		// Trigger button animation
		pulseAnimation.set(1.2).then(() => pulseAnimation.set(1));
		
		// Show success state with animation
		showSuccess = true;
		actionProgress.set(0);
		
		setTimeout(() => {
			// Generate and open mailto link
			const mailtoLink = generateMailtoLink();
			window.location.href = mailtoLink;
			
			// Notify parent of successful action
			dispatch('used', { 
				templateId: template.id, 
				action: 'mailto_opened' 
			});
			
			// Close modal after brief delay
			setTimeout(() => dispatch('close'), 800);
		}, 600);
	}
	
	function generateMailtoLink(): string {
		const subject = encodeURIComponent(template.title);
		const body = encodeURIComponent(template.preview || template.message_body || '');
		
		if (template.deliveryMethod === 'both') {
			// Congressional routing
			const routingEmail = user 
				? `congress+${template.id}-${user.id}@communi.email`
				: `congress+guest-${template.id}-${Date.now()}@communi.email`;
			return `mailto:${routingEmail}?subject=${subject}&body=${body}`;
		} else {
			// Direct email
			const recipients = template.recipientEmails?.join(',') || '';
			return `mailto:${recipients}?subject=${subject}&body=${body}`;
		}
	}
	
	function copyShareLink() {
		navigator.clipboard.writeText(shareUrl);
		showCopied = true;
		setTimeout(() => showCopied = false, 2000);
		
		trackEvent('template_link_copied', {
			template_id: template.id,
			user_id: user?.id
		});
	}
	
	function shareOnSocial(platform: 'twitter' | 'facebook' | 'linkedin') {
		const text = `Join me in supporting "${template.title}" - make your voice heard!`;
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
			user_id: user?.id
		});
	}
	
	function handleClose() {
		trackEvent('template_modal_closed', {
			template_id: template.id,
			action_taken: showSuccess ? 'used' : 'closed_without_action'
		});
		
		dispatch('close');
	}
	
	// Simple analytics tracking (replace with your analytics service)
	function trackEvent(event: string, properties: Record<string, any>) {
		// TODO: Implement analytics tracking
		console.log('Analytics:', event, properties);
	}
</script>

<!-- Modal Backdrop with improved animation -->
<div 
	class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
	on:click={handleClose}
	in:fade={{ duration: 300, easing: quintOut }}
	out:fade={{ duration: 200 }}
>
	<!-- Modal Content with spring entrance -->
	<div 
		class="fixed inset-x-4 top-1/2 max-w-2xl mx-auto transform -translate-y-1/2 bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
		on:click|stopPropagation
		in:scale={{ 
			duration: 500, 
			easing: backOut,
			start: 0.9,
			opacity: 0.5 
		}}
		out:scale={{ 
			duration: 250, 
			easing: quintOut,
			start: 0.95 
		}}
	>
		<!-- Animated Header -->
		<div 
			class="flex items-center justify-between p-6 border-b border-slate-200"
			in:fly={{ y: -10, duration: 400, delay: 200 }}
		>
			<div class="flex items-center gap-3">
				<h2 
					class="text-xl font-semibold text-slate-900"
					in:fly={{ x: -10, duration: 400, delay: 300 }}
				>
					Ready to take action?
				</h2>
				{#if user}
					<span 
						class="text-sm text-green-600 bg-green-50 px-2 py-1 rounded-full"
						in:scale={{ duration: 400, delay: 400, easing: backOut }}
					>
						Welcome back, {user.name?.split(' ')[0]}!
					</span>
				{/if}
			</div>
			<button
				on:click={handleClose}
				class="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all duration-200 hover:scale-110"
				in:scale={{ duration: 300, delay: 500 }}
			>
				<X class="h-5 w-5" />
			</button>
		</div>
		
		<!-- Content -->
		<div class="flex-1 overflow-y-auto">
			<!-- Animated Success State -->
			{#if showSuccess}
				<div 
					class="p-8 text-center" 
					in:scale={{ duration: 500, easing: backOut }}
					out:fade={{ duration: 200 }}
				>
					<div 
						class="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4"
						in:scale={{ duration: 600, delay: 200, easing: elasticOut }}
						style="transform: scale({$pulseAnimation})"
					>
						<CheckCircle2 class="h-8 w-8 text-green-600" />
					</div>
					<h3 
						class="text-xl font-semibold text-slate-900 mb-2"
						in:fly={{ y: 10, duration: 400, delay: 400 }}
					>
						Opening your email app...
					</h3>
					<p 
						class="text-slate-600"
						in:fly={{ y: 10, duration: 400, delay: 500 }}
					>
						Your message is ready to send. Thank you for making your voice heard!
					</p>
					
					<!-- Progress indicator -->
					<div 
						class="mt-6 w-24 h-1 bg-slate-200 rounded-full mx-auto overflow-hidden"
						in:scale={{ duration: 300, delay: 600 }}
					>
						<div 
							class="h-full bg-green-500 rounded-full transition-all duration-1000 ease-out"
							style="width: {(1 - $actionProgress) * 100}%"
						/>
					</div>
				</div>
			{:else}
				<!-- Animated Template Content -->
				<div class="p-6">
					<div in:fly={{ y: 20, duration: 400, delay: 300 }}>
						<TemplateHeader {template} />
					</div>
					<div in:fly={{ y: 20, duration: 400, delay: 400 }}>
						<MessagePreview 
							preview={template.preview} 
							{template} 
							onScroll={() => {}}
						/>
					</div>
					
					<!-- Animated Action Section -->
					<div 
						class="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg"
						in:scale={{ duration: 400, delay: 500, easing: backOut, start: 0.95 }}
					>
						<div 
							class="flex items-center gap-3 mb-3"
							in:fly={{ x: -10, duration: 300, delay: 600 }}
						>
							<Sparkles class="h-5 w-5 text-blue-600" />
							<h3 class="font-semibold text-slate-900">Your voice matters</h3>
						</div>
						<p 
							class="text-sm text-slate-600 mb-4"
							in:fly={{ y: 10, duration: 300, delay: 700 }}
						>
							Join {template.metrics.sent.toLocaleString()} others who have already taken action on this campaign.
						</p>
						
						<div in:scale={{ duration: 400, delay: 800, easing: backOut, start: 0.9 }}>
							<Button 
								variant="primary" 
								size="lg" 
								classNames="w-full transition-all duration-200 hover:scale-105 hover:shadow-lg group"
								on:click={handleUseTemplate}
								style="transform: scale({$pulseAnimation})"
							>
								<Send class="mr-2 h-5 w-5 transition-transform group-hover:rotate-12" />
								Send your message
								<ArrowRight class="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
							</Button>
						</div>
					</div>
					
					<!-- Animated Share Section -->
					<div 
						class="mt-6 pt-6 border-t border-slate-200"
						in:slide={{ duration: 400, delay: 900, easing: quintOut }}
					>
						<h4 
							class="font-medium text-slate-900 mb-3"
							in:fly={{ y: 10, duration: 300, delay: 1000 }}
						>
							Amplify your impact
						</h4>
						<p 
							class="text-sm text-slate-600 mb-4"
							in:fly={{ y: 10, duration: 300, delay: 1050 }}
						>
							Share this campaign to multiply your voice
						</p>
						
						<div 
							class="flex gap-2"
							in:fly={{ y: 20, duration: 400, delay: 1100 }}
						>
							<button
								on:click={copyShareLink}
								class="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 hover:scale-105 hover:shadow-md transition-all duration-200"
							>
								{#if showCopied}
									<div in:scale={{ duration: 300, easing: backOut }}>
										<CheckCircle2 class="h-4 w-4 text-green-600" />
									</div>
									<span 
										class="text-green-600"
										in:fly={{ x: 10, duration: 200 }}
									>
										Copied!
									</span>
								{:else}
									<Copy class="h-4 w-4" />
									<span>Copy link</span>
								{/if}
							</button>
							
							<button
								on:click={() => shareOnSocial('twitter')}
								class="flex items-center justify-center p-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 hover:scale-110 hover:shadow-md transition-all duration-200"
								title="Share on X"
							>
								<span class="text-black font-bold text-sm">𝕏</span>
							</button>
							
							<button
								on:click={() => shareOnSocial('facebook')}
								class="flex items-center justify-center p-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 hover:scale-110 hover:shadow-md transition-all duration-200"
								title="Share on Facebook"
							>
								<span class="text-[#1877F2] font-bold text-sm">f</span>
							</button>
							
							<button
								on:click={() => shareOnSocial('linkedin')}
								class="flex items-center justify-center p-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 hover:scale-110 hover:shadow-md transition-all duration-200"
								title="Share on LinkedIn"
							>
								<span class="text-[#0A66C2] font-bold text-sm">in</span>
							</button>
						</div>
					</div>
				</div>
			{/if}
		</div>
		
		<!-- Animated Footer -->
		{#if !showSuccess}
			<div 
				class="p-4 bg-slate-50 border-t border-slate-200"
				in:slide={{ duration: 200, delay: 650, easing: quintOut }}
				out:slide={{ duration: 200, easing: quintOut }}
			>
				<div class="flex items-center justify-between text-xs text-slate-500">
					<div 
						class="flex items-center gap-4"
						in:fly={{ x: -10, duration: 150, delay: 700 }}
					>
						<span class="flex items-center gap-1">
							<Users class="h-3 w-3" />
							{template.metrics.sent.toLocaleString()} sent
						</span>
						{#if template.metrics.views}
							<span class="flex items-center gap-1">
								<Eye class="h-3 w-3" />
								{template.metrics.views.toLocaleString()} views
							</span>
						{/if}
					</div>
					<a 
						href={shareUrl} 
						target="_blank" 
						class="flex items-center gap-1 hover:text-slate-700 hover:scale-105 transition-all duration-200"
						in:fly={{ x: 10, duration: 150, delay: 750 }}
					>
						View campaign page
						<ExternalLink class="h-3 w-3 transition-transform group-hover:rotate-12" />
					</a>
				</div>
			</div>
		{/if}
	</div>
</div>