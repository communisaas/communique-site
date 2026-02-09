<script lang="ts">
	import { onMount } from 'svelte';
	import type { TemplateFormData } from '$lib/types/template';

	import {
		processDecisionMakers,
		extractRecipientEmails
	} from '$lib/utils/decision-maker-processing';
	import { parseSSEStream } from '$lib/utils/sse-stream';
	import AgentThinking from '$lib/components/ui/AgentThinking.svelte';
	import DecisionMakerResults from './DecisionMakerResults.svelte';
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

	type Stage = 'resolving' | 'results' | 'error' | 'auth-required' | 'rate-limited';
	let stage = $state<Stage>('resolving');
	let errorMessage = $state<string | null>(null);
	let rateLimitResetAt = $state<string | null>(null);
	let isResolving = $state(false);

	// Streaming state
	let thoughts = $state<string[]>([]);

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

		try {
			// Resolve decision-makers via streaming endpoint
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

			// Check for auth / rate-limit errors
			if (response.status === 429 || response.status === 401) {
				const errorData = await response.json().catch(() => ({}));
				console.log('[DecisionMakerResolver] Auth/rate error:', {
					status: response.status,
					error: errorData.error,
					tier: errorData.tier,
					remaining: errorData.remaining,
					limit: errorData.limit,
					resetAt: errorData.resetAt
				});

				// Guest with zero quota → auth gate
				if (response.status === 401 || errorData.tier === 'guest') {
					throw { _kind: 'auth-required' };
				}

				// Authenticated/verified user who exhausted quota → rate-limited
				throw { _kind: 'rate-limited', resetAt: errorData.resetAt, message: errorData.error };
			}

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || 'Failed to resolve decision-makers');
			}

			// Process SSE stream
			// V2 emits 'segment' events with ThoughtSegment objects
			// V1 emits 'thought' events with { content: string }
			for await (const event of parseSSEStream<Record<string, unknown>>(response)) {
				switch (event.type) {
					case 'segment': {
						// V2 format: ThoughtSegment with content field
						const segment = event.data as { content?: string };
						if (typeof segment.content === 'string' && segment.content.trim()) {
							thoughts = [...thoughts, segment.content];
						}
						break;
					}

					case 'thought':
						// V1 legacy format
						if (typeof event.data.content === 'string') {
							thoughts = [...thoughts, event.data.content];
						}
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
		} catch (err: any) {
			console.error('[DecisionMakerResolver] Error:', err);

			if (err?._kind === 'auth-required') {
				stage = 'auth-required';
			} else if (err?._kind === 'rate-limited') {
				rateLimitResetAt = err.resetAt ?? null;
				stage = 'rate-limited';
			} else if (err instanceof Error && err.name === 'AbortError') {
				errorMessage = 'Request was cancelled. Please try again.';
				stage = 'error';
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

	/**
	 * Skip agent resolution and go straight to results with empty AI list.
	 * User can still add custom recipients manually.
	 */
	function skipToManualRecipients() {
		if (!formData.audience) {
			formData.audience = {
				decisionMakers: [],
				recipientEmails: [],
				includesCongress: false,
				customRecipients: []
			};
		}
		stage = 'results';
	}

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
	{#if stage === 'resolving'}
		<!-- Thought-centered loading: the agent's reasoning IS the experience -->
		<AgentThinking
			{thoughts}
			isActive={stage === 'resolving'}
			context="Finding decision-makers"
		/>
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
	{:else if stage === 'rate-limited'}
		<!-- Rate limit reached — friendly, non-blocking -->
		<div class="space-y-6 py-8">
			<div class="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
				<p class="text-base font-semibold text-amber-900">
					Research limit reached
				</p>
				<p class="mx-auto mt-2 max-w-md text-sm text-amber-700">
					You've used all your decision-maker lookups for now.
					{#if rateLimitResetAt}
						Resets at {new Date(rateLimitResetAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.
					{/if}
					You can still add recipients manually below.
				</p>
			</div>

			<div class="flex items-center justify-center gap-4">
				<button
					type="button"
					onclick={skipToManualRecipients}
					class="inline-flex items-center gap-2 rounded-lg bg-participation-primary-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-participation-primary-700"
				>
					Add recipients manually
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
