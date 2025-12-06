<script lang="ts">
	import { onMount } from 'svelte';
	import type { TemplateFormData } from '$lib/types/template';
	import { api } from '$lib/core/api/client';
	import { cleanHtmlFormatting } from '$lib/utils/message-processing';
	import MessageAnticipation from './MessageAnticipation.svelte';
	import MessageResults from './MessageResults.svelte';

	interface Props {
		formData: TemplateFormData;
		onnext: () => void;
		onback: () => void;
	}

	let { formData = $bindable(), onnext, onback }: Props = $props();

	type Stage = 'generating' | 'results' | 'editing' | 'error';
	let stage = $state<Stage>('generating');
	let errorMessage = $state<string | null>(null);

	// Store original AI-generated message for "start fresh"
	let originalMessage = $state('');
	let originalSubject = $state('');

	async function generateMessage() {
		try {
			stage = 'generating';
			console.log('[MessageGenerationResolver] Generating message...');

			// Validate we have required data
			if (!formData.objective.title || !formData.objective.description) {
				throw new Error('Missing subject line or core issue');
			}

			if (!formData.audience.decisionMakers || formData.audience.decisionMakers.length === 0) {
				throw new Error('No decision-makers selected');
			}

			// Prepare request data
			const requestData = {
				subject_line: formData.objective.title,
				core_issue: formData.objective.description,
				domain: formData.objective.category?.toLowerCase() || 'general',
				decision_makers: formData.audience.decisionMakers.map((dm) => ({
					name: dm.name,
					title: dm.title,
					organization: dm.organization
				}))
			};

			console.log('[MessageGenerationResolver] Request data:', requestData);

			// Call message generation API
			const response = await api.post('/toolhouse/generate-message', requestData, {
				timeout: 200000, // 200 seconds (3+ minutes) for Toolhouse agent processing
				showToast: false // Don't show success toast
			});

			console.log('[MessageGenerationResolver] Raw response:', response);

			if (!response.success || !response.data) {
				throw new Error(response.error || 'Failed to generate message');
			}

			// Extract data
			const { message, subject, sources, research_log, geographic_scope } = response.data;

			// Clean HTML formatting from message
			const cleanedMessage = cleanHtmlFormatting(message);

			// Store original for "start fresh"
			originalMessage = cleanedMessage;
			originalSubject = subject;

			// Update formData
			formData.content.preview = cleanedMessage;
			formData.content.sources = sources || [];
			formData.content.researchLog = research_log || [];
			formData.content.geographicScope = geographic_scope || null;
			formData.content.aiGenerated = true;
			formData.content.edited = false;

			// Update subject if different
			if (subject && subject !== formData.objective.title) {
				formData.objective.title = subject;
			}

			console.log('[MessageGenerationResolver] Message generated:', {
				message_length: message.length,
				sources_count: sources?.length || 0,
				research_log_count: research_log?.length || 0
			});

			stage = 'results';
		} catch (err) {
			console.error('[MessageGenerationResolver] Error:', err);
			errorMessage =
				err instanceof Error ? err.message : 'Failed to generate message. Please try again.';
			stage = 'error';
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
		<!-- Main wait: 15-30 seconds with educational phases -->
		<MessageAnticipation />
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
	{/if}
</div>
