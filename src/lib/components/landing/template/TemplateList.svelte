<script lang="ts">
	import { ChevronRight } from '@lucide/svelte';
	import type { Template } from '$lib/types/template';
	import Badge from '$lib/components/ui/Badge.svelte';
	import MessageMetrics from './MessageMetrics.svelte';

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
		<!-- Swiss/Bauhaus Loading State -->
		{#each Array(3) as _, index}
			<div class="template-loading-card rounded-lg border border-slate-200 p-3 md:p-4" data-testid="template-loading-{index}">
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0 flex-1 space-y-3">
						<!-- Badge area with geometric shapes -->
						<div class="flex items-center gap-2">
							<div class="loading-badge h-6 w-16 rounded-full bg-slate-200"></div>
							<div class="loading-badge h-6 w-20 rounded bg-slate-100"></div>
						</div>

						<!-- Title with mathematical proportions -->
						<div
							class="loading-title h-5 w-3/4 rounded bg-slate-200"
							style="animation-delay: {index * 150}ms"
						></div>

						<!-- Description lines with Swiss grid -->
						<div class="space-y-2">
							<div
								class="loading-line h-3 w-full rounded bg-slate-100"
								style="animation-delay: {index * 150 + 75}ms"
							></div>
							<div
								class="loading-line h-3 w-4/5 rounded bg-slate-100"
								style="animation-delay: {index * 150 + 150}ms"
							></div>
						</div>

						<!-- Metrics with geometric precision -->
						<div class="flex items-center gap-4 pt-2">
							<div class="flex items-center gap-1">
								<div class="loading-metric-icon h-3 w-3 rounded-full bg-slate-200"></div>
								<div class="loading-metric h-3 w-8 rounded bg-slate-100"></div>
							</div>
							<div class="flex items-center gap-1">
								<div class="loading-metric-icon h-3 w-3 rounded-full bg-slate-200"></div>
								<div class="loading-metric h-3 w-12 rounded bg-slate-100"></div>
							</div>
						</div>
					</div>

					<!-- Chevron placeholder -->
					<div class="loading-chevron h-5 w-5 rounded bg-slate-200 md:hidden"></div>
				</div>
			</div>
		{/each}
	{:else}
		{#each templates as template, index (template.id)}
			<button
				type="button"
				data-template-button
				data-template-id={template.id}
				data-testid="template-button-{template.id}"
				class="flex w-full cursor-pointer items-start justify-between gap-3 rounded-lg border p-3 text-left transition-all md:p-4"
				class:border-blue-400={selectedId === template.id}
				class:bg-blue-50={selectedId === template.id}
				class:border-slate-200={selectedId !== template.id}
				class:hover:border-blue-200={selectedId !== template.id}
				onclick={() => onSelect(template.id)}
				onkeydown={(e) => handleKeydown(e, template.id, index)}
			>
				<div class="min-w-0 flex-1">
					<div class="flex flex-wrap items-center gap-2">
						<Badge
							type={template.deliveryMethod === 'both'
								? 'certified'
								: template.deliveryMethod === 'email'
									? 'direct'
									: 'direct'}
						/>
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

<style>
	/* Swiss/Bauhaus Loading Animations */
	.template-loading-card {
		animation: fadeIn 0.6s ease-out;
	}

	.loading-badge,
	.loading-title,
	.loading-line,
	.loading-metric,
	.loading-metric-icon,
	.loading-chevron {
		position: relative;
		overflow: hidden;
		background: linear-gradient(
			90deg,
			theme('colors.slate.200') 0%,
			theme('colors.slate.100') 50%,
			theme('colors.slate.200') 100%
		);
		animation: shimmer 1.8s ease-in-out infinite;
	}

	@keyframes shimmer {
		0% {
			background-position: -200% 0;
		}
		100% {
			background-position: 200% 0;
		}
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Mathematical progression timing (Fibonacci-inspired) */
	.loading-badge {
		animation-delay: 0ms;
	}
	.loading-title {
		animation-delay: 150ms;
	}
	.loading-line:nth-child(1) {
		animation-delay: 300ms;
	}
	.loading-line:nth-child(2) {
		animation-delay: 450ms;
	}
	.loading-metric {
		animation-delay: 600ms;
	}
</style>
