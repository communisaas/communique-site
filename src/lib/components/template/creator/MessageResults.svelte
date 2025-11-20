<script lang="ts">
	import { RotateCcw, Edit3, BookOpen } from '@lucide/svelte';
	import type { Source } from '$lib/types/template';
	import type { ScopeMapping } from '$lib/utils/scope-mapper-international';
	import SourceCard from './SourceCard.svelte';
	import ResearchLog from './ResearchLog.svelte';
	import GeographicScopeEditor from './GeographicScopeEditor.svelte';
	import {
		splitIntoParagraphs,
		countWords,
		estimateReadingTime,
		hasCitations
	} from '$lib/utils/message-processing';

	interface Props {
		message: string;
		subject: string;
		sources: Source[];
		researchLog: string[];
		geographicScope?: ScopeMapping | null;
		onEdit: () => void;
		onStartFresh: () => void;
	}

	let {
		message,
		subject,
		sources,
		researchLog,
		geographicScope = $bindable(),
		onEdit,
		onStartFresh
	}: Props = $props();

	let showResearchLog = $state(false);
	let selectedCitation = $state<number | null>(null);

	const paragraphs = $derived(splitIntoParagraphs(message));
	const wordCount = $derived(countWords(message));
	const readingTime = $derived(estimateReadingTime(message));
	const hasCitationsInMessage = $derived(hasCitations(message));

	// Handle citation click
	function handleCitationClick(citationNum: number) {
		selectedCitation = citationNum;
		// Scroll to source
		const sourceElement = document.querySelector(`[data-source="${citationNum}"]`);
		if (sourceElement) {
			sourceElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
	}

	// Handle geographic scope changes
	function handleScopeChanged(
		event: CustomEvent<{ scope: ScopeMapping; validatedAgainst: 'user_edit' }>
	) {
		geographicScope = event.detail.scope;
		console.log('[MessageResults] Geographic scope updated:', event.detail.scope);
	}
</script>

<div class="space-y-6 py-4">
	<!-- Header with actions -->
	<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
		<div>
			<h3 class="text-lg font-semibold text-slate-900 md:text-xl">Your research-backed message</h3>
			<p class="mt-1 text-sm text-slate-600">
				{wordCount} words · {readingTime} min read
				{#if hasCitationsInMessage}
					· {sources.length} sources cited
				{/if}
			</p>
		</div>

		<div class="flex gap-2">
			<button
				type="button"
				onclick={onEdit}
				class="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
			>
				<Edit3 class="h-4 w-4" />
				Edit
			</button>
			<button
				type="button"
				onclick={onStartFresh}
				class="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
			>
				<RotateCcw class="h-4 w-4" />
				Start fresh
			</button>
		</div>
	</div>

	<!-- Subject line -->
	<div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
		<p class="text-xs font-medium text-slate-700">Subject</p>
		<p class="mt-1 font-medium text-slate-900">{subject}</p>
	</div>

	<!-- Geographic scope (if extracted) -->
	{#if geographicScope}
		<div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
			<p class="mb-2 text-xs font-medium text-slate-700">Geographic Scope</p>
			<div class="flex items-baseline gap-1">
				<p class="text-sm text-slate-700">
					This message is targeted
					<GeographicScopeEditor scope={geographicScope} on:scopeChanged={handleScopeChanged} />
				</p>
			</div>
			<p class="mt-2 text-xs text-slate-600">
				{#if geographicScope.confidence >= 0.9}
					High confidence extraction. Click "Edit" to change if incorrect.
				{:else if geographicScope.confidence >= 0.7}
					Medium confidence extraction. Select from dropdown to verify or change.
				{:else}
					Low confidence extraction. Please verify the location is correct.
				{/if}
			</p>
		</div>
	{/if}

	<!-- Message with citations -->
	<div class="rounded-lg border border-slate-200 bg-white p-6">
		<div class="prose prose-sm max-w-none">
			{#each paragraphs as paragraph}
				<p class="mb-4 leading-relaxed text-slate-700">
					{#each paragraph.split(/(\[\d+\]|\*\*.*?\*\*|\*.*?\*)/) as part}
						{#if /^\[\d+\]$/.test(part)}
							<!-- Citation link -->
							{@const citationNum = parseInt(part.slice(1, -1), 10)}
							{@const source = sources.find((s) => s.num === citationNum)}
							{#if source}
								<button
									type="button"
									onclick={() => handleCitationClick(citationNum)}
									class="citation-link inline-flex items-baseline font-semibold text-participation-primary-600 transition-colors hover:text-participation-primary-700"
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
							<!-- Bold text (markdown **text**) -->
							<strong class="font-semibold text-slate-900">{part.slice(2, -2)}</strong>
						{:else if /^\*.*?\*$/.test(part)}
							<!-- Italic text (markdown *text*) -->
							<em class="italic">{part.slice(1, -1)}</em>
						{:else}
							<!-- Regular text -->
							{part}
						{/if}
					{/each}
				</p>
			{/each}
		</div>
	</div>

	<!-- Sources -->
	{#if sources.length > 0}
		<div class="space-y-3">
			<div class="flex items-center gap-2">
				<BookOpen class="h-5 w-5 text-slate-600" />
				<h4 class="font-semibold text-slate-900">Sources ({sources.length})</h4>
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

	<!-- Research log -->
	{#if researchLog.length > 0}
		<ResearchLog {researchLog} bind:expanded={showResearchLog} />
	{/if}

	<!-- Educational context -->
	<div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
		<p class="text-sm leading-relaxed text-slate-600">
			<span class="font-semibold text-slate-900">Why citations matter:</span>
			Decision-makers get hundreds of messages. Citations demonstrate you've done your homework, understand
			the issue deeply, and aren't just copy-pasting a template. This is how you earn attention and respect.
		</p>
	</div>
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
