<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { fade } from 'svelte/transition';
    import { Building2, Users, Mail, Target, ArrowRight, ArrowLeft } from 'lucide-svelte';
    import type { TemplateCreationContext, TemplateFormData, Template } from '$lib/types/template';
    import ObjectiveDefiner from './creator/ObjectiveDefiner.svelte';
    import AudienceSelector from './creator/AudienceSelector.svelte';
    import MessageEditor from './creator/MessageEditor.svelte';
    import TemplateReview from './creator/TemplateReview.svelte';
    
    const dispatch = createEventDispatcher<{
        close: void;
        save: Omit<Template, 'id'>;
    }>();

    export let context: TemplateCreationContext;

    let currentStep: 'objective' | 'audience' | 'content' | 'review' = 'objective';
    let formErrors: string[] = [];
    
    let formData: TemplateFormData = {
        objective: {
            title: '',
            description: '',
            category: '',
            goal: ''
        },
        audience: {
            organizations: [],
            roles: [],
            emailPatterns: []
        },
        content: {
            preview: '',
            variables: []
        }
    };

    // Validation functions for each step
    const validators = {
        objective: (data: TemplateFormData['objective']) => {
            const errors = [];
            if (!data.title.trim()) errors.push('Title is required');
            if (!data.goal.trim()) errors.push('Goal is required');
            return errors;
        },
        audience: (data: TemplateFormData['audience']) => {
            const errors = [];
            if (data.organizations.length === 0) errors.push('At least one organization is required');
            if (data.roles.length === 0) errors.push('At least one role is required');
            return errors;
        },
        content: (data: TemplateFormData['content']) => {
            const errors = [];
            if (!data.preview) errors.push('Message content is required');
            if (!data.preview.includes('[')) errors.push('Message should include at least one variable');
            return errors;
        },
        review: () => [] // Review step doesn't need validation
    };

    $: isCurrentStepValid = (() => {
        const currentErrors = validators[currentStep](formData[currentStep]);
        return currentErrors.length === 0;
    })();

    function validateCurrentStep(): boolean {
        formErrors = validators[currentStep](formData[currentStep]);
        return formErrors.length === 0;
    }

    function handleNext() {
        if (!validateCurrentStep()) return;

        const steps: ('objective' | 'audience' | 'content' | 'review')[] = 
            ['objective', 'audience', 'content', 'review'];
        const currentIndex = steps.indexOf(currentStep);
        
        if (currentIndex < steps.length - 1) {
            currentStep = steps[currentIndex + 1];
            formErrors = []; // Clear errors when moving to next step
        }
    }

    function handleBack() {
        const steps: ('objective' | 'audience' | 'content' | 'review')[] = 
            ['objective', 'audience', 'content', 'review'];
        const currentIndex = steps.indexOf(currentStep);
        
        if (currentIndex > 0) {
            currentStep = steps[currentIndex - 1];
            formErrors = []; // Clear errors when moving back
        }
    }

    function handleSave() {
        if (!validateCurrentStep()) return;

        const template = {
            type: context.channelId,
            title: formData.objective.title,
            description: formData.objective.goal,
            category: formData.objective.category || 'General',
            deliveryMethod: context.channelTitle,
            metrics: {
                messages: '0 messages sent',
                reach: formData.audience.organizations.join(', '),
                tooltip: `Campaign targeting ${formData.audience.roles.join(', ')}`,
                target: formData.audience.organizations[0] || 'Pending'
            },
            preview: formData.content.preview,
            recipientEmails: formData.audience.emailPatterns
        };

        dispatch('save', template);
    }

    // Progress calculation
    $: progress = (() => {
        const steps = ['objective', 'audience', 'content', 'review'];
        return ((steps.indexOf(currentStep) + 1) / steps.length) * 100;
    })();

    const stepInfo = {
        objective: {
            title: 'Define Your Objective',
            icon: Target,
            description: 'What do you want to achieve with this campaign?'
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
</script>

<div class="flex flex-col h-full">
    <!-- Progress bar -->
    <div class="h-1 bg-slate-100">
        <div 
            class="h-full bg-blue-600 transition-all duration-300"
            style="width: {progress}%"
        />
    </div>

    <!-- Step Header -->
    <div class="px-6 py-4 border-b border-slate-200">
        <div class="flex items-center gap-3 mb-1">
            <svelte:component this={stepInfo[currentStep].icon} class="w-5 h-5 text-blue-600" />
            <h2 class="text-xl font-semibold text-slate-900">
                {stepInfo[currentStep].title}
            </h2>
        </div>
        <p class="text-sm text-slate-600 ml-8">
            {stepInfo[currentStep].description}
        </p>
    </div>

    <!-- Error display -->
    {#if formErrors.length > 0}
        <div class="px-6 py-3 bg-red-50 border-b border-red-200">
            <ul class="list-disc list-inside text-sm text-red-600">
                {#each formErrors as error}
                    <li>{error}</li>
                {/each}
            </ul>
        </div>
    {/if}

    <!-- Content -->
    <div class="flex-1 overflow-y-auto">
        <div class="p-6" transition:fade={{ duration: 150 }}>
            {#if currentStep === 'objective'}
                <ObjectiveDefiner bind:data={formData.objective} {context} />
            {:else if currentStep === 'audience'}
                <AudienceSelector bind:data={formData.audience} {context} />
            {:else if currentStep === 'content'}
                <MessageEditor bind:data={formData.content} {context} />
            {:else}
                <TemplateReview data={formData} {context} />
            {/if}
        </div>
    </div>

    <!-- Navigation -->
    <div class="px-6 py-4 border-t border-slate-200 bg-slate-50">
        <div class="flex justify-between items-center">
            <button
                class="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 disabled:opacity-50"
                on:click={handleBack}
                disabled={currentStep === 'objective'}
            >
                <ArrowLeft class="w-4 h-4" />
                Back
            </button>
            
            {#if currentStep === 'review'}
                <button
                    class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    on:click={handleSave}
                    disabled={!isCurrentStepValid}
                >
                    Create Template
                    <ArrowRight class="w-4 h-4" />
                </button>
            {:else}
                <button
                    class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    on:click={handleNext}
                    disabled={!isCurrentStepValid}
                >
                    Continue
                    <ArrowRight class="w-4 h-4" />
                </button>
            {/if}
        </div>
    </div>
</div> 