<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { fade, fly, scale, slide } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { crossfade } from 'svelte/transition';
	import { quintOut, elasticOut, backOut } from 'svelte/easing';
	import { spring } from 'svelte/motion';
	import { page } from '$app/stores';
	import { 
		X, 
		Mail, 
		MessageCircle, 
		Users, 
		Zap, 
		CheckCircle2,
		ArrowRight,
		ArrowLeft,
		Sparkles
	} from '@lucide/svelte';
	import Button from '../ui/Button.svelte';
	
	export let template: {
		title: string;
		description: string;
		slug: string;
		deliveryMethod?: string;
		metrics: { sent: number; views?: number };
	};
	export let source: 'social-link' | 'direct-link' | 'share' = 'direct-link';
	
	const dispatch = createEventDispatcher<{ close: void }>();
	
	let currentStep: 'preview' | 'benefits' | 'providers' = 'preview';
	let isTransitioning = false;
	
	// Prevent background scrolling when modal is open
	onMount(() => {
		document.body.style.overflow = 'hidden';
	});
	
	onDestroy(() => {
		document.body.style.overflow = '';
	});
	
	// Spring-powered step progression
	const stepProgress = spring(0, { stiffness: 0.3, damping: 0.8 });
	$: stepProgress.set(['preview', 'benefits', 'providers'].indexOf(currentStep));
	
	// Crossfade for smooth step transitions
	const [send, receive] = crossfade({
		duration: 400,
		easing: quintOut,
		fallback: scale
	});
	
	// Dynamic messaging based on source and template type - enhanced with agency and impact
	$: sourceMessages = getSourceMessages(isCongressional, isDirectOutreach);
	
	function getSourceMessages(congressional: boolean, directOutreach: boolean) {
		if (congressional) {
			return {
				'social-link': {
					headline: 'Your voice can drive change',
					subtext: 'Someone shared this because they know your voice matters to Congress.',
					cta: 'Add your voice'
				},
				'direct-link': {
					headline: 'Your representative needs to hear this',
					subtext: 'Congressional offices count every message from constituents like you.',
					cta: 'Speak up'
				},
				'share': {
					headline: 'Join the pressure campaign',
					subtext: 'Your voice adds to the growing momentum on this issue.',
					cta: 'Join them'
				}
			};
		} else if (directOutreach) {
			return {
				'social-link': {
					headline: 'Make decision-makers listen',
					subtext: 'Someone shared this because they believe your voice can create change.',
					cta: 'Add your voice'
				},
				'direct-link': {
					headline: 'Decision-makers need to hear from you',
					subtext: 'Your voice carries weight when you speak as a stakeholder.',
					cta: 'Make your voice heard'
				},
				'share': {
					headline: 'Join the advocacy push',
					subtext: 'Add your voice to the growing pressure on decision-makers.',
					cta: 'Join them'
				}
			};
		} else {
			// Fallback messaging
			return {
				'social-link': {
					headline: 'Your voice can drive change',
					subtext: 'Someone shared this because they believe in change.',
					cta: 'Add your voice'
				},
				'direct-link': {
					headline: 'Make your voice heard',
					subtext: 'This campaign needs supporters like you.',
					cta: 'Get started'
				},
				'share': {
					headline: 'Shared with you',
					subtext: 'Someone wants you to join this important cause.',
					cta: 'Join them'
				}
			};
		}
	}
	
	function getProcessSteps(congressional: boolean, directOutreach: boolean) {
		if (congressional) {
			return [
				{ icon: Mail, title: 'Direct delivery to congressional office', desc: 'Your message goes straight to your representative\'s staff' },
				{ icon: Users, title: 'Counted as constituent feedback', desc: 'Congressional offices track messages by issue and district' },
				{ icon: CheckCircle2, title: 'Influences their position', desc: 'Representatives consider constituent input when voting' }
			];
		} else if (directOutreach) {
			return [
				{ icon: Mail, title: 'Direct delivery to decision-makers', desc: 'Your message reaches executives, officials, or stakeholders' },
				{ icon: Users, title: 'Strengthened by your credentials', desc: 'Your role and connection amplify your message\'s impact' },
				{ icon: CheckCircle2, title: 'Creates pressure for change', desc: 'Decision-makers respond when stakeholders speak up' }
			];
		} else {
			return [
				{ icon: Mail, title: 'Direct message delivery', desc: 'Your message is sent to the right people' },
				{ icon: Users, title: 'Tracked for impact', desc: 'We monitor campaign effectiveness' },
				{ icon: CheckCircle2, title: 'Drives change', desc: 'Collective voices create real impact' }
			];
		}
	}
	
	// Detect template type for customized messaging
	$: isCongressional = template.deliveryMethod === 'both';
	$: isDirectOutreach = template.deliveryMethod === 'email';
	
	$: message = sourceMessages[source];
	$: returnUrl = encodeURIComponent(`/template-modal/${template.slug}`);
	
	function handleAuth(provider: string) {
		// Store the template context before redirecting
		if (typeof window !== 'undefined') {
			sessionStorage.setItem('pending_template_action', JSON.stringify({
				slug: template.slug,
				action: 'use_template',
				timestamp: Date.now()
			}));
		}
		
		window.location.href = `/auth/${provider}?returnTo=${returnUrl}`;
	}
	
	function handleClose() {
		dispatch('close');
	}
	
	// Progressive disclosure steps with immediate response
	function nextStep() {
		if (isTransitioning) return;
		isTransitioning = true;
		
		// Immediate state change for responsiveness
		if (currentStep === 'preview') currentStep = 'benefits';
		else if (currentStep === 'benefits') currentStep = 'providers';
		
		// Short protection period
		setTimeout(() => isTransitioning = false, 150);
	}
	
	function prevStep() {
		if (isTransitioning) return;
		isTransitioning = true;
		
		// Immediate state change for responsiveness
		if (currentStep === 'providers') currentStep = 'benefits';
		else if (currentStep === 'benefits') currentStep = 'preview';
		
		// Short protection period
		setTimeout(() => isTransitioning = false, 150);
	}
</script>

<!-- Modal Backdrop with improved animation -->
<div 
	class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
	on:click={handleClose}
	in:fade={{ duration: 300, easing: quintOut }}
	out:fade={{ duration: 200 }}
>
	<!-- Modal Content with spring-like entrance -->
	<div 
		class="fixed inset-x-4 top-1/2 max-w-lg mx-auto transform -translate-y-1/2 bg-white rounded-2xl shadow-2xl overflow-hidden"
		on:click|stopPropagation
		in:scale={{ 
			duration: 400, 
			easing: backOut,
			start: 0.9,
			opacity: 0.5
		}}
		out:scale={{ 
			duration: 200, 
			easing: quintOut,
			start: 0.95
		}}
	>
		<!-- Close Button -->
		<button
			on:click={handleClose}
			class="absolute right-4 top-4 z-10 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
		>
			<X class="h-5 w-5" />
		</button>
		
		<!-- Animated Step Indicator -->
		<div class="flex justify-center pt-6 pb-4">
			<div class="flex gap-2">
				{#each ['preview', 'benefits', 'providers'] as step, i}
					<div 
						class="h-2 rounded-full transition-all duration-500 ease-out {
							currentStep === step 
								? 'w-12 bg-blue-600 shadow-lg shadow-blue-200' 
								: ['preview', 'benefits', 'providers'].indexOf(currentStep) > i 
									? 'w-8 bg-blue-300' 
									: 'w-8 bg-slate-200'
						}"
						in:scale={{ delay: i * 100, duration: 300 }}
					/>
				{/each}
			</div>
		</div>
		
		<!-- Content Container with Key-based Transitions -->
		<div class="relative overflow-hidden h-[480px]">
			{#key currentStep}
				<div 
					class="absolute inset-0 p-6 pt-2"
					in:fly={{ x: 20, duration: 400, delay: 350, easing: quintOut }}
					out:fly={{ x: -20, duration: 300, easing: quintOut }}
				>
					{#if currentStep === 'preview'}
						<!-- Template Preview Step -->
						<div class="text-center mb-6">
							<h2 
								class="text-2xl font-bold text-slate-900 mb-2"
								in:fly={{ y: 10, duration: 200, delay: 50 }}
							>
								{message.headline}
							</h2>
							<p 
								class="text-slate-600"
								in:fly={{ y: 10, duration: 200, delay: 100 }}
							>
								{message.subtext}
							</p>
						</div>
				
						<!-- Template Card with Staggered Animation -->
						<div 
							class="border border-slate-200 rounded-lg p-4 mb-6 bg-gradient-to-br from-blue-50 to-indigo-50"
							in:scale={{ duration: 200, delay: 150, easing: backOut, start: 0.95 }}
						>
							<h3 
								class="font-semibold text-slate-900 mb-2"
								in:fly={{ y: 10, duration: 300, delay: 350 }}
							>
								{template.title}
							</h3>
							<p 
								class="text-sm text-slate-600 mb-3"
								in:fly={{ y: 10, duration: 300, delay: 400 }}
							>
								{template.description}
							</p>
							
							<!-- Enhanced Social Proof with Impact Context -->
							<div 
								class="space-y-2"
								in:fly={{ y: 10, duration: 300, delay: 450 }}
							>
								<div class="flex items-center gap-4 text-xs text-slate-500">
									<div class="flex items-center gap-1">
										<Users class="h-3 w-3" />
										<span>{template.metrics.sent.toLocaleString()} voices sent to Congress</span>
									</div>
									{#if template.metrics.views}
										<div class="flex items-center gap-1">
											<Sparkles class="h-3 w-3" />
											<span>{template.metrics.views.toLocaleString()} people engaged</span>
										</div>
									{/if}
								</div>
								{#if template.metrics.sent > 100}
									<div class="text-xs text-blue-600 font-medium">
										📈 Building momentum - congressional offices are taking notice
									</div>
								{:else if template.metrics.sent > 50}
									<div class="text-xs text-green-600 font-medium">
										🎯 Growing pressure - your voice adds to the impact
									</div>
								{:else}
									<div class="text-xs text-amber-600 font-medium">
										🚀 Early momentum - be among the first to speak up
									</div>
								{/if}
							</div>
						</div>
				
						<!-- Animated Buttons -->
						<div 
							class="flex gap-3"
							in:fly={{ y: 20, duration: 200, delay: 200 }}
						>
							<Button 
								variant="secondary" 
								size="sm" 
								classNames="flex-1 transition-all duration-200 hover:scale-105"
								on:click={handleClose}
								disabled={isTransitioning}
							>
								Maybe later
							</Button>
							<Button 
								variant="primary" 
								size="sm" 
								classNames="flex-1 transition-all duration-200 hover:scale-105 hover:shadow-lg"
								on:click={nextStep}
								disabled={isTransitioning}
							>
								{message.cta}
								<ArrowRight class="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
							</Button>
						</div>
						
					{:else if currentStep === 'benefits'}
						<!-- Benefits Step -->
						<div class="text-center mb-6">
							<h2 
								class="text-xl font-bold text-slate-900 mb-2"
								in:fly={{ y: 10, duration: 200, delay: 50 }}
							>
								Here's what happens when you send
							</h2>
							<p 
								class="text-slate-600"
								in:fly={{ y: 10, duration: 200, delay: 100 }}
							>
								{#if isCongressional}
									Your message follows a direct path to Congress
								{:else if isDirectOutreach}
									Your message reaches decision-makers who can create change
								{:else}
									Your message gets delivered with maximum impact
								{/if}
							</p>
						</div>
						
						<!-- Process Visualization -->
						<div class="space-y-4 mb-6">
							{#each getProcessSteps(isCongressional, isDirectOutreach) as step, i}
								<div 
									class="flex items-start gap-3"
									in:fly={{ x: -20, duration: 200, delay: 150 + (i * 50) }}
								>
									<div class="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full shrink-0">
										<svelte:component 
											this={step.icon} 
											class="h-4 w-4 text-blue-600" 
										/>
									</div>
									<div>
										<p class="font-medium text-slate-900">{step.title}</p>
										<p class="text-sm text-slate-600">{step.desc}</p>
									</div>
								</div>
							{/each}
						</div>
						
						<!-- Additional Benefits -->
						<div class="bg-slate-50 rounded-lg p-3 mb-6">
							<p class="text-sm text-slate-700 font-medium mb-1">Plus with your account:</p>
							<div class="space-y-1 text-xs text-slate-600">
								<div>📊 Track how many others joined your campaigns</div>
								<div>🎯 Get notified of policy updates on issues you care about</div>
								<div>🌟 Discover new advocacy opportunities</div>
							</div>
						</div>
						
						<!-- Navigation Buttons -->
						<div 
							class="flex gap-3"
							in:fly={{ y: 20, duration: 200, delay: 200 }}
						>
							<Button 
								variant="secondary" 
								size="sm" 
								classNames="flex-1 transition-all duration-200 hover:scale-105"
								on:click={prevStep}
								disabled={isTransitioning}
							>
								<ArrowLeft class="mr-1 h-4 w-4" />
								Back
							</Button>
							<Button 
								variant="primary" 
								size="sm" 
								classNames="flex-1 transition-all duration-200 hover:scale-105 hover:shadow-lg"
								on:click={nextStep}
								disabled={isTransitioning}
							>
								Sign up
								<ArrowRight class="ml-1 h-4 w-4" />
							</Button>
						</div>
						
					{:else}
						<!-- OAuth Providers Step -->
						<div class="text-center mb-6">
							<h2 
								class="text-xl font-bold text-slate-900 mb-2"
								in:fly={{ y: 10, duration: 200, delay: 50 }}
							>
								Join the advocacy community
							</h2>
							<p 
								class="text-slate-600"
								in:fly={{ y: 10, duration: 200, delay: 100 }}
							>
								Quick signup - then your voice goes directly to Congress
							</p>
						</div>
						
						<!-- Momentum Indicator -->
						<div class="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-3 mb-4 text-center">
							<p class="text-sm font-medium text-slate-800">
								🔥 {template.metrics.sent.toLocaleString()} people have already sent this message
							</p>
							<p class="text-xs text-slate-600 mt-1">
								Your voice adds to the growing pressure on this issue
							</p>
						</div>
						
						<!-- Animated OAuth Buttons -->
						<div class="space-y-3 mb-6">
							{#each [
								{ provider: 'google', name: 'Google', icon: 'google-svg', color: 'bg-white' },
								{ provider: 'facebook', name: 'Facebook', icon: 'f', color: 'bg-[#1877F2]' },
								{ provider: 'twitter', name: 'X (Twitter)', icon: '𝕏', color: 'bg-black' }
							] as auth, i}
								<button
									on:click={() => handleAuth(auth.provider)}
									class="w-full flex items-center justify-center gap-3 px-4 py-3 border border-slate-300 rounded-lg bg-white hover:bg-slate-50 hover:scale-105 hover:shadow-md transition-all duration-200"
									in:fly={{ x: -20, duration: 200, delay: 150 + (i * 50) }}
									disabled={isTransitioning}
								>
									{#if auth.provider === 'google'}
										<svg class="h-5 w-5" viewBox="0 0 24 24">
											<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
											<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
											<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
											<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
										</svg>
									{:else}
										<div class="h-5 w-5 {auth.color} rounded text-white flex items-center justify-center font-bold text-sm">
											{auth.icon}
										</div>
									{/if}
									Continue with {auth.name}
								</button>
							{/each}
						</div>
						
						<!-- Back Button -->
						<div 
							class="flex gap-3"
							in:fly={{ y: 20, duration: 200, delay: 200 }}
						>
							<Button 
								variant="secondary" 
								size="sm" 
								classNames="flex-1 transition-all duration-200 hover:scale-105"
								on:click={prevStep}
								disabled={isTransitioning}
							>
								<ArrowLeft class="mr-1 h-4 w-4" />
								Back
							</Button>
						</div>
						
						<!-- Privacy Notice -->
						<p 
							class="text-xs text-center text-slate-500 mt-4"
							in:fade={{ duration: 200, delay: 250 }}
						>
							By signing up, you agree to our terms and privacy policy. We'll only use your account for advocacy tracking and to keep you updated on your campaigns.
						</p>
					{/if}
				</div>
			{/key}
		</div>
	</div>
</div>