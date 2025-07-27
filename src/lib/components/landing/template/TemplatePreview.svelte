<script lang="ts">
	import type { Template } from '$lib/types/template';
	import { Mail, Users, ClipboardCopy, ClipboardCheck } from '@lucide/svelte';

	import TemplateTips from './TemplateTips.svelte';
	import MessagePreview from './MessagePreview.svelte';
	import Popover from '$lib/components/ui/Popover.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { extractRecipientEmails } from '$lib/types/templateConfig';
	import { fade } from 'svelte/transition';
	import { onDestroy, onMount, tick, createEventDispatcher } from 'svelte';
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
		user?: { id: string; name: string } | null;
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
				coordinated.clearTimer(copyTimeout);
			}

			// Reset after 2 seconds
			copyTimeout = coordinated.feedback(() => {
				copied = false;
			}, 2000, componentId);
		} catch (err) {
		}
	}

	onDestroy(() => {
		useTimerCleanup(componentId)();
	});

	function handleScrollStateChange(event: CustomEvent) {
		const scrollState = event.detail;
		dispatch('scrollStateChange', scrollState);
	}

	function handleTouchStateChange(event: CustomEvent) {
		const touchState = event.detail;
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
	class="border-slate-200 bg-white
           {inModal ? 'h-full border-0' : 'rounded-xl border'} 
           {inModal ? 'p-4 sm:p-6' : 'p-3 sm:p-4 md:p-6 lg:p-8'} 
           {inModal ? '' : 'sm:sticky sm:top-8'}
           {inModal ? '' : 'h-[calc(100vh-4rem)]'}
           {!inModal && onOpenModal ? 'cursor-pointer md:cursor-default' : ''}
           flex flex-col overflow-hidden"
	onclick={handleMobileClick}
	role={!inModal && onOpenModal ? 'button' : 'region'}
	tabindex={!inModal && onOpenModal ? 0 : -1}
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
			<div class="shrink-0">
				<TemplateTips isCertified={template.type === 'certified'} />
			</div>

			{#if template.type === 'direct' && recipients.length}
				<div class="my-2 flex shrink-0 items-center gap-2 text-sm text-slate-600">
					<Users class="h-4 w-4 text-slate-500" />
					<div class="flex items-center gap-1.5 overflow-hidden">
						<!-- Only show preview on larger screens -->
						<span class="hidden truncate text-slate-600 sm:block">
							{recipientPreview}
						</span>

						<!-- Always show popover on small screens -->
						<Popover let:open>
							<svelte:fragment slot="trigger" let:trigger>
								<button
									use:trigger
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
										onclick={(e) => { e.stopPropagation(); copyToClipboard(); }}
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

			<div class="my-4 min-h-0 flex-1 touch-pan-y overflow-hidden">
				<MessagePreview
					preview={template.preview}
					{template}
					{user}
					{onScroll}
					onscrollStateChange={handleScrollStateChange}
					ontouchStateChange={handleTouchStateChange}
				/>
			</div>

			{#if onSendMessage}
				<div class="mt-4 flex justify-center">
					{#if template.deliveryMethod === 'both'}
						<Button 
							variant="primary" 
							size="lg"
							classNames="bg-green-600 hover:bg-green-700 focus:ring-green-600/50 w-full"
							onclick={() => {
								showEmailModal = true;
								coordinated.transition(() => {
									onSendMessage?.();
									coordinated.autoClose(() => {
										showEmailModal = false;
									}, 1500, componentId);
								}, 100, componentId);
							}}
						>
							<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 2.676-.732 5.162-2.217 7.162-4.416.43-.462.753-.96.938-1.49z"/>
							</svg>
							{user ? 'Contact Your Representatives' : 'Sign in to Contact Congress'}
						</Button>
					{:else}
						<Button 
							variant="primary" 
							size="lg"
							classNames="bg-blue-600 hover:bg-blue-700 focus:ring-blue-600/50 w-full"
							onclick={() => {
								showEmailModal = true;
								coordinated.transition(() => {
									onSendMessage?.();
									coordinated.autoClose(() => {
										showEmailModal = false;
									}, 1500, componentId);
								}, 100, componentId);
							}}
						>
							<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"/>
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
		<div class="bg-white rounded-2xl p-8 mx-4 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
			<div class="text-center">
				<!-- Animated mail icon -->
				<div class="mb-4 relative">
					<svg class="h-16 w-16 mx-auto text-blue-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
					</svg>
					<!-- Flying papers animation -->
					<div class="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full animate-ping"></div>
				</div>
				
				<h3 class="text-lg font-semibold text-slate-900 mb-2">
					Opening Mail App
				</h3>
				<p class="text-sm text-slate-600">
					Your message is ready to send
				</p>
				
				<!-- Progress dots -->
				<div class="flex justify-center mt-4 space-x-1">
					<div class="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
					<div class="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
					<div class="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
				</div>
			</div>
		</div>
	</div>
{/if}
