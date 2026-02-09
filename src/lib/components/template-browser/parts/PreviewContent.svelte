<script lang="ts">
	import type { Template } from '$lib/types/template';
	import {
		Users,
		ClipboardCopy,
		ClipboardCheck,
		BookOpen,
		Building2,
		Landmark,
		Mail
	} from '@lucide/svelte';
	import TemplateTips from '../TemplateTips.svelte';
	import MessagePreview from '../MessagePreview.svelte';
	import Popover from '$lib/components/ui/Popover.svelte';
	import ShareButton from '$lib/components/ui/ShareButton.svelte';
	import { extractRecipientEmails } from '$lib/types/templateConfig';
	import {
		deriveTargetPresentation,
		parseRecipientConfig
	} from '$lib/utils/deriveTargetPresentation';
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
	const recipientConfig = $derived(parseRecipientConfig(template?.recipient_config));
	const decisionMakers = $derived(recipientConfig?.decisionMakers ?? []);
	const recipientCount = $derived(decisionMakers.length || recipients.length);
	const targetInfo = $derived(deriveTargetPresentation(template));

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

{#if recipientCount > 0}
	<div class="mb-4 flex shrink-0 items-center gap-2 text-sm">
		{#if targetInfo.type === 'multi-level'}
			<!-- Multi-Level: Compact vertical stack -->
			<div class="flex items-center gap-2 overflow-hidden">
				<div class="space-y-0.5">
					{#each targetInfo.targets as target}
						<div class="flex items-center gap-1.5">
							{#if target.icon === 'Capitol'}
								<Landmark class="h-3.5 w-3.5 shrink-0 text-congressional-500" />
							{:else if target.icon === 'Building'}
								<Building2 class="h-3.5 w-3.5 shrink-0 text-emerald-500" />
							{:else}
								<Users class="h-3.5 w-3.5 shrink-0 text-slate-500" />
							{/if}
							<span
								class="truncate text-sm font-medium"
								class:text-congressional-700={target.emphasis === 'federal'}
								class:text-emerald-700={target.emphasis === 'local'}
								class:text-slate-600={target.emphasis === 'neutral'}
							>
								{target.primary}
							</span>
							{#if target.secondary}
								<span class="shrink-0 text-xs text-slate-400">{target.secondary}</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{:else}
			<!-- Single-Level: Inline with icon -->
			{#if targetInfo.icon === 'Capitol'}
				<Landmark class="h-4 w-4 shrink-0 text-congressional-500" />
			{:else if targetInfo.icon === 'Building'}
				<Building2 class="h-4 w-4 shrink-0 text-emerald-500" />
			{:else if targetInfo.icon === 'Users'}
				<Users class="h-4 w-4 shrink-0 text-slate-500" />
			{:else}
				<Mail class="h-4 w-4 shrink-0 text-slate-500" />
			{/if}

			<span
				class="truncate font-medium"
				class:text-congressional-700={targetInfo.emphasis === 'federal'}
				class:text-emerald-700={targetInfo.emphasis === 'local'}
				class:text-slate-600={targetInfo.emphasis === 'neutral' || targetInfo.emphasis === 'state'}
			>
				{targetInfo.primary}
			</span>
			{#if targetInfo.secondary}
				<span class="shrink-0 text-xs text-slate-400">{targetInfo.secondary}</span>
			{/if}
		{/if}

		<!-- Detail popover -->
		{#if decisionMakers.length > 0 || recipients.length > 0}
			<Popover>
				{#snippet trigger(triggerAction)}
					<button
						onclick={triggerAction.trigger}
						aria-controls={triggerAction['aria-controls']}
						class="inline-flex shrink-0 cursor-alias items-center rounded-md bg-slate-100
                               px-1.5 py-0.5 text-xs font-medium
                               text-slate-500 transition-colors
                               duration-200
                               hover:bg-slate-200 hover:text-slate-700"
					>
						{recipientCount}
						{recipientCount === 1 ? 'recipient' : 'recipients'}
					</button>
				{/snippet}

				<div class="w-[300px] max-w-[calc(100vw-2rem)] cursor-default p-4">
					{#if decisionMakers.length > 0}
						<!-- Rich decision-maker view -->
						<div class="mb-3 flex items-center justify-between">
							<h3 class="text-sm font-semibold text-slate-900">
								Decision-Makers ({decisionMakers.length})
							</h3>
							{#if recipients.length > 0}
								<button
									onclick={(e) => {
										e.stopPropagation();
										copyToClipboard();
									}}
									class="shrink-0 cursor-pointer rounded-md p-1.5 transition-colors
									       duration-200 hover:bg-slate-100"
									aria-label="Copy all recipient emails to clipboard"
								>
									{#if copied}
										<div in:fade={{ duration: 200 }}>
											<ClipboardCheck class="h-4 w-4 text-green-500" />
										</div>
									{:else}
										<div in:fade={{ duration: 200 }}>
											<ClipboardCopy class="h-4 w-4 text-slate-400" />
										</div>
									{/if}
								</button>
							{/if}
						</div>
						<div class="space-y-2.5">
							{#each decisionMakers as dm}
								<div class="flex items-start gap-2.5">
									<div
										class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
										class:bg-congressional-100={targetInfo.type === 'district-based' || (targetInfo.type === 'multi-level')}
										class:text-congressional-700={targetInfo.type === 'district-based' || (targetInfo.type === 'multi-level')}
										class:bg-emerald-100={targetInfo.type === 'location-specific'}
										class:text-emerald-700={targetInfo.type === 'location-specific'}
										class:bg-slate-100={targetInfo.type === 'universal'}
										class:text-slate-600={targetInfo.type === 'universal'}
									>
										{dm.name.charAt(0)}
									</div>
									<div class="min-w-0 flex-1">
										<div class="truncate text-sm font-medium text-slate-900">
											{dm.name}
										</div>
										{#if dm.role || dm.organization}
											<div class="truncate text-xs text-slate-500">
												{#if dm.role && dm.organization}
													{dm.role}, {dm.organization}
												{:else}
													{dm.role || dm.organization}
												{/if}
											</div>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<!-- Fallback: email-only view (legacy templates) -->
						<div class="flex items-start gap-3">
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
										<ClipboardCheck class="h-5 w-5 text-green-500" />
									</div>
								{:else}
									<div in:fade={{ duration: 200 }}>
										<ClipboardCopy class="h-5 w-5 text-participation-primary-400" />
									</div>
								{/if}
							</button>
							<div class="min-w-0 flex-1">
								<h3 class="mb-1 text-sm font-medium text-slate-900">
									Recipients ({recipients.length})
								</h3>
								<div class="cursor-text space-y-0.5 text-xs text-slate-500">
									{#each recipients as email}
										<div class="truncate">{email}</div>
									{/each}
								</div>
							</div>
						</div>
					{/if}
				</div>
			</Popover>
		{/if}
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
