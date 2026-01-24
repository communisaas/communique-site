<script lang="ts">
	import { onMount } from 'svelte';
	import { FileText, Search, BookOpen, CheckCircle2 } from '@lucide/svelte';
	import type { TemplateFormData } from '$lib/types/template';
	import { cleanHtmlFormatting } from '$lib/utils/message-processing';
	import { parseSSEStream } from '$lib/utils/sse-stream';
	import ThinkingAtmosphere from '$lib/components/ui/ThinkingAtmosphere.svelte';
	import MessageResults from './MessageResults.svelte';
	import AuthGateOverlay from './AuthGateOverlay.svelte';

	interface Props {
		formData: TemplateFormData;
		onnext: () => void;
		onback: () => void;
		/** Draft ID for OAuth resumption */
		draftId?: string;
		/** Save draft callback for OAuth flow */
		onSaveDraft?: () => void;
	}

	let { formData = $bindable(), onnext, onback, draftId, onSaveDraft }: Props = $props();

	type Stage = 'generating' | 'results' | 'editing' | 'error' | 'auth-required';
	let stage = $state<Stage>('generating');
	let errorMessage = $state<string | null>(null);
	let isGenerating = $state(false);

	// Streaming state
	let thoughts = $state<string[]>([]);
	let currentPhase = $state<'research' | 'complete'>('research');

	// Phase display
	const phases = [
		{ id: 'research', icon: Search, text: 'Researching and writing' },
		{ id: 'complete', icon: CheckCircle2, text: 'Complete' }
	] as const;

	/**
	 * Check if error indicates auth is required
	 * Matches rate limiter 429 responses for guests
	 */
	function isAuthRequiredError(err: unknown): boolean {
		if (err instanceof Error) {
			const msg = err.message.toLowerCase();
			return (
				msg.includes('requires an account') ||
				msg.includes('sign in') ||
				msg.includes('authentication required') ||
				msg.includes('rate limit') ||
				msg.includes('401')
			);
		}
		return false;
	}

	/**
	 * Build progress items for auth gate - shows sunk cost
	 */
	function buildAuthProgressItems() {
		const items = [];

		// Their subject line
		if (formData.objective.title) {
			items.push({
				label: 'Subject line',
				value: formData.objective.title,
				secondary: formData.objective.description
			});
		}

		// Their selected decision-makers (truncated list)
		const dmCount = formData.audience?.decisionMakers?.length || 0;
		if (dmCount > 0) {
			const firstDm = formData.audience.decisionMakers[0];
			const dmValue =
				dmCount === 1
					? firstDm.name
					: `${firstDm.name} + ${dmCount - 1} other${dmCount > 2 ? 's' : ''}`;
			items.push({
				label: 'Decision-makers',
				value: dmValue,
				secondary: firstDm.title
			});
		}

		return items;
	}

	// Store original AI-generated message for "start fresh"
	let originalMessage = $state('');
	let originalSubject = $state('');

	/**
	 * Build topics array with robust fallback chain
	 * 1. Use topics array if populated with valid entries
	 * 2. Fall back to category (normalized)
	 * 3. Ultimate fallback - 'general'
	 */
	function buildTopics(): string[] {
		if (Array.isArray(formData.objective.topics) && formData.objective.topics.length > 0) {
			const valid = formData.objective.topics.filter((t) => t && t.trim());
			if (valid.length > 0) return valid;
		}
		if (formData.objective.category && formData.objective.category.trim()) {
			return [formData.objective.category.toLowerCase().trim()];
		}
		return ['general'];
	}

	/**
	 * Build voice sample with fallback chain
	 * Prefer AI-extracted voiceSample, fall back to rawInput, then description
	 */
	function buildVoiceSample(): string {
		return (
			formData.objective.voiceSample ||
			formData.objective.rawInput ||
			formData.objective.description ||
			''
		);
	}

	/**
	 * Build raw input with fallback to description
	 */
	function buildRawInput(): string {
		return formData.objective.rawInput || formData.objective.description || '';
	}

	async function generateMessage() {
		// Prevent concurrent generation
		if (isGenerating) return;
		isGenerating = true;

		try {
			stage = 'generating';
			errorMessage = null;
			thoughts = [];
			currentPhase = 'research';
			console.log('[MessageGenerationResolver] Starting streaming generation...');

			// Validate we have required data
			if (!formData.objective.title || !formData.objective.description) {
				throw new Error('Missing subject line or core issue');
			}

			if (!formData.audience.decisionMakers || formData.audience.decisionMakers.length === 0) {
				throw new Error('No decision-makers selected');
			}

			// Build with fallback chains
			const topics = buildTopics();
			const voiceSample = buildVoiceSample();
			const rawInput = buildRawInput();

			// Use streaming endpoint
			const response = await fetch('/api/agents/stream-message', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					subject_line: formData.objective.title,
					core_issue: formData.objective.description,
					topics,
					decision_makers: formData.audience.decisionMakers.map((dm) => ({
						name: dm.name,
						title: dm.title,
						organization: dm.organization
					})),
					voice_sample: voiceSample,
					raw_input: rawInput
				})
			});

			// Check for auth errors
			if (response.status === 429 || response.status === 401) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || 'Authentication required');
			}

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || 'Failed to generate message');
			}

			// Process SSE stream
			for await (const event of parseSSEStream<Record<string, unknown>>(response)) {
				switch (event.type) {
					case 'phase':
						currentPhase = event.data.phase as typeof currentPhase;
						break;

					case 'thought':
						if (typeof event.data.content === 'string') {
							thoughts = [...thoughts, event.data.content];
						}
						break;

					case 'complete': {
						const result = event.data as {
							message?: string;
							subject?: string;
							sources?: unknown[];
							research_log?: string[];
							geographic_scope?: unknown;
						};

						// Clean HTML formatting from message
						const cleanedMessage = cleanHtmlFormatting(result.message || '');

						// Store original for "start fresh"
						originalMessage = cleanedMessage;
						originalSubject = result.subject || formData.objective.title;

						// Update formData
						formData.content.preview = cleanedMessage;
						formData.content.sources = (result.sources as typeof formData.content.sources) || [];
						formData.content.researchLog = result.research_log || [];
						formData.content.geographicScope =
							(result.geographic_scope as typeof formData.content.geographicScope) || null;
						formData.content.aiGenerated = true;
						formData.content.edited = false;

						// Update subject if different
						if (result.subject && result.subject !== formData.objective.title) {
							formData.objective.title = result.subject;
						}

						console.log('[MessageGenerationResolver] Message generated:', {
							message_length: cleanedMessage.length,
							sources_count: formData.content.sources?.length || 0
						});

						stage = 'results';
						break;
					}

					case 'error':
						throw new Error(
							typeof event.data.message === 'string' ? event.data.message : 'Generation failed'
						);
				}
			}
		} catch (err) {
			console.error('[MessageGenerationResolver] Error:', err);

			if (isAuthRequiredError(err)) {
				console.log('[MessageGenerationResolver] Auth required, showing overlay');
				stage = 'auth-required';
			} else {
				errorMessage =
					err instanceof Error ? err.message : 'Failed to generate message. Please try again.';
				stage = 'error';
			}
		} finally {
			isGenerating = false;
		}
	}

	// Auto-run on mount
	onMount(() => {
		// Only generate if message hasn't been generated yet
		if (!formData.content.preview || !formData.content.aiGenerated) {
			generateMessage();
		} else {
			// Already have a message, go straight to results
			stage = 'results';
		}
	});

	function handleEdit() {
		stage = 'editing';
		// Mark as edited
		formData.content.edited = true;
	}

	function handleStartFresh() {
		// Reset to original AI-generated message
		formData.content.preview = originalMessage;
		formData.objective.title = originalSubject;
		formData.content.edited = false;
		stage = 'results';
	}

	function handleSaveEdit() {
		// User finished editing, back to results
		stage = 'results';
	}

	function handleNext() {
		// Ensure content is set
		if (!formData.content.preview.trim()) {
			errorMessage = 'Message content is required';
			stage = 'error';
			return;
		}

		onnext();
	}
</script>

<div class="mx-auto max-w-3xl">
	{#if stage === 'generating'}
		<!-- Streaming generation UI with real agent thoughts -->
		<div class="mx-auto max-w-2xl space-y-6 py-8">
			<!-- Header -->
			<div class="text-center">
				<h3 class="text-lg font-semibold text-slate-900 md:text-xl">
					Crafting your research-backed message
				</h3>
				<p class="mt-2 text-sm text-slate-500">
					Finding sources, building arguments, writing with your voice
				</p>
			</div>

			<!-- Phase indicator -->
			<div class="space-y-2">
				{#each phases as phase, i}
					{@const phaseIndex = phases.findIndex((p) => p.id === currentPhase)}
					{@const isActive = phase.id === currentPhase}
					{@const isComplete = i < phaseIndex || currentPhase === 'complete'}
					{@const IconComponent = phase.icon}
					<div
						class="flex items-center gap-3 rounded-lg p-3 transition-all duration-300"
						class:bg-participation-primary-50={isActive}
						class:border={isActive}
						class:border-participation-primary-200={isActive}
					>
						<div
							class="flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300"
							class:bg-participation-primary-600={isActive}
							class:text-white={isActive}
							class:bg-green-100={isComplete}
							class:text-green-600={isComplete}
							class:bg-slate-100={!isActive && !isComplete}
							class:text-slate-400={!isActive && !isComplete}
						>
							<IconComponent class="h-5 w-5" />
						</div>

						<p
							class="text-sm font-medium transition-colors duration-300"
							class:text-participation-primary-900={isActive}
							class:text-green-900={isComplete}
							class:text-slate-500={!isActive && !isComplete}
						>
							{phase.text}
						</p>

						{#if isComplete}
							<CheckCircle2 class="ml-auto h-5 w-5 text-green-600" />
						{:else if isActive}
							<div class="ml-auto h-5 w-5">
								<div
									class="h-full w-full animate-spin rounded-full border-2 border-participation-primary-600 border-t-transparent"
								></div>
							</div>
						{/if}
					</div>
				{/each}
			</div>

			<!-- Real agent thoughts -->
			<ThinkingAtmosphere {thoughts} isActive={stage === 'generating'} />

			<!-- Educational context -->
			<div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
				<p class="text-sm text-slate-600">
					<span class="font-medium text-slate-700">Why this takes time:</span>
					We're researching your specific issue, finding credible sources, and writing a message that
					shows you understand the landscape.
				</p>
			</div>
		</div>
	{:else if stage === 'results'}
		<!-- Results display with citations, sources, and research log -->
		<MessageResults
			bind:geographicScope={formData.content.geographicScope}
			message={formData.content.preview}
			subject={formData.objective.title}
			sources={formData.content.sources || []}
			researchLog={formData.content.researchLog || []}
			onEdit={handleEdit}
			onStartFresh={handleStartFresh}
		/>

		<!-- Navigation -->
		<div class="mt-8 flex items-center justify-between border-t border-slate-200 pt-6">
			<button
				type="button"
				onclick={onback}
				class="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
			>
				← Back
			</button>

			<button
				type="button"
				onclick={handleNext}
				class="inline-flex items-center gap-2 rounded-lg bg-participation-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-participation-primary-700 hover:shadow"
			>
				Publish →
			</button>
		</div>
	{:else if stage === 'editing'}
		<!-- Message editor -->
		<div class="space-y-4">
			<div>
				<h3 class="text-lg font-semibold text-slate-900">Edit your message</h3>
				<p class="mt-1 text-sm text-slate-600">
					{#if formData.content.sources && formData.content.sources.length > 0}
						Citations [1][2][3] will be preserved and linked to sources
					{:else}
						Edit the message to match your voice while keeping the research-backed content
					{/if}
				</p>
			</div>

			<!-- Subject line -->
			<div>
				<label for="edit-subject" class="block text-sm font-medium text-slate-700"> Subject </label>
				<input
					id="edit-subject"
					type="text"
					bind:value={formData.objective.title}
					class="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-participation-primary-500 focus:ring-2 focus:ring-participation-primary-500"
				/>
			</div>

			<!-- Message body -->
			<div>
				<label for="edit-message" class="block text-sm font-medium text-slate-700"> Message </label>
				<textarea
					id="edit-message"
					bind:value={formData.content.preview}
					rows={16}
					class="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2 font-mono text-sm focus:border-participation-primary-500 focus:ring-2 focus:ring-participation-primary-500"
				></textarea>
				<p class="mt-1 text-xs text-slate-600">
					Keep citations like [1][2][3] to maintain source links
				</p>
			</div>

			<!-- Actions -->
			<div class="flex items-center justify-end gap-3">
				<button
					type="button"
					onclick={handleStartFresh}
					class="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
				>
					Reset to original
				</button>
				<button
					type="button"
					onclick={handleSaveEdit}
					class="inline-flex items-center gap-2 rounded-lg bg-participation-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-participation-primary-700"
				>
					Save changes
				</button>
			</div>
		</div>
	{:else if stage === 'error'}
		<!-- Error state -->
		<div class="space-y-4 py-8">
			<div class="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
				<p class="text-lg font-semibold text-red-900">Something went wrong</p>
				<p class="mt-2 text-sm text-red-700">{errorMessage}</p>
			</div>

			<div class="flex items-center justify-center gap-4">
				<button
					type="button"
					onclick={generateMessage}
					class="inline-flex items-center gap-2 rounded-lg bg-participation-primary-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-participation-primary-700"
				>
					Try again
				</button>

				<button
					type="button"
					onclick={onback}
					class="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
				>
					Go back
				</button>
			</div>
		</div>
	{:else if stage === 'auth-required'}
		<!-- Auth required - progressive commitment overlay -->
		<div class="relative min-h-[400px]">
			<AuthGateOverlay
				title="Unlock Message Generation"
				description="Free account required to craft your message"
				icon={FileText}
				progress={buildAuthProgressItems()}
				onback={onback}
				{draftId}
				{onSaveDraft}
			/>
		</div>
	{/if}
</div>
