<!--
DocumentDetail: L3 Focal Immersion for Documents

PERCEPTUAL ENGINEERING:
- Full cognitive engagement - user is IN the document
- Section navigation for structure (headings as nav)
- Entities highlighted for quick scanning
- Query-relevant sections prioritized
- Stream de-emphasized (handled by parent) but visible

COGNITIVE LOAD:
- Serial processing mode - user is reading deliberately
- Structure reduces navigation burden
- Entities provide anchors for scanning

DESIGN:
- Slides in via DetailDrawer (300ms transition)
- Section nav is sticky sidebar on desktop, top nav on mobile
- Relevant passages highlighted with type color
-->
<script lang="ts">
	import type { ParsedDocument, DocumentSection, DocumentEntity } from '$lib/server/reducto/types';
	import { getDocumentTypeIcon, getDocumentTypeColor } from '$lib/core/tools/document-helpers';
	import {
		ExternalLink,
		ChevronRight,
		FileText,
		Calendar,
		Building2,
		User,
		MapPin,
		DollarSign,
		Link
	} from '@lucide/svelte';

	interface Props {
		/** The parsed document to display */
		document: ParsedDocument;

		/** Callback when user closes detail view */
		onClose?: () => void;
	}

	let { document, onClose }: Props = $props();

	// Currently selected section
	let activeSectionId = $state<string | null>(document.sections[0]?.id || null);

	const icon = $derived(getDocumentTypeIcon(document.type));
	const typeColor = $derived(getDocumentTypeColor(document.type));

	// Format date
	const formattedDate = $derived(() => {
		if (!document.source.date) return null;
		try {
			return new Date(document.source.date).toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'long',
				day: 'numeric'
			});
		} catch {
			return document.source.date;
		}
	});

	// Get active section
	const activeSection = $derived(
		document.sections.find((s) => s.id === activeSectionId) || document.sections[0]
	);

	// Check if section is relevant to query
	function isRelevantSection(sectionId: string): boolean {
		return document.queryRelevance?.relevantSections?.includes(sectionId) || false;
	}

	// Get entity icon
	function getEntityIcon(type: DocumentEntity['type']) {
		const icons = {
			amount: DollarSign,
			date: Calendar,
			person: User,
			organization: Building2,
			location: MapPin,
			reference: Link
		};
		return icons[type] || FileText;
	}

	// Navigate to section
	function navigateToSection(sectionId: string) {
		activeSectionId = sectionId;
	}

	// Get entities for active section
	const sectionEntities = $derived(
		document.entities.filter((e) => e.sectionId === activeSectionId)
	);

	// Get relevant passage for active section
	const sectionPassage = $derived(
		document.queryRelevance?.passages?.find((p) => p.sectionId === activeSectionId)
	);
</script>

<article class="document-detail" style:--type-color={typeColor}>
	<!-- Header -->
	<header class="detail-header">
		<div class="header-main">
			<span class="type-badge" aria-label="Document type: {document.type}">
				{icon}
			</span>
			<div class="header-text">
				<h2 class="document-title">{document.title}</h2>
				<div class="document-meta">
					<span class="source-name">{document.source.name}</span>
					{#if formattedDate()}
						<span class="meta-sep">•</span>
						<span class="source-date">{formattedDate()}</span>
					{/if}
					<span class="meta-sep">•</span>
					<span class="page-count">{document.metadata.pageCount} pages</span>
				</div>
			</div>
		</div>

		<a
			href={document.source.url}
			target="_blank"
			rel="noopener noreferrer"
			class="external-link"
			title="Open original document"
		>
			<ExternalLink size={18} />
			<span>Original</span>
		</a>
	</header>

	<!-- Relevance summary (if available) -->
	{#if document.queryRelevance}
		<div class="relevance-summary">
			<div class="relevance-badge">
				<span class="relevance-score">
					{Math.round(document.queryRelevance.score * 100)}% relevant
				</span>
			</div>
			<p class="relevance-text">{document.queryRelevance.summary}</p>
		</div>
	{/if}

	<!-- Main content area -->
	<div class="detail-content">
		<!-- Section navigation (sidebar) -->
		<nav class="section-nav" aria-label="Document sections">
			<h3 class="nav-heading">Sections</h3>
			<ul class="nav-list">
				{#each document.sections as section}
					<li>
						<button
							type="button"
							class="nav-item"
							class:active={section.id === activeSectionId}
							class:relevant={isRelevantSection(section.id)}
							onclick={() => navigateToSection(section.id)}
							style:padding-left="{12 + section.level * 12}px"
						>
							{#if isRelevantSection(section.id)}
								<span class="relevance-dot" aria-label="Relevant to your query"></span>
							{/if}
							<span class="nav-item-text">{section.title}</span>
							{#if section.id === activeSectionId}
								<ChevronRight size={14} class="nav-arrow" />
							{/if}
						</button>
					</li>
				{/each}
			</ul>
		</nav>

		<!-- Section content -->
		<div class="section-content">
			{#if activeSection}
				<header class="section-header">
					<h3 class="section-title">{activeSection.title}</h3>
					{#if activeSection.pageNumbers?.length}
						<span class="page-ref">
							Page {activeSection.pageNumbers.join(', ')}
						</span>
					{/if}
				</header>

				<!-- Relevant passage highlight -->
				{#if sectionPassage}
					<blockquote class="relevant-passage">
						<p>"{sectionPassage.text}"</p>
						<footer class="passage-reason">{sectionPassage.reason}</footer>
					</blockquote>
				{/if}

				<!-- Section entities -->
				{#if sectionEntities.length > 0}
					<div class="section-entities">
						<h4 class="entities-heading">Key Items</h4>
						<ul class="entities-list">
							{#each sectionEntities as entity}
								{@const EntityIcon = getEntityIcon(entity.type)}
								<li class="entity-item">
									<EntityIcon size={14} class="entity-icon" />
									<span class="entity-value">{entity.value}</span>
									{#if entity.normalized && entity.normalized !== entity.value}
										<span class="entity-normalized">({entity.normalized})</span>
									{/if}
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				<!-- Full section text -->
				<div class="section-text">
					{#each activeSection.content.split('\n\n') as paragraph}
						<p>{paragraph}</p>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- All entities summary -->
	{#if document.entities.length > 0}
		<aside class="entities-sidebar">
			<h3 class="sidebar-heading">All Entities ({document.entities.length})</h3>
			<div class="entities-grid">
				{#each document.entities.slice(0, 12) as entity}
					{@const EntityIcon = getEntityIcon(entity.type)}
					<button
						type="button"
						class="entity-chip"
						onclick={() => entity.sectionId && navigateToSection(entity.sectionId)}
						disabled={!entity.sectionId}
					>
						<EntityIcon size={12} />
						<span>{entity.value}</span>
					</button>
				{/each}
				{#if document.entities.length > 12}
					<span class="entities-more">+{document.entities.length - 12} more</span>
				{/if}
			</div>
		</aside>
	{/if}
</article>

<style>
	.document-detail {
		display: flex;
		flex-direction: column;
		gap: 20px;
		height: 100%;
		overflow: hidden;
	}

	/* Header */
	.detail-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		padding-bottom: 16px;
		border-bottom: 1px solid oklch(0.92 0.005 60);
	}

	.header-main {
		display: flex;
		align-items: flex-start;
		gap: 12px;
	}

	.type-badge {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		background: var(--type-color);
		border-radius: 10px;
		font-size: 1.25rem;
		filter: brightness(1.1);
	}

	.header-text {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.document-title {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
		line-height: 1.3;
		color: oklch(0.2 0.02 60);
	}

	.document-meta {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.8125rem;
		color: oklch(0.5 0.02 60);
	}

	.source-name {
		font-weight: 500;
		color: var(--type-color);
	}

	.meta-sep {
		color: oklch(0.7 0.01 60);
	}

	.external-link {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		background: oklch(0.97 0.003 60);
		border: 1px solid oklch(0.88 0.01 60);
		border-radius: 8px;
		font-size: 0.8125rem;
		font-weight: 500;
		color: oklch(0.4 0.02 60);
		text-decoration: none;
		transition: background 150ms ease;
	}

	.external-link:hover {
		background: oklch(0.94 0.005 60);
	}

	/* Relevance summary */
	.relevance-summary {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		background: oklch(from var(--type-color) l c h / 0.08);
		border-radius: 10px;
	}

	.relevance-badge {
		flex-shrink: 0;
	}

	.relevance-score {
		display: inline-block;
		padding: 4px 10px;
		background: var(--type-color);
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 600;
		color: white;
	}

	.relevance-text {
		margin: 0;
		font-size: 0.875rem;
		color: oklch(0.35 0.02 60);
	}

	/* Main content */
	.detail-content {
		display: grid;
		grid-template-columns: 200px 1fr;
		gap: 24px;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	/* Section nav */
	.section-nav {
		display: flex;
		flex-direction: column;
		gap: 8px;
		overflow-y: auto;
	}

	.nav-heading {
		margin: 0;
		padding: 0 12px;
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: oklch(0.5 0.02 60);
	}

	.nav-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.nav-item {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		padding: 8px 12px;
		background: transparent;
		border: none;
		border-radius: 6px;
		font-size: 0.8125rem;
		text-align: left;
		color: oklch(0.4 0.02 60);
		cursor: pointer;
		transition: background 150ms ease;
	}

	.nav-item:hover {
		background: oklch(0.96 0.003 60);
	}

	.nav-item.active {
		background: oklch(0.94 0.005 60);
		font-weight: 500;
		color: oklch(0.25 0.02 60);
	}

	.nav-item.relevant .nav-item-text {
		color: var(--type-color);
	}

	.relevance-dot {
		width: 6px;
		height: 6px;
		background: var(--type-color);
		border-radius: 50%;
		flex-shrink: 0;
	}

	.nav-item-text {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.nav-item :global(.nav-arrow) {
		flex-shrink: 0;
		color: oklch(0.5 0.02 60);
	}

	/* Section content */
	.section-content {
		display: flex;
		flex-direction: column;
		gap: 16px;
		overflow-y: auto;
		padding-right: 8px;
	}

	.section-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
	}

	.section-title {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: oklch(0.25 0.02 60);
	}

	.page-ref {
		font-size: 0.75rem;
		color: oklch(0.5 0.02 60);
	}

	/* Relevant passage */
	.relevant-passage {
		margin: 0;
		padding: 12px 16px;
		background: oklch(from var(--type-color) l c h / 0.06);
		border-left: 3px solid var(--type-color);
		border-radius: 0 8px 8px 0;
	}

	.relevant-passage p {
		margin: 0;
		font-size: 0.875rem;
		font-style: italic;
		line-height: 1.6;
		color: oklch(0.3 0.02 60);
	}

	.passage-reason {
		margin-top: 8px;
		font-size: 0.75rem;
		font-style: normal;
		color: var(--type-color);
	}

	/* Section entities */
	.section-entities {
		padding: 12px;
		background: oklch(0.98 0.002 60);
		border-radius: 8px;
	}

	.entities-heading {
		margin: 0 0 8px;
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: oklch(0.5 0.02 60);
	}

	.entities-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.entity-item {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 8px;
		background: white;
		border: 1px solid oklch(0.9 0.005 60);
		border-radius: 4px;
		font-size: 0.8125rem;
	}

	.entity-item :global(.entity-icon) {
		color: var(--type-color);
	}

	.entity-value {
		font-weight: 500;
		color: oklch(0.3 0.02 60);
	}

	.entity-normalized {
		font-size: 0.75rem;
		color: oklch(0.5 0.02 60);
	}

	/* Section text */
	.section-text {
		font-size: 0.9375rem;
		line-height: 1.7;
		color: oklch(0.3 0.02 60);
	}

	.section-text p {
		margin: 0 0 16px;
	}

	.section-text p:last-child {
		margin-bottom: 0;
	}

	/* Entities sidebar */
	.entities-sidebar {
		padding-top: 16px;
		border-top: 1px solid oklch(0.92 0.005 60);
	}

	.sidebar-heading {
		margin: 0 0 12px;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: oklch(0.5 0.02 60);
	}

	.entities-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.entity-chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 4px 8px;
		background: oklch(0.97 0.003 60);
		border: 1px solid oklch(0.9 0.005 60);
		border-radius: 4px;
		font-size: 0.75rem;
		color: oklch(0.4 0.02 60);
		cursor: pointer;
		transition: background 150ms ease;
	}

	.entity-chip:not(:disabled):hover {
		background: oklch(0.94 0.005 60);
	}

	.entity-chip:disabled {
		cursor: default;
		opacity: 0.7;
	}

	.entities-more {
		display: inline-flex;
		align-items: center;
		padding: 4px 8px;
		font-size: 0.75rem;
		color: oklch(0.5 0.02 60);
	}

	/* Mobile responsive */
	@media (max-width: 640px) {
		.detail-content {
			grid-template-columns: 1fr;
		}

		.section-nav {
			flex-direction: row;
			overflow-x: auto;
			padding-bottom: 8px;
			border-bottom: 1px solid oklch(0.92 0.005 60);
		}

		.nav-heading {
			display: none;
		}

		.nav-list {
			flex-direction: row;
			gap: 4px;
		}

		.nav-item {
			white-space: nowrap;
			padding: 6px 10px;
		}
	}
</style>
