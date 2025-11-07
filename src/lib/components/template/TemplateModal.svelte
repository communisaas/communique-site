<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	// import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { fade, fly, scale, slide } from 'svelte/transition';
	import { quintOut, backOut, elasticOut } from 'svelte/easing';
	import { spring } from 'svelte/motion';
	import { page } from '$app/stores';
	import { coordinated, useTimerCleanup } from '$lib/utils/timerCoordinator';
	import {
		X,
		Send,
		Users as _Users,
		Eye as _Eye,
		Share2 as _Share2,
		Copy,
		CheckCircle2,
		ExternalLink,
		Sparkles as _Sparkles,
		ArrowRight,
		Heart as _Heart,
		Trophy as _Trophy,
		Flame as _Flame
	} from '@lucide/svelte';
	// import TemplateMeta from '$lib/components/template/TemplateMeta.svelte';
	// import MessagePreview from '$lib/components/landing/template/MessagePreview.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	// import { guestState } from '$lib/stores/guestState.svelte';
	import {
		modalActions,
		modalState as _modalState,
		isModalOpen as _isModalOpen
	} from '$lib/stores/modalSystem.svelte';
	import { analyzeEmailFlow, launchEmail } from '$lib/services/emailService';
	// import TemplatePreview from '$lib/components/landing/template/TemplatePreview.svelte';
	import SubmissionStatus from '$lib/components/submission/SubmissionStatus.svelte';
	import type { ComponentTemplate } from '$lib/types/component-props';
	import type { Template } from '$lib/types/template';

	let {
		template,
		user = null
	}: {
		template: ComponentTemplate;
		user?: { id: string; name: string } | null;
	} = $props();

	const dispatch = createEventDispatcher<{
		close: void;
		used: { templateId: string; action: 'mailto_opened' };
	}>();

	// Component ID for timer coordination
	const componentId = 'template-modal-' + Math.random().toString(36).substring(2, 15);

	// Modal States - access from modalActions (not a store, just a getter)
	const currentState = $derived(modalActions.modalState);

	let showCopied = $state(false);
	let _showShareMenu = $state(false);
	let actionProgress = spring(0, { stiffness: 0.2, damping: 0.8 });
	let celebrationScale = spring(1, { stiffness: 0.3, damping: 0.6 });
	let submissionId = $state<string | null>(null);

	// Enhanced URL copy component state
	let copyButtonScale = spring(1, { stiffness: 0.4, damping: 0.8 });
	let copyButtonRotation = spring(0, { stiffness: 0.3, damping: 0.7 });
	let copyButtonGlow = $state(false);
	let copySuccessWave = $state(false);

	// Generate share URL for template
	const shareUrl = $derived(`${$page.url.origin}/s/${template.slug}`);

	// Store event handlers for proper cleanup
	let mailAppBlurHandler: (() => void) | null = null;
	let mailAppVisibilityHandler: (() => void) | null = null;

	// Initialize modal and auto-trigger mailto for authenticated users
	onMount(() => {
		// Don't manipulate scroll here - UnifiedModal handles it
		// Don't call modalActions.open - parent component handles it

		if (user) {
			// For authenticated users, immediately start the mailto flow
			handleUnifiedEmailFlow();
		}
	});

	onDestroy(() => {
		// Don't manipulate scroll here - UnifiedModal handles it
		useTimerCleanup(componentId)();

		// Clean up event listeners
		if (mailAppBlurHandler) {
			window.removeEventListener('blur', mailAppBlurHandler);
			mailAppBlurHandler = null;
		}
		if (mailAppVisibilityHandler) {
			document.removeEventListener('visibilitychange', mailAppVisibilityHandler);
			mailAppVisibilityHandler = null;
		}
	});

	function handleClose() {
		dispatch('close');
	}

	async function handleUnifiedEmailFlow(_skipNavigation: boolean = false) {
		modalActions.setState('loading');

		// Reset and animate progress bar
		actionProgress.set(0);

		// Delay setting to 1 to allow animation
		coordinated.setTimeout(
			() => {
				actionProgress.set(1);
			},
			50,
			'progress',
			componentId
		);

		// Use unified email service
		const currentUser = $page.data?.user || user;
		const flow = analyzeEmailFlow(template as Template, currentUser);

		// Store mailto URL for later use
		if (flow.mailtoUrl) {
			modalActions.setMailtoUrl(flow.mailtoUrl);
		}

		// NOTE: Navigation removed from here - now happens after user confirms send
		// This prevents the race condition where navigation interrupts mailto

		// Show loading state briefly to let user understand what's happening
		coordinated.setTimeout(
			() => {
				if (flow.mailtoUrl) {
					// Launch email using unified service
					launchEmail(flow.mailtoUrl);

					// Dispatch for analytics
					dispatch('used', { templateId: template.id, action: 'mailto_opened' });

					// Set up enhanced mail app detection
					setupEnhancedMailAppDetection();
				}
			},
			800,
			'modal',
			componentId
		); // Shorter delay since we're not navigating
	}

	function setupEnhancedMailAppDetection() {
		// Clean up any existing handlers first
		if (mailAppBlurHandler) {
			window.removeEventListener('blur', mailAppBlurHandler);
			mailAppBlurHandler = null;
		}
		if (mailAppVisibilityHandler) {
			document.removeEventListener('visibilitychange', mailAppVisibilityHandler);
			mailAppVisibilityHandler = null;
		}

		let hasDetectedSwitch = false;
		const detectionStartTime = Date.now();

		// Helper to transition to appropriate state
		const handleDetection = (detected: boolean) => {
			if (!hasDetectedSwitch) {
				hasDetectedSwitch = true;

				// Remove listeners immediately
				if (mailAppBlurHandler) {
					window.removeEventListener('blur', mailAppBlurHandler);
					mailAppBlurHandler = null;
				}
				if (mailAppVisibilityHandler) {
					document.removeEventListener('visibilitychange', mailAppVisibilityHandler);
					mailAppVisibilityHandler = null;
				}

				if (detected) {
					// Email client likely opened - show confirmation
					modalActions.setState('confirmation');
				} else {
					// No detection - show retry option
					modalActions.setState('retry_needed');
				}
			}
		};

		// Detect when user leaves browser (mail app opens)
		mailAppBlurHandler = () => {
			// Quick detection means email client opened
			if (Date.now() - detectionStartTime < 2000) {
				handleDetection(true);
			}
		};

		mailAppVisibilityHandler = () => {
			if (document.hidden && Date.now() - detectionStartTime < 2000) {
				handleDetection(true);
			}
		};

		// Add event listeners
		window.addEventListener('blur', mailAppBlurHandler);
		document.addEventListener('visibilitychange', mailAppVisibilityHandler);

		// Shorter timeout for detection (1 second)
		// If no blur/visibility change detected, email client probably didn't open
		coordinated.setTimeout(
			() => {
				if (!hasDetectedSwitch) {
					// Check one more time if window is not focused
					if (!document.hasFocus() || document.hidden) {
						handleDetection(true);
					} else {
						// No detection - likely means email client didn't open
						handleDetection(false);
					}
				}
			},
			1000,
			'detection-timeout',
			componentId
		);

		// Final cleanup after reasonable time
		coordinated.setTimeout(
			() => {
				if (mailAppBlurHandler) {
					window.removeEventListener('blur', mailAppBlurHandler);
					mailAppBlurHandler = null;
				}
				if (mailAppVisibilityHandler) {
					document.removeEventListener('visibilitychange', mailAppVisibilityHandler);
					mailAppVisibilityHandler = null;
				}
			},
			5000,
			'cleanup',
			componentId
		);
	}

	async function handleSendConfirmation(sent: boolean) {
		if (sent) {
			// Check delivery method to determine flow
			const isCertifiedDelivery = template.deliveryMethod === 'cwc';

			if (isCertifiedDelivery) {
				// Congressional delivery - use full agent processing pipeline
				modalActions.setState('tracking');

				// Generate submission ID and trigger agent processing
				try {
					const response = await fetch('/api/n8n/process-template', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							templateId: template.id,
							userId: user?.id,
							actionType: 'cwc_message',
							stage: 'submitted'
						})
					});

					const result = await response.json();
					if (result.success && result.data?.submissionId) {
						submissionId = result.data.submissionId;
					} else {
						// Fallback - generate client-side ID
						submissionId = 'sub_' + Date.now() + '_' + Math.random().toString(36).substring(2);
					}
				} catch {
					console.error('Error occurred');
					// Fallback - generate client-side ID
					submissionId = 'sub_' + Date.now() + '_' + Math.random().toString(36).substring(2);
				}
			} else {
				// Direct outreach - skip agent processing, go straight to celebration
				modalActions.confirmSend();

				// Navigate to template page after brief celebration
				coordinated.setTimeout(
					async () => {
						await goto(`/s/${template.slug}`, { replaceState: true });
					},
					1500,
					'direct-navigation',
					componentId
				);
			}

			// Celebration animation for both paths
			celebrationScale.set(1.05).then(() => celebrationScale.set(1));
		} else {
			// User didn't send, retry the flow
			modalActions.setState('loading');

			// Clean up existing event listeners before retry
			if (mailAppBlurHandler) {
				window.removeEventListener('blur', mailAppBlurHandler);
				mailAppBlurHandler = null;
			}
			if (mailAppVisibilityHandler) {
				document.removeEventListener('visibilitychange', mailAppVisibilityHandler);
				mailAppVisibilityHandler = null;
			}

			// Re-trigger the entire email flow with skipNavigation=true
			coordinated.setTimeout(
				() => {
					handleUnifiedEmailFlow(true); // Skip navigation on retry
				},
				100,
				'retry',
				componentId
			);
		}
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
		} catch {
			console.warn('Error occurred');
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

		_showShareMenu = false;
	}
</script>

<!-- Modal Content (no backdrop - UnifiedModal handles that) -->
<div
	class="flex max-h-[90vh] w-full flex-col overflow-hidden"
	role="document"
	tabindex="-1"
	in:scale={{ duration: 300, start: 0.9, easing: backOut }}
	out:scale={{ duration: 200, start: 1, easing: quintOut }}
>
	<!-- Dynamic Content Based on State -->
	{#if currentState === 'loading'}
		<!-- Loading State - mailto is being resolved -->
		<div class="p-6 text-center sm:p-8" in:scale={{ duration: 500, easing: backOut }}>
			<div
				class="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-participation-primary-100 sm:mb-6 sm:h-20 sm:w-20"
				style="transform: scale({$celebrationScale})"
			>
				<Send class="h-8 w-8 text-participation-primary-600 sm:h-10 sm:w-10" />
			</div>
			<h3 class="mb-2 text-xl font-bold text-slate-900 sm:text-2xl">Opening your email app...</h3>
			<p class="mb-4 text-sm text-slate-600 sm:mb-6 sm:text-base">
				Your message is ready with your information pre-filled.
			</p>

			<!-- Animated progress indicator -->
			<div class="mx-auto h-2 w-32 overflow-hidden rounded-full bg-slate-200">
				<div
					class="h-full rounded-full bg-gradient-to-r from-participation-primary-500 to-participation-primary-700 transition-all duration-1000 ease-out"
					style="width: {$actionProgress * 100}%"
				></div>
			</div>
		</div>
	{:else if currentState === 'confirmation'}
		<!-- Send Confirmation State - Did user actually send? -->
		<div class="relative p-6 text-center sm:p-8" in:scale={{ duration: 500, easing: backOut }}>
			<!-- Close Button -->
			<button
				onclick={handleClose}
				class="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-600"
			>
				<X class="h-5 w-5" />
			</button>

			<div
				class="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-participation-primary-100 sm:mb-6 sm:h-20 sm:w-20"
			>
				<Send class="h-8 w-8 text-participation-primary-600 sm:h-10 sm:w-10" />
			</div>
			<h3 class="mb-2 text-xl font-bold text-slate-900 sm:text-2xl">Did you send your message?</h3>
			<p class="mb-4 text-sm text-slate-600 sm:mb-6 sm:text-base">
				Help us track real impact by confirming your send.
			</p>

			<div class="flex justify-center gap-2 sm:gap-3">
				<Button
					variant="primary"
					size="lg"
					classNames="flex-1 min-w-[120px] sm:min-w-[140px] whitespace-nowrap"
					onclick={() => handleSendConfirmation(true)}
				>
					<CheckCircle2 class="mr-2 h-5 w-5 shrink-0" />
					Yes, sent
				</Button>
				<Button
					variant="secondary"
					size="lg"
					classNames="flex-1 min-w-[120px] sm:min-w-[140px] whitespace-nowrap"
					onclick={() => handleSendConfirmation(false)}
				>
					<ArrowRight class="mr-2 h-5 w-5 shrink-0 rotate-180" />
					Try again
				</Button>
			</div>
		</div>
	{:else if currentState === 'retry_needed'}
		<!-- Retry Needed State - Email client didn't open -->
		<div class="relative p-6 text-center sm:p-8" in:scale={{ duration: 500, easing: backOut }}>
			<!-- Close Button -->
			<button
				onclick={handleClose}
				class="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-600"
			>
				<X class="h-5 w-5" />
			</button>

			<div
				class="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 sm:mb-6 sm:h-20 sm:w-20"
			>
				<ExternalLink class="h-8 w-8 text-amber-600 sm:h-10 sm:w-10" />
			</div>
			<h3 class="mb-2 text-xl font-bold text-slate-900 sm:text-2xl">Email client didn't open</h3>
			<p class="mb-4 text-sm text-slate-600 sm:mb-6 sm:text-base">
				Your email app may not be configured. Would you like to try again or copy the message
				instead?
			</p>

			<div class="flex flex-col gap-3">
				<Button
					variant="primary"
					size="lg"
					classNames="w-full"
					onclick={() => handleUnifiedEmailFlow(true)}
				>
					<Send class="mr-2 h-5 w-5" />
					Try opening email again
				</Button>

				<button
					onclick={() => {
						// Navigate to template page where they can see/copy the message
						goto(`/s/${template.slug}`);
						handleClose();
					}}
					class="text-sm text-slate-600 underline hover:text-slate-800"
				>
					View template to copy message manually
				</button>
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
							<h2 class="text-lg font-semibold text-slate-900">Message sent</h2>
							<p class="text-sm text-slate-600">Queued for delivery</p>
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
						You + {(template.metrics?.sent ?? 0).toLocaleString()} others
					</div>
					<p class="text-sm text-slate-600">Real voices creating real change</p>
				</div>

				<!-- Prominent URL Copy Section -->
				<div class="rounded-xl border-2 border-slate-200 bg-slate-50 p-6">
					<div class="mb-4 text-center">
						<h3 class="mb-2 text-lg font-semibold text-slate-900">Share this template</h3>
						<p class="text-sm text-slate-600">Others can use it too</p>
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
									? 'border-participation-primary-400 bg-participation-primary-50'
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
	{:else if currentState === 'tracking'}
		<!-- Agent Processing Tracking State -->
		<div class="flex h-full flex-col">
			<!-- Header -->
			<div class="border-b border-slate-100 p-6">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-3">
						<div
							class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-participation-primary-100"
							style="transform: scale({$celebrationScale})"
						>
							<Send class="h-5 w-5 text-participation-primary-600" />
						</div>
						<div>
							<h2 class="text-lg font-semibold text-slate-900">Message sent</h2>
							<p class="text-sm text-slate-600">Tracking delivery and impact</p>
						</div>
					</div>
					<button
						onclick={() => {
							// Navigate to template page when closing tracking
							goto(`/s/${template.slug}`, { replaceState: true });
							handleClose();
						}}
						class="rounded-full p-2 text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-600"
					>
						<X class="h-5 w-5" />
					</button>
				</div>
			</div>

			<!-- Submission Status -->
			<div class="flex-1 p-6">
				{#if submissionId}
					<SubmissionStatus
						{submissionId}
						initialStatus="sending"
						onOverride={() => {
							// Allow user to bypass agent processing
							modalActions.setState('celebration');

							// Still navigate after a delay
							coordinated.setTimeout(
								async () => {
									await goto(`/s/${template.slug}`, { replaceState: true });
								},
								2000,
								'override-navigation',
								componentId
							);
						}}
					/>
				{:else}
					<!-- Fallback if no submission ID -->
					<div class="rounded-lg border border-slate-200 bg-white p-4 text-center">
						<Send class="mx-auto mb-3 h-8 w-8 text-participation-primary-600" />
						<p class="text-slate-600">Message processing started</p>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
