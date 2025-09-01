<script lang="ts">
	import { browser } from '$app/environment';
	import type { Template } from '$lib/types/template';
	import { Mail, Users, ClipboardCopy, ClipboardCheck } from '@lucide/svelte';

	import TemplateTips from './TemplateTips.svelte';
	import MessagePreview from './MessagePreview.svelte';
	import Popover from '$lib/components/ui/Popover.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { extractRecipientEmails } from '$lib/types/templateConfig';
	import { fade } from 'svelte/transition';
	import { onDestroy, onMount, tick, createEventDispatcher } from 'svelte';
	import { spring } from 'svelte/motion';
	import { isMobile } from '$lib/utils/browserUtils';
	import { coordinated, useTimerCleanup } from '$lib/utils/timerCoordinator';

	const dispatch = createEventDispatcher();
	const componentId = 'TemplatePreview_' + Math.random().toString(36).substr(2, 9);

	let {
		template,
		inModal = false,
		user = null,
		onScroll = () => {},
		onOpenModal = null,
		onSendMessage = null
	}: {
		template: Template;
		inModal?: boolean;
		user?: { id: string; name: string | null } | null;
		onScroll?: (isAtBottom: boolean, scrollProgress?: number) => void;
		onOpenModal?: (() => void) | null;
		onSendMessage?: (() => void) | null;
	} = $props();

	const recipients = $derived(extractRecipientEmails(template?.recipient_config));
	const recipientCount = $derived(recipients.length);
	const recipientPreview = $derived(recipients.slice(0, inModal ? 1 : 2).join(' • '));

	let copied = $state(false);
	let copyTimeout: string | null = null;
	let showEmailModal = $state(false);
	let actionProgress = spring(0, { stiffness: 0.2, damping: 0.8 });

	// Capture user-provided Personal Connection to apply in JS-land before mailto
	let personalConnectionValue: string = $state('');
	
	// Persist and restore personalization data across OAuth flow
	$effect(() => {
		if (browser && personalConnectionValue) {
			// Save to session storage whenever it changes
			sessionStorage.setItem(`template_${template.id}_personalization`, JSON.stringify({
				personalConnection: personalConnectionValue,
				timestamp: Date.now()
			}));
		}
	});

	let previewContainer: HTMLDivElement;
	let firstFocusableElement: HTMLButtonElement | HTMLAnchorElement | HTMLInputElement;
	let lastFocusableElement: HTMLButtonElement | HTMLAnchorElement | HTMLInputElement;
	let templateListButtons: NodeListOf<HTMLButtonElement>;

	function handleKeyboardNav(event: KeyboardEvent) {
		// Allow focus events to pass through for popover triggers
		if ((event.target as HTMLElement).closest('[aria-haspopup="true"]')) {
			return;
		}

		if (event.key === 'Tab') {
			const templateButtons = Array.from(templateListButtons);
			const selectedIndex = templateButtons.findIndex(
				(button) => button.getAttribute('data-template-id') === template.id.toString()
			);
			const lastTemplateIndex = templateButtons.length - 1;

			if (event.shiftKey) {
				// Handle shift+tab from first element
				if (document.activeElement === firstFocusableElement) {
					event.preventDefault();
					// Focus the current template button
					templateButtons[selectedIndex]?.focus();
				}
			} else {
				// Handle forward tab from last element
				if (document.activeElement === lastFocusableElement) {
					// If we're not at the last template in the list,
					// move focus to the next template
					if (selectedIndex < lastTemplateIndex) {
						event.preventDefault();
						templateButtons[selectedIndex + 1]?.focus();
					}
					// Otherwise, let focus continue naturally
				}
			}
		}
	}

	// Listen for focus move request (when template is selected)
	onMount(() => {
		// Restore personalization data if returning from OAuth
		if (browser) {
			console.log('🔍 Checking for restoration...', {
				templateId: template.id,
				hasUser: !!user,
				userState: user ? 'loaded' : 'not loaded'
			});
			
			const savedData = sessionStorage.getItem(`template_${template.id}_personalization`);
			const pendingSend = sessionStorage.getItem(`template_${template.id}_pending_send`);
			
			console.log('💾 Session data:', {
				hasSavedData: !!savedData,
				pendingSend,
				savedDataPreview: savedData ? savedData.substring(0, 50) + '...' : 'none'
			});
			
			if (savedData) {
				try {
					const parsed = JSON.parse(savedData);
					// Only restore if data is less than 30 minutes old
					if (parsed.timestamp && Date.now() - parsed.timestamp < 30 * 60 * 1000) {
						personalConnectionValue = parsed.personalConnection || '';
						console.log('✅ Restored personalization:', parsed.personalConnection);
						
						// Check if we should auto-trigger send flow
						if (pendingSend === 'true' && user) {
							// Clear the pending flag
							sessionStorage.removeItem(`template_${template.id}_pending_send`);
							// Auto-trigger send flow after a brief delay
							coordinated.setTimeout(() => {
								// Apply Personal Connection to template if available
								const pc = personalConnectionValue?.trim();
								if (pc && pc.length > 0 && typeof template?.message_body === 'string') {
									console.log('📝 Applying Personal Connection:', pc);
									template.message_body = template.message_body.replace(
										/\[Personal Connection\]/g,
										pc
									);
								}
								
								// Let parent handle the full flow (modal + email launch)
								console.log('📧 Auto-triggering send message...');
								if (onSendMessage) {
									onSendMessage();
								} else {
									console.error('❌ No onSendMessage callback available');
								}
							}, 500, 'auto-send', componentId);
						}
					} else {
						// Data is too old, clean it up
						sessionStorage.removeItem(`template_${template.id}_personalization`);
					}
				} catch (e) {
					console.error('Failed to restore personalization data:', e);
				}
			}
		}
		
		const handleMovePreviewFocus = () => {
			if (firstFocusableElement) {
				firstFocusableElement.focus();
			}
		};

		window.addEventListener('movePreviewFocus', handleMovePreviewFocus);

		return () => {
			window.removeEventListener('movePreviewFocus', handleMovePreviewFocus);
		};
	});

	// Find first and last focusable elements after template changes
	$effect(() => {
		if (template && previewContainer) {
			tick().then(() => {
				const focusableElements = previewContainer.querySelectorAll(
					'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
				);
				firstFocusableElement = focusableElements[0] as
					| HTMLButtonElement
					| HTMLAnchorElement
					| HTMLInputElement;
				lastFocusableElement = focusableElements[focusableElements.length - 1] as
					| HTMLButtonElement
					| HTMLAnchorElement
					| HTMLInputElement;

				// Get reference to template list buttons
				templateListButtons = document.querySelectorAll('[data-template-button]');
			});
		}
	});

	async function copyToClipboard() {
		const csvEmails = recipients.join(', ');

		try {
			if (!browser) return;
			// Try modern clipboard API first
			if (navigator.clipboard && window.isSecureContext) {
				await navigator.clipboard.writeText(csvEmails);
			} else {
				// Fallback for older browsers
				const textArea = document.createElement('textarea');
				textArea.value = csvEmails;
				textArea.style.position = 'fixed';
				textArea.style.left = '-999999px';
				textArea.style.top = '-999999px';
				document.body.appendChild(textArea);
				textArea.focus();
				textArea.select();
				document.execCommand('copy');
				textArea.remove();
			}

			// Show success feedback
			copied = true;

			// Clear any existing timeout
			if (copyTimeout) {
				// clear existing feedback timer
				coordinated.autoClose(() => {}, 0, componentId);
			}

			// Reset after 2 seconds
			copyTimeout = coordinated.feedback(
				() => {
					copied = false;
				},
				2000,
				componentId
			);
		} catch (err) {}
	}

	onDestroy(() => {
		useTimerCleanup(componentId)();
	});

	function handleScrollStateChange(scrollState: unknown) {
		dispatch('scrollStateChange', scrollState);
	}

	function handleTouchStateChange(touchState: unknown) {
		dispatch('touchStateChange', touchState);
	}

	function handleMobileClick(event: MouseEvent) {
		// Don't intercept button clicks
		const target = event.target as HTMLElement;
		if (target.tagName === 'BUTTON' || target.closest('button')) {
			return;
		}

		const isMobileDevice = isMobile();

		if (!inModal && onOpenModal && isMobileDevice) {
			event.preventDefault();
			event.stopPropagation();
			onOpenModal();
		}
	}
</script>

<div
	bind:this={previewContainer}
	data-testid="template-preview"
	class="border-slate-200 bg-white
               {inModal ? 'h-full border-0' : 'rounded-xl border'} 
               {inModal ? 'p-4 sm:p-6' : 'p-3 sm:p-4 md:p-6 lg:p-8'} 
               {inModal ? '' : 'sm:sticky sm:top-8'}
               {inModal ? '' : 'h-[calc(100vh-4rem)]'}
               {!inModal && onOpenModal ? 'cursor-pointer md:cursor-default' : ''}
               flex flex-col overflow-hidden"
	onclick={handleMobileClick}
	role={!inModal && onOpenModal ? 'button' : 'region'}
	{...!inModal && onOpenModal ? { tabindex: 0 } : {}}
	aria-label={!inModal && onOpenModal ? 'Open template in modal' : 'Template preview'}
>
	{#if template}
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			role="region"
			aria-label="Template preview navigation"
			onkeydown={handleKeyboardNav}
			class="flex flex-1 cursor-default flex-col overflow-visible border-0 bg-transparent text-left outline-none"
		>
			<div class="mb-4 shrink-0">
				<TemplateTips isCertified={template.type === 'certified'} />
			</div>

			<!-- Share Link Button - Always available -->
			<div class="mb-4 flex shrink-0 items-center gap-2">
					<button
						onclick={async () => {
							const shareUrl = `${window.location.origin}/${template.slug}`;
							try {
								await navigator.clipboard.writeText(shareUrl);
								copied = true;
								if (copyTimeout) coordinated.autoClose(() => {}, 0, componentId);
								copyTimeout = coordinated.feedback(
									() => {
										copied = false;
									},
									2000,
									componentId
								);
							} catch (err) {}
						}}
						class="inline-flex cursor-pointer items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 transition-all duration-200 hover:bg-blue-100 hover:text-blue-800"
					>
						{#if copied}
							<ClipboardCheck class="h-3 w-3" />
							Copied!
						{:else}
							<ClipboardCopy class="h-3 w-3" />
							Share Link
						{/if}
					</button>
			</div>

			{#if template.type === 'direct' && recipients.length}
				<div class="mb-4 flex shrink-0 items-center gap-2 text-sm text-slate-600">
					<Users class="h-4 w-4 text-slate-500" />
					<div class="flex items-center gap-1.5 overflow-hidden">
						<!-- Only show preview on larger screens -->
						<span class="hidden truncate text-slate-600 sm:block">
							{recipientPreview}
						</span>

						<!-- Recipients popover -->
						<Popover let:open>
							<svelte:fragment slot="trigger" let:triggerAction>
								<button
									use:triggerAction
									class="inline-flex cursor-alias items-center rounded-md bg-slate-100
                                           px-1.5 py-0.5 font-medium
                                           text-slate-600 transition-all
                                           duration-200
                                           hover:bg-slate-200 hover:text-slate-800"
								>
									<!-- Different text for small vs larger screens -->
									<span class="max-w-[120px] cursor-text truncate sm:hidden">
										{recipientCount}
										{recipientCount === 1 ? 'Recipient' : 'Recipients'}
									</span>
									<span class="hidden max-w-[120px] truncate sm:inline">
										+{recipientCount - (inModal ? 1 : 2)} more
									</span>
								</button>
							</svelte:fragment>

							<div class="w-[280px] max-w-[calc(100vw-2rem)] cursor-default p-4">
								<div class="flex items-start gap-4 text-sm sm:text-base">
									<button
										onclick={(e) => {
											e.stopPropagation();
											copyToClipboard();
										}}
										class="shrink-0 cursor-pointer rounded-lg bg-blue-50 p-2 transition-all
                                               duration-200 hover:bg-blue-100 focus:outline-none focus:ring-2
                                               focus:ring-blue-200 focus:ring-offset-2 active:bg-blue-200"
										aria-label="Copy all recipient emails to clipboard"
									>
										{#if copied}
											<div in:fade={{ duration: 200 }}>
												<ClipboardCheck class="h-6 w-6 text-green-500" />
											</div>
										{:else}
											<div in:fade={{ duration: 200 }}>
												<ClipboardCopy class="h-6 w-6 text-blue-400" />
											</div>
										{/if}
									</button>
									<div class="min-w-0 flex-1">
										<h3 class="mb-1 truncate font-medium text-slate-900">
											All Recipients ({recipientCount})
										</h3>
										<div class="cursor-text space-y-1 text-sm text-slate-600">
											{#each recipients as email}
												<div class="truncate">{email}</div>
											{/each}
										</div>
									</div>
								</div>
							</div>
						</Popover>
					</div>
				</div>
			{/if}

			<div
				class={inModal
					? 'min-h-0 flex-1 touch-pan-y overflow-hidden'
					: 'min-h-0 flex-1 touch-pan-y overflow-hidden'}
			>
				<MessagePreview
					preview={template.message_body}
					{template}
					{user}
					{onScroll}
					onscrollStateChange={handleScrollStateChange}
					ontouchStateChange={handleTouchStateChange}
					onvariableChange={(e) => {
						if (e?.name === 'Personal Connection') {
							personalConnectionValue = e.value ?? '';
						}
					}}
				/>
			</div>

			{#if onSendMessage}
				<div class="mt-4 flex justify-center">
					{#if template.deliveryMethod === 'both'}
						<Button
							variant="primary"
							testId="contact-congress-button"
							classNames="bg-green-600 hover:bg-green-700 focus:ring-green-600/50 w-full"
							onclick={() => {
								// Apply Personal Connection into the template body in JS-land
								const pc = personalConnectionValue?.trim();
								if (pc && pc.length > 0 && typeof template?.message_body === 'string') {
									template.message_body = template.message_body.replace(
										/\[Personal Connection\]/g,
										pc
									);
								}
								// Only show email modal if user is authenticated
								if (user) {
									showEmailModal = true;
									actionProgress.set(1);
									coordinated.transition(
										() => {
											onSendMessage?.();
											coordinated.autoClose(
												() => {
													showEmailModal = false;
													actionProgress.set(0);
												},
												1500,
												componentId
											);
										},
										100,
										componentId
									);
								} else {
									// Save personalization and set pending flag before auth
									if (browser) {
										// Ensure personalization is saved
										if (personalConnectionValue) {
											sessionStorage.setItem(`template_${template.id}_personalization`, JSON.stringify({
												personalConnection: personalConnectionValue,
												timestamp: Date.now()
											}));
										}
										// Set pending send flag
										sessionStorage.setItem(`template_${template.id}_pending_send`, 'true');
									}
									// Let parent handle auth flow
									if (onSendMessage) {
										onSendMessage();
									}
								}
							}}
						>
							<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 2.676-.732 5.162-2.217 7.162-4.416.43-.462.753-.96.938-1.49z"
								/>
							</svg>
							{user ? 'Contact Your Representatives' : 'Sign in to Contact Congress'}
						</Button>
					{:else}
						<Button
							variant="primary"
							testId="send-email-button"
							classNames="bg-blue-600 hover:bg-blue-700 focus:ring-blue-600/50 w-full"
							onclick={() => {
								// Apply Personal Connection into the template body in JS-land
								const pc = personalConnectionValue?.trim();
								if (pc && pc.length > 0 && typeof template?.message_body === 'string') {
									template.message_body = template.message_body.replace(
										/\[Personal Connection\]/g,
										pc
									);
								}
								// Only show email modal if user is authenticated
								if (user) {
									showEmailModal = true;
									actionProgress.set(1);
									coordinated.transition(
										() => {
											onSendMessage?.();
											coordinated.autoClose(
												() => {
													showEmailModal = false;
													actionProgress.set(0);
												},
												1500,
												componentId
											);
										},
										100,
										componentId
									);
								} else {
									// Save personalization and set pending flag before auth
									if (browser) {
										// Ensure personalization is saved
										if (personalConnectionValue) {
											sessionStorage.setItem(`template_${template.id}_personalization`, JSON.stringify({
												personalConnection: personalConnectionValue,
												timestamp: Date.now()
											}));
										}
										// Set pending send flag
										sessionStorage.setItem(`template_${template.id}_pending_send`, 'true');
									}
									// Let parent handle auth flow
									if (onSendMessage) {
										onSendMessage();
									}
								}
							}}
						>
							<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
								/>
							</svg>
							{user ? 'Send This Message' : 'Sign in to Send'}
						</Button>
					{/if}
				</div>
			{/if}
		</div>
	{:else}
		<div class="py-12 text-center text-slate-500">Select a template to preview</div>
	{/if}
</div>

<!-- Email Loading Modal -->
{#if showEmailModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
		<div
			class="animate-in zoom-in-95 mx-4 w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl duration-200"
		>
			<div class="text-center">
				<!-- Animated mail icon -->
				<div class="relative mb-4">
					<svg
						class="mx-auto h-16 w-16 animate-pulse text-blue-600"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
						/>
					</svg>
					<!-- Flying papers animation -->
					<div class="absolute -right-1 -top-1 h-3 w-3 animate-ping rounded-full bg-blue-400"></div>
				</div>

				<h3 class="mb-2 text-lg font-semibold text-slate-900">Opening your email app...</h3>
				<p class="mb-4 text-sm text-slate-600">
					Your message is ready with your information pre-filled.
				</p>

				<!-- Animated progress bar -->
				<div class="mx-auto h-2 w-32 overflow-hidden rounded-full bg-slate-200">
					<div
						class="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-1000 ease-out"
						style="width: {$actionProgress * 100}%"
					></div>
				</div>
			</div>
		</div>
	</div>
{/if}
