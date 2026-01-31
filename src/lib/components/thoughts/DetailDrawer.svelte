<!--
DetailDrawer: Slide-in panel from right showing expanded citation/action details

PERCEPTUAL ENGINEERING:
- Slides alongside stream (continuity, no replacement)
- Semi-transparent overlay provides context (not total modal takeover)
- Easy escape hatches (overlay click, X, Escape key)
- Content stays in view while drawer open (progressive disclosure)
- Focus trap prevents keyboard navigation escape

ACCESSIBILITY:
- Focus trap within drawer when open
- Escape key to close
- Screen reader announces drawer opening
- Touch/click overlay to close
- Proper ARIA roles and labels
-->
<script lang="ts">
	import type { Citation, ActionTrace } from '$lib/core/thoughts/types';
	import { fly, fade } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { X } from '@lucide/svelte';
	import CitationDetail from './CitationDetail.svelte';
	import ActionDetail from './ActionDetail.svelte';

	interface Props {
		open: boolean;
		content: Citation | ActionTrace | null;
		onclose: () => void;
	}

	let { open = $bindable(false), content, onclose }: Props = $props();

	// Type guards
	function isCitation(item: unknown): item is Citation {
		return item !== null && typeof item === 'object' && 'sourceType' in item && 'excerpt' in item;
	}

	function isActionTrace(item: unknown): item is ActionTrace {
		return item !== null && typeof item === 'object' && 'type' in item && 'target' in item;
	}

	// Title determination
	function getTitle(item: Citation | ActionTrace | null): string {
		if (!item) return '';
		if (isCitation(item)) return item.label;
		if (isActionTrace(item)) {
			const typeLabels = {
				research: 'Research',
				retrieve: 'Retrieval',
				analyze: 'Analysis',
				search: 'Search'
			};
			return `${typeLabels[item.type]}: ${item.target}`;
		}
		return 'Details';
	}

	// Handle escape key
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			e.preventDefault();
			onclose();
		}
	}

	// Focus trap - capture Tab within drawer
	let drawerElement: HTMLElement;

	function trapFocus(e: KeyboardEvent) {
		if (!open || e.key !== 'Tab') return;

		const focusableElements = drawerElement?.querySelectorAll<HTMLElement>(
			'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
		);

		if (!focusableElements || focusableElements.length === 0) return;

		const firstElement = focusableElements[0];
		const lastElement = focusableElements[focusableElements.length - 1];

		if (e.shiftKey && document.activeElement === firstElement) {
			e.preventDefault();
			lastElement.focus();
		} else if (!e.shiftKey && document.activeElement === lastElement) {
			e.preventDefault();
			firstElement.focus();
		}
	}

	// Auto-focus drawer when it opens
	$effect(() => {
		if (open && drawerElement) {
			// Focus the close button as the first interactive element
			const closeButton = drawerElement.querySelector<HTMLButtonElement>('button[aria-label="Close"]');
			closeButton?.focus();
		}
	});
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- Overlay backdrop -->
	<div
		class="drawer-overlay fixed inset-0 z-50 bg-black/25 backdrop-blur-sm"
		onclick={onclose}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				onclose();
			}
		}}
		role="presentation"
		aria-hidden="true"
		in:fade={{ duration: 200 }}
		out:fade={{ duration: 200 }}
		tabindex="-1"
	></div>

	<!-- Drawer panel -->
	<aside
		bind:this={drawerElement}
		class="detail-drawer fixed right-0 top-0 z-50 flex h-full w-full flex-col overflow-hidden shadow-2xl
			sm:w-[480px]"
		style="
			background: oklch(0.995 0.003 60);
			border-left: 1px solid oklch(0.85 0.01 60 / 0.3);
		"
		role="dialog"
		aria-modal="true"
		aria-label={getTitle(content)}
		in:fly={{ x: 300, duration: 250, easing: quintOut }}
		out:fly={{ x: 300, duration: 200, easing: quintOut }}
		onkeydown={trapFocus}
	>
		<!-- Header -->
		<header
			class="flex shrink-0 items-start justify-between gap-4 border-b px-6 py-4"
			style="border-color: oklch(0.88 0.01 60 / 0.25);"
		>
			<div class="min-w-0 flex-1">
				<h3 class="text-lg font-semibold leading-tight" style="color: oklch(0.15 0.02 60);">
					{getTitle(content)}
				</h3>
			</div>

			<button
				onclick={onclose}
				class="shrink-0 rounded-lg p-2 transition-all duration-150
					hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50"
				style="color: oklch(0.45 0.02 60);"
				aria-label="Close"
			>
				<X class="h-5 w-5" />
			</button>
		</header>

		<!-- Content area - scrollable -->
		<div class="flex-1 overflow-y-auto px-6 py-5">
			{#if isCitation(content)}
				<CitationDetail citation={content} />
			{:else if isActionTrace(content)}
				<ActionDetail action={content} />
			{:else}
				<p class="text-sm" style="color: oklch(0.45 0.02 60);">No content available</p>
			{/if}
		</div>
	</aside>
{/if}

<style>
	/* Custom scrollbar for drawer content */
	.detail-drawer {
		scrollbar-width: thin;
		scrollbar-color: oklch(0.7 0.01 60 / 0.3) transparent;
	}

	.detail-drawer::-webkit-scrollbar {
		width: 6px;
	}

	.detail-drawer::-webkit-scrollbar-track {
		background: transparent;
	}

	.detail-drawer::-webkit-scrollbar-thumb {
		background: oklch(0.7 0.01 60 / 0.3);
		border-radius: 3px;
	}

	.detail-drawer::-webkit-scrollbar-thumb:hover {
		background: oklch(0.6 0.01 60 / 0.4);
	}

	/* Ensure drawer is above everything except toast notifications */
	.drawer-overlay,
	.detail-drawer {
		position: fixed;
	}
</style>
