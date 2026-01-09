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
	import ClarificationPanel from './ClarificationPanel.svelte';
	import type {
		ClarificationQuestion,
		InferredContext,
		ClarificationAnswers
	} from '$lib/core/agents/types/clarification';

	interface Props {
		data: {
			rawInput: string;
			title: string;
			description: string;
			category: string;
			topics?: string[];
			slug?: string;
			voiceSample?: string;
			aiGenerated?: boolean;
		};
		context: TemplateCreationContext;
	}

	/**
	 * Normalize topics to lowercase, hyphenated format
	 * "Tuition Hikes" → "tuition-hikes"
	 */
	function normalizeTopics(topics: string[]): string[] {
		return topics.map((t) =>
			t
				.toLowerCase()
				.trim()
				.replace(/\s+/g, '-')
				.replace(/[^a-z0-9-]/g, '')
		);
	}

	let { data = $bindable(), context }: Props = $props();

	// State
	type SuggestionState =
		| { status: 'idle' }
		| { status: 'thinking'; startTime: number }
		| {
				status: 'clarifying';
				questions: ClarificationQuestion[];
				inferredContext: InferredContext;
				interactionId: string;
		  }
		| { status: 'ready'; suggestion: AISuggestion }
		| { status: 'error'; message: string };

	interface AISuggestion {
		subject_line: string;
		core_issue: string;
		topics: string[];
		url_slug: string;
		voice_sample: string;
		interactionId?: string;
	}

	let suggestionState = $state<SuggestionState>({ status: 'idle' });
	let showAISuggest = $state(false);
	let attemptCount = $state(0);
	let isGenerating = $state(false);
	let userWantsAI = $state(true); // Default to AI mode - auto-trigger on first input
	let manualMode = $state(false); // User writing subject line manually
	let hasAutoTriggered = $state(false); // Track if we've auto-triggered once

	// Store complete context for clarification turns
	let conversationContext = $state<{
		originalDescription: string;
		questionsAsked: ClarificationQuestion[];
		inferredContext: InferredContext;
	} | null>(null);

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

	// React to rawInput changes with debouncing
	// Auto-triggers on first sufficient input, then on subsequent changes if userWantsAI
	$effect(() => {
		// Cancel existing timer
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}

		// Don't auto-generate if in manual mode
		if (manualMode) {
			return;
		}

		const text = data.rawInput || '';
		const hasSufficientInput = text.trim().length >= AI_SUGGESTION_TIMING.MIN_INPUT_LENGTH;

		// Check conditions for generation
		const shouldGenerate =
			hasSufficientInput &&
			suggestionState.status === 'idle' &&
			!isGenerating &&
			calculateSimilarity(text, lastGeneratedText) <
				1 - AI_SUGGESTION_TIMING.CONTENT_SIMILARITY_THRESHOLD;

		if (shouldGenerate && userWantsAI) {
			// Start debounce timer
			debounceTimer = setTimeout(() => {
				hasAutoTriggered = true;
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

		// Set generating flag to prevent double-triggers
		isGenerating = true;
		try {
			await generateSuggestionWithTiming(text);
		} finally {
			isGenerating = false;
		}
	}

	async function generateSuggestionWithTiming(
		text: string,
		clarificationAnswers?: ClarificationAnswers,
		interactionId?: string
	): Promise<void> {
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

			const payload: {
				message: string;
				interactionId?: string;
				clarificationAnswers?: ClarificationAnswers;
			} = { message: text };

			if (interactionId) {
				payload.interactionId = interactionId;
			}

			if (clarificationAnswers) {
				payload.clarificationAnswers = clarificationAnswers;
			}

			const response = await api.post('/agents/generate-subject', payload, {
				timeout: AI_SUGGESTION_TIMING.SUGGESTION_TIMEOUT,
				retries: AI_SUGGESTION_TIMING.MAX_RETRIES,
				showToast: false,
				skipErrorLogging: true
			});

			clearTimeout(thinkingTimer);

			// Ignore stale responses
			if (requestId !== currentRequestId) {
				return;
			}

			if (response.success && response.data) {
				// Check if agent needs clarification
				if (response.data.needs_clarification) {
					suggestionState = {
						status: 'clarifying',
						questions: response.data.clarification_questions || [],
						inferredContext: response.data.inferred_context || {
							detected_location: null,
							detected_scope: null,
							detected_target_type: null,
							location_confidence: 0,
							scope_confidence: 0,
							target_type_confidence: 0
						},
						interactionId: response.data.interactionId || crypto.randomUUID()
					};

					// Store complete context for reconstruction on answer submission
					conversationContext = {
						originalDescription: text,
						questionsAsked: response.data.clarification_questions || [],
						inferredContext: response.data.inferred_context || {
							detected_location: null,
							detected_scope: null,
							detected_target_type: null,
							location_confidence: 0,
							scope_confidence: 0,
							target_type_confidence: 0
						}
					};

					showAISuggest = true;
					return;
				}

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
			const { subject_line, core_issue, url_slug, topics, voice_sample } = currentSuggestion;
			data.title = subject_line || '';
			// Fallback chain for core_issue: use raw input if agent didn't provide one
			data.description = core_issue || data.rawInput || '';
			data.slug = url_slug || '';
			// Fallback chain for voice_sample: prefer agent-extracted, then raw input
			data.voiceSample = voice_sample || data.rawInput || '';
			// Normalize and store all topics
			const normalized = normalizeTopics(topics || []);
			data.topics = normalized;
			// Use primary topic as category (capitalize first letter of first word)
			const primaryTopic = normalized[0] || 'general';
			data.category =
				primaryTopic.split('-')[0].charAt(0).toUpperCase() + primaryTopic.split('-')[0].slice(1);
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
		// Trigger generation immediately if we have enough input
		if ((data.rawInput || '').trim().length >= AI_SUGGESTION_TIMING.MIN_INPUT_LENGTH) {
			generateSuggestion();
		}
	}

	// Handle keyboard shortcuts in textarea
	function handleTextareaKeydown(event: KeyboardEvent) {
		// Cmd/Ctrl + Enter to trigger generation immediately
		if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
			event.preventDefault();
			if (
				(data.rawInput || '').trim().length >= AI_SUGGESTION_TIMING.MIN_INPUT_LENGTH &&
				!isGenerating
			) {
				generateSuggestion();
			}
		}
	}

	function writeManually() {
		manualMode = true;
		userWantsAI = false;
		showAISuggest = false;
		suggestionState = { status: 'idle' };
		// Capture rawInput as voice sample for downstream agents
		// Manual writers still have voice—it's in their original complaint
		if (data.rawInput && data.rawInput.trim()) {
			data.voiceSample = data.rawInput.trim();
		}
		data.aiGenerated = false;
	}

	/**
	 * Handle clarification answers submission
	 * Sends COMPLETE context (original + questions + answers) for stateless reconstruction
	 */
	async function handleClarificationSubmit(answers: Record<string, string>): Promise<void> {
		if (suggestionState.status !== 'clarifying' || !conversationContext) return;

		// Build full conversation context for the agent
		const fullContext = {
			originalDescription: conversationContext.originalDescription,
			questionsAsked: conversationContext.questionsAsked,
			inferredContext: conversationContext.inferredContext,
			answers: answers as ClarificationAnswers
		};

		isGenerating = true;

		try {
			const response = await api.post(
				'/agents/generate-subject',
				{
					message: data.rawInput,
					conversationContext: fullContext
				},
				{
					timeout: AI_SUGGESTION_TIMING.SUGGESTION_TIMEOUT,
					retries: AI_SUGGESTION_TIMING.MAX_RETRIES,
					showToast: false,
					skipErrorLogging: true
				}
			);

			if (response.success && response.data) {
				// Agent should return final output now (no more clarification)
				const newSuggestion = response.data as AISuggestion;

				suggestionCache.set(data.rawInput.trim().toLowerCase(), newSuggestion);
				suggestionHistory = [...suggestionHistory, newSuggestion];
				selectedIterationIndex = suggestionHistory.length - 1;

				suggestionState = { status: 'ready', suggestion: newSuggestion };
				lastGeneratedText = data.rawInput;
				attemptCount++;

				// Clear conversation context
				conversationContext = null;
			} else {
				throw new Error(response.error || 'Generation failed after clarification');
			}
		} catch (err) {
			suggestionState = {
				status: 'error',
				message: 'Something broke after clarification. Try again.'
			};
		} finally {
			isGenerating = false;
		}
	}

	/**
	 * Handle clarification skip
	 * Still sends context but with empty answers - agent uses best guesses
	 */
	async function handleClarificationSkip(): Promise<void> {
		// Treat skip as submitting empty answers - agent will use inferred context
		await handleClarificationSubmit({});
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
			onkeydown={handleTextareaKeydown}
			placeholder="The rent keeps going up but wages don't..."
			rows="5"
			disabled={isGenerating}
			tabindex={0}
			class="w-full rounded-lg border-2 border-slate-200 bg-slate-50 px-4 py-3
             text-base text-slate-900 transition-colors duration-200
             placeholder:italic placeholder:text-slate-500 focus:border-participation-primary-500 focus:bg-white focus:outline-none
             focus:ring-2 focus:ring-participation-primary-500
             disabled:cursor-not-allowed disabled:opacity-60"
		></textarea>

		<div class="mt-2 flex items-center justify-between text-xs text-slate-600">
			{#if (data.rawInput || '').trim().length > 0}
				<span class="font-mono">{(data.rawInput || '').length} characters</span>
				{#if (data.rawInput || '').trim().length >= AI_SUGGESTION_TIMING.MIN_INPUT_LENGTH && !isGenerating && !showAISuggest}
					<span class="text-slate-400">⌘↵ to generate now</span>
				{/if}
			{:else}
				<span class="italic">Describe the problem you want to solve</span>
			{/if}
		</div>
	</div>

	<!-- Manual mode option (shown during generation or when AI is working) -->
	{#if !manualMode && !showAISuggest && (data.rawInput || '').trim().length >= AI_SUGGESTION_TIMING.MIN_INPUT_LENGTH && suggestionState.status !== 'thinking'}
		<div class="mt-3 text-right" transition:fade={{ duration: 150 }}>
			<button
				type="button"
				onclick={writeManually}
				tabindex={0}
				class="text-sm text-slate-500 underline transition-colors hover:text-slate-700"
			>
				I'll write my own subject line
			</button>
		</div>
	{/if}

	<!-- Status indicator (shows when waiting to generate) -->
	{#if !manualMode && !showAISuggest && suggestionState.status === 'idle' && (data.rawInput || '').trim().length >= AI_SUGGESTION_TIMING.MIN_INPUT_LENGTH}
		<div
			class="mt-2 flex items-center gap-2 text-xs text-slate-500"
			transition:fade={{ duration: 150 }}
		>
			<Sparkles class="h-3.5 w-3.5" />
			<span>Generating when you stop typing...</span>
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

	<!-- Clarification panel (shown when agent needs clarification) -->
	{#if showAISuggest && suggestionState.status === 'clarifying'}
		<div class="mt-4" transition:slide={{ duration: 200 }}>
			<ClarificationPanel
				questions={suggestionState.questions}
				inferredContext={suggestionState.inferredContext}
				onSubmit={handleClarificationSubmit}
				onSkip={handleClarificationSkip}
			/>
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

			<div class="mb-4 space-y-2 text-sm text-slate-700">
				<div>
					<strong class="font-semibold">Core issue:</strong>
					{currentSuggestion.core_issue}
				</div>
				<div class="flex flex-wrap gap-1.5">
					{#each currentSuggestion.topics as topic}
						<span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{topic}</span
						>
					{/each}
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
						tabindex={0}
						class="inline-flex flex-1 items-center justify-center gap-2 rounded-lg
                 bg-participation-primary-600 px-4 py-2 text-sm font-semibold text-white
                 shadow-sm transition-all duration-150 hover:bg-participation-primary-700 hover:shadow
                 focus:outline-none focus:ring-2 focus:ring-participation-primary-500 focus:ring-offset-2"
					>
						Use this
						<ArrowRight class="h-4 w-4" />
					</button>

					<button
						type="button"
						onclick={writeManually}
						tabindex={0}
						class="inline-flex items-center gap-2 rounded-lg border-2 border-slate-300
                 bg-white px-4 py-2 text-sm font-medium text-slate-700
                 transition-all duration-150 hover:border-slate-400 hover:bg-slate-50
                 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
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
							tabindex={0}
							class="inline-flex items-center gap-2 text-sm font-medium text-participation-primary-700
                     transition-colors duration-150 hover:text-participation-primary-800
                     focus:underline focus:outline-none
                     disabled:cursor-not-allowed disabled:opacity-50"
						>
							{#if isGenerating}
								<div
									class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-participation-primary-600 border-t-transparent"
								></div>
							{:else}
								<Sparkles class="h-3.5 w-3.5" />
							{/if}
							Try another ({5 - attemptCount} left)
						</button>
					{:else}
						<span class="text-sm text-slate-600">Out of refinements</span>
					{/if}

					<button
						type="button"
						onclick={editRawWriting}
						tabindex={0}
						class="text-sm text-slate-600 underline hover:text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
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
