<script lang="ts">
    import type { Template } from '$lib/types/template';
    import { Mail, Users, ClipboardCopy, ClipboardCheck } from 'lucide-svelte';
    import TemplateHeader from './TemplateHeader.svelte';
    import DeliveryInfo from './DeliveryInfo.svelte';
    import TemplateTips from './TemplateTips.svelte';
    import MessagePreview from './MessagePreview.svelte';
    import Popover from '$lib/components/ui/Popover.svelte';
    import { fade } from 'svelte/transition';
	import { onDestroy, onMount, tick } from 'svelte';
    
    export let template: Template;
    export let inModal = false;
    export let onScroll: (isAtBottom: boolean, scrollProgress?: number) => void = () => {};

    $: recipientCount = template?.recipientEmails?.length ?? 0;
    $: recipientPreview = template?.recipientEmails
        ?.slice(0, inModal ? 1 : 2)
        .join(' • ');

    let copied = false;
    let copyTimeout: NodeJS.Timeout;
    
    let previewContainer: HTMLDivElement;
    let firstFocusableElement: HTMLButtonElement | HTMLAnchorElement | HTMLInputElement;
    let lastFocusableElement: HTMLButtonElement | HTMLAnchorElement | HTMLInputElement;
    let templateListButtons: NodeListOf<HTMLButtonElement>;
    
    function handleKeyboardNav(event: KeyboardEvent) {
        if (event.key === 'Tab') {
            const templateButtons = Array.from(templateListButtons);
            const selectedIndex = templateButtons.findIndex(
                button => button.getAttribute('data-template-id') === template.id.toString()
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
            firstFocusableElement = focusableElements[0] as HTMLButtonElement | HTMLAnchorElement | HTMLInputElement;
            lastFocusableElement = focusableElements[focusableElements.length - 1] as HTMLButtonElement | HTMLAnchorElement | HTMLInputElement;
            
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
</script>

<div
    bind:this={previewContainer}
    class="bg-white border-slate-200 
           {inModal ? 'border-0 h-full' : 'border rounded-xl'} 
           {inModal ? 'p-4 sm:p-6' : 'p-3 sm:p-4 md:p-6 lg:p-8'} 
           {inModal ? '' : 'sm:sticky sm:top-8'}
           {inModal ? '' : 'h-[calc(100vh-4rem)]'}
           flex flex-col overflow-hidden"
>
    {#if template}
        <button 
            type="button"
            aria-label="Template preview navigation"
            on:keydown={handleKeyboardNav}
            class="outline-none flex-1 flex flex-col text-left bg-transparent border-0 overflow-hidden"
        >
            <div class="shrink-0 w-full">
                <TemplateHeader {template} />
            </div>
            <div class="shrink-0">
                <DeliveryInfo {template} />
            </div>
            
            {#if template.type === 'direct' && template.recipientEmails?.length}
                <div class="shrink-0 flex items-center gap-2 text-sm text-slate-600 my-2">
                    <Users class="w-4 h-4 text-slate-500" />
                    <div class="flex items-center gap-1.5 overflow-hidden">
                        <!-- Only show preview on larger screens -->
                        <span class="hidden sm:block truncate text-slate-600">
                            {recipientPreview}
                        </span>
                        
                        <!-- Always show popover on small screens -->
                        <Popover>
                            <svelte:fragment slot="trigger" let:trigger>
                                <button 
                                    use:trigger
                                    class="inline-flex items-center px-1.5 py-0.5 rounded-md
                                           bg-slate-100 hover:bg-slate-200 
                                           text-slate-600 hover:text-slate-800
                                           font-medium
                                           transition-all duration-200"
                                >
                                    <!-- Different text for small vs larger screens -->
                                    <span class="sm:hidden truncate max-w-[120px]">
                                        {recipientCount} {recipientCount === 1 ? 'Recipient' : 'Recipients'}
                                    </span>
                                    <span class="hidden sm:inline truncate max-w-[120px]">
                                        +{recipientCount - (inModal ? 1 : 2)} more
                                    </span>
                                </button>
                            </svelte:fragment>
                            
                            <div class="w-[280px] p-4 max-w-[calc(100vw-2rem)]">
                                <div class="flex items-start gap-4 sm:text-base text-sm">
                                    <button
                                        on:click|stopPropagation={copyToClipboard}
                                        class="shrink-0 p-2 bg-blue-50 rounded-lg hover:bg-blue-100 active:bg-blue-200
                                               transition-all duration-200 focus:outline-none 
                                               focus:ring-2 focus:ring-blue-200 focus:ring-offset-2"
                                        aria-label="Copy all recipient emails to clipboard"
                                    >
                                        {#if copied}
                                            <div in:fade={{ duration: 200 }}>
                                                <ClipboardCheck class="w-6 h-6 text-green-500" />
                                            </div>
                                        {:else}
                                            <div in:fade={{ duration: 200 }}>
                                                <ClipboardCopy class="w-6 h-6 text-blue-400" />
                                            </div>
                                        {/if}
                                    </button>
                                    <div class="min-w-0 flex-1">
                                        <h3 class="font-medium text-slate-900 mb-1 truncate">
                                            All Recipients ({recipientCount})
                                        </h3>
                                        <div class="space-y-1 text-slate-600 text-sm">
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
            
            <div class="flex-1 min-h-0 my-4 overflow-hidden">
                <MessagePreview 
                    preview={template.preview}
                    {onScroll}
                />
            </div>
            <div class="shrink-0">
                <TemplateTips isCertified={template.type === 'certified'} />
            </div>
        </button>
    {:else}
        <div class="text-center text-slate-500 py-12">
            Select a template to preview
        </div>
    {/if}
</div>
