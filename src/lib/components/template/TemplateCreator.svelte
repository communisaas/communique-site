<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { fade } from 'svelte/transition';
	import { Building2, Users, Mail, Megaphone, ArrowRight, ArrowLeft } from '@lucide/svelte';
	import type { TemplateCreationContext, TemplateFormData, Template } from '$lib/types/template';
	import { templateDraftStore, generateDraftId, formatTimeAgo } from '$lib/stores/templateDraft';
	import ObjectiveDefiner from './creator/ObjectiveDefiner.svelte';
	import AudienceSelector from './creator/AudienceSelector.svelte';
	import MessageEditor from './creator/MessageEditor.svelte';
	import TemplateReview from './creator/TemplateReview.svelte';

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
		const stepData = (formData as any)[currentStep] as Record<string, unknown>;
		const currentErrors = validators[currentStep](stepData);
		return currentErrors.length === 0;
	});

	function validateCurrentStep(): boolean {
		const stepData = (formData as any)[currentStep] as Record<string, unknown>;
		formErrors = validators[currentStep](stepData);
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

		const template = {
			title: formData.objective.title,
			description: formData.content.preview.substring(0, 160),
			category: formData.objective.category || 'General',
			type: context.channelId,
			deliveryMethod: (context.channelId === 'certified' ? 'both' : 'email') as 'both' | 'email',
			subject: `Regarding: ${formData.objective.title}`,
			message_body: formData.content.preview,
			preview: formData.content.preview.substring(0, 100),
			slug: formData.objective.slug,
			delivery_config: {},
			cwc_config: {},
			recipient_config: {
				emails: formData.audience.recipientEmails
			},
			metrics: {
				sends: 0,
				opens: 0,
				clicks: 0,
				views: 0
			},
			is_public: false
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
			title: 'Identify Your Audience',
			icon: Users,
			description: 'Who are the key decision makers you want to reach?'
		},
		content: {
			title: 'Compose Your Message',
			icon: Mail,
			description: 'Craft your message with personalized variables'
		},
		review: {
			title: 'Review & Finalize',
			icon: Building2,
			description: 'Review your template before creation'
		}
	};

	// Draft recovery and auto-save setup
	onMount(() => {
		// Check for existing draft
		const availableDrafts = templateDraftStore.getAllDraftIds();
		if (availableDrafts.length > 0) {
			// Show recovery dialog for the most recent draft
			const mostRecentDraftId = availableDrafts
				.map(id => ({ id, age: templateDraftStore.getDraftAge(id) || Infinity }))
				.sort((a, b) => a.age - b.age)[0].id;
			
			const draft = templateDraftStore.getDraft(mostRecentDraftId);
			if (draft && draft.lastSaved > Date.now() - (24 * 60 * 60 * 1000)) { // Within 24 hours
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
		<div class="h-full bg-blue-600 transition-all duration-300" style="width: {progress}%"></div>
	</div>

	<!-- Step Header -->
	<div class="border-b border-slate-200 px-6 py-4">
		<div class="mb-1 flex items-center gap-3">
			{#snippet iconSnippet()}
				{@const IconComponent = stepInfo[currentStep].icon}
				<IconComponent class="h-5 w-5 text-blue-600" />
			{/snippet}
			{@render iconSnippet()}
			<h2 class="text-xl font-semibold text-slate-900">
				{stepInfo[currentStep].title}
			</h2>
		</div>
		<p class="ml-8 text-sm text-slate-600">
			{stepInfo[currentStep].description}
		</p>
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
	<div class="flex-1 overflow-y-auto relative">
		<div class="p-6" transition:fade={{ duration: 150 }}>
			{#if currentStep === 'objective'}
				<ObjectiveDefiner data={formData.objective} {context} />
			{:else if currentStep === 'audience'}
				<AudienceSelector data={formData.audience} {context} />
			{:else if currentStep === 'content'}
				<MessageEditor data={formData.content} {context} />
			{:else}
				<TemplateReview data={formData} {context} />
			{/if}
		</div>
		
		<!-- Auto-save indicator -->
		{#if lastSaved}
			<div class="absolute bottom-2 left-6 inline-flex items-center gap-1.5 px-2.5 py-1 
			            bg-emerald-50 text-emerald-700 
			            border border-emerald-200 rounded-full 
			            text-xs font-medium">
				<div class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-save-pulse" />
				Auto-saved {formatTimeAgo(lastSaved)}
			</div>
		{/if}
	</div>

	<!-- Navigation -->
	<div class="border-t border-slate-200 bg-slate-50 px-6 py-4">
		<div class="flex items-center justify-between">
			<button
				class="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 disabled:opacity-50"
				onclick={handleBack}
				disabled={currentStep === 'objective' || isSubmitting}
			>
				<ArrowLeft class="h-4 w-4" />
				Back
			</button>

			{#if currentStep === 'review'}
				<button
					class="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
					onclick={handleSave}
					disabled={!isCurrentStepValid || isSubmitting}
				>
					{#if isSubmitting}
						<div class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
						Saving...
					{:else}
						Save Draft
						<ArrowRight class="h-4 w-4" />
					{/if}
				</button>
			{:else}
				<button
					class="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
					onclick={handleNext}
					disabled={!isCurrentStepValid || isSubmitting}
				>
					{#if currentStep === 'objective'}
						Choose Recipients
					{:else if currentStep === 'audience'}
						Write Your Message  
					{:else if currentStep === 'content'}
						Review Template
					{:else}
						Continue
					{/if}
					<ArrowRight class="h-4 w-4" />
				</button>
			{/if}
		</div>
	</div>
</div>

<!-- Draft Recovery Modal -->
{#if showDraftRecovery}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
			<div class="p-6">
				<h3 class="text-lg font-semibold text-slate-900 mb-2">
					Recover Previous Draft?
				</h3>
				<p class="text-sm text-slate-600 mb-4">
					We found a draft that was auto-saved {templateDraftStore.getDraftAge(draftId) ? formatTimeAgo(Date.now() - templateDraftStore.getDraftAge(draftId)!) : 'recently'}. Would you like to recover it?
				</p>
				<div class="flex gap-3 justify-end">
					<button
						class="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
						onclick={discardDraft}
					>
						Start Fresh
					</button>
					<button
						class="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
						onclick={recoverDraft}
					>
						Recover Draft
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
