<script lang="ts">
	import { ChevronRight } from '@lucide/svelte';
	import { spring } from 'svelte/motion';
	import { preloadData } from '$app/navigation';
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
	
	let hoveredTemplate = $state<string | null>(null);
	
	function handleTemplateHover(templateId: string, isHovering: boolean) {
		hoveredTemplate = isHovering ? templateId : null;
		
		// Preload template page on hover
		if (isHovering) {
			const template = templates.find(t => t.id === templateId);
			if (template?.slug) {
				preloadData(`/s/${template.slug}`);
			}
		}
	}
	

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
			{@const isCongressional = template.deliveryMethod === 'certified'}
			{@const isHovered = hoveredTemplate === template.id}
			<button
				type="button"
				data-template-button
				data-template-id={template.id}
				data-testid="template-button-{template.id}"
				class="relative flex w-full items-start justify-between gap-3 rounded-md border-2 border-l-4 p-3 text-left transition-all duration-200 md:p-4 transform-gpu hover:scale-[1.02] hover:shadow-lg"
				class:cursor-pointer={selectedId !== template.id}
				class:cursor-default={selectedId === template.id}
				class:border-direct-400={selectedId === template.id && !isCongressional}
				class:border-congressional-400={selectedId === template.id && isCongressional}
				class:bg-direct-50={selectedId === template.id && !isCongressional}
				class:bg-congressional-50={selectedId === template.id && isCongressional}
				class:border-slate-200={selectedId !== template.id && !isHovered}
				class:border-slate-300={selectedId !== template.id && isHovered}
				class:border-l-congressional-500={isCongressional}
				class:border-l-direct-500={!isCongressional}
				onmouseenter={() => handleTemplateHover(template.id, true)}
				onmouseleave={() => handleTemplateHover(template.id, false)}
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
						<span class="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600 md:text-sm">
							{template.category}
						</span>
					</div>

					<h3 class="mt-2 truncate font-medium text-gray-900 md:mt-3">
						{template.title}
					</h3>

					<p class="mb-2 line-clamp-2 text-xs text-gray-600 md:mb-3 md:text-sm">
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
