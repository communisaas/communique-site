<script lang="ts">
	import type { Template } from '$lib/types/template';
	import { Mail, Users, ClipboardCopy, ClipboardCheck } from 'lucide-svelte';
	import TemplateHeader from './TemplateHeader.svelte';

	import TemplateTips from './TemplateTips.svelte';
	import MessagePreview from './MessagePreview.svelte';
	import Popover from '$lib/components/ui/Popover.svelte';
	import { fade } from 'svelte/transition';
	import { onDestroy, onMount, tick, createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	export let template: Template;
	export let inModal = false;
	export let onScroll: (isAtBottom: boolean, scrollProgress?: number) => void = () => {};

	$: recipientCount = template?.recipientEmails?.length ?? 0;
	$: recipientPreview = template?.recipientEmails?.slice(0, inModal ? 1 : 2).join(' • ');

	let copied = false;
	let copyTimeout: NodeJS.Timeout;

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
	$: if (template && previewContainer) {
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

	async function copyToClipboard() {
		const csvEmails = template?.recipientEmails?.join(', ') ?? '';

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
			if (copyTimeout) clearTimeout(copyTimeout);

			// Reset after 2 seconds
			copyTimeout = setTimeout(() => {
				copied = false;
			}, 2000);
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}

	onDestroy(() => {
		if (copyTimeout) clearTimeout(copyTimeout);
	});

	function handleScrollStateChange(event: CustomEvent) {
		const scrollState = event.detail;
		dispatch('scrollStateChange', scrollState);
	}

	function handleTouchStateChange(event: CustomEvent) {
		const touchState = event.detail;
		dispatch('touchStateChange', touchState);
	}
</script>

<div
	bind:this={previewContainer}
	class="border-slate-200 bg-white
           {inModal ? 'h-full border-0' : 'rounded-xl border'} 
           {inModal ? 'p-4 sm:p-6' : 'p-3 sm:p-4 md:p-6 lg:p-8'} 
           {inModal ? '' : 'sm:sticky sm:top-8'}
           {inModal ? '' : 'h-[calc(100vh-4rem)]'}
           flex flex-col overflow-hidden"
>
	{#if template}
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			role="region"
			aria-label="Template preview navigation"
			on:keydown={handleKeyboardNav}
			class="flex flex-1 cursor-default flex-col overflow-visible border-0 bg-transparent text-left outline-none"
		>
			<div class="w-full shrink-0">
				<TemplateHeader {template} />
			</div>
			<div class="shrink-0">
				<TemplateTips isCertified={template.type === 'certified'} />
			</div>

			{#if template.type === 'direct' && template.recipientEmails?.length}
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
										on:click|stopPropagation={copyToClipboard}
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
											{#each template.recipientEmails as email}
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
					{onScroll}
					on:scrollStateChange={handleScrollStateChange}
					on:touchStateChange={handleTouchStateChange}
				/>
			</div>
		</div>
	{:else}
		<div class="py-12 text-center text-slate-500">Select a template to preview</div>
	{/if}
</div>
