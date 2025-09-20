<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { fade } from 'svelte/transition';
	import { Building2, Users, Mail, Megaphone, ArrowRight, ArrowLeft, X } from '@lucide/svelte';
	import type { TemplateCreationContext, TemplateFormData, Template } from '$lib/types/template';
	import { templateDraftStore, generateDraftId, formatTimeAgo } from '$lib/stores/templateDraft';
	import ObjectiveDefiner from './creator/ObjectiveDefiner.svelte';
	import AudienceSelector from './creator/AudienceSelector.svelte';
	import MessageEditor from './creator/MessageEditor.svelte';
	import SmartReview from './creator/SmartReview.svelte';

	const dispatch = createEventDispatcher<{
		close: void;
		save: Omit<Template, 'id'>;
	}>();

	let {
		context,
		isSubmitting = false,
		validationErrors = {}
	}: {
		context: TemplateCreationContext;
		isSubmitting?: boolean;
		validationErrors?: Record<string, string>;
	} = $props();

	let currentStep: 'objective' | 'audience' | 'content' | 'review' = $state('objective');
	let formErrors: string[] = $state([]);
	let draftId = $state<string>(generateDraftId());
	let lastSaved = $state<number | null>(null);
	let showDraftRecovery = $state(false);

	// Auto-save cleanup function
	let cleanupAutoSave: (() => void) | null = null;

	let formData: TemplateFormData = $state({
		objective: {
			title: '',
			description: '',
			category: '',
			slug: ''
		},
		audience: {
			recipientEmails: []
		},
		content: {
			preview: '',
			variables: []
		},
		review: {}
	});

	// Validation functions for each step
	const validators = {
		objective: (data: TemplateFormData['objective']) => {
			const errors: string[] = [];
			if (!data.title.trim()) errors.push('Title is required');
			return errors;
		},
		audience: (data: TemplateFormData['audience']) => {
			const errors = [];
			// For congressional templates, auto-routing handles recipients
			if (context.channelId === 'direct' && data.recipientEmails.length === 0) {
				errors.push('At least one recipient email is required');
			}
			return errors;
		},
		content: (data: TemplateFormData['content']) => {
			const errors = [];
			if (!data.preview.trim()) errors.push('Message content is required');
			// Note: We removed variable requirements to give writers more agency
			// Templates work great with or without personalization variables
			return errors;
		},
		review: () => [] // Review step doesn't need validation
	};

	const isCurrentStepValid = $derived.by(() => {
		if (currentStep === 'objective') {
			const currentErrors = validators.objective(formData.objective);
			return currentErrors.length === 0;
		} else if (currentStep === 'audience') {
			const currentErrors = validators.audience(formData.audience);
			return currentErrors.length === 0;
		} else if (currentStep === 'content') {
			const currentErrors = validators.content(formData.content);
			return currentErrors.length === 0;
		} else {
			const currentErrors = validators.review();
			return currentErrors.length === 0;
		}
	});

	function validateCurrentStep(): boolean {
		if (currentStep === 'objective') {
			formErrors = validators.objective(formData.objective);
		} else if (currentStep === 'audience') {
			formErrors = validators.audience(formData.audience);
		} else if (currentStep === 'content') {
			formErrors = validators.content(formData.content);
		} else {
			formErrors = validators.review();
		}
		return formErrors.length === 0;
	}

	function handleNext() {
		if (!validateCurrentStep()) return;

		const steps: ('objective' | 'audience' | 'content' | 'review')[] = [
			'objective',
			'audience',
			'content',
			'review'
		];
		const currentIndex = steps.indexOf(currentStep);

		if (currentIndex < steps.length - 1) {
			currentStep = steps[currentIndex + 1];
			formErrors = []; // Clear errors when moving to next step
		}
	}

	function handleBack() {
		const steps: ('objective' | 'audience' | 'content' | 'review')[] = [
			'objective',
			'audience',
			'content',
			'review'
		];
		const currentIndex = steps.indexOf(currentStep);

		if (currentIndex > 0) {
			currentStep = steps[currentIndex - 1];
			formErrors = []; // Clear errors when moving back
		}
	}

	function handleSave() {
		if (!validateCurrentStep()) return;

		// Additional validation for required fields
		if (!formData.objective.title?.trim()) {
			formErrors = ['Template title is required'];
			return;
		}
		if (!formData.content.preview?.trim()) {
			formErrors = ['Message content is required'];
			return;
		}
		if (!formData.audience.recipientEmails || formData.audience.recipientEmails.length === 0) {
			formErrors = ['At least one recipient email is required'];
			return;
		}

		const template: Omit<Template, 'id'> = {
			slug: formData.objective.slug || '',
			title: formData.objective.title,
			description: formData.content.preview.substring(0, 160),
			category: formData.objective.category || 'General',
			type: context.channelId === 'certified' ? 'certified' : 'direct',
			deliveryMethod: context.channelId === 'certified' ? 'certified' : 'email',
			subject: formData.objective.title || `Regarding: ${formData.objective.title}`,
			message_body: formData.content.preview,
			delivery_config: {},
			cwc_config: {},
			recipient_config: {
				emails: formData.audience.recipientEmails
			},
			metrics: {
				sent: 0,
				delivered: 0,
				opened: 0,
				clicked: 0,
				views: 0
			},
			campaign_id: null,
			status: 'draft',
			is_public: false,
			send_count: 0,
			last_sent_at: null,
			applicable_countries: [],
			jurisdiction_level: null,
			specific_locations: [],
			preview: formData.content.preview.substring(0, 500),
			recipientEmails: formData.audience.recipientEmails
		};

		dispatch('save', template);

		// Clean up draft after successful save
		templateDraftStore.deleteDraft(draftId);
	}

	// Progress calculation
	const progress = $derived.by(() => {
		const steps = ['objective', 'audience', 'content', 'review'];
		return ((steps.indexOf(currentStep) + 1) / steps.length) * 100;
	});

	const stepInfo = {
		objective: {
			title: 'What Issue Needs Action?',
			icon: Megaphone,
			description: 'What issue do you want decision-makers to address?'
		},
		audience: {
			title: 'Who Controls This?',
			icon: Users,
			description: 'Congress, CEO, school board—who makes the call?'
		},
		content: {
			title: 'Load Your Message',
			icon: Mail,
			description: 'What gets their attention and moves the needle?'
		},
		review: {
			title: 'Make It Count',
			icon: Building2,
			description: 'Quick check before your message hits the target'
		}
	};

	// Draft recovery and auto-save setup
	onMount(() => {
		// Check for existing draft
		const availableDrafts = templateDraftStore.getAllDraftIds();
		if (availableDrafts.length > 0) {
			// Show recovery dialog for the most recent draft
			const mostRecentDraftId = availableDrafts
				.map((id) => ({ id, age: templateDraftStore.getDraftAge(id) || Infinity }))
				.sort((a, b) => a.age - b.age)[0].id;

			const draft = templateDraftStore.getDraft(mostRecentDraftId);
			if (draft && draft.lastSaved > Date.now() - 24 * 60 * 60 * 1000) {
				// Within 24 hours
				showDraftRecovery = true;
				draftId = mostRecentDraftId;
			}
		}

		// Start auto-save
		cleanupAutoSave = templateDraftStore.startAutoSave(
			draftId,
			() => formData,
			() => currentStep
		);
	});

	onDestroy(() => {
		// Cleanup auto-save
		if (cleanupAutoSave) {
			cleanupAutoSave();
		}
	});

	// Functions for draft management
	function recoverDraft() {
		const draft = templateDraftStore.getDraft(draftId);
		if (draft) {
			formData = draft.data;
			currentStep = draft.currentStep as any;
			lastSaved = draft.lastSaved;
		}
		showDraftRecovery = false;
	}

	function discardDraft() {
		templateDraftStore.deleteDraft(draftId);
		showDraftRecovery = false;
		// Generate new draft ID for current session
		draftId = generateDraftId();

		// Restart auto-save with new ID
		if (cleanupAutoSave) {
			cleanupAutoSave();
		}
		cleanupAutoSave = templateDraftStore.startAutoSave(
			draftId,
			() => formData,
			() => currentStep
		);
	}

	function manualSave() {
		templateDraftStore.saveDraft(draftId, formData, currentStep);
		lastSaved = Date.now();
	}
</script>

<div class="flex h-full flex-col">
	<!-- Progress bar -->
	<div class="h-1 bg-slate-100">
		<div
			class="h-full bg-participation-primary-600 transition-all duration-300"
			style="width: {progress}%"
		></div>
	</div>

	<!-- Step Header -->
	<div class="border-b border-slate-200 px-4 py-3 md:px-6 md:py-4">
		<div class="flex flex-col gap-1 md:gap-1">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-1.5 md:gap-3">
					{#snippet iconSnippet()}
						{@const IconComponent = stepInfo[currentStep].icon}
						<IconComponent class="h-4 w-4 text-participation-primary-600 md:h-5 md:w-5" />
					{/snippet}
					{@render iconSnippet()}
					<h2 class="text-base font-semibold text-slate-900 md:text-xl">
						{stepInfo[currentStep].title}
					</h2>
				</div>

				<div class="flex items-center gap-2">
					<!-- Auto-save indicator -->
					{#if lastSaved}
						<div
							class="inline-flex items-center gap-0.5 rounded-full border border-emerald-200
						            bg-emerald-50 px-1.5
						            py-0.5 text-xs text-emerald-600 md:px-2
						            md:text-xs"
						>
							<div
								class="h-0.5 w-0.5 animate-save-pulse rounded-full bg-emerald-500 md:h-1 md:w-1"
							></div>
							saved {formatTimeAgo(lastSaved).toLowerCase()}
						</div>
					{/if}

					<!-- Close button -->
					<button
						type="button"
						onclick={() => dispatch('close')}
						class="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
						aria-label="Close"
					>
						<X class="h-5 w-5" />
					</button>
				</div>
			</div>
			<p class="ml-6 text-sm text-slate-600 md:ml-8 md:text-sm">
				{stepInfo[currentStep].description}
			</p>
		</div>
	</div>

	<!-- Error display -->
	{#if formErrors.length > 0 || Object.keys(validationErrors).length > 0}
		<div class="border-b border-red-200 bg-red-50 px-6 py-3">
			<ul class="list-inside list-disc text-sm text-red-600">
				{#each formErrors as error}
					<li>{error}</li>
				{/each}
				{#each Object.entries(validationErrors) as [field, message]}
					<li>{message}</li>
				{/each}
			</ul>
		</div>
	{/if}

	<!-- Content -->
	<div class="relative flex-1">
		<div class="p-4 md:p-6" transition:fade={{ duration: 150 }}>
			{#if currentStep === 'objective'}
				<ObjectiveDefiner data={formData.objective} {context} />
			{:else if currentStep === 'audience'}
				<AudienceSelector data={formData.audience} {context} />
			{:else if currentStep === 'content'}
				<MessageEditor data={formData.content} {context} />
			{:else}
				<SmartReview data={formData} {context} />
			{/if}
		</div>
	</div>

	<!-- Navigation -->
	<div class="border-t border-slate-200 bg-slate-50 px-4 py-3 md:px-6 md:py-4">
		<div class="flex items-center justify-between">
			<button
				class="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-50 md:gap-2 md:px-4 md:py-2 md:text-base"
				onclick={handleBack}
				disabled={currentStep === 'objective' || isSubmitting}
			>
				<ArrowLeft class="h-4 w-4 md:h-4 md:w-4" />
				Back
			</button>

			{#if currentStep === 'review'}
				<button
					class="flex items-center gap-1.5 rounded bg-participation-primary-600 px-3 py-2 text-sm text-white hover:bg-participation-primary-700 disabled:cursor-not-allowed disabled:opacity-50 md:gap-2 md:px-4 md:py-2 md:text-base"
					onclick={handleSave}
					disabled={!isCurrentStepValid || isSubmitting}
				>
					{#if isSubmitting}
						<div
							class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent md:h-4 md:w-4"
						></div>
						Launching...
					{:else}
						Launch Campaign
						<ArrowRight class="h-4 w-4 md:h-4 md:w-4" />
					{/if}
				</button>
			{:else}
				<button
					class="flex items-center gap-1.5 rounded bg-participation-primary-600 px-3 py-2 text-sm text-white hover:bg-participation-primary-700 disabled:opacity-50 md:gap-2 md:px-4 md:py-2 md:text-base"
					onclick={handleNext}
					disabled={!isCurrentStepValid || isSubmitting}
				>
					{#if currentStep === 'objective'}
						Pick Decision-Makers
					{:else if currentStep === 'audience'}
						Load Your Message
					{:else if currentStep === 'content'}
						Make It Count
					{:else}
						Continue
					{/if}
					<ArrowRight class="h-4 w-4 md:h-4 md:w-4" />
				</button>
			{/if}
		</div>
	</div>
</div>

<!-- Draft Recovery Modal -->
{#if showDraftRecovery}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<div class="mx-4 w-full max-w-md rounded-lg bg-white shadow-xl">
			<div class="p-6">
				<h3 class="mb-2 text-lg font-semibold text-slate-900">Recover Previous Draft?</h3>
				<p class="mb-4 text-sm text-slate-600">
					We found a draft that was auto-saved {templateDraftStore.getDraftAge(draftId)
						? formatTimeAgo(Date.now() - templateDraftStore.getDraftAge(draftId)!)
						: 'recently'}. Would you like to recover it?
				</p>
				<div class="flex justify-end gap-3">
					<button
						class="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
						onclick={discardDraft}
					>
						Start Fresh
					</button>
					<button
						class="rounded bg-participation-primary-600 px-4 py-2 text-sm text-white hover:bg-participation-primary-700"
						onclick={recoverDraft}
					>
						Recover Draft
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
