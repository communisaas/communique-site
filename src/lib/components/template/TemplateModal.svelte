<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	// import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { fade, fly, scale, slide } from 'svelte/transition';
	import { quintOut, backOut, elasticOut } from 'svelte/easing';
	import { spring } from 'svelte/motion';
	import { page } from '$app/stores';
	import { coordinated, useTimerCleanup } from '$lib/utils/timerCoordinator';
	import { invalidateLocationCaches } from '$lib/core/identity/cache-invalidation';
	import {
		X,
		Send,
		Users,
		Eye as _Eye,
		Share2,
		Copy,
		CheckCircle2,
		ExternalLink,
		Sparkles as _Sparkles,
		ArrowRight,
		Heart as _Heart,
		Trophy as _Trophy,
		Flame,
		QrCode,
		Download,
		ShieldCheck,
		AlertCircle
	} from '@lucide/svelte';
	import QRCode from 'qrcode';
	// import TemplateMeta from '$lib/components/template/TemplateMeta.svelte';
	// import MessagePreview from '$lib/components/landing/template/MessagePreview.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { guestState } from '$lib/stores/guestState.svelte';
	import {
		modalActions,
		modalState as _modalState,
		isModalOpen as _isModalOpen
	} from '$lib/stores/modalSystem.svelte';
	import { analyzeEmailFlow, launchEmail } from '$lib/services/emailService';
	// import TemplatePreview from '$lib/components/landing/template/TemplatePreview.svelte';
	import SubmissionStatus from '$lib/components/submission/SubmissionStatus.svelte';
	import CWCProgressTracker from '$lib/components/template/CWCProgressTracker.svelte';
	import DeliveryJourney from '$lib/components/delivery/DeliveryJourney.svelte';
	import type { DeliveryResult } from '$lib/components/delivery/delivery-types';
	import VerificationGate from '$lib/components/auth/VerificationGate.svelte';
	import ProofGenerator from '$lib/components/template/ProofGenerator.svelte';
	import AddressCollectionForm from '$lib/components/onboarding/AddressCollectionForm.svelte';
	import type { ComponentTemplate } from '$lib/types/component-props';
	import type { Template } from '$lib/types/template';
	import { parseRecipientConfig } from '$lib/utils/deriveTargetPresentation';

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

	// Multi-target type definitions
	interface MultiTargetInfo {
		hasCongressional: boolean;
		hasDecisionMakers: boolean;
		isMultiTarget: boolean;
		decisionMakerNames: string[];
	}

	/**
	 * Detect if template targets both Congressional AND decision-makers
	 */
	function detectMultiTarget(tpl: ComponentTemplate): MultiTargetInfo {
		const config = parseRecipientConfig(tpl.recipient_config);

		const hasCongressional = tpl.deliveryMethod === 'cwc' || config?.cwcRouting === true;

		const decisionMakers = config?.decisionMakers ?? [];
		const emails = config?.emails ?? [];

		const hasDecisionMakers = decisionMakers.length > 0 || emails.length > 0;

		const decisionMakerNames = decisionMakers.slice(0, 2).map((dm) => dm.shortName || dm.name);

		return {
			hasCongressional,
			hasDecisionMakers,
			isMultiTarget: hasCongressional && hasDecisionMakers,
			decisionMakerNames
		};
	}

	// Component ID for timer coordination
	const componentId = 'template-modal-' + Math.random().toString(36).substring(2, 15);

	// Modal States - access from modalActions (not a store, just a getter)
	const currentState = $derived(modalActions.modalState);

	let showCopied = $state(false);
	let _showShareMenu = $state(false);
	let actionProgress = spring(0, { stiffness: 0.2, damping: 0.8 });
	let celebrationScale = spring(1, { stiffness: 0.3, damping: 0.6 });
	let submissionId = $state<string | null>(null);
	let deliveryResults = $state<DeliveryResult[] | null>(null);

	// Verification gate state
	let showVerificationGate = $state(false);
	let verificationGateRef = $state<VerificationGate | null>(null);

	// Address collection state (for congressional templates)
	let needsAddress = $state(false);
	let collectingAddress = $state(false);

	// Enhanced URL copy component state
	let copyButtonScale = spring(1, { stiffness: 0.4, damping: 0.8 });
	let copyButtonRotation = spring(0, { stiffness: 0.3, damping: 0.7 });
	let copyButtonGlow = $state(false);
	let copySuccessWave = $state(false);

	// QR code state
	let qrCodeDataUrl = $state<string>('');
	let showQRCode = $state(false);
	let showPreWrittenMessages = $state(false);

	// CWC job results state (for conditional .gov verification)
	let cwcJobResults = $state<any[]>([]);
	let hasSenateDelivery = $derived(
		cwcJobResults.some(
			(r) =>
				r.chamber === 'senate' &&
				r.success &&
				r.messageId &&
				!r.messageId.startsWith('SIM-') &&
				!r.messageId.startsWith('HOUSE-SIM-')
		)
	);

	// Multi-target state tracking
	let multiTargetInfo = $state<MultiTargetInfo | null>(null);
	let multiTargetProgress = $state({
		mailtoLaunched: false,
		mailtoConfirmed: false,
		cwcStarted: false,
		cwcComplete: false,
		cwcResults: null as { success: boolean; office: string; chamber?: string }[] | null
	});

	// Track component lifecycle for navigation guard
	let componentActive = true;

	// Generate share URL for template
	const shareUrl = $derived(`${$page.url.origin}/s/${template.slug}`);

	// Pre-written share messages for different contexts
	const shareMessages = $derived(() => {
		const actionCount = template.metrics?.sent || 0;
		const category = template.category.toLowerCase();

		return {
			// Short & urgent (Twitter, Discord) - <280 chars
			short:
				actionCount > 1000
					? `🔥 ${actionCount.toLocaleString()}+ people coordinating: "${template.title}"\n\n${shareUrl}`
					: `"${template.title}"\n\n${shareUrl}`,

			// Medium (Slack, group chats)
			medium: `Coordinating on ${category}.\n\n"${template.title}"\n\n${actionCount > 0 ? `${actionCount.toLocaleString()} people already sent. ` : ''}Takes 2 minutes: ${shareUrl}`,

			// Long (Email, Reddit)
			long: `I'm sending this.\n\n"${template.title}"\n\n${template.description}\n\n${actionCount > 1000 ? `${actionCount.toLocaleString()}+ people already sent this. ` : actionCount > 100 ? `${actionCount.toLocaleString()} people acted. ` : ''}Takes 2 minutes.\n\n${shareUrl}`,

			// SMS-friendly (under 160 chars)
			sms:
				actionCount > 0
					? `${template.title} - Join ${actionCount.toLocaleString()}+: ${shareUrl}`
					: `${template.title} - ${shareUrl}`
		};
	});

	// Store event handlers for proper cleanup
	let mailAppBlurHandler: (() => void) | null = null;
	let mailAppVisibilityHandler: (() => void) | null = null;

	// Initialize modal and auto-trigger mailto for ALL users (viral QR code flow)
	onMount(() => {
		// Don't manipulate scroll here - UnifiedModal handles it
		// Don't call modalActions.open - parent component handles it

		// Detect multi-target FIRST
		multiTargetInfo = detectMultiTarget(template);

		if (multiTargetInfo.isMultiTarget) {
			console.log('[TemplateModal] Multi-target template detected');
			modalActions.setState('multi-target-briefing');
			return;
		}

		// Single-target flows (unchanged)
		if (template.deliveryMethod === 'cwc') {
			console.log('[TemplateModal] Congressional template detected, initiating CWC flow');
			submitCongressionalMessage();
			return;
		}

		// Decision-makers only (mailto flow)
		handleUnifiedEmailFlow();
	});

	onDestroy(() => {
		// Mark component as inactive to guard navigation callbacks
		componentActive = false;

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
			// Any blur within 3 seconds means email client opened
			if (Date.now() - detectionStartTime < 3000) {
				handleDetection(true);
			}
		};

		mailAppVisibilityHandler = () => {
			if (document.hidden && Date.now() - detectionStartTime < 3000) {
				handleDetection(true);
			}
		};

		// Add event listeners
		window.addEventListener('blur', mailAppBlurHandler);
		document.addEventListener('visibilitychange', mailAppVisibilityHandler);

		// OPTIMISTIC APPROACH: Assume mailto: worked unless we have evidence it didn't
		// Wait 2 seconds - if user never left the window, they might not have an email client configured
		coordinated.setTimeout(
			() => {
				if (!hasDetectedSwitch) {
					// CHANGED: Default to success (assume mailto: worked)
					// Only show error if window NEVER lost focus during the entire flow
					// This prevents false-negatives when user quickly returns to browser
					handleDetection(true);
				}
			},
			2000,
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

	/**
	 * Handle address collection complete
	 * Continue to verification gate (if needed) then submission
	 */
	async function handleAddressComplete(
		_event: CustomEvent<{
			address: string;
			verified: boolean;
			representatives: unknown[];
			district: string;
			streetAddress: string;
			city: string;
			state: string;
			zipCode: string;
		}>
	) {
		const { streetAddress, city, state, zipCode, district, verified } = _event.detail;

		// Save address to database
		try {
			const { api } = await import('$lib/core/api/client');

			const result = await api.post('/user/address', {
				street: streetAddress,
				city,
				state,
				zip: zipCode,
				congressional_district: district,
				verified
			});

			if (!result.success) {
				console.error('[Template Modal] Failed to save address:', result.error);
				// TODO: Show error state
				return;
			}

			console.log('[Template Modal] Address saved successfully');

			// Invalidate stale location caches (old address/district data)
			await invalidateLocationCaches();

			// Update page data to reflect new address
			if ($page.data?.user) {
				$page.data.user.street = streetAddress;
				$page.data.user.city = city;
				$page.data.user.state = state;
				$page.data.user.zip = zipCode;
				$page.data.user.congressional_district = district;
			}

			// Close address collection
			collectingAddress = false;
			needsAddress = false;

			// Continue with submission flow
			// Check verification gate, then submit
			if (user?.id && verificationGateRef) {
				const isVerified = await verificationGateRef.checkVerification();

				if (!isVerified) {
					showVerificationGate = true;
					return;
				}
			}

			// Proceed to submission
			await submitCongressionalMessage();
		} catch (error) {
			console.error('[Template Modal] Address save error:', error);
			// TODO: Show error state
		}
	}

	/**
	 * Submit Congressional message with direct CWC API submission (MVP version)
	 * HACKATHON: Bypasses ZK proof generation for demo purposes
	 */
	async function submitCongressionalMessage() {
		try {
			console.log('[Template Modal] Starting ZKP submission flow');

			// Set loading state - this will now trigger the ProofGenerator component
			modalActions.setState('cwc-submission');

			// The ProofGenerator component handles the rest:
			// 1. Loading credentials
			// 2. Generating proof
			// 3. Encrypting witness (with address)
			// 4. Submitting to backend
		} catch (error) {
			console.error('[Template Modal] Submission error:', error);
			modalActions.setState('error');
		}
	}

	/**
	 * Handle verification complete from VerificationGate
	 * After user verifies, proceed with Congressional submission
	 */
	function handleVerificationComplete(_event: CustomEvent<{ userId: string; method: string }>) {
		console.log(
			'[Template Modal] Verification complete, proceeding with submission:',
			_event.detail
		);
		showVerificationGate = false;

		// Now that user is verified, submit the Congressional message
		submitCongressionalMessage();

		// Celebration animation
		celebrationScale.set(1.05).then(() => celebrationScale.set(1));
	}

	/**
	 * Handle verification cancel from VerificationGate
	 * User cancelled verification - return to confirmation state
	 */
	function handleVerificationCancel() {
		console.log('[Template Modal] Verification cancelled');
		showVerificationGate = false;
		// Return to confirmation state so user can try again
		modalActions.setState('confirmation');
	}

	/**
	 * Handle proof generation complete
	 * If delivery results are included (MVP mode), go directly to delivery-journey
	 * Otherwise, fall back to tracking state for TEE processing
	 */
	function handleProofComplete(
		event: CustomEvent<{ submissionId: string; deliveryResults?: DeliveryResult[] }>
	) {
		console.log('[Template Modal] Proof generation complete:', event.detail);
		submissionId = event.detail.submissionId;

		// MVP mode: delivery results returned immediately from API
		if (event.detail.deliveryResults && event.detail.deliveryResults.length > 0) {
			deliveryResults = event.detail.deliveryResults;
			modalActions.setState('delivery-journey');
		} else {
			// Legacy/TEE mode: need to poll for results
			modalActions.setState('tracking');
		}

		// Celebration animation
		celebrationScale.set(1.05).then(() => celebrationScale.set(1));
	}

	/**
	 * Handle delivery journey completion
	 * Transition to celebration state
	 */
	function handleDeliveryComplete() {
		console.log('[Template Modal] Delivery journey complete');
		// Update CWC job results for any post-celebration logic
		if (deliveryResults) {
			cwcJobResults = deliveryResults.map((r) => ({
				office: r.office,
				chamber: r.chamber,
				success: r.outcome === 'delivered',
				messageId: r.confirmationId,
				status: r.outcome
			}));
		}
		modalActions.setState('celebration');
	}

	/**
	 * Handle proof generation cancel
	 * User cancelled proof generation - return to confirmation state
	 */
	function handleProofCancel() {
		console.log('[Template Modal] Proof generation cancelled');
		modalActions.setState('confirmation');
	}

	/**
	 * Handle proof generation error
	 * Show error and allow retry
	 */
	function handleProofError(event: CustomEvent<{ message: string }>) {
		console.error('[Template Modal] Proof generation failed:', event.detail.message);
		// For now, return to confirmation state
		// TODO: Show dedicated error state with retry option
		modalActions.setState('retry_needed');
	}

	/**
	 * User acknowledged the dual-track briefing, proceed with both channels
	 */
	function handleMultiTargetProceed() {
		console.log('[TemplateModal] Multi-target: User acknowledged, starting dual-track flow');

		// Step 1: Launch mailto for decision-makers
		// This is synchronous - opens email client
		handleUnifiedEmailFlow();
		multiTargetProgress.mailtoLaunched = true;

		// Step 2: Check if we need address for CWC
		const currentUser = $page.data?.user;
		const hasAddress = currentUser?.street && currentUser?.city && currentUser?.state && currentUser?.zip;

		if (!currentUser) {
			// Guest user: mailto sent, prompt auth for CWC
			console.log('[TemplateModal] Multi-target: Guest user, prompting auth for CWC');
			coordinated.setTimeout(
				() => {
					if (!componentActive) return;
					// Store pending CWC
					sessionStorage.setItem('pendingCwcTemplate', template.id);
					dispatch('close');
					modalActions.openModal('onboarding-modal', 'onboarding', {
						template,
						source: 'multi-target-cwc' as const,
						message: 'Create an account to contact your congressional representatives'
					});
				},
				2000,
				'guest-multi-target-auth',
				componentId
			);
			return;
		}

		if (!hasAddress) {
			// Authenticated but no address: mailto sent, collect address for CWC
			console.log('[TemplateModal] Multi-target: Collecting address for CWC');
			coordinated.setTimeout(
				() => {
					if (!componentActive) return;
					modalActions.setState('multi-target-address');
					collectingAddress = true;
					needsAddress = true;
				},
				2000,
				'multi-target-address-gate',
				componentId
			);
			return;
		}

		// Has user + address: proceed to CWC after delay
		console.log('[TemplateModal] Multi-target: Proceeding to CWC submission');
		coordinated.setTimeout(
			() => {
				if (!componentActive) return;
				multiTargetProgress.cwcStarted = true;
				submitCongressionalMessage();
			},
			3000,
			'multi-target-cwc',
			componentId
		);
	}

	/**
	 * After address collected in multi-target flow, continue to CWC
	 */
	function handleMultiTargetAddressComplete() {
		console.log('[TemplateModal] Multi-target: Address collected, proceeding to CWC');
		collectingAddress = false;
		needsAddress = false;
		multiTargetProgress.cwcStarted = true;
		submitCongressionalMessage();
	}

	async function handleSendConfirmation(sent: boolean) {
		if (sent) {
			// Check if Congressional message (Phase 1: only these are verified)
			const isCongressional = template.deliveryMethod === 'cwc';

			// DEMO MODE: For guest users on non-Congressional (mailto) templates,
			// skip onboarding and go straight to celebration for viral QR code flow
			if (!user && !isCongressional) {
				console.log(
					'[Template Modal] Guest user confirmed send - proceeding to celebration (demo mode)'
				);

				// Go straight to celebration for mailto templates
				modalActions.confirmSend();

				// Navigate to template page after brief celebration
				coordinated.setTimeout(
					async () => {
						await goto(`/s/${template.slug}`, { replaceState: true });
					},
					1500,
					'guest-navigation',
					componentId
				);

				// Celebration animation
				celebrationScale.set(1.05).then(() => celebrationScale.set(1));
				return;
			}

			// For Congressional templates, guest users need to create account first
			if (!user && isCongressional) {
				console.log('[Template Modal] Guest user on Congressional template - showing onboarding');

				// Close template modal
				dispatch('close');

				// Open onboarding modal to create account
				modalActions.openModal('onboarding-modal', 'onboarding', {
					template,
					source: 'template-modal' as const,
					// Store that they already sent the message
					skipDirectSend: true
				});

				return;
			}

			if (isCongressional) {
				// STEP 1: Check if user has address (for congressional routing)
				const currentUser = $page.data?.user || user;
				const hasAddress =
					currentUser &&
					currentUser.street &&
					currentUser.city &&
					currentUser.state &&
					currentUser.zip;

				if (!hasAddress) {
					// Need address for congressional routing - collect it inline
					console.log(
						'[Template Modal] Congressional template needs address - showing inline collection'
					);
					collectingAddress = true;
					needsAddress = true;
					return; // Stop until address collected
				}

				// STEP 2: Progressive verification gate: Check if user is verified
				if (user?.id && verificationGateRef) {
					const isVerified = await verificationGateRef.checkVerification();

					if (!isVerified) {
						// User not verified - show verification gate
						console.log('[Template Modal] User not verified, showing verification gate');
						showVerificationGate = true;
						return; // Stop submission until verification complete
					}
				}

				// STEP 3: User has address + is verified - proceed with submission
				await submitCongressionalMessage();
			} else {
				// Phase 1: Non-Congressional messages use mailto, no verification yet
				// Phase 2: Will add OAuth verification for all message types
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

	// Universal share handler (native share or clipboard)
	async function handleUniversalShare() {
		const shareData = {
			title: template.title,
			text: shareMessages().medium,
			url: shareUrl
		};

		// Try native share first (mobile)
		if (navigator.share && navigator.canShare?.(shareData)) {
			try {
				await navigator.share(shareData);
				// Track share
				console.log('[Share] Native share used');
			} catch (err) {
				// User cancelled or error
				if (err instanceof Error && err.name !== 'AbortError') {
					console.error('[Share] Native share failed:', err);
				}
			}
		} else {
			// Fallback to clipboard (desktop)
			await copyMessage(shareMessages().medium);
		}
	}

	// Copy message to clipboard
	async function copyMessage(message: string) {
		try {
			await navigator.clipboard.writeText(`${message}\n\n${shareUrl}`);
			showCopied = true;
			coordinated.setTimeout(
				() => {
					showCopied = false;
				},
				3000,
				'copy-hide',
				componentId
			);
		} catch {
			console.warn('Clipboard copy failed');
		}
	}

	// Copy just the URL
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

	// Generate QR code
	async function loadQRCode() {
		if (!qrCodeDataUrl) {
			try {
				qrCodeDataUrl = await QRCode.toDataURL(shareUrl, {
					width: 300,
					margin: 2,
					color: {
						dark: '#1E293B',
						light: '#FFFFFF'
					}
				});
			} catch (err) {
				console.error('QR code generation failed:', err);
			}
		}
		showQRCode = true;
	}

	// Download QR code as PNG
	function downloadQRCode() {
		if (!qrCodeDataUrl) return;

		const a = document.createElement('a');
		a.href = qrCodeDataUrl;
		a.download = `${template.slug}-qr-code.png`;
		a.click();
	}

	// Fetch CWC job results to check for Senate delivery
	async function fetchCWCResults() {
		if (!submissionId) return;

		try {
			const response = await fetch(`/api/cwc/jobs/${submissionId}`);
			if (!response.ok) {
				console.error('[Template Modal] Failed to fetch CWC job results');
				return;
			}

			const data = await response.json();
			if (data.results && Array.isArray(data.results)) {
				cwcJobResults = data.results;
				console.log('[Template Modal] CWC job results loaded:', {
					count: cwcJobResults.length,
					hasSenate: hasSenateDelivery
				});
			}
		} catch (error) {
			console.error('[Template Modal] Error fetching CWC results:', error);
		}
	}
</script>

<!-- Modal Content (no backdrop - UnifiedModal handles that) -->
<div
	class="flex max-h-[90vh] w-full flex-col"
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
			<h3 class="mb-2 text-xl font-bold text-slate-900 sm:text-2xl">Preparing message...</h3>
			<p class="mb-4 text-sm text-slate-600 sm:mb-6 sm:text-base">
				Opening your email with pre-filled message.
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
			<h3 class="mb-2 text-xl font-bold text-slate-900 sm:text-2xl">Did you send it?</h3>
			<p class="mb-4 text-sm text-slate-600 sm:mb-6 sm:text-base">Confirm to track this action.</p>

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
		<!-- Enhanced Celebration State -->
		<div class="flex h-full flex-col">
			<!-- Celebration Header -->
			<div class="border-b border-slate-100 p-6">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-3">
						<div
							class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-green-100 to-blue-100"
							style="transform: scale({$celebrationScale})"
						>
							<CheckCircle2 class="h-5 w-5 text-green-600" />
						</div>
						<div>
							<h2 class="text-lg font-semibold text-slate-900">🎉 Mission Accomplished!</h2>
							<p class="text-sm text-slate-600">Your message has been delivered</p>
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

			<!-- Enhanced Celebration Content -->
			<div class="flex-1 space-y-6 overflow-y-auto p-6">
				<!-- Pioneer Badge (first 10 users) or Impact Counter -->
				{#if (template.metrics?.sent ?? 0) <= 10}
					{@const sentCount = template.metrics?.sent ?? 0}
					<!-- Pioneer Badge -->
					<div
						class="rounded-lg border-2 border-orange-300 bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 p-6"
					>
						<div class="text-center">
							<div
								class="mb-3 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-600 shadow-lg"
							>
								<Flame class="h-8 w-8 text-white" />
							</div>
							<div class="mb-2 text-3xl font-bold text-slate-900">
								{#if sentCount === 0}
									🔥 FIRST SENDER 🔥
								{:else}
									Pioneer #{sentCount + 1}
								{/if}
							</div>
							<p class="mb-3 text-sm font-medium text-orange-900">
								{#if sentCount === 0}
									You just launched this movement
								{:else}
									Early adopter • Setting the standard
								{/if}
							</p>
							<div class="rounded-lg bg-white/50 px-4 py-3 text-xs text-slate-700">
								<p class="font-semibold">Your impact matters most:</p>
								<p class="mt-1">Every movement starts with pioneers like you who act first.</p>
							</div>
						</div>
					</div>
				{:else}
					{@const sentCount = template.metrics?.sent ?? 0}
					<!-- Standard Impact Counter -->
					<div class="rounded-lg border border-slate-200 bg-white p-4">
						<div class="text-center">
							<div class="mb-2 text-3xl font-bold text-slate-900">
								You + {sentCount.toLocaleString()} others
							</div>
							<p class="text-sm text-slate-600">Real voices creating real change</p>
							<div class="mt-3 flex items-center justify-center gap-2 text-xs text-slate-500">
								<Users class="h-3 w-3" />
								<span>Part of a movement</span>
							</div>
						</div>
					</div>
				{/if}

				<!-- Next Steps / Share -->
				<div class="space-y-3">
					<!-- Primary: Universal Share Button -->
					<button
						onclick={handleUniversalShare}
						class="flex w-full items-center justify-center gap-2 rounded-lg bg-participation-primary-600 px-6 py-3 font-semibold text-white shadow-sm transition-all hover:bg-participation-primary-700 active:scale-95"
					>
						<Share2 class="h-5 w-5" />
						<span>{navigator.share ? 'Share template' : 'Copy share message'}</span>
					</button>
				</div>

				{#if showCopied}
					<div
						class="rounded-lg bg-green-50 px-4 py-2 text-center text-sm text-green-700"
						in:scale={{ duration: 200 }}
						out:fade={{ duration: 200 }}
					>
						✓ Copied to clipboard!
					</div>
				{/if}

				<!-- QR Code -->
				<button
					onclick={loadQRCode}
					class="w-full text-sm text-slate-600 underline hover:text-slate-900"
				>
					<QrCode class="mr-1 inline h-4 w-4" />
					Show QR code for in-person sharing
				</button>

				{#if showQRCode && qrCodeDataUrl}
					<div class="rounded-lg border border-slate-200 bg-white p-4" in:scale={{ duration: 300 }}>
						<img src={qrCodeDataUrl} alt="QR code for {template.title}" class="mx-auto" />
						<p class="mb-3 mt-2 text-center text-xs text-slate-600">
							Print this for protests, meetings, or events
						</p>
						<button
							onclick={downloadQRCode}
							class="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
						>
							<Download class="h-4 w-4" />
							Download for printing
						</button>
					</div>
				{/if}

				<!-- Always Visible: Raw URL -->
				<div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
					<input
						type="text"
						readonly
						value={shareUrl}
						onclick={(e) => e.currentTarget.select()}
						class="mb-2 w-full rounded border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-700"
					/>
					<div class="flex items-center justify-between text-xs text-slate-500">
						<span>Share this link anywhere</span>
						<button
							onclick={copyTemplateUrl}
							class="text-participation-primary-600 hover:underline"
						>
							Copy URL
						</button>
					</div>
				</div>

				<!-- Senate Delivery Verification (only if actual Senate submission) -->
				{#if hasSenateDelivery}
					<div class="rounded-lg border border-blue-200 bg-blue-50 p-4" in:fade={{ duration: 400 }}>
						<div class="mb-2 flex items-center gap-2">
							<CheckCircle2 class="h-4 w-4 text-blue-600" />
							<p class="text-sm font-semibold text-blue-900">Senate Delivery Confirmed</p>
						</div>
						<p class="mb-2 text-xs text-blue-800">
							Your message was delivered through the official Senate messaging system
						</p>
						<a
							href="https://soapbox.senate.gov/api"
							target="_blank"
							rel="noopener noreferrer"
							class="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
						>
							<ExternalLink class="h-3 w-3" />
							soapbox.senate.gov/api
						</a>
					</div>
				{/if}
			</div>
		</div>
	{:else if collectingAddress}
		<!-- Address Collection State - Inline for Congressional templates -->
		<div class="relative p-6 sm:p-8" in:scale={{ duration: 500, easing: backOut }}>
			<!-- Close Button -->
			<button
				onclick={handleClose}
				class="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-600"
			>
				<X class="h-5 w-5" />
			</button>

			<AddressCollectionForm
				_template={{
					title: template.title,
					deliveryMethod: template.deliveryMethod
				}}
				oncomplete={handleAddressComplete}
			/>
		</div>
	{:else if currentState === 'multi-target-briefing' && multiTargetInfo}
		<!-- Multi-Target Briefing State -->
		<div class="relative p-6" in:scale={{ duration: 500, easing: backOut }}>
			<!-- Close Button -->
			<button
				onclick={handleClose}
				class="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-600"
			>
				<X class="h-5 w-5" />
			</button>

			<h3 class="mb-4 text-lg font-semibold text-slate-900">
				Contacting {3 + multiTargetInfo.decisionMakerNames.length} decision-makers
			</h3>

			<div class="mb-6 space-y-3">
				<!-- Your Action: Email -->
				<div class="rounded-lg border-l-4 border-amber-400 bg-amber-50 p-4">
					<div class="mb-1 flex items-center gap-2">
						<Send class="h-4 w-4 text-amber-600" />
						<span class="font-medium text-amber-900">Your email client will open</span>
					</div>
					<p class="text-sm text-amber-700">
						{multiTargetInfo.decisionMakerNames.join(', ')}
						— you'll review and send
					</p>
				</div>

				<!-- System Action: Congress -->
				<div class="rounded-lg border-l-4 border-blue-400 bg-blue-50 p-4">
					<div class="mb-1 flex items-center gap-2">
						<ShieldCheck class="h-4 w-4 text-blue-600" />
						<span class="font-medium text-blue-900">Automatic delivery to Congress</span>
					</div>
					<p class="text-sm text-blue-700">
						Your 3 representatives — we'll deliver through verified channels
					</p>
				</div>
			</div>

			<Button variant="primary" size="lg" classNames="w-full" onclick={handleMultiTargetProceed}>
				<Send class="mr-2 h-5 w-5" />
				Start — Open Email & Deliver to Congress
			</Button>
		</div>
	{:else if currentState === 'multi-target-progress'}
		<!-- Multi-Target Progress State -->
		<div class="relative p-6" in:scale={{ duration: 500, easing: backOut }}>
			<!-- Close Button -->
			<button
				onclick={handleClose}
				class="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-600"
			>
				<X class="h-5 w-5" />
			</button>

			<h3 class="mb-4 text-lg font-semibold text-slate-900">Delivery Progress</h3>

			<div class="space-y-4">
				<!-- Email Track -->
				<div class="rounded-lg border border-slate-200 p-4">
					<div class="flex items-center justify-between">
						<div>
							<p class="font-medium text-slate-900">
								Email to {multiTargetInfo?.decisionMakerNames.join(', ')}
							</p>
							<p class="text-sm text-slate-600">
								{#if multiTargetProgress.mailtoConfirmed}
									Sent
								{:else if multiTargetProgress.mailtoLaunched}
									Did you send it?
								{:else}
									Preparing...
								{/if}
							</p>
						</div>
						{#if multiTargetProgress.mailtoConfirmed}
							<CheckCircle2 class="h-5 w-5 text-green-600" />
						{:else if multiTargetProgress.mailtoLaunched}
							<div class="flex gap-2">
								<Button
									size="sm"
									onclick={() => {
										multiTargetProgress.mailtoConfirmed = true;
									}}
								>
									Yes, sent
								</Button>
								<Button size="sm" variant="ghost" onclick={() => handleUnifiedEmailFlow()}>
									Retry
								</Button>
							</div>
						{:else}
							<div
								class="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"
							></div>
						{/if}
					</div>
				</div>

				<!-- Congress Track -->
				<div class="rounded-lg border border-slate-200 p-4">
					{#if multiTargetProgress.cwcStarted}
						<CWCProgressTracker
							{submissionId}
							{template}
							onComplete={(results) => {
								multiTargetProgress.cwcComplete = true;
								multiTargetProgress.cwcResults = results;
							}}
						/>
					{:else}
						<div class="flex items-center gap-3">
							<div class="h-5 w-5 animate-pulse rounded-full bg-blue-200"></div>
							<p class="text-slate-600">Congress delivery will start after email...</p>
						</div>
					{/if}
				</div>

				<!-- Combined Completion -->
				{#if multiTargetProgress.mailtoConfirmed && multiTargetProgress.cwcComplete}
					<div
						class="rounded-lg border border-green-200 bg-green-50 p-4 text-center"
						in:scale={{ duration: 300, easing: backOut }}
					>
						<CheckCircle2 class="mx-auto mb-2 h-8 w-8 text-green-600" />
						<p class="font-medium text-green-900">
							All {3 + (multiTargetInfo?.decisionMakerNames.length ?? 0)} decision-makers contacted
						</p>
					</div>
				{/if}
			</div>
		</div>
	{:else if currentState === 'multi-target-address'}
		<!-- Multi-Target Address Collection -->
		<div class="relative p-6" in:scale={{ duration: 500, easing: backOut }}>
			<!-- Close Button -->
			<button
				onclick={handleClose}
				class="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-600"
			>
				<X class="h-5 w-5" />
			</button>

			<div class="mb-4 rounded-lg border border-green-200 bg-green-50 p-3">
				<div class="flex items-center gap-2">
					<CheckCircle2 class="h-4 w-4 text-green-600" />
					<span class="text-sm text-green-800">
						Email opened for {multiTargetInfo?.decisionMakerNames.join(', ')}
					</span>
				</div>
			</div>

			<h3 class="mb-2 text-lg font-semibold">Now, let's contact Congress</h3>
			<p class="mb-4 text-sm text-slate-600">
				Enter your address to verify your congressional district
			</p>

			<AddressCollectionForm {template} oncomplete={handleMultiTargetAddressComplete} />
		</div>
	{:else if currentState === 'cwc-submission'}
		<!-- ZKP Proof Generation & Submission State -->
		<div class="flex h-full flex-col">
			<!-- Header -->
			<div class="border-b border-slate-100 p-6">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-3">
						<div
							class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-100"
							style="transform: scale({$celebrationScale})"
						>
							<ShieldCheck class="h-5 w-5 text-blue-600" />
						</div>
						<div>
							<h2 class="text-lg font-semibold text-slate-900">Securing your message</h2>
							<p class="text-sm text-slate-600">Generating zero-knowledge proof</p>
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

			<!-- Proof Generator Component -->
			<div class="flex-1 overflow-y-auto p-6">
				{#if user?.id}
					<ProofGenerator
						userId={user.id}
						templateId={template.id}
						templateData={{
							subject: template.title,
							message: template.body || template.description,
							recipientOffices: ['Senate', 'House'] // TODO: Get actual offices
						}}
						address={guestState.state?.address || $page.data.user?.street || ''}
						mvpAddress={$page.data.user?.street
							? {
									street: $page.data.user.street,
									city: $page.data.user.city || '',
									state: $page.data.user.state || '',
									zip: $page.data.user.zip || ''
								}
							: undefined}
						userEmail={$page.data.user?.email}
						userName={$page.data.user?.first_name
							? `${$page.data.user.first_name} ${$page.data.user.last_name || ''}`.trim()
							: undefined}
						skipCredentialCheck={true}
						on:complete={handleProofComplete}
						on:cancel={handleProofCancel}
						on:error={handleProofError}
					/>
				{:else}
					<div class="flex flex-col items-center justify-center py-12 text-center">
						<AlertCircle class="mb-4 h-12 w-12 text-amber-500" />
						<h3 class="mb-2 text-lg font-semibold text-slate-900">Authentication Required</h3>
						<p class="text-sm text-slate-600">Please sign in to send verified messages.</p>
					</div>
				{/if}
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
							<p class="text-sm text-slate-600">Tracking delivery</p>
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
	{:else if currentState === 'delivery-journey'}
		<!-- Delivery Journey State - MVP mode with immediate results -->
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
							<h2 class="text-lg font-semibold text-slate-900">Reaching Congress</h2>
							<p class="text-sm text-slate-600">Your message is being delivered</p>
						</div>
					</div>
					<button
						onclick={() => {
							goto(`/s/${template.slug}`, { replaceState: true });
							handleClose();
						}}
						class="rounded-full p-2 text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-600"
					>
						<X class="h-5 w-5" />
					</button>
				</div>
			</div>

			<!-- Delivery Journey -->
			<div class="flex-1 overflow-y-auto p-6">
				{#if submissionId && deliveryResults}
					<DeliveryJourney
						{submissionId}
						results={deliveryResults}
						template={{ title: template.title, category: template.category }}
						onComplete={handleDeliveryComplete}
					/>
				{:else}
					<!-- Fallback if data missing -->
					<div class="rounded-lg border border-slate-200 bg-white p-4 text-center">
						<Send class="mx-auto mb-3 h-8 w-8 text-participation-primary-600" />
						<p class="text-slate-600">Message processing started</p>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<!-- Verification Gate Modal -->
{#if user?.id}
	<VerificationGate
		bind:this={verificationGateRef}
		userId={user.id}
		templateSlug={template.slug}
		bind:showModal={showVerificationGate}
		on:verified={handleVerificationComplete}
		on:cancel={handleVerificationCancel}
	/>
{/if}
