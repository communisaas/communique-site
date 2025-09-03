<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { coordinated, useTimerCleanup } from '$lib/utils/timerCoordinator';
	import { createModalStore } from '$lib/stores/modalSystem';
	import UnifiedModal from '$lib/components/ui/UnifiedModal.svelte';
	import { RoleSelector, ConnectionPicker, VerificationStep } from './steps';
	
	let {
		template
	}: {
		template: {
			title: string;
			deliveryMethod: string;
			category?: string;
			recipientEmails?: string[];
		};
	} = $props();
	
	const dispatch = createEventDispatcher<{ 
		close: void; 
		complete: { 
			role: string; 
			organization?: string; 
			location?: string; 
			connection: string;
			connectionDetails?: string;
		};
	}>();
	
	// Modal system integration
	const modalStore = createModalStore('direct-outreach-modal', 'template_modal');
	
	// Component ID for timer coordination
	const componentId = 'direct-outreach-modal-' + Math.random().toString(36).substring(2, 15);
	
	type Step = 'role' | 'connection' | 'verify';
	let currentStep: Step = $state('role');
	let isTransitioning = $state(false);
	
	// Modal control functions
	let unifiedModal: UnifiedModal;

	export function open(data?: unknown) {
		unifiedModal?.open(data);
	}

	export function close() {
		unifiedModal?.close();
	}

	onMount(() => {
		// Modal system handles body scroll locking
	});
	
	onDestroy(() => {
		useTimerCleanup(componentId)();
	});
	
	// Form data
	let selectedRole = $state('');
	let customRole = $state('');
	let organization = $state('');
	let location = $state('');
	let selectedConnection = $state('');
	let connectionDetails = $state('');
	
	// Validation
	let roleError = $state('');
	let connectionError = $state('');
	
	// Determine template context
	const isLocalGovernment = $derived(isLocalGovTemplate(template));
	const isCorporate = $derived(isCorporateTemplate(template));
	const templateContext = $derived(getTemplateContext(template));
	
	function isLocalGovTemplate(template: Record<string, unknown>): boolean {
		const category = template.category?.toLowerCase() || '';
		const title = template.title?.toLowerCase() || '';
		return category.includes('local') || 
			   category.includes('city') || 
			   category.includes('municipal') ||
			   title.includes('city council') ||
			   title.includes('mayor') ||
			   title.includes('school board');
	}
	
	function isCorporateTemplate(template: Record<string, unknown>): boolean {
		const category = template.category?.toLowerCase() || '';
		return category.includes('corporate') || 
			   category.includes('business') ||
			   category.includes('company');
	}
	
	function getTemplateContext(template: Record<string, unknown>) {
		if (isLocalGovernment) return 'local-government';
		if (isCorporate) return 'corporate';
		return 'general';
	}
	
	function handleClose() {
		dispatch('close');
		modalStore.close();
	}
	
	function validateRole(): boolean {
		roleError = '';
		const role = selectedRole === 'other' ? customRole : selectedRole;
		console.log('Validating role:', { selectedRole, customRole, role });
		if (!role.trim()) {
			roleError = 'Please select or enter your role';
			return false;
		}
		return true;
	}
	
	function validateConnection(): boolean {
		connectionError = '';
		if (!selectedConnection) {
			connectionError = 'Please select your connection to this issue';
			return false;
		}
		if (selectedConnection === 'other' && !connectionDetails.trim()) {
			connectionError = 'Please specify your connection';
			return false;
		}
		return true;
	}
	
	function nextStep() {
		console.log('nextStep called, isTransitioning:', isTransitioning, 'currentStep:', currentStep);
		if (isTransitioning) return;
		
		let isValid = true;
		if (currentStep === 'role') {
			isValid = validateRole();
		} else if (currentStep === 'connection') {
			isValid = validateConnection();
		}
		
		console.log('Validation result:', isValid);
		if (!isValid) return;
		
		isTransitioning = true;
		
		if (currentStep === 'role') {
			currentStep = 'connection';
		} else if (currentStep === 'connection') {
			currentStep = 'verify';
		}
		
		console.log('New currentStep:', currentStep);
		coordinated.setTimeout(() => isTransitioning = false, 300, 'transition', componentId);
	}
	
	function prevStep() {
		if (isTransitioning) return;
		
		isTransitioning = true;
		
		if (currentStep === 'verify') {
			currentStep = 'connection';
		} else if (currentStep === 'connection') {
			currentStep = 'role';
		}
		
		coordinated.setTimeout(() => isTransitioning = false, 300, 'transition', componentId);
	}
	
	function handleComplete() {
		const role = selectedRole === 'other' ? customRole : selectedRole;
		const connection = selectedConnection === 'other' ? connectionDetails : selectedConnection;
		
		dispatch('complete', {
			role,
			organization: organization.trim() || undefined,
			location: location.trim() || undefined,
			connection,
			connectionDetails: selectedConnection === 'other' ? connectionDetails : undefined
		});
	}
	
	// Step handlers
	function handleCancel() {
		dispatch('close');
	}
	
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			if (currentStep === 'verify') {
				handleComplete();
			} else {
				nextStep();
			}
		}
	}
</script>

<UnifiedModal 
	bind:this={unifiedModal}
	id="direct-outreach-modal"
	type="template_modal"
	size="sm"
	closeOnBackdrop={true}
	closeOnEscape={true}
>
	{#snippet children(data)}
		<!-- Progress Indicator -->
		<div class="flex justify-center pt-6 pb-4">
			<div class="flex gap-2">
				{#each ['role', 'connection', 'verify'] as step, i}
					<div 
						class="h-2 rounded-full transition-all duration-500 ease-out {
							currentStep === step 
								? 'w-12 bg-blue-600 shadow-lg shadow-blue-200' 
								: ['role', 'connection', 'verify'].indexOf(currentStep) > i 
									? 'w-8 bg-blue-300' 
									: 'w-8 bg-slate-200'
						}"
					></div>
				{/each}
			</div>
		</div>
		
		<!-- Content -->
		<div class="relative">
			{#key currentStep}
				<div 
					class="p-6 pt-2"
					in:fly={{ x: 20, duration: 400, delay: 300, easing: quintOut }}
					out:fly={{ x: -20, duration: 300, easing: quintOut }}
					onkeydown={handleKeydown}
				>
					{#if currentStep === 'role'}
						<RoleSelector 
							{templateContext}
							bind:selectedRole
							bind:customRole
							bind:organization
							bind:roleError
							{isTransitioning}
							onNext={nextStep}
							onCancel={handleCancel}
						/>
					{:else if currentStep === 'connection'}
						<ConnectionPicker 
							{templateContext}
							{isLocalGovernment}
							{isCorporate}
							bind:selectedConnection
							bind:connectionDetails
							bind:location
							bind:connectionError
							{isTransitioning}
							onNext={nextStep}
							onPrev={prevStep}
						/>
					{:else}
						<VerificationStep 
							{template}
							{selectedRole}
							{customRole}
							{organization}
							{selectedConnection}
							{connectionDetails}
							{location}
							{isTransitioning}
							onPrev={prevStep}
							onComplete={handleComplete}
						/>
					{/if}
				</div>
			{/key}
		</div>
	{/snippet}
</UnifiedModal>