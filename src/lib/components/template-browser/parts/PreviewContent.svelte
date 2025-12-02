<script lang="ts">
	import type { Template } from '$lib/types/template';
	import { Users, ClipboardCopy, ClipboardCheck, BookOpen } from '@lucide/svelte';
	import TemplateTips from '../TemplateTips.svelte';
	import MessagePreview from '../MessagePreview.svelte';
	import Popover from '$lib/components/ui/Popover.svelte';
	import ShareButton from '$lib/components/ui/ShareButton.svelte';
	import { extractRecipientEmails } from '$lib/types/templateConfig';
	import { fade } from 'svelte/transition';
	import { coordinated } from '$lib/utils/timerCoordinator';
	import SourceCard from '$lib/components/template/creator/SourceCard.svelte';
	import ResearchLog from '$lib/components/template/creator/ResearchLog.svelte';
	import { hasCitations } from '$lib/utils/message-processing';

	let {
		template,
		inModal,
		context = 'list',
		user,
		onScroll,
		personalConnectionValue = $bindable(),
		onScrollStateChange,
		onTouchStateChange,
		componentId,
		expandToContent = false
	}: {
		template: Template;
		inModal: boolean;
		context?: 'list' | 'page' | 'modal';
		user: { id: string; name: string | null } | null;
		onScroll: (isAtBottom: boolean, scrollProgress?: number) => void;
		personalConnectionValue: string;
		onScrollStateChange: (scrollState: unknown) => void;
		onTouchStateChange: (touchState: unknown) => void;
		componentId: string;
		expandToContent?: boolean;
	} = $props();

	const recipients = $derived(extractRecipientEmails(template?.recipient_config));
	const recipientCount = $derived(recipients.length);
	const recipientPreview = $derived(recipients.slice(0, inModal ? 1 : 2).join(' • '));

	let copied = $state(false);
	let copyTimeout: string | null = null;
	let showResearchLog = $state(false);

	// Check if template has sources and citations
	const hasSources = $derived(template.sources && template.sources.length > 0);
	const hasResearchLog = $derived(template.research_log && template.research_log.length > 0);
	const hasCitationsInMessage = $derived(hasCitations(template.message_body));

	async function copyToClipboard() {
		const csvEmails = recipients.join(', ');

		try {
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
				coordinated.autoClose(
					() => {
						/* Clear timeout callback */
					},
					0,
					componentId
				);
			}

			// Reset after 2 seconds
			copyTimeout = coordinated.feedback(
				() => {
					copied = false;
				},
				2000,
				componentId
			);
		} catch {
			/* Ignore clipboard errors - copy operation failed silently */
		}
	}
</script>

<div class="relative mb-4 shrink-0 space-y-4 overflow-visible">
	<TemplateTips isCertified={template.type === 'certified'} />

	<!-- Prominent Share Button - Context aware positioning -->
	{#if context === 'page'}
		<!-- On template page, show larger, more prominent share button -->
		<div class="flex items-center gap-3">
			<ShareButton
				url={`${typeof window !== 'undefined' ? window.location.origin : ''}/s/${template.slug}`}
				_title={template.title || template.title}
				variant="magical"
				size="lg"
			/>
			<div class="text-sm text-gray-600">
				<div class="font-medium">{template.metrics?.sent || 0} people shared this</div>
				<div class="text-xs text-gray-500">Help spread the message</div>
			</div>
		</div>
	{:else}
		<!-- In list/modal context, show smaller share button -->
		<ShareButton
			url={`${typeof window !== 'undefined' ? window.location.origin : ''}/s/${template.slug}`}
			_title={template.title || template.title}
			variant="primary"
			size="default"
		/>
	{/if}
</div>

{#if template.type === 'direct' && recipients.length}
	<div class="mb-4 flex shrink-0 items-center gap-2 text-sm text-gray-600">
		<Users class="h-4 w-4 text-gray-500" />
		<div class="flex items-center gap-1.5 overflow-hidden">
			<!-- Only show preview on larger screens -->
			<span class="hidden truncate text-gray-600 sm:block">
				{recipientPreview}
			</span>

			<!-- Recipients popover -->
			<Popover>
				{#snippet trigger(triggerAction)}
					<button
						onclick={triggerAction.trigger}
						aria-controls={triggerAction['aria-controls']}
						class="inline-flex cursor-alias items-center rounded-md bg-gray-100
                               px-1.5 py-0.5 font-medium
                               text-gray-600 transition-all
                               duration-200
                               hover:bg-gray-200 hover:text-gray-800"
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
				{/snippet}

				<div class="w-[280px] max-w-[calc(100vw-2rem)] cursor-default p-4">
					<div class="flex items-start gap-4 text-sm sm:text-base">
						<button
							onclick={(e) => {
								e.stopPropagation();
								copyToClipboard();
							}}
							class="shrink-0 cursor-pointer rounded-lg bg-participation-primary-50 p-2 transition-all
                                   duration-200 hover:bg-participation-primary-100 focus:outline-none focus:ring-2
                                   focus:ring-participation-primary-200 focus:ring-offset-2 active:bg-participation-primary-200"
							aria-label="Copy all recipient emails to clipboard"
						>
							{#if copied}
								<div in:fade={{ duration: 200 }}>
									<ClipboardCheck class="h-6 w-6 text-green-500" />
								</div>
							{:else}
								<div in:fade={{ duration: 200 }}>
									<ClipboardCopy class="h-6 w-6 text-participation-primary-400" />
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
		{context}
		{onScroll}
		onscrollStateChange={onScrollStateChange}
		ontouchStateChange={onTouchStateChange}
		onvariableChange={(e) => {
			if (e?.name === 'Personal Connection') {
				personalConnectionValue = e.value ?? '';
			}
		}}
		{expandToContent}
	/>

	<!-- Sources section (when available) -->
	{#if hasSources && hasCitationsInMessage}
		<div class="mt-6 space-y-3">
			<div class="flex items-center gap-2">
				<BookOpen class="h-5 w-5 text-slate-600" />
				<h4 class="font-semibold text-slate-900">
					Sources ({template.sources?.length || 0})
				</h4>
			</div>

			<div class="space-y-2">
				{#each template.sources || [] as source}
					<SourceCard {source} />
				{/each}
			</div>
		</div>
	{/if}

	<!-- Research log (when available) -->
	{#if hasResearchLog}
		<div class="mt-4">
			<ResearchLog researchLog={template.research_log || []} bind:expanded={showResearchLog} />
		</div>
	{/if}
</div>
