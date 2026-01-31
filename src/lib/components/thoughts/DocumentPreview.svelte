<!--
DocumentPreview: L2 Recognition Layer for Documents

PERCEPTUAL ENGINEERING:
- Appears on hover with 300ms delay (prevents accidental triggers)
- Shows just enough for recognition: title, source, date, relevance snippet
- Clear affordance to L3 ("View Full Analysis")
- 150ms linger time when leaving (allows traversal to card)

COGNITIVE LOAD:
- 1-2 chunks: document identity + why it's relevant
- Recognition task, not reading task
- Type color provides peripheral classification

TIMING CONSTANTS:
- L2_HOVER_DELAY: 300ms (from perceptual architecture)
- L2_FADE_IN: 150ms
- L2_LINGER: 150ms
-->
<script lang="ts">
	import type { ParsedDocument } from '$lib/server/reducto/types';
	import { getDocumentTypeIcon, getDocumentTypeColor } from '$lib/core/tools/document-helpers';
	import { ExternalLink, FileText, ChevronRight } from '@lucide/svelte';

	interface Props {
		/** The parsed document to preview */
		document: ParsedDocument;

		/** Position relative to trigger element */
		position?: { x: number; y: number };

		/** Callback when user clicks "View Full" */
		onViewFull?: (document: ParsedDocument) => void;

		/** Callback when user clicks external link */
		onExternalLink?: (url: string) => void;
	}

	let { document, position, onViewFull, onExternalLink }: Props = $props();

	const icon = $derived(getDocumentTypeIcon(document.type));
	const typeColor = $derived(getDocumentTypeColor(document.type));

	// Format date for display
	const formattedDate = $derived(() => {
		if (!document.source.date) return null;
		try {
			return new Date(document.source.date).toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'short',
				day: 'numeric'
			});
		} catch {
			return document.source.date;
		}
	});

	// Get relevance snippet
	const relevanceSnippet = $derived(() => {
		if (document.queryRelevance?.passages?.[0]) {
			const text = document.queryRelevance.passages[0].text;
			return text.length > 150 ? text.slice(0, 150) + '...' : text;
		}
		if (document.sections[0]?.content) {
			const text = document.sections[0].content;
			return text.length > 150 ? text.slice(0, 150) + '...' : text;
		}
		return null;
	});

	function handleViewFull() {
		onViewFull?.(document);
	}

	function handleExternalClick(e: Event) {
		e.stopPropagation();
		onExternalLink?.(document.source.url);
	}
</script>

<div
	class="document-preview"
	style:--type-color={typeColor}
	style:left={position ? `${position.x}px` : undefined}
	style:top={position ? `${position.y}px` : undefined}
	role="tooltip"
	aria-label="Document preview: {document.title}"
>
	<!-- Header: Type icon + Title -->
	<header class="preview-header">
		<span class="type-icon" aria-hidden="true">{icon}</span>
		<h3 class="preview-title">{document.title}</h3>
	</header>

	<!-- Source + Date -->
	<div class="preview-meta">
		<span class="source-name">{document.source.name}</span>
		{#if formattedDate()}
			<span class="meta-separator">•</span>
			<span class="source-date">{formattedDate()}</span>
		{/if}
	</div>

	<!-- Relevance Snippet -->
	{#if relevanceSnippet()}
		<blockquote class="preview-snippet">
			"{relevanceSnippet()}"
		</blockquote>
	{/if}

	<!-- Structure summary -->
	<div class="preview-structure">
		<FileText class="structure-icon" size={14} />
		<span>{document.sections.length} sections</span>
		{#if document.entities.length > 0}
			<span class="meta-separator">•</span>
			<span>{document.entities.length} entities</span>
		{/if}
	</div>

	<!-- Actions -->
	<div class="preview-actions">
		<button
			type="button"
			class="action-view-full"
			onclick={handleViewFull}
		>
			<span>View Full Analysis</span>
			<ChevronRight size={16} />
		</button>

		<a
			href={document.source.url}
			target="_blank"
			rel="noopener noreferrer"
			class="action-external"
			onclick={handleExternalClick}
			title="Open original document"
		>
			<ExternalLink size={14} />
			<span class="sr-only">Open original document</span>
		</a>
	</div>

	<!-- Tooltip arrow -->
	<div class="preview-arrow" aria-hidden="true"></div>
</div>

<style>
	.document-preview {
		position: absolute;
		z-index: 100;

		display: flex;
		flex-direction: column;
		gap: 12px;

		width: 320px;
		padding: 16px;

		background: oklch(0.995 0.002 60);
		border: 1px solid oklch(0.88 0.01 60 / 0.5);
		border-radius: 12px;
		box-shadow:
			0 4px 6px -1px oklch(0.2 0.02 60 / 0.1),
			0 2px 4px -2px oklch(0.2 0.02 60 / 0.1),
			0 0 0 1px oklch(0.9 0.01 60 / 0.3);

		/* Animation from perceptual constants */
		animation: fadeSlideIn 150ms ease-out;
	}

	@keyframes fadeSlideIn {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Header */
	.preview-header {
		display: flex;
		align-items: flex-start;
		gap: 8px;
	}

	.type-icon {
		flex-shrink: 0;
		font-size: 1.25rem;
		line-height: 1;
	}

	.preview-title {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 600;
		line-height: 1.3;
		color: oklch(0.2 0.02 60);
	}

	/* Meta line */
	.preview-meta {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.8125rem;
		color: oklch(0.45 0.02 60);
	}

	.source-name {
		font-weight: 500;
		color: var(--type-color);
	}

	.meta-separator {
		color: oklch(0.7 0.01 60);
	}

	/* Snippet */
	.preview-snippet {
		margin: 0;
		padding: 10px 12px;
		background: oklch(0.98 0.003 60);
		border-left: 3px solid var(--type-color);
		border-radius: 0 6px 6px 0;
		font-size: 0.8125rem;
		font-style: italic;
		line-height: 1.5;
		color: oklch(0.35 0.02 60);
	}

	/* Structure */
	.preview-structure {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.75rem;
		color: oklch(0.5 0.02 60);
	}

	.structure-icon {
		color: oklch(0.6 0.02 60);
	}

	/* Actions */
	.preview-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding-top: 4px;
		border-top: 1px solid oklch(0.92 0.005 60);
	}

	.action-view-full {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 8px 12px;
		background: var(--type-color);
		border: none;
		border-radius: 6px;
		font-size: 0.8125rem;
		font-weight: 500;
		color: white;
		cursor: pointer;
		transition: opacity 150ms ease, transform 150ms ease;
	}

	.action-view-full:hover {
		opacity: 0.9;
	}

	.action-view-full:active {
		transform: scale(0.98);
	}

	.action-view-full:focus-visible {
		outline: 2px solid var(--type-color);
		outline-offset: 2px;
	}

	.action-external {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 8px;
		background: transparent;
		border: 1px solid oklch(0.85 0.01 60);
		border-radius: 6px;
		color: oklch(0.5 0.02 60);
		cursor: pointer;
		transition: background 150ms ease, color 150ms ease;
	}

	.action-external:hover {
		background: oklch(0.96 0.003 60);
		color: oklch(0.35 0.02 60);
	}

	.action-external:focus-visible {
		outline: 2px solid oklch(0.6 0.15 250);
		outline-offset: 2px;
	}

	/* Arrow */
	.preview-arrow {
		position: absolute;
		bottom: 100%;
		left: 24px;
		width: 12px;
		height: 12px;
		background: oklch(0.995 0.002 60);
		border-top: 1px solid oklch(0.88 0.01 60 / 0.5);
		border-left: 1px solid oklch(0.88 0.01 60 / 0.5);
		transform: rotate(45deg);
		transform-origin: center;
		margin-bottom: -6px;
	}

	/* Screen reader only */
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
