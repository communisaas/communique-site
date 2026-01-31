<!--
CitationDetail: L1 depth expansion for citations

Shows source information:
- Title/label
- Source URL (clickable external link)
- Excerpt with context
- Source type badge
- Future: "View full document" button for L3 depth (Reducto parse)

PERCEPTUAL ENGINEERING:
- Badge provides quick classification (pre-attentive processing)
- Excerpt gets visual emphasis (quoted style)
- External link affordance (icon + color)
- Clear hierarchy (label → excerpt → metadata)

ACCESSIBILITY:
- External link announced to screen readers
- Semantic HTML (blockquote for excerpt)
- Focus visible on interactive elements
-->
<script lang="ts">
	import type { Citation } from '$lib/core/thoughts/types';
	import { ExternalLink } from '@lucide/svelte';

	interface Props {
		citation: Citation;
	}

	let { citation }: Props = $props();

	// Source type badge styling
	const sourceTypeSchemes = {
		intelligence: {
			bg: 'bg-blue-50',
			text: 'text-blue-700',
			border: 'border-blue-200'
		},
		document: {
			bg: 'bg-purple-50',
			text: 'text-purple-700',
			border: 'border-purple-200'
		},
		organization: {
			bg: 'bg-orange-50',
			text: 'text-orange-700',
			border: 'border-orange-200'
		},
		web: {
			bg: 'bg-emerald-50',
			text: 'text-emerald-700',
			border: 'border-emerald-200'
		}
	};

	const sourceTypeLabels = {
		intelligence: 'Intelligence',
		document: 'Document',
		organization: 'Organization',
		web: 'Web Source'
	};

	const scheme = sourceTypeSchemes[citation.sourceType];
	const label = sourceTypeLabels[citation.sourceType];
</script>

<div class="citation-detail space-y-4">
	<!-- Source type badge -->
	<div class="flex items-center gap-2">
		<span
			class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium
				{scheme.bg} {scheme.text} {scheme.border}"
		>
			{label}
		</span>
	</div>

	<!-- Excerpt (primary content) -->
	<blockquote
		class="rounded-lg border-l-4 p-4"
		style="
			background: oklch(0.99 0.003 60);
			border-left-color: oklch(0.65 0.1 220);
			color: oklch(0.25 0.02 60);
		"
	>
		<p class="text-sm leading-relaxed">
			{citation.excerpt}
		</p>
	</blockquote>

	<!-- Metadata section -->
	<div class="space-y-3">
		<!-- Source URL -->
		{#if citation.url}
			<div class="space-y-1">
				<span class="block text-xs font-medium uppercase tracking-wider" style="color: oklch(0.5 0.02 60);">
					Source
				</span>
				<a
					href={citation.url}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-1.5 text-sm font-medium transition-colors duration-150
						hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-1
						rounded-sm"
					style="color: oklch(0.5 0.15 240);"
				>
					<span class="break-all">{citation.url}</span>
					<ExternalLink class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
					<span class="sr-only">(opens in new tab)</span>
				</a>
			</div>
		{/if}

		<!-- MongoDB ID (if intelligence source) -->
		{#if citation.mongoId}
			<div class="space-y-1">
				<span class="block text-xs font-medium uppercase tracking-wider" style="color: oklch(0.5 0.02 60);">
					Intelligence ID
				</span>
				<code
					class="block rounded px-2 py-1 text-xs font-mono"
					style="
						background: oklch(0.97 0.003 60);
						color: oklch(0.35 0.02 60);
					"
				>
					{citation.mongoId}
				</code>
			</div>
		{/if}

		<!-- Document ID (if parsed document) -->
		{#if citation.documentId}
			<div class="space-y-1">
				<span class="block text-xs font-medium uppercase tracking-wider" style="color: oklch(0.5 0.02 60);">
					Document ID
				</span>
				<code
					class="block rounded px-2 py-1 text-xs font-mono"
					style="
						background: oklch(0.97 0.003 60);
						color: oklch(0.35 0.02 60);
					"
				>
					{citation.documentId}
				</code>
			</div>
		{/if}
	</div>

	<!-- Future: Full document button (L3 depth) -->
	{#if citation.documentId}
		<div
			class="rounded-lg border p-3"
			style="
				background: oklch(0.985 0.003 60);
				border-color: oklch(0.88 0.01 60 / 0.3);
			"
		>
			<p class="text-xs" style="color: oklch(0.45 0.02 60);">
				Full document view coming soon (L3 depth - Reducto parse)
			</p>
		</div>
	{/if}
</div>

<style>
	/* Quote styling for excerpt */
	blockquote p {
		quotes: '\201C''\201D''\2018''\2019';
	}

	blockquote p::before {
		content: open-quote;
	}

	blockquote p::after {
		content: close-quote;
	}
</style>
