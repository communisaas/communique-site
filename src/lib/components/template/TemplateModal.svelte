<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
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
	import TemplateMeta from '$lib/components/template/TemplateMeta.svelte';
	import MessagePreview from '$lib/components/landing/template/MessagePreview.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { guestState } from '$lib/stores/guestState.svelte';
	import { modalActions, modalState, isModalOpen } from '$lib/stores/modalSystem.svelte';
	import { analyzeEmailFlow, launchEmail } from '$lib/services/emailService';
	import TemplatePreview from '$lib/components/landing/template/TemplatePreview.svelte';

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
			type?: string;
			message_body?: string;
			recipient_config?: any;
			recipientEmails?: string[];
			metrics: { sent?: number; views?: number };
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

	// Modal States - use persistent store
	const currentState = $derived($modalState);

	let showCopied = $state(false);
	let showShareMenu = $state(false);
	let actionProgress = spring(0, { stiffness: 0.2, damping: 0.8 });
	let celebrationScale = spring(1, { stiffness: 0.3, damping: 0.6 });

	// Enhanced URL copy component state
	let copyButtonScale = spring(1, { stiffness: 0.4, damping: 0.8 });
	let copyButtonRotation = spring(0, { stiffness: 0.3, damping: 0.7 });
	let copyButtonGlow = $state(false);
	let copySuccessWave = $state(false);

	// Generate share URL for template
	const shareUrl = $derived(`${$page.url.origin}/${template.slug}`);

	// Initialize modal state and auto-trigger mailto for authenticated users
	onMount(() => {
		if (browser) {
			document.body.style.overflow = 'hidden';
		}

		// Initialize the modal state
		modalActions.open(template, user);

		if (user) {
			// For authenticated users, immediately start the mailto flow
			handleUnifiedEmailFlow();
		}

		
	});

	onDestroy(() => {
		if (browser) {
			document.body.style.overflow = 'auto';
		}
		useTimerCleanup(componentId)();
	});

	function handleClose() {
		dispatch('close');
	}

	async function handleUnifiedEmailFlow() {
		modalActions.setState('loading');
		actionProgress.set(1);

		// Use unified email service
		const currentUser = $page.data?.user || user;
		const flow = analyzeEmailFlow(template as any, currentUser);

		// Store mailto URL for later use
		if (flow.mailtoUrl) {
			modalActions.setMailtoUrl(flow.mailtoUrl);
		}

		// Navigate to template page in background (seamless transition)
		coordinated.setTimeout(
			async () => {
				await goto(`/${template.slug}`, { replaceState: true });
			},
			500,
			'navigation',
			componentId
		);

		// Show loading state briefly to let user understand what's happening
		coordinated.setTimeout(
			() => {
				if (flow.mailtoUrl) {
					// Launch email using unified service
					launchEmail(flow.mailtoUrl);

					

					// Dispatch for analytics
					dispatch('used', { templateId: template.id, action: 'mailto_opened' });

					// Set up mail app detection
					setupMailAppDetection();
				}
			},
			1200,
			'modal',
			componentId
		); // Brief loading to show intent
	}

	function setupMailAppDetection() {
		let hasDetectedSwitch = false;

		// Detect when user leaves browser (mail app opens)
		const handleBlur = () => {
			if (!hasDetectedSwitch) {
				hasDetectedSwitch = true;
				// Transition to confirmation state when mail app opens
				coordinated.setTimeout(
					() => {
						modalActions.setState('confirmation');
					},
					100,
					'detection',
					componentId
				);
			}
		};

		const handleVisibilityChange = () => {
			if (document.hidden && !hasDetectedSwitch) {
				hasDetectedSwitch = true;
				coordinated.setTimeout(
					() => {
						modalActions.setState('confirmation');
					},
					100,
					'detection',
					componentId
				);
			}
		};

		// Add event listeners
		window.addEventListener('blur', handleBlur);
		document.addEventListener('visibilitychange', handleVisibilityChange);

		// Fallback timeout if no detection
		coordinated.setTimeout(
			() => {
				if (!hasDetectedSwitch) {
					modalActions.setState('confirmation');
				}
			},
			3000,
			'fallback',
			componentId
		);

		// Cleanup function
		coordinated.setTimeout(
			() => {
				window.removeEventListener('blur', handleBlur);
				document.removeEventListener('visibilitychange', handleVisibilityChange);
			},
			10000,
			'cleanup',
			componentId
		);
	}

	function handleSendConfirmation(sent: boolean) {
		if (sent) {
			// User confirmed they sent the message
			modalActions.confirmSend();

			

			// Celebration animation
			celebrationScale.set(1.05).then(() => celebrationScale.set(1));
		} else {
			// User didn't send, return to loading
			modalActions.setState('loading');
			// Could retry the flow here if needed
		}
	}

	function handleAuth() {
		// Prepare secure return cookie then redirect to Google OAuth
		fetch('/auth/prepare', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ returnTo: window.location.pathname })
		}).finally(() => {
			window.location.href = `/auth/google`;
		});
	}

	async function copyTemplateUrl() {
		try {
			// Trigger press animation
			copyButtonScale.set(0.95);
			copyButtonRotation.set(-2);
			copyButtonGlow = true;

			// Copy to clipboard
			await navigator.clipboard.writeText(shareUrl);

			// Success animation sequence
			coordinated.setTimeout(
				() => {
					copyButtonScale.set(1.02);
					copyButtonRotation.set(2);
					copySuccessWave = true;
					showCopied = true;
				},
				100,
				'copy-success',
				componentId
			);

			// Reset to normal
			coordinated.setTimeout(
				() => {
					copyButtonScale.set(1);
					copyButtonRotation.set(0);
					copyButtonGlow = false;
				},
				300,
				'copy-reset',
				componentId
			);

			// Hide success state
			coordinated.setTimeout(
				() => {
					showCopied = false;
					copySuccessWave = false;
				},
				3000,
				'copy-hide',
				componentId
			);

			
		} catch (err) {
			console.warn('Copy failed:', err);
		}
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

		

		showShareMenu = false;
	}

	
</script>

<!-- Modal Backdrop -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
	onclick={handleClose}
	onkeydown={(e) => {
		if (e.key === 'Escape') handleClose();
	}}
	role="dialog"
	aria-modal="true"
	aria-label="Template modal"
	tabindex="0"
	in:fade={{ duration: 200 }}
	out:fade={{ duration: 200 }}
>
	<!-- Modal Container -->
	<div
		class="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
		onclick={(e) => {
			e.stopPropagation();
		}}
		onkeydown={(e) => {
			e.stopPropagation();
		}}
		role="document"
		in:scale={{ duration: 300, start: 0.9, easing: backOut }}
		out:scale={{ duration: 200, start: 1, easing: quintOut }}
	>
		<!-- Dynamic Content Based on State -->
		{#if currentState === 'auth_required'}
			<!-- Auth Required State -->
			<div class="p-8 text-center">
				<div class="mb-6">
					<div
						class="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-blue-100"
					>
						<Zap class="h-8 w-8 text-blue-600" />
					</div>
					<h2 class="mb-2 text-2xl font-bold text-slate-900">Ready to make your voice heard?</h2>
					<p class="mb-6 text-slate-600">
						Sign in to auto-fill your information and join {(
							template.metrics.sent || 0
						).toLocaleString()} others taking action.
					</p>
				</div>

				<div class="space-y-4">
					<Button variant="primary" size="lg" classNames="w-full" onclick={handleAuth}>
						<Send class="mr-2 h-5 w-5" />
						Sign In & Send Message
					</Button>

					<button onclick={handleClose} class="text-sm text-slate-500 hover:text-slate-700">
						Maybe later
					</button>
				</div>
			</div>
		{:else if currentState === 'loading'}
			<!-- Loading State - mailto is being resolved -->
			<div class="p-8 text-center" in:scale={{ duration: 500, easing: backOut }}>
				<div
					class="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-blue-100"
					style="transform: scale({$celebrationScale})"
				>
					<Send class="h-10 w-10 text-blue-600" />
				</div>
				<h3 class="mb-2 text-2xl font-bold text-slate-900">Opening your email app...</h3>
				<p class="mb-6 text-slate-600">Your message is ready with your information pre-filled.</p>

				<!-- Animated progress indicator -->
				<div class="mx-auto h-2 w-32 overflow-hidden rounded-full bg-slate-200">
					<div
						class="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-1000 ease-out"
						style="width: {$actionProgress * 100}%"
					></div>
				</div>
			</div>
		{:else if currentState === 'confirmation'}
			<!-- Send Confirmation State - Did user actually send? -->
			<div class="p-8 text-center" in:scale={{ duration: 500, easing: backOut }}>
				<div
					class="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-blue-100"
				>
					<Send class="h-10 w-10 text-blue-600" />
				</div>
				<h3 class="mb-2 text-2xl font-bold text-slate-900">Did you send your message?</h3>
				<p class="mb-6 text-slate-600">Help us track real impact by confirming your send.</p>

				<div class="flex justify-center gap-3">
					<Button
						variant="primary"
						size="lg"
						classNames="flex-1 max-w-40"
						onclick={() => handleSendConfirmation(true)}
					>
						<CheckCircle2 class="mr-2 h-5 w-5" />
						Yes, sent
					</Button>
					<Button
						variant="secondary"
						size="lg"
						classNames="flex-1 max-w-40"
						onclick={() => handleSendConfirmation(false)}
					>
						<ArrowRight class="mr-2 h-5 w-5 rotate-180" />
						No, try again
					</Button>
				</div>
			</div>
		{:else if currentState === 'celebration'}
			<!-- Professional Celebration State -->
			<div class="flex h-full flex-col">
				<!-- Clean Header -->
				<div class="border-b border-slate-100 p-6">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-3">
							<div
								class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-green-100"
								style="transform: scale({$celebrationScale})"
							>
								<CheckCircle2 class="h-5 w-5 text-green-600" />
							</div>
							<div>
								<h2 class="text-lg font-semibold text-slate-900">Message sent successfully</h2>
								<p class="text-sm text-slate-600">Your voice has been added to the campaign</p>
							</div>
						</div>
						<button
							onclick={handleClose}
							class="rounded-full p-2 text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-600"
						>
							<X class="h-5 w-5" />
						</button>
					</div>
				</div>

				<!-- Content -->
				<div class="flex-1 space-y-6 p-6">
					<!-- Impact Counter -->
					<div class="text-center">
						<div class="mb-1 text-3xl font-bold text-slate-900">
							You + {(template.metrics.sent || 0).toLocaleString()} others
						</div>
						<p class="text-sm text-slate-600">Real voices creating real change</p>
					</div>

					<!-- Prominent URL Copy Section -->
					<div class="rounded-xl border-2 border-slate-200 bg-slate-50 p-6">
						<div class="mb-4 text-center">
							<h3 class="mb-2 text-lg font-semibold text-slate-900">Share this campaign</h3>
							<p class="text-sm text-slate-600">Help others join the movement</p>
						</div>

						<!-- The URL Display -->
						<div class="mb-4 rounded-lg border border-slate-300 bg-white p-4">
							<div class="flex items-center justify-between">
								<div class="mr-3 flex-1">
									<div class="truncate font-mono text-sm text-slate-600">
										{shareUrl}
									</div>
								</div>
								<button
									onclick={copyTemplateUrl}
									class="flex items-center gap-2 rounded-lg border px-4 py-2 transition-all duration-200 {copyButtonGlow
										? 'border-blue-400 bg-blue-50'
										: 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50'}"
									style="transform: scale({$copyButtonScale}) rotate({$copyButtonRotation}deg)"
								>
									{#if showCopied}
										<CheckCircle2 class="h-4 w-4 text-green-600" />
										<span class="text-sm font-medium text-green-600">Copied!</span>
									{:else}
										<Copy class="h-4 w-4 text-slate-600" />
										<span class="text-sm font-medium text-slate-700">Copy</span>
									{/if}
								</button>
							</div>

							<!-- Success Wave Animation -->
							{#if copySuccessWave}
								<div
									class="pointer-events-none absolute inset-0 rounded-lg bg-green-100 opacity-30"
									in:scale={{ duration: 300, start: 0.8 }}
									out:fade={{ duration: 200 }}
								></div>
							{/if}
						</div>

						<!-- Social Share -->
						<div class="flex justify-center gap-3">
							<button
								onclick={() => shareOnSocial('twitter')}
								class="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 transition-all duration-200 hover:border-slate-400 hover:bg-slate-50"
								title="Share on X"
							>
								<span class="text-sm font-bold text-black">𝕏</span>
								<span class="text-sm text-slate-700">Share</span>
							</button>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
