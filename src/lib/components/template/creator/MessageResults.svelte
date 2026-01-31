<script lang="ts">
	import { Edit3, BookOpen, MapPin } from '@lucide/svelte';
	import type { Source } from '$lib/types/template';
	import type { GeoScope } from '$lib/core/agents/types';
	import SourceCard from './SourceCard.svelte';
	import ResearchLog from './ResearchLog.svelte';
	import GeographicScopeEditor from './GeographicScopeEditor.svelte';
	import {
		splitIntoParagraphs,
		countWords,
		hasCitations
	} from '$lib/utils/message-processing';

	interface Props {
		message: string;
		subject: string;
		sources: Source[];
		researchLog: string[];
		geographicScope?: GeoScope | null;
		onEdit: () => void;
	}

	let {
		message,
		subject,
		sources,
		researchLog,
		geographicScope = $bindable(),
		onEdit
	}: Props = $props();

	let showResearchLog = $state(false);
	let selectedCitation = $state<number | null>(null);

	const paragraphs = $derived(splitIntoParagraphs(message));
	const wordCount = $derived(countWords(message));
	const hasCitationsInMessage = $derived(hasCitations(message));

	function handleCitationClick(citationNum: number) {
		selectedCitation = citationNum;
		const sourceElement = document.querySelector(`[data-source="${citationNum}"]`);
		if (sourceElement) {
			sourceElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
	}

	function handleScopeChanged(scope: GeoScope) {
		geographicScope = scope;
	}

	/**
	 * Format geographic scope for inline display
	 */
	function formatScope(s: GeoScope): string {
		if (s.type === 'international') return 'International';
		if (s.type === 'nationwide') return s.country;
		const parts: string[] = [];
		if (s.locality) parts.push(s.locality);
		if (s.subdivision) {
			// Extract state code from ISO format (e.g., "US-CA" → "CA")
			const stateCode = s.subdivision.includes('-')
				? s.subdivision.split('-')[1]
				: s.subdivision;
			parts.push(stateCode);
		}
		return parts.join(', ') || s.country;
	}
</script>

<div class="space-y-4 py-4">
	<!-- Email Preview Card -->
	<div class="rounded-lg border border-slate-200 bg-white shadow-sm">
		<!-- Subject Header -->
		<div class="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50/50 px-5 py-4">
			<div class="min-w-0 flex-1">
				<p class="text-xs font-medium uppercase tracking-wide text-slate-500">Subject</p>
				<p class="mt-1 text-base font-semibold text-slate-900">{subject}</p>
			</div>
			<button
				type="button"
				onclick={onEdit}
				class="flex shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
			>
				<Edit3 class="h-3.5 w-3.5" />
				Edit
			</button>
		</div>

		<!-- Message Body -->
		<div class="px-5 py-5">
			<div class="prose prose-sm max-w-none">
				{#each paragraphs as paragraph}
					<p class="mb-4 whitespace-pre-line leading-relaxed text-slate-700 last:mb-0">
						{#each paragraph.split(/(\[\d+\]|\*\*.*?\*\*|\*.*?\*)/) as part}
							{#if /^\[\d+\]$/.test(part)}
								{@const citationNum = parseInt(part.slice(1, -1), 10)}
								{@const source = sources.find((s) => s.num === citationNum)}
								{#if source}
									<button
										type="button"
										onclick={() => handleCitationClick(citationNum)}
										class="citation-link font-semibold text-participation-primary-600 transition-colors hover:text-participation-primary-700"
										class:bg-participation-primary-50={selectedCitation === citationNum}
										class:px-1={selectedCitation === citationNum}
										class:rounded={selectedCitation === citationNum}
										title={source.title}
									>
										{part}
									</button>
								{:else}
									<span class="text-slate-400">{part}</span>
								{/if}
							{:else if /^\*\*.*?\*\*$/.test(part)}
								<strong class="font-semibold text-slate-900">{part.slice(2, -2)}</strong>
							{:else if /^\*.*?\*$/.test(part)}
								<em class="italic">{part.slice(1, -1)}</em>
							{:else}
								{part}
							{/if}
						{/each}
					</p>
				{/each}
			</div>
		</div>

		<!-- Footer Metadata -->
		<div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 bg-slate-50/30 px-5 py-3 text-xs text-slate-500">
			<span>{wordCount} words</span>
			{#if hasCitationsInMessage}
				<span class="flex items-center gap-1">
					<BookOpen class="h-3 w-3" />
					{sources.length} source{sources.length !== 1 ? 's' : ''}
				</span>
			{/if}
			{#if geographicScope}
				<span class="flex items-center gap-1">
					<MapPin class="h-3 w-3" />
					<GeographicScopeEditor scope={geographicScope} onScopeChanged={handleScopeChanged} />
				</span>
			{/if}
		</div>
	</div>

	<!-- Sources -->
	{#if sources.length > 0}
		<div class="space-y-2">
			<div class="flex items-center gap-2 px-1">
				<BookOpen class="h-4 w-4 text-slate-500" />
				<h4 class="text-sm font-medium text-slate-700">Sources</h4>
			</div>
			<div class="space-y-2">
				{#each sources as source}
					<div data-source={source.num}>
						<SourceCard {source} />
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Research Log -->
	{#if researchLog.length > 0}
		<ResearchLog {researchLog} bind:expanded={showResearchLog} />
	{/if}
</div>

<style>
	.citation-link {
		cursor: pointer;
		user-select: none;
	}

	.citation-link:hover {
		text-decoration: underline;
	}
</style>
