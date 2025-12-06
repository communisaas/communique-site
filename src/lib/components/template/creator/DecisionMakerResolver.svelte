<script lang="ts">
	import { onMount } from 'svelte';
	import type { TemplateFormData } from '$lib/types/template';
	import { api } from '$lib/core/api/client';
	import {
		processDecisionMakers,
		extractRecipientEmails
	} from '$lib/utils/decision-maker-processing';
	import AnticipationBuilder from './AnticipationBuilder.svelte';
	import DecisionMakerResults from './DecisionMakerResults.svelte';

	interface Props {
		formData: TemplateFormData;
		onnext: () => void;
		onback: () => void;
	}

	let { formData = $bindable(), onnext, onback }: Props = $props();

	type Stage = 'structuring' | 'resolving' | 'results' | 'error';
	let stage = $state<Stage>('resolving');
	let errorMessage = $state<string | null>(null);
	let isResolving = $state(false); // Prevent concurrent resolution attempts

	async function resolveDecisionMakers() {
		// Prevent concurrent calls
		if (isResolving) {
			console.log('[DecisionMakerResolver] Already resolving, skipping...');
			return;
		}

		isResolving = true;
		errorMessage = null; // Clear previous errors

		try {
			// Stage 1: Structure input if manual (quick pass)
			if (!formData.objective.aiGenerated) {
				stage = 'structuring';
				console.log('[DecisionMakerResolver] Structuring manual input...');

				// Quick structure pass via subject-line agent
				const structureResponse = await api.post(
					'/toolhouse/generate-subject',
					{
						message: `${formData.objective.title}. ${formData.objective.description}`
					},
					{
						timeout: 30000, // 30 seconds for structuring
						showToast: false
					}
				);

				if (structureResponse.success && structureResponse.data) {
					// Update formData with structured output (but keep user's original title/description)
					// This is just to ensure we have clean structured data for decision-maker agent
					console.log('[DecisionMakerResolver] Structured input:', structureResponse.data);
				}
			}

			// Stage 2: Resolve decision-makers
			stage = 'resolving';
			console.log('[DecisionMakerResolver] Resolving decision-makers...');

			const response = await api.post(
				'/toolhouse/resolve-decision-makers',
				{
					subject_line: formData.objective.title,
					core_issue: formData.objective.description,
					domain: formData.objective.category.toLowerCase(),
					url_slug: formData.objective.slug
				},
				{
					timeout: 60000, // 60 seconds for agent processing
					showToast: false // Don't show success toast
				}
			);

			console.log('[DecisionMakerResolver] Raw response:', response);

			if (!response.success || !response.data) {
				throw new Error(response.error || 'Failed to resolve decision-makers');
			}

			// Process decision-makers
			const rawDecisionMakers = response.data.decision_makers || [];
			const processed = processDecisionMakers(rawDecisionMakers);

			console.log('[DecisionMakerResolver] Processed decision-makers:', processed);

			// Initialize audience data if not already set
			if (!formData.audience) {
				formData.audience = {
					decisionMakers: [],
					recipientEmails: [],
					includesCongress: false,
					customRecipients: []
				};
			}

			// Update formData with results
			formData.audience.decisionMakers = processed;

			// Show results
			stage = 'results';
		} catch (err) {
			console.error('[DecisionMakerResolver] Error:', err);

			// Handle AbortError specifically (request was cancelled)
			if (err instanceof Error && err.name === 'AbortError') {
				errorMessage = 'Request was cancelled. Please try again.';
			} else {
				errorMessage =
					err instanceof Error
						? err.message
						: 'Failed to resolve decision-makers. Please try again.';
			}

			stage = 'error';
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
			// Already have decision-makers, skip to results
			stage = 'results';
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
		<!-- Main wait: 10-20 seconds -->
		<AnticipationBuilder />
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
	{/if}
</div>
