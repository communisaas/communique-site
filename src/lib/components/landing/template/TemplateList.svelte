<script lang="ts">
	import { ChevronRight } from '@lucide/svelte';
	// import { spring } from 'svelte/motion';
	import { preloadData } from '$app/navigation';
	import type { Template, TemplateGroup } from '$lib/types/template';
	// import ChannelBadge from '$lib/components/ui/ChannelBadge.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import MessageMetrics from './MessageMetrics.svelte';
	import SkeletonTemplate from '$lib/components/ui/SkeletonTemplate.svelte';

	interface Props {
		groups: TemplateGroup[];
		selectedId: string | null;
		onSelect: (id: string) => void;
		loading?: boolean;
	}

	let { groups, selectedId, onSelect, loading = false }: Props = $props();

	// Flatten groups into single array for keyboard navigation
	const allTemplates = $derived(groups.flatMap((g) => g.templates));

	let hoveredTemplate = $state<string | null>(null);

	function handleTemplateHover(templateId: string, isHovering: boolean) {
		hoveredTemplate = isHovering ? templateId : null;

		// Preload template page on hover
		if (isHovering) {
			const template = allTemplates.find((t) => t.id === templateId);
			if (template?.slug) {
				preloadData(`/s/${template.slug}`);
			}
		}
	}

	function handleKeydown(__event: KeyboardEvent, templateId: string, index: number) {
		if (__event.key === 'Enter' || __event.key === ' ') {
			__event.preventDefault();
			onSelect(templateId);
			// Dispatch custom event to notify parent to move focus
			const customEvent = new CustomEvent('movePreviewFocus');
			window.dispatchEvent(customEvent);
		} else if (__event.key === 'Tab' && __event.shiftKey) {
			// If we're at the first template and shift+tab, let it go to previous element
			if (index === 0) return;

			// Otherwise, prevent default to handle our own focus management
			__event.preventDefault();
			const buttons = document.querySelectorAll('[data-template-button]');
			const prevButton = buttons[index - 1] as HTMLElement;
			prevButton?.focus();
		} else if (__event.key === 'Tab' && !__event.shiftKey) {
			// When reaching the last template
			if (index === allTemplates.length - 1) {
				// If this template is selected, let focus continue naturally
				if (templateId === selectedId) return;

				// Otherwise, dispatch event to move focus to current preview
				__event.preventDefault();
				const customEvent = new CustomEvent('movePreviewFocus');
				window.dispatchEvent(customEvent);
				return;
			}

			// Otherwise continue with template list navigation
			__event.preventDefault();
			const buttons = document.querySelectorAll('[data-template-button]');
			const nextButton = buttons[index + 1] as HTMLElement;
			nextButton?.focus();
		}
	}
</script>

<div class="space-y-6 md:space-y-8" data-testid="template-list">
	{#if loading}
		<!-- Loading State using SkeletonTemplate -->
		{#each Array(3) as _, index}
			<SkeletonTemplate variant="list" animate={true} classNames="template-loading-{index}" />
		{/each}
	{:else}
		{#each groups as group, groupIndex (group.title)}
			<!-- Section Header -->
			<div class="space-y-3 md:space-y-4">
				<div class="flex items-center justify-between">
					<h3 class="text-sm font-semibold uppercase tracking-wide text-slate-700">
						{group.title}
					</h3>
					<span class="text-xs font-medium text-slate-500">
						{group.templates.length} {group.templates.length === 1 ? 'template' : 'templates'}
					</span>
				</div>

				<!-- Templates in this group -->
				{#each group.templates as template, templateIndex (template.id)}
					{@const isCongressional = template.deliveryMethod === 'cwc'}
					{@const isHovered = hoveredTemplate === template.id}
					{@const globalIndex = allTemplates.findIndex((t) => t.id === template.id)}
					<button
						type="button"
						data-template-button
						data-template-id={template.id}
						data-testid="template-button-{template.id}"
						class="relative flex w-full items-start justify-between gap-3 rounded-md border-2 border-l-4 p-3 text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-lg md:p-4"
						style="will-change: transform; backface-visibility: hidden;"
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
						onkeydown={(e) => handleKeydown(e, template.id, globalIndex)}
					>
						<div class="min-w-0 flex-1">
							<div class="flex flex-wrap items-center gap-2">
								<Badge variant={isCongressional ? 'congressional' : 'direct'} size="sm">
									{isCongressional ? 'US Congress' : 'Email'}
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
			</div>
		{/each}
	{/if}
</div>
