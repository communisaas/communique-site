<script lang="ts">
	import { onMount } from 'svelte';
	import type { TemplateFormData, Source } from '$lib/types/template';
	import { api } from '$lib/core/api/client';
	import {
		processDecisionMakers,
		extractRecipientEmails
	} from '$lib/utils/decision-maker-processing';
	import { parseSSEStream } from '$lib/utils/sse-stream';
	import ThoughtStream from '$lib/components/thoughts/ThoughtStream.svelte';
	import type { ThoughtSegment, PhaseState } from '$lib/core/thoughts/types';
	import type { ParsedDocument } from '$lib/server/reducto/types';
	import DecisionMakerResults from './DecisionMakerResults.svelte';
	import AuthGateOverlay from './AuthGateOverlay.svelte';
	import { L2_HOVER_DELAY } from '$lib/core/perceptual';
	import { browser } from '$app/environment';

	interface Props {
		formData: TemplateFormData;
		onnext: () => void;
		onback: () => void;
		/** Draft ID for OAuth resumption */
		draftId?: string;
		/** Save draft callback for OAuth flow */
		onSaveDraft?: () => void;
		/** Resume from previously saved segments (partial recovery) */
		resumeFromSegments?: ThoughtSegment[];
	}

	let { formData = $bindable(), onnext, onback, draftId, onSaveDraft, resumeFromSegments }: Props = $props();

	type Stage = 'structuring' | 'resolving' | 'results' | 'error' | 'auth-required';
	let stage = $state<Stage>('resolving');
	let errorMessage = $state<string | null>(null);
	let isResolving = $state(false);

	// Streaming state
	let segments = $state<ThoughtSegment[]>(resumeFromSegments || []);
	// Simplified to single research phase (verification runs silently in background)
	let phases = $state<PhaseState[]>([{ name: 'research', status: 'pending' }]);
	let documents = $state<Map<string, ParsedDocument>>(new Map());
	let sources = $state<Source[]>([]);
	let currentPhase = $state<'discovery' | 'verification' | 'complete'>('discovery');

	// Incremental save tracking
	let segmentsSinceLastSave = $state(0);
	let lastSavedPhase = $state<string | null>(null);
	const SAVE_EVERY_N_SEGMENTS = 5;

	/**
	 * Check if error indicates auth is required (guest blocked)
	 * Does NOT match rate limit errors for authenticated users
	 */
	function isAuthRequiredError(err: unknown): boolean {
		if (err instanceof Error) {
			const msg = err.message.toLowerCase();
			// Only match guest-specific auth errors, NOT general rate limits
			return (
				msg.includes('requires an account') ||
				msg.includes('sign in to continue') ||
				msg.includes('authentication required')
			);
		}
		return false;
	}

	/**
	 * Parse error to provide actionable, user-friendly messages
	 * Reduces friction by telling users exactly what to do
	 */
	function parseErrorMessage(err: unknown, statusCode?: number): string {
		// Handle specific status codes first
		if (statusCode === 429) {
			return 'Rate limit reached. Please sign in for more requests.';
		}
		if (statusCode === 500) {
			return 'Server error. Please try again in a moment.';
		}
		if (statusCode === 503) {
			return 'Service temporarily unavailable. Please try again shortly.';
		}

		// Handle error types
		if (err instanceof Error) {
			// AbortError / timeout
			if (err.name === 'AbortError') {
				return 'Request timed out. Please retry.';
			}

			// Network errors (fetch fails entirely)
			if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
				return 'Connection lost. Check your internet and retry.';
			}

			// Timeout errors
			if (err.message.toLowerCase().includes('timeout')) {
				return 'Request timed out. Please retry.';
			}

			// Return the original message if it's already user-friendly
			return err.message;
		}

		// Fallback
		return 'Failed to resolve decision-makers. Please try again.';
	}

	/**
	 * Incremental save: persist segments periodically during streaming
	 * Enables partial recovery on network failure
	 */
	function incrementalSave() {
		if (onSaveDraft) {
			// Store current segments in formData for recovery
			// This piggybacks on the existing draft storage mechanism
			(formData as any)._savedSegments = [...segments];
			(formData as any)._savedPhase = currentPhase;
			onSaveDraft();
			console.log(`[DecisionMakerResolver] Incremental save: ${segments.length} segments`);
		}
		segmentsSinceLastSave = 0;
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

		// Offline Detection: Check before starting fetch
		// Provides immediate feedback instead of waiting for timeout
		if (browser && !navigator.onLine) {
			errorMessage = "You're offline. Please check your connection.";
			stage = 'error';
			return;
		}

		isResolving = true;
		errorMessage = null;
		// Preserve resumed segments if available, otherwise reset
		if (!resumeFromSegments || resumeFromSegments.length === 0) {
			segments = [];
		}
		segmentsSinceLastSave = 0;
		lastSavedPhase = null;
		phases = [{ name: 'research', status: 'pending' }];
		documents = new Map();
		currentPhase = 'discovery';

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
				credentials: 'include', // Ensure session cookie is sent after OAuth return
				body: JSON.stringify({
					subject_line: formData.objective.title,
					core_message: formData.objective.description,
					topics,
					voice_sample: voiceSample,
					url_slug: formData.objective.slug
				})
			});

			// Check for auth errors
			if (response.status === 429 || response.status === 401) {
				const errorData = await response.json().catch(() => ({}));
				console.log('[DecisionMakerResolver] Auth/rate error:', {
					status: response.status,
					error: errorData.error,
					tier: errorData.tier,
					remaining: errorData.remaining,
					limit: errorData.limit
				});
				throw new Error(errorData.error || 'Authentication required');
			}

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || 'Failed to resolve decision-makers');
			}

			// Process SSE stream
			for await (const event of parseSSEStream<Record<string, unknown>>(response)) {
				switch (event.type) {
					case 'segment': {
						const segment = event.data as ThoughtSegment;
						segments = [...segments, segment];

						// Incremental Thought Storage: Save periodically during streaming
						// Enables partial recovery on network failure
						segmentsSinceLastSave++;
						if (segmentsSinceLastSave >= SAVE_EVERY_N_SEGMENTS) {
							incrementalSave();
						}
						break;
					}

					case 'phase':
					case 'phase-change': {
						// Handle both 'phase' (legacy) and 'phase-change' (standard) event types
						const phaseEvent = event.data as { from: string; to: string };
						// Update phase states
						phases = phases.map((p) => {
							if (p.name === phaseEvent.from) return { ...p, status: 'complete' as const };
							if (p.name === phaseEvent.to) return { ...p, status: 'active' as const };
							return p;
						});
						currentPhase = phaseEvent.to as any;

						// Save on phase change (important checkpoint)
						if (phaseEvent.to !== lastSavedPhase) {
							lastSavedPhase = phaseEvent.to;
							incrementalSave();
						}
						break;
					}

					case 'ping':
					// Heartbeat event to keep connection alive - no action needed
					break;

					case 'confidence': {
						const confEvent = event.data as { thoughtId: string; newConfidence: number };
						// Update segment confidence
						segments = segments.map((s) =>
							s.id === confEvent.thoughtId ? { ...s, confidence: confEvent.newConfidence } : s
						);
						break;
					}

					case 'documents': {
						const docsEvent = event.data as { documents: Array<[string, ParsedDocument]> };
						documents = new Map(docsEvent.documents);
						break;
					}

					case 'sources': {
						const sourcesEvent = event.data as { sources: Source[] };
						sources = sourcesEvent.sources;
						console.log(`[DecisionMakerResolver] Captured ${sources.length} sources for L1 citations`);
						break;
					}

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

						// Store grounding sources for L1 citations (carried to message generation)
						if (sources.length > 0) {
							formData.audience.sources = sources;
							console.log(`[DecisionMakerResolver] Stored ${sources.length} sources in formData`);
						}

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

			// Extract status code if available from error context
			const statusCode = (err as any)?.status || (err as any)?.statusCode;

			if (isAuthRequiredError(err)) {
				console.log('[DecisionMakerResolver] Auth required, showing overlay');
				stage = 'auth-required';
			} else {
				// Use specific, actionable error messages
				errorMessage = parseErrorMessage(err, statusCode);
				stage = 'error';

				// If we have partial progress, save it for potential recovery
				if (segments.length > 0 && onSaveDraft) {
					console.log(`[DecisionMakerResolver] Saving ${segments.length} segments for recovery`);
					incrementalSave();
				}
			}
		} finally {
			isResolving = false;
		}
	}

	/**
	 * Detect if we just returned from OAuth
	 * The oauth_completion cookie is set by the OAuth callback handler
	 */
	function isOAuthReturn(): boolean {
		if (typeof document === 'undefined') return false;
		return document.cookie.includes('oauth_completion');
	}

	/**
	 * Clear the OAuth completion cookie after use
	 */
	function clearOAuthCookie(): void {
		if (typeof document === 'undefined') return;
		document.cookie = 'oauth_completion=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
	}

	// Auto-run on mount (only if not already resolved)
	onMount(() => {
		const fromOAuth = isOAuthReturn();
		if (fromOAuth) {
			console.log('[DecisionMakerResolver] Detected OAuth return, clearing cookie');
			clearOAuthCookie();
		}

		// Only auto-resolve if we don't already have decision-makers
		if (!formData.audience?.decisionMakers || formData.audience.decisionMakers.length === 0) {
			console.log('[DecisionMakerResolver] No decision-makers, starting resolution', { fromOAuth });
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
				console.log('[DecisionMakerResolver] Decision-makers already resolved, skipping to results');
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
	{#if stage === 'structuring' || stage === 'resolving'}
		<!-- Thought-centered loading: the agent's reasoning IS the experience -->
		<ThoughtStream {segments} {phases} streaming={stage === 'resolving'} {documents} />
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
				coreMessage={formData.objective.description}
				onback={onback}
				{draftId}
				{onSaveDraft}
			/>
		</div>
	{/if}
</div>
