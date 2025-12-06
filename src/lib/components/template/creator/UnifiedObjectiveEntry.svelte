<script lang="ts">
	import type { TemplateCreationContext } from '$lib/types/template';
	import { Sparkles, ArrowRight } from 'lucide-svelte';
	import { api } from '$lib/core/api/client';
	import { slide, fade } from 'svelte/transition';
	import { onMount } from 'svelte';
	import { AI_SUGGESTION_TIMING } from '$lib/constants/ai-timing';
	import { calculateSimilarity } from '$lib/utils/similarity';
	import { SuggestionCache } from '$lib/services/ai/suggestion-cache';
	import { SuggestionRateLimiter } from '$lib/services/ai/rate-limiter';
	import SlugCustomizer from './SlugCustomizer.svelte';

	interface Props {
		data: {
			rawInput: string;
			title: string;
			description: string;
			category: string;
			slug?: string;
			aiGenerated?: boolean;
		};
		context: TemplateCreationContext;
	}

	let { data = $bindable(), context }: Props = $props();

	// State
	type SuggestionState =
		| { status: 'idle' }
		| { status: 'thinking'; startTime: number }
		| { status: 'ready'; suggestion: AISuggestion }
		| { status: 'error'; message: string };

	interface AISuggestion {
		subject_line: string;
		core_issue: string;
		domain: string;
		url_slug: string;
		runId?: string;
	}

	let suggestionState = $state<SuggestionState>({ status: 'idle' });
	let showAISuggest = $state(false);
	let attemptCount = $state(0);
	let isGenerating = $state(false);
	let userWantsAI = $state(false); // User explicitly opted into AI suggestions
	let manualMode = $state(false); // User writing subject line manually

	// Iteration history (perceptual substrate for temporal navigation)
	let suggestionHistory = $state<AISuggestion[]>([]);
	let selectedIterationIndex = $state<number>(0);

	// Real-time generation state
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;
	let currentRequestId: string | null = null;
	let lastGeneratedText = '';

	// Cache and rate limiter
	const suggestionCache = new SuggestionCache<AISuggestion>();
	const rateLimiter = new SuggestionRateLimiter();

	// Derived (perceptual state)
	const canShowRegenerateButton = $derived(
		showAISuggest && suggestionState.status === 'ready' && attemptCount < 5
	);

	// Current displayed suggestion (from history if navigating, else from state)
	const currentSuggestion = $derived<AISuggestion | null>(
		suggestionHistory.length > 0
			? suggestionHistory[selectedIterationIndex]
			: suggestionState.status === 'ready'
				? suggestionState.suggestion
				: null
	);

	// Is user viewing an older iteration (not the latest)?
	const isViewingPastIteration = $derived(
		suggestionHistory.length > 0 && selectedIterationIndex < suggestionHistory.length - 1
	);

	// React to rawInput changes with debouncing (only if user wants AI)
	$effect(() => {
		// Cancel existing timer
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}

		// Only auto-generate if user explicitly wants AI
		if (!userWantsAI || manualMode) {
			return;
		}

		const text = data.rawInput || '';

		// Check conditions
		const shouldGenerate =
			text.trim().length >= AI_SUGGESTION_TIMING.MIN_INPUT_LENGTH &&
			suggestionState.status === 'idle' &&
			calculateSimilarity(text, lastGeneratedText) <
				1 - AI_SUGGESTION_TIMING.CONTENT_SIMILARITY_THRESHOLD;

		if (shouldGenerate) {
			// Start debounce timer
			debounceTimer = setTimeout(() => {
				handleDebouncedGeneration(text);
			}, AI_SUGGESTION_TIMING.DEBOUNCE_DELAY);
		}
	});

	async function handleDebouncedGeneration(text: string): Promise<void> {
		// Check cache
		const cacheKey = text.trim().toLowerCase();
		const cached = suggestionCache.get(cacheKey);
		if (cached) {
			console.log('[AI] Using cached suggestion');
			suggestionState = { status: 'ready', suggestion: cached };
			showAISuggest = true;
			return;
		}

		// Check rate limit
		if (!rateLimiter.canMakeCall()) {
			const remaining = Math.ceil(rateLimiter.getTimeUntilReset() / 1000);
			suggestionState = {
				status: 'error',
				message: `Slow down. Try again in ${remaining}s.`
			};
			return;
		}

		// Generate
		await generateSuggestionWithTiming(text);
	}

	async function generateSuggestionWithTiming(text: string): Promise<void> {
		const requestId = crypto.randomUUID();
		currentRequestId = requestId;

		const startTime = Date.now();

		// Delay showing "thinking" to prevent flash
		const thinkingTimer = setTimeout(() => {
			if (currentRequestId === requestId) {
				suggestionState = { status: 'thinking', startTime };
			}
		}, AI_SUGGESTION_TIMING.MIN_THINKING_DURATION);

		try {
			rateLimiter.recordCall();

			const response = await api.post(
				'/toolhouse/generate-subject',
				{ message: text },
				{
					timeout: AI_SUGGESTION_TIMING.SUGGESTION_TIMEOUT,
					retries: AI_SUGGESTION_TIMING.MAX_RETRIES,
					showToast: false,
					skipErrorLogging: true
				}
			);

			clearTimeout(thinkingTimer);

			// Ignore stale responses
			if (requestId !== currentRequestId) {
				return;
			}

			if (response.success && response.data) {
				// Cache result
				suggestionCache.set(text.trim().toLowerCase(), response.data as AISuggestion);

				const newSuggestion = response.data as AISuggestion;

				// Add to history (temporal substrate)
				suggestionHistory = [...suggestionHistory, newSuggestion];
				selectedIterationIndex = suggestionHistory.length - 1; // Auto-select latest

				suggestionState = { status: 'ready', suggestion: newSuggestion };
				showAISuggest = true;
				lastGeneratedText = text;
				attemptCount++;
			} else {
				throw new Error(response.error || 'Generation failed');
			}
		} catch (err) {
			clearTimeout(thinkingTimer);

			if (requestId === currentRequestId) {
				const isTimeout = err instanceof Error && err.name === 'AbortError';
				suggestionState = {
					status: 'error',
					message: isTimeout
						? 'AI took too long. Try again or write your own.'
						: 'Something broke. Try again.'
				};
			}
		}
	}

	async function generateSuggestion(): Promise<void> {
		if (attemptCount >= 5) return;

		isGenerating = true;

		// Cancel any pending debounce
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}

		await generateSuggestionWithTiming(data.rawInput);

		isGenerating = false;
	}

	// Cleanup on unmount
	onMount(() => {
		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
		};
	});

	function acceptSuggestion() {
		if (currentSuggestion) {
			const { subject_line, core_issue, url_slug, domain } = currentSuggestion;
			data.title = subject_line;
			data.description = core_issue;
			data.slug = url_slug;
			data.category = mapDomainToCategory(domain);
			data.aiGenerated = true;
			showAISuggest = false;
		}
	}

	// Temporal navigation functions
	function navigateToIteration(index: number) {
		if (index >= 0 && index < suggestionHistory.length) {
			selectedIterationIndex = index;
		}
	}

	function navigatePrevious() {
		if (selectedIterationIndex > 0) {
			selectedIterationIndex--;
		}
	}

	function navigateNext() {
		if (selectedIterationIndex < suggestionHistory.length - 1) {
			selectedIterationIndex++;
		}
	}

	// Keyboard navigation (spatial metaphor: ← → arrows)
	function handleKeyboardNavigation(event: KeyboardEvent) {
		if (!showAISuggest || suggestionHistory.length === 0) return;

		if (event.key === 'ArrowLeft') {
			event.preventDefault();
			navigatePrevious();
		} else if (event.key === 'ArrowRight') {
			event.preventDefault();
			navigateNext();
		}
	}

	// Attach keyboard listener on mount
	onMount(() => {
		window.addEventListener('keydown', handleKeyboardNavigation);
		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
			window.removeEventListener('keydown', handleKeyboardNavigation);
		};
	});

	function editRawWriting() {
		showAISuggest = false;
		suggestionState = { status: 'idle' };
		userWantsAI = false;
	}

	function enableAISuggestions() {
		userWantsAI = true;
		manualMode = false;
		if ((data.rawInput || '').trim().length >= AI_SUGGESTION_TIMING.MIN_INPUT_LENGTH) {
			generateSuggestion();
		}
	}

	function writeManually() {
		manualMode = true;
		userWantsAI = false;
		showAISuggest = false;
		suggestionState = { status: 'idle' };
	}

	function mapDomainToCategory(domain: string): string {
		const mapping: Record<string, string> = {
			government: 'Government',
			corporate: 'Corporate',
			institutional: 'Institutional',
			labor: 'Labor',
			advocacy: 'Advocacy'
		};
		return mapping[domain] || 'General';
	}
</script>

<div class="unified-objective-entry">
	<!-- Raw writing surface (always visible) -->
	<div class="raw-writing-surface">
		<label for="raw-input" class="mb-2 block text-sm font-medium text-slate-700">
			What needs to change?
		</label>

		<textarea
			id="raw-input"
			bind:value={data.rawInput}
			placeholder="The rent keeps going up but wages don't..."
			rows="5"
			disabled={isGenerating}
			class="w-full rounded-lg border-2 border-slate-200 bg-slate-50 px-4 py-3
             text-base text-slate-900 transition-colors duration-200
             placeholder:italic placeholder:text-slate-500 focus:border-participation-primary-500 focus:bg-white focus:outline-none
             focus:ring-2 focus:ring-participation-primary-500
             disabled:cursor-not-allowed disabled:opacity-60"
		/>

		<div class="mt-2 flex items-center justify-between text-xs text-slate-600">
			{#if (data.rawInput || '').trim().length > 0}
				<span class="font-mono">{(data.rawInput || '').length} characters</span>
			{:else}
				<span class="italic">Describe the problem you want to solve</span>
			{/if}
		</div>
	</div>

	<!-- Path choice: refine or write manually -->
	{#if !manualMode && !userWantsAI && !showAISuggest && (data.rawInput || '').trim().length >= AI_SUGGESTION_TIMING.MIN_INPUT_LENGTH}
		<div class="mt-4 flex gap-3" transition:slide={{ duration: 200 }}>
			<button
				type="button"
				onclick={enableAISuggestions}
				class="inline-flex flex-1 items-center justify-center gap-2 rounded-lg
                 bg-participation-primary-600 px-4 py-3 text-sm font-semibold text-white
                 shadow-sm transition-all duration-150 hover:bg-participation-primary-700 hover:shadow"
			>
				<Sparkles class="h-4 w-4" />
				Hit me ({5 - attemptCount}
				{attemptCount === 4 ? 'left' : 'left'})
			</button>

			<button
				type="button"
				onclick={writeManually}
				class="inline-flex items-center gap-2 rounded-lg border-2 border-slate-300
                 bg-white px-4 py-3 text-sm font-medium text-slate-700
                 transition-all duration-150 hover:border-slate-400 hover:bg-slate-50"
			>
				I'll write it
			</button>
		</div>
	{/if}

	<!-- Status indicator (shows when refining enabled and waiting) -->
	{#if userWantsAI && !showAISuggest && suggestionState.status === 'idle' && (data.rawInput || '').trim().length >= AI_SUGGESTION_TIMING.MIN_INPUT_LENGTH}
		<div
			class="mt-2 flex items-center gap-2 text-xs text-slate-500"
			transition:fade={{ duration: 150 }}
		>
			<Sparkles class="h-3.5 w-3.5" />
			<span>Refining when you stop typing...</span>
		</div>
	{/if}

	<!-- Thinking indicator (only show if not already showing suggestion surface) -->
	{#if suggestionState.status === 'thinking' && !showAISuggest}
		<div
			class="mt-3 flex items-center gap-2 text-sm text-slate-600"
			transition:fade={{ duration: 150 }}
		>
			<div
				class="h-4 w-4 animate-spin rounded-full border-2 border-participation-primary-600 border-t-transparent"
			/>
			<span>Refining...</span>
		</div>
	{/if}

	<!-- Refined suggestion surface -->
	{#if showAISuggest && currentSuggestion}
		<div
			class="mt-4 rounded-lg border-2 border-participation-primary-200 bg-participation-primary-50 p-4"
			transition:slide={{ duration: 200 }}
		>
			<!-- Iteration timeline (perceptual temporal navigation) -->
			{#if suggestionHistory.length > 1}
				<div class="mb-4 flex items-center gap-3 border-b border-participation-primary-200 pb-3">
					<button
						type="button"
						onclick={navigatePrevious}
						disabled={selectedIterationIndex === 0}
						class="text-participation-primary-600 transition-opacity hover:text-participation-primary-700 disabled:cursor-not-allowed disabled:opacity-30"
						aria-label="Previous iteration"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M15 19l-7-7 7-7"
							/>
						</svg>
					</button>

					<div class="flex flex-1 items-center justify-center gap-2">
						{#each suggestionHistory as _, index}
							<button
								type="button"
								onclick={() => navigateToIteration(index)}
								class="group relative transition-all duration-200 ease-out"
								aria-label={`Iteration ${index + 1}${index === suggestionHistory.length - 1 ? ' (latest)' : ''}`}
							>
								<!-- Dot indicator -->
								<div
									class="h-2.5 w-2.5 rounded-full transition-all duration-200
									{index === selectedIterationIndex
										? 'scale-125 bg-participation-primary-600 ring-2 ring-participation-primary-600 ring-offset-2 ring-offset-participation-primary-50'
										: index === suggestionHistory.length - 1
											? 'bg-participation-primary-400 hover:bg-participation-primary-500'
											: 'bg-participation-primary-300 hover:bg-participation-primary-400'}"
								/>

								<!-- Tooltip on hover -->
								<div
									class="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
								>
									{index === suggestionHistory.length - 1 ? 'Latest' : `Try ${index + 1}`}
								</div>
							</button>
						{/each}
					</div>

					<button
						type="button"
						onclick={navigateNext}
						disabled={selectedIterationIndex === suggestionHistory.length - 1}
						class="text-participation-primary-600 transition-opacity hover:text-participation-primary-700 disabled:cursor-not-allowed disabled:opacity-30"
						aria-label="Next iteration"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 5l7 7-7 7"
							/>
						</svg>
					</button>
				</div>

				<!-- Viewing past iteration indicator -->
				{#if isViewingPastIteration}
					<div
						class="mb-3 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-100 px-3 py-2 text-xs text-amber-900"
						transition:fade={{ duration: 150 }}
					>
						<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<span class="font-medium"
							>Viewing try {selectedIterationIndex + 1} of {suggestionHistory.length}</span
						>
						<button
							type="button"
							onclick={() => navigateToIteration(suggestionHistory.length - 1)}
							class="ml-auto font-medium text-amber-700 underline hover:text-amber-800"
						>
							Jump to latest
						</button>
					</div>
				{/if}
			{/if}

			<div class="mb-3">
				<div class="mb-2 flex items-center gap-2">
					<Sparkles class="h-4 w-4 text-participation-primary-600" />
					<span
						class="text-xs font-semibold uppercase tracking-wide text-participation-primary-700"
					>
						Refined Subject Line
					</span>
				</div>
				<p class="text-lg font-bold leading-tight text-slate-900">
					{currentSuggestion.subject_line}
				</p>
			</div>

			<div class="mb-4 space-y-1 text-sm text-slate-700">
				<div>
					<strong class="font-semibold">Core issue:</strong>
					{currentSuggestion.core_issue}
				</div>
				<div>
					<strong class="font-semibold">Domain:</strong>
					{currentSuggestion.domain}
				</div>
				<div class="text-xs text-slate-600">
					<strong class="font-semibold">Slug:</strong>
					{currentSuggestion.url_slug}
				</div>
			</div>

			<div class="space-y-2">
				<div class="flex gap-2">
					<button
						type="button"
						onclick={acceptSuggestion}
						class="inline-flex flex-1 items-center justify-center gap-2 rounded-lg
                 bg-participation-primary-600 px-4 py-2 text-sm font-semibold text-white
                 shadow-sm transition-all duration-150 hover:bg-participation-primary-700 hover:shadow"
					>
						Use this
						<ArrowRight class="h-4 w-4" />
					</button>

					<button
						type="button"
						onclick={writeManually}
						class="inline-flex items-center gap-2 rounded-lg border-2 border-slate-300
                 bg-white px-4 py-2 text-sm font-medium text-slate-700
                 transition-all duration-150 hover:border-slate-400 hover:bg-slate-50"
					>
						I'll write it
					</button>
				</div>

				<div class="flex items-center justify-between">
					{#if attemptCount < 5}
						<button
							type="button"
							onclick={generateSuggestion}
							disabled={isGenerating}
							class="inline-flex items-center gap-2 text-sm font-medium text-participation-primary-700
                     transition-colors duration-150 hover:text-participation-primary-800
                     disabled:cursor-not-allowed disabled:opacity-50"
						>
							{#if isGenerating}
								<div
									class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-participation-primary-600 border-t-transparent"
								/>
							{:else}
								<Sparkles class="h-3.5 w-3.5" />
							{/if}
							Hit me again ({5 - attemptCount} left)
						</button>
					{:else}
						<span class="text-sm text-slate-600">Out of refinements</span>
					{/if}

					<button
						type="button"
						onclick={editRawWriting}
						class="text-sm text-slate-600 underline hover:text-slate-800"
					>
						Edit original
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Error state -->
	{#if suggestionState.status === 'error'}
		<div
			class="mt-4 rounded-lg border border-red-200 bg-red-50 p-3"
			transition:slide={{ duration: 200 }}
		>
			<p class="text-sm text-red-700">{suggestionState.message}</p>
			<button
				type="button"
				onclick={generateSuggestion}
				class="mt-2 text-sm font-medium text-red-600 underline hover:text-red-800"
			>
				Hit me again
			</button>
		</div>
	{/if}

	<!-- Manual writing mode -->
	{#if manualMode}
		<div class="mt-4 space-y-4" transition:slide={{ duration: 200 }}>
			<div class="rounded-lg border-2 border-slate-200 bg-white p-4">
				<div class="mb-3">
					<label for="manual-title" class="mb-1 block text-sm font-medium text-slate-700">
						Subject Line
					</label>
					<input
						id="manual-title"
						type="text"
						bind:value={data.title}
						placeholder="Make housing affordable in California"
						class="w-full rounded-lg border-2 border-slate-200 bg-slate-50 px-4 py-2
                     text-base text-slate-900 transition-colors duration-200
                     placeholder:text-slate-500 focus:border-participation-primary-500 focus:bg-white
                     focus:outline-none focus:ring-2 focus:ring-participation-primary-500"
					/>
				</div>

				<div class="mb-3">
					<label for="manual-description" class="mb-1 block text-sm font-medium text-slate-700">
						Core Issue (Optional)
					</label>
					<textarea
						id="manual-description"
						bind:value={data.description}
						placeholder="Brief description of the core issue..."
						rows="3"
						class="w-full rounded-lg border-2 border-slate-200 bg-slate-50 px-4 py-2
                     text-base text-slate-900 transition-colors duration-200
                     placeholder:text-slate-500 focus:border-participation-primary-500 focus:bg-white
                     focus:outline-none focus:ring-2 focus:ring-participation-primary-500"
					/>
				</div>

				<div class="flex justify-end gap-2">
					<button
						type="button"
						onclick={enableAISuggestions}
						class="inline-flex items-center gap-2 rounded-lg border border-slate-300
                   bg-white px-3 py-2 text-sm font-medium text-slate-700
                   transition-colors duration-150 hover:bg-slate-50"
					>
						<Sparkles class="h-3.5 w-3.5" />
						Refine it for me
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Slug customizer (existing component, unchanged) -->
	<div class="mt-6">
		<SlugCustomizer
			title={data.title}
			bind:slug={data.slug}
			aiGenerated={data.aiGenerated}
			{context}
		/>
	</div>
</div>
