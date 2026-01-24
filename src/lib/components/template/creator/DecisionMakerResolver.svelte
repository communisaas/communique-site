<script lang="ts">
	import { onMount } from 'svelte';
	import type { TemplateFormData } from '$lib/types/template';
	import { api } from '$lib/core/api/client';
	import {
		processDecisionMakers,
		extractRecipientEmails
	} from '$lib/utils/decision-maker-processing';
	import { parseSSEStream } from '$lib/utils/sse-stream';
	import ThinkingAtmosphere from '$lib/components/ui/ThinkingAtmosphere.svelte';
	import DecisionMakerResults from './DecisionMakerResults.svelte';
	import AuthGateOverlay from './AuthGateOverlay.svelte';
	import { Search, Building, Users, CheckCircle2 } from '@lucide/svelte';

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

	type Stage = 'structuring' | 'resolving' | 'results' | 'error' | 'auth-required';
	let stage = $state<Stage>('resolving');
	let errorMessage = $state<string | null>(null);
	let isResolving = $state(false);

	// Streaming state
	let thoughts = $state<string[]>([]);
	let currentPhase = $state<'identify' | 'enrich' | 'validate' | 'complete'>('identify');
	let enrichmentProgress = $state<{ current: number; total: number } | null>(null);

	// Phase display data
	const phases = [
		{ id: 'identify', icon: Search, text: 'Researching decision-makers' },
		{ id: 'enrich', icon: Building, text: 'Finding contact information' },
		{ id: 'validate', icon: Users, text: 'Validating pathways' },
		{ id: 'complete', icon: CheckCircle2, text: 'Complete' }
	] as const;

	/**
	 * Check if error indicates auth is required
	 * The rate limiter returns 429 with specific messages for auth-blocked operations
	 */
	function isAuthRequiredError(err: unknown): boolean {
		if (err instanceof Error) {
			const msg = err.message.toLowerCase();
			return (
				msg.includes('requires an account') ||
				msg.includes('sign in') ||
				msg.includes('authentication required') ||
				msg.includes('rate limit') // 429 errors from guest quota = 0
			);
		}
		return false;
	}

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

	async function resolveDecisionMakers() {
		// Prevent concurrent calls
		if (isResolving) {
			console.log('[DecisionMakerResolver] Already resolving, skipping...');
			return;
		}

		isResolving = true;
		errorMessage = null;
		thoughts = [];
		currentPhase = 'identify';
		enrichmentProgress = null;

		try {
			// Stage 1: Structure input if manual (quick pass)
			if (!formData.objective.aiGenerated) {
				stage = 'structuring';
				console.log('[DecisionMakerResolver] Structuring manual input...');

				const structureResponse = await api.post(
					'/agents/generate-subject',
					{
						message: `${formData.objective.title}. ${formData.objective.description}`
					},
					{
						timeout: 30000,
						showToast: false
					}
				);

				if (structureResponse.success && structureResponse.data) {
					console.log('[DecisionMakerResolver] Structured input:', structureResponse.data);
				}
			}

			// Stage 2: Resolve decision-makers via streaming endpoint
			stage = 'resolving';
			console.log('[DecisionMakerResolver] Starting streaming resolution...');

			const topics = buildTopics();
			const voiceSample = buildVoiceSample();

			const response = await fetch('/api/agents/stream-decision-makers', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					subject_line: formData.objective.title,
					core_issue: formData.objective.description,
					topics,
					voice_sample: voiceSample,
					url_slug: formData.objective.slug
				})
			});

			// Check for auth errors
			if (response.status === 429 || response.status === 401) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || 'Authentication required');
			}

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || 'Failed to resolve decision-makers');
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

					case 'progress':
						enrichmentProgress = {
							current: event.data.current as number,
							total: event.data.total as number
						};
						break;

					case 'complete': {
						const result = event.data as { decision_makers?: unknown[] };
						const rawDecisionMakers = result.decision_makers || [];
						const processed = processDecisionMakers(rawDecisionMakers);

						// Initialize audience data if not already set
						if (!formData.audience) {
							formData.audience = {
								decisionMakers: [],
								recipientEmails: [],
								includesCongress: false,
								customRecipients: []
							};
						}

						formData.audience.decisionMakers = processed;
						stage = 'results';
						break;
					}

					case 'error':
						throw new Error(
							typeof event.data.message === 'string'
								? event.data.message
								: 'Resolution failed'
						);
				}
			}
		} catch (err) {
			console.error('[DecisionMakerResolver] Error:', err);

			if (err instanceof Error && err.name === 'AbortError') {
				errorMessage = 'Request was cancelled. Please try again.';
				stage = 'error';
			} else if (isAuthRequiredError(err)) {
				console.log('[DecisionMakerResolver] Auth required, showing overlay');
				stage = 'auth-required';
			} else {
				errorMessage =
					err instanceof Error
						? err.message
						: 'Failed to resolve decision-makers. Please try again.';
				stage = 'error';
			}
		} finally {
			isResolving = false;
		}
	}

	// Auto-run on mount (only if not already resolved)
	onMount(() => {
		// Only auto-resolve if we don't already have decision-makers
		if (!formData.audience?.decisionMakers || formData.audience.decisionMakers.length === 0) {
			resolveDecisionMakers();
		} else {
			// Check for stale/broken data (missing emails/sources from old drafts)
			const hasInvalidData = formData.audience.decisionMakers.some(
				(dm) => dm.isAiResolved && (!dm.email || !dm.source)
			);

			if (hasInvalidData) {
				console.log('[DecisionMakerResolver] Found stale draft data (missing fields), re-resolving...');
				resolveDecisionMakers();
			} else {
				// Already have decision-makers, skip to results
				stage = 'results';
			}
		}
	});

	function handleNext() {
		// Ensure recipientEmails is updated from decision-makers
		formData.audience.recipientEmails = extractRecipientEmails(
			formData.audience.decisionMakers,
			formData.audience.customRecipients,
			formData.audience.includesCongress
		);

		onnext();
	}
</script>

<div class="mx-auto max-w-3xl">
	{#if stage === 'structuring'}
		<!-- Brief transition: 1-2 seconds -->
		<div class="space-y-4 py-8 text-center">
			<div
				class="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-participation-primary-600 border-t-transparent"
			></div>
			<p class="text-lg font-medium text-slate-900">Analyzing your issue...</p>
			<p class="text-sm text-slate-600">Preparing to find decision-makers</p>
		</div>
	{:else if stage === 'resolving'}
		<!-- Streaming resolution UI with real agent thoughts -->
		<div class="space-y-6 py-8">
			<!-- Header -->
			<div class="text-center">
				<h3 class="text-lg font-semibold text-slate-900 md:text-xl">
					Finding who can actually fix this
				</h3>
			</div>

			<!-- Phase Indicators (real progress, not fake cycling) -->
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
							class="flex h-8 w-8 items-center justify-center rounded-full transition-all duration-300"
							class:bg-participation-primary-600={isActive}
							class:text-white={isActive}
							class:bg-green-100={isComplete}
							class:text-green-600={isComplete}
							class:bg-slate-100={!isActive && !isComplete}
							class:text-slate-400={!isActive && !isComplete}
						>
							<IconComponent class="h-4 w-4" />
						</div>

						<div class="flex-1">
							<p
								class="text-sm font-medium transition-colors duration-300"
								class:text-participation-primary-900={isActive}
								class:text-green-900={isComplete}
								class:text-slate-500={!isActive && !isComplete}
							>
								{phase.text}
							</p>
							<!-- Enrichment progress bar -->
							{#if isActive && phase.id === 'enrich' && enrichmentProgress}
								<div class="mt-1.5 flex items-center gap-2">
									<div class="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
										<div
											class="h-full rounded-full bg-participation-primary-500 transition-all duration-300"
											style="width: {(enrichmentProgress.current / enrichmentProgress.total) * 100}%"
										></div>
									</div>
									<span class="text-xs text-slate-500">
										{enrichmentProgress.current}/{enrichmentProgress.total}
									</span>
								</div>
							{/if}
						</div>

						{#if isComplete}
							<CheckCircle2 class="h-5 w-5 text-green-600" />
						{:else if isActive}
							<div class="h-5 w-5">
								<div
									class="h-full w-full animate-spin rounded-full border-2 border-participation-primary-600 border-t-transparent"
								></div>
							</div>
						{/if}
					</div>
				{/each}
			</div>

			<!-- Real agent thoughts (replaces fake educational messages) -->
			<ThinkingAtmosphere {thoughts} isActive={stage === 'resolving'} />
		</div>
	{:else if stage === 'results'}
		<!-- Results display -->
		<DecisionMakerResults
			bind:decisionMakers={formData.audience.decisionMakers}
			bind:customRecipients={formData.audience.customRecipients}
			bind:includesCongress={formData.audience.includesCongress}
			onupdate={(data) => {
				formData.audience = { ...formData.audience, ...data };
			}}
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
				disabled={formData.audience.decisionMakers.length === 0 &&
					formData.audience.customRecipients.length === 0 &&
					!formData.audience.includesCongress}
				class="inline-flex items-center gap-2 rounded-lg bg-participation-primary-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-participation-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
			>
				Next →
			</button>
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
					onclick={resolveDecisionMakers}
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
			<!-- Auth overlay (full coverage) -->
			<AuthGateOverlay
				subjectLine={formData.objective.title}
				coreIssue={formData.objective.description}
				onback={onback}
				{draftId}
				{onSaveDraft}
			/>
		</div>
	{/if}
</div>
