<script lang="ts">
	import { ChevronRight } from '@lucide/svelte';
	import type { Template } from '$lib/types/template';
	import ChannelBadge from '$lib/components/ui/ChannelBadge.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import MessageMetrics from './MessageMetrics.svelte';
	import SkeletonTemplate from '$lib/components/ui/SkeletonTemplate.svelte';

	interface Props {
		templates: Template[];
		selectedId: string | null;
		onSelect: (id: string) => void;
		loading?: boolean;
	}

	const { templates, selectedId, onSelect, loading = false }: Props = $props();
	

	function handleKeydown(event: KeyboardEvent, templateId: string, index: number) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onSelect(templateId);
			// Dispatch custom event to notify parent to move focus
			const customEvent = new CustomEvent('movePreviewFocus');
			window.dispatchEvent(customEvent);
		} else if (event.key === 'Tab' && event.shiftKey) {
			// If we're at the first template and shift+tab, let it go to previous element
			if (index === 0) return;

			// Otherwise, prevent default to handle our own focus management
			event.preventDefault();
			const buttons = document.querySelectorAll('[data-template-button]');
			const prevButton = buttons[index - 1] as HTMLElement;
			prevButton?.focus();
		} else if (event.key === 'Tab' && !event.shiftKey) {
			// When reaching the last template
			if (index === templates.length - 1) {
				// If this template is selected, let focus continue naturally
				if (templateId === selectedId) return;

				// Otherwise, dispatch event to move focus to current preview
				event.preventDefault();
				const customEvent = new CustomEvent('movePreviewFocus');
				window.dispatchEvent(customEvent);
				return;
			}

			// Otherwise continue with template list navigation
			event.preventDefault();
			const buttons = document.querySelectorAll('[data-template-button]');
			const nextButton = buttons[index + 1] as HTMLElement;
			nextButton?.focus();
		}
	}
</script>

<div class="space-y-3 md:space-y-4" data-testid="template-list">
	{#if loading}
		<!-- Loading State using SkeletonTemplate -->
		{#each Array(3) as _, index}
			<SkeletonTemplate 
				variant="list" 
				animate={true}
				classNames="template-loading-{index}"
			/>
		{/each}
	{:else}
		{#each templates as template, index (template.id)}
			{@const isCongressional = template.deliveryMethod === 'both'}
			<button
				type="button"
				data-template-button
				data-template-id={template.id}
				data-testid="template-button-{template.id}"
				class="relative flex w-full items-start justify-between gap-3 rounded-lg border-2 border-l-4 p-3 text-left transition-all md:p-4"
				class:cursor-pointer={selectedId !== template.id}
				class:cursor-default={selectedId === template.id}
				class:border-direct-400={selectedId === template.id && !isCongressional}
				class:border-congressional-400={selectedId === template.id && isCongressional}
				class:bg-direct-50={selectedId === template.id && !isCongressional}
				class:bg-congressional-50={selectedId === template.id && isCongressional}
				class:border-slate-200={selectedId !== template.id}
				class:border-l-congressional-500={isCongressional}
				class:border-l-direct-500={!isCongressional}
				class:hover:border-direct-200={selectedId !== template.id && !isCongressional}
				class:hover:border-congressional-200={selectedId !== template.id && isCongressional}
				onclick={() => onSelect(template.id)}
				onkeydown={(e) => handleKeydown(e, template.id, index)}
			>
				<div class="min-w-0 flex-1">
					<div class="flex flex-wrap items-center gap-2">
						<Badge
							variant={isCongressional ? 'congressional' : 'direct'}
							size="sm"
						>
							{isCongressional ? 'Certified Delivery' : 'Direct Outreach'}
						</Badge>
						<span class="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 md:text-sm">
							{template.category}
						</span>
					</div>

					<h3 class="mt-2 truncate font-medium text-slate-900 md:mt-3">
						{template.title}
					</h3>

					<p class="mb-2 line-clamp-2 text-xs text-slate-600 md:mb-3 md:text-sm">
						{template.description}
					</p>

					<MessageMetrics {template} />
				</div>

				<!-- Mobile indicator -->
				<div class="shrink-0 text-slate-400 md:hidden">
					<ChevronRight class="h-5 w-5" />
				</div>
			</button>
		{/each}
	{/if}
</div>
