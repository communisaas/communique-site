<script lang="ts">
	import { Sparkles, ArrowRight, ChevronLeft, ChevronRight } from '@lucide/svelte';
	import { api } from '$lib/core/api/client';

	let {
		description = $bindable(''),
		onaccept,
		oncancel
	}: {
		description: string;
		onaccept: (suggestion: {
			subject_line: string;
			core_issue: string;
			domain: string;
			url_slug: string;
		}) => void;
		oncancel: () => void;
	} = $props();

	// State
	let isGenerating = $state(false);
	let suggestions = $state<
		Array<{
			subject_line: string;
			core_issue: string;
			domain: string;
			url_slug: string;
			runId?: string;
		}>
	>([]);
	let currentIndex = $state(0);
	let attemptCount = $state(0);
	let error = $state<string | null>(null);
	let editedDescription = $state(description);

	const MAX_ATTEMPTS = 5;
	const currentSuggestion = $derived(suggestions[currentIndex]);
	const canGenerate = $derived(attemptCount < MAX_ATTEMPTS && editedDescription.trim().length > 0);
	const attemptsRemaining = $derived(MAX_ATTEMPTS - attemptCount);

	// Sync edited description with parent when switching suggestions
	$effect(() => {
		if (currentSuggestion) {
			description = editedDescription;
		}
	});

	async function generate() {
		if (!editedDescription.trim()) {
			error = 'Tell us what pisses you off first';
			return;
		}

		if (attemptCount >= MAX_ATTEMPTS) {
			error = "That's it—use one or write your own";
			return;
		}

		isGenerating = true;
		error = null;

		try {
			const response = await api.post('/toolhouse/generate-subject', {
				message: editedDescription,
				runId: currentSuggestion?.runId // Continue conversation if refining
			});

			console.log('[SubjectLineGenerator] Received response:', response);

			// Extract data from API client wrapper
			if (!response.success || !response.data) {
				throw new Error('Invalid response from API');
			}

			// Add new suggestion to the list
			suggestions = [...suggestions, response.data];
			currentIndex = suggestions.length - 1;
			attemptCount++;
			error = null;
		} catch (err) {
			console.error('[SubjectLineGenerator] Error:', err);
			error = 'Something broke. Try again.';
		} finally {
			isGenerating = false;
		}
	}

	function previous() {
		if (currentIndex > 0) {
			currentIndex--;
		}
	}

	function next() {
		if (currentIndex < suggestions.length - 1) {
			currentIndex++;
		}
	}

	function use() {
		if (currentSuggestion) {
			onaccept(currentSuggestion);
		}
	}
</script>

<div class="space-y-3">
	<!-- Issue Description Input -->
	<div>
		<label for="issue-description" class="block text-xs font-medium text-slate-700 md:text-sm">
			What's the issue?
		</label>
		<textarea
			id="issue-description"
			bind:value={editedDescription}
			placeholder="Amazon drivers forced to piss in bottles. Warehouse workers collapsing from heat. Bezos making $2.5M/hour while this happens."
			rows="3"
			class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-participation-primary-500 focus:ring-2 focus:ring-participation-primary-500 md:text-base"
			disabled={isGenerating}
		></textarea>
	</div>

	<!-- Generate / Regenerate Button -->
	<div class="flex items-center justify-between">
		<button
			type="button"
			onclick={generate}
			disabled={!canGenerate || isGenerating}
			class="inline-flex items-center gap-2 rounded-lg bg-participation-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-participation-primary-700 disabled:cursor-not-allowed disabled:opacity-50 md:text-base"
		>
			{#if isGenerating}
				<div
					class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
				></div>
				Loading...
			{:else}
				<Sparkles class="h-4 w-4" />
				{suggestions.length === 0 ? 'Hit me' : 'Try again'}
			{/if}
		</button>

		{#if suggestions.length > 0}
			<div class="text-xs text-slate-600 md:text-sm">
				{attemptsRemaining} {attemptsRemaining === 1 ? 'try' : 'tries'} left
			</div>
		{/if}
	</div>

	<!-- Error Display -->
	{#if error}
		<div class="rounded-lg border border-red-200 bg-red-50 p-3">
			<p class="text-xs text-red-700 md:text-sm">{error}</p>
		</div>
	{/if}

	<!-- Suggestions Carousel -->
	{#if suggestions.length > 0}
		<div class="space-y-3 rounded-lg border-2 border-slate-200 bg-white p-4">
			<!-- Navigation Header -->
			{#if suggestions.length > 1}
				<div class="flex items-center justify-between border-b border-slate-100 pb-3">
					<button
						type="button"
						onclick={previous}
						disabled={currentIndex === 0}
						class="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-30 md:text-sm"
					>
						<ChevronLeft class="h-4 w-4" />
						Previous
					</button>

					<div class="text-xs font-medium text-slate-700 md:text-sm">
						{currentIndex + 1} of {suggestions.length}
					</div>

					<button
						type="button"
						onclick={next}
						disabled={currentIndex === suggestions.length - 1}
						class="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-30 md:text-sm"
					>
						Next
						<ChevronRight class="h-4 w-4" />
					</button>
				</div>
			{/if}

			<!-- Current Suggestion -->
			<div class="space-y-3">
				<div>
					<div class="mb-1 flex items-center gap-2">
						<Sparkles class="h-4 w-4 text-participation-primary-600" />
						<span class="text-xs font-medium text-slate-700 md:text-sm">Subject line</span>
					</div>
					<p class="text-base font-semibold text-slate-900 md:text-lg">
						{currentSuggestion.subject_line}
					</p>
				</div>

				<div>
					<label class="text-xs font-medium text-slate-600">Core issue</label>
					<p class="mt-0.5 text-xs text-slate-700 md:text-sm">
						{currentSuggestion.core_issue}
					</p>
				</div>

				<div class="flex gap-3 text-xs text-slate-600">
					<span>Domain: <strong class="text-slate-900">{currentSuggestion.domain}</strong></span>
					<span>•</span>
					<span
						>Slug: <strong class="text-slate-900">{currentSuggestion.url_slug}</strong></span
					>
				</div>
			</div>

			<!-- Action Buttons -->
			<div class="flex gap-2 border-t border-slate-100 pt-3">
				<button
					type="button"
					onclick={use}
					class="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-participation-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-participation-primary-700 md:text-base"
				>
					Use this
					<ArrowRight class="h-4 w-4" />
				</button>

				<button
					type="button"
					onclick={oncancel}
					class="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 md:text-base"
				>
					Write my own
				</button>
			</div>
		</div>
	{/if}
</div>
