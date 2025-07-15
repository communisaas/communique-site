<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fade, fly, scale } from 'svelte/transition';
	import { quintOut, backOut } from 'svelte/easing';
	import { 
		X, 
		User,
		Building2,
		MapPin,
		CheckCircle2,
		Users,
		Briefcase,
		Home
	} from '@lucide/svelte';
	import Button from '../ui/Button.svelte';
	
	export let template: {
		title: string;
		deliveryMethod: string;
		category?: string;
		recipientEmails?: string[];
	};
	
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
	
	type Step = 'role' | 'connection' | 'verify';
	let currentStep: Step = 'role';
	let isTransitioning = false;
	
	// Form data
	let selectedRole = '';
	let customRole = '';
	let organization = '';
	let location = '';
	let selectedConnection = '';
	let connectionDetails = '';
	
	// Validation
	let roleError = '';
	let connectionError = '';
	
	// Determine template context
	$: isLocalGovernment = isLocalGovTemplate(template);
	$: isCorporate = isCorporateTemplate(template);
	$: templateContext = getTemplateContext(template);
	
	function isLocalGovTemplate(template: any): boolean {
		const category = template.category?.toLowerCase() || '';
		const title = template.title?.toLowerCase() || '';
		return category.includes('local') || 
			   category.includes('city') || 
			   category.includes('municipal') ||
			   title.includes('city council') ||
			   title.includes('mayor') ||
			   title.includes('school board');
	}
	
	function isCorporateTemplate(template: any): boolean {
		const category = template.category?.toLowerCase() || '';
		return category.includes('corporate') || 
			   category.includes('business') ||
			   category.includes('company');
	}
	
	function getTemplateContext(template: any) {
		if (isLocalGovernment) return 'local-government';
		if (isCorporate) return 'corporate';
		return 'general';
	}
	
	function handleClose() {
		dispatch('close');
	}
	
	function validateRole(): boolean {
		roleError = '';
		const role = selectedRole === 'other' ? customRole : selectedRole;
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
		if (isTransitioning) return;
		
		let isValid = true;
		if (currentStep === 'role') {
			isValid = validateRole();
		} else if (currentStep === 'connection') {
			isValid = validateConnection();
		}
		
		if (!isValid) return;
		
		isTransitioning = true;
		
		if (currentStep === 'role') {
			currentStep = 'connection';
		} else if (currentStep === 'connection') {
			currentStep = 'verify';
		}
		
		setTimeout(() => isTransitioning = false, 300);
	}
	
	function prevStep() {
		if (isTransitioning) return;
		
		isTransitioning = true;
		
		if (currentStep === 'verify') {
			currentStep = 'connection';
		} else if (currentStep === 'connection') {
			currentStep = 'role';
		}
		
		setTimeout(() => isTransitioning = false, 300);
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
	
	// Role options based on template context
	$: roleOptions = getRoleOptions(templateContext);
	$: connectionOptions = getConnectionOptions(templateContext);
	
	function getRoleOptions(context: string) {
		const baseOptions = [
			'Resident',
			'Business Owner', 
			'Employee',
			'Student',
			'Community Volunteer'
		];
		
		if (context === 'corporate') {
			return [
				'Customer',
				'Employee', 
				'Shareholder',
				'Business Partner',
				'Industry Professional',
				...baseOptions
			];
		}
		
		if (context === 'local-government') {
			return [
				'Local Resident',
				'Voter',
				'Taxpayer',
				'Business Owner',
				'Parent',
				'Community Leader',
				...baseOptions
			];
		}
		
		return baseOptions;
	}
	
	function getConnectionOptions(context: string) {
		if (context === 'corporate') {
			return [
				'Customer/Client',
				'Employee',
				'Shareholder/Investor', 
				'Business Partner',
				'Community Member Affected',
				'Industry Stakeholder'
			];
		}
		
		if (context === 'local-government') {
			return [
				'Local Resident',
				'Voter in District',
				'Taxpayer',
				'Business in Area',
				'Family Affected',
				'Community Organization'
			];
		}
		
		return [
			'Directly Affected',
			'Community Member',
			'Concerned Citizen',
			'Professional Stakeholder',
			'Advocate/Supporter'
		];
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

<div 
	class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
	on:click={handleClose}
	in:fade={{ duration: 300, easing: quintOut }}
	out:fade={{ duration: 200 }}
>
	<div 
		class="fixed inset-x-4 top-1/2 max-w-md mx-auto transform -translate-y-1/2 bg-white rounded-2xl shadow-2xl overflow-hidden"
		on:click|stopPropagation
		in:scale={{ 
			duration: 400, 
			easing: backOut,
			start: 0.9,
			opacity: 0.5
		}}
		out:scale={{ 
			duration: 200, 
			easing: quintOut,
			start: 0.95
		}}
	>
		<!-- Close Button -->
		<button
			on:click={handleClose}
			class="absolute right-4 top-4 z-10 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
		>
			<X class="h-5 w-5" />
		</button>
		
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
					/>
				{/each}
			</div>
		</div>
		
		<!-- Content -->
		<div class="relative overflow-hidden min-h-[500px]">
			{#key currentStep}
				<div 
					class="absolute inset-0 p-6 pt-2"
					in:fly={{ x: 20, duration: 400, delay: 300, easing: quintOut }}
					out:fly={{ x: -20, duration: 300, easing: quintOut }}
					on:keydown={handleKeydown}
				>
					{#if currentStep === 'role'}
						<!-- Role & Credentials Step -->
						<div class="text-center mb-6">
							<div class="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
								<User class="h-6 w-6 text-blue-600" />
							</div>
							<h2 class="text-xl font-bold text-slate-900 mb-2">
								Strengthen your voice
							</h2>
							<p class="text-slate-600">
								Adding your role and credentials increases your message's impact
							</p>
						</div>
						
						<div class="space-y-4 mb-6">
							<div>
								<label class="block text-sm font-medium text-slate-700 mb-3">
									What's your role?
								</label>
								<div class="grid grid-cols-2 gap-2">
									{#each roleOptions as role}
										<button
											type="button"
											on:click={() => selectedRole = role.toLowerCase().replace(/\s+/g, '-')}
											class="text-left p-3 border rounded-lg text-sm transition-all hover:border-blue-300 {
												selectedRole === role.toLowerCase().replace(/\s+/g, '-') 
													? 'border-blue-500 bg-blue-50 text-blue-900' 
													: 'border-slate-300 text-slate-700'
											}"
										>
											{role}
										</button>
									{/each}
									<button
										type="button"
										on:click={() => selectedRole = 'other'}
										class="text-left p-3 border rounded-lg text-sm transition-all hover:border-blue-300 {
											selectedRole === 'other' 
												? 'border-blue-500 bg-blue-50 text-blue-900' 
												: 'border-slate-300 text-slate-700'
										}"
									>
										Other
									</button>
								</div>
								
								{#if selectedRole === 'other'}
									<input
										type="text"
										bind:value={customRole}
										placeholder="Enter your role"
										class="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
										autofocus
									/>
								{/if}
							</div>
							
							<div>
								<label for="organization" class="block text-sm font-medium text-slate-700 mb-2">
									Organization (optional but recommended)
								</label>
								<input
									id="organization"
									type="text"
									bind:value={organization}
									placeholder="Company, school, or organization"
									class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
								/>
								<p class="mt-1 text-xs text-slate-500">
									Adding your organization increases credibility
								</p>
							</div>
							
							{#if roleError}
								<p class="text-sm text-red-600">{roleError}</p>
							{/if}
						</div>
						
						<div class="flex gap-3">
							<Button 
								variant="secondary" 
								size="sm" 
								classNames="flex-1"
								on:click={handleClose}
							>
								Cancel
							</Button>
							<Button 
								variant="primary" 
								size="sm" 
								classNames="flex-1"
								on:click={nextStep}
								disabled={isTransitioning}
							>
								Continue
							</Button>
						</div>
						
					{:else if currentStep === 'connection'}
						<!-- Connection & Context Step -->
						<div class="text-center mb-6">
							<div class="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4">
								{#if isLocalGovernment}
									<Home class="h-6 w-6 text-green-600" />
								{:else if isCorporate}
									<Building2 class="h-6 w-6 text-green-600" />
								{:else}
									<Users class="h-6 w-6 text-green-600" />
								{/if}
							</div>
							<h2 class="text-xl font-bold text-slate-900 mb-2">
								Your connection
							</h2>
							<p class="text-slate-600">
								{#if isLocalGovernment}
									How are you connected to this local issue?
								{:else if isCorporate}
									What's your relationship to this organization?
								{:else}
									How does this issue affect you?
								{/if}
							</p>
						</div>
						
						<div class="space-y-4 mb-6">
							<div>
								<label class="block text-sm font-medium text-slate-700 mb-3">
									Select your connection:
								</label>
								<div class="space-y-2">
									{#each connectionOptions as connection}
										<button
											type="button"
											on:click={() => selectedConnection = connection.toLowerCase().replace(/\s+/g, '-')}
											class="w-full text-left p-3 border rounded-lg text-sm transition-all hover:border-blue-300 {
												selectedConnection === connection.toLowerCase().replace(/\s+/g, '-') 
													? 'border-blue-500 bg-blue-50 text-blue-900' 
													: 'border-slate-300 text-slate-700'
											}"
										>
											{connection}
										</button>
									{/each}
									<button
										type="button"
										on:click={() => selectedConnection = 'other'}
										class="w-full text-left p-3 border rounded-lg text-sm transition-all hover:border-blue-300 {
											selectedConnection === 'other' 
												? 'border-blue-500 bg-blue-50 text-blue-900' 
												: 'border-slate-300 text-slate-700'
										}"
									>
										Other
									</button>
								</div>
								
								{#if selectedConnection === 'other'}
									<input
										type="text"
										bind:value={connectionDetails}
										placeholder="Describe your connection"
										class="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
										autofocus
									/>
								{/if}
							</div>
							
							{#if isLocalGovernment}
								<div>
									<label for="location" class="block text-sm font-medium text-slate-700 mb-2">
										Location (optional)
									</label>
									<input
										id="location"
										type="text"
										bind:value={location}
										placeholder="City, State"
										class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
									/>
									<p class="mt-1 text-xs text-slate-500">
										Helps verify you're in the jurisdiction
									</p>
								</div>
							{/if}
							
							{#if connectionError}
								<p class="text-sm text-red-600">{connectionError}</p>
							{/if}
						</div>
						
						<div class="flex gap-3">
							<Button 
								variant="secondary" 
								size="sm" 
								classNames="flex-1"
								on:click={prevStep}
								disabled={isTransitioning}
							>
								Back
							</Button>
							<Button 
								variant="primary" 
								size="sm" 
								classNames="flex-1"
								on:click={nextStep}
								disabled={isTransitioning}
							>
								Continue
							</Button>
						</div>
						
					{:else}
						<!-- Verification & Send Step -->
						<div class="text-center mb-6">
							<div class="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4">
								<CheckCircle2 class="h-6 w-6 text-green-600" />
							</div>
							<h2 class="text-xl font-bold text-slate-900 mb-2">
								Ready to send
							</h2>
							<p class="text-slate-600">
								Your credentials strengthen your message's impact
							</p>
						</div>
						
						<!-- Summary Card -->
						<div class="bg-slate-50 rounded-lg p-4 mb-6 space-y-3">
							<div class="flex items-start justify-between">
								<span class="text-sm text-slate-600">Role:</span>
								<span class="text-sm font-medium text-slate-900 text-right max-w-[60%]">
									{selectedRole === 'other' ? customRole : selectedRole.replace(/-/g, ' ')}
									{#if organization}
										<br><span class="text-slate-600">at {organization}</span>
									{/if}
								</span>
							</div>
							<div class="flex items-start justify-between">
								<span class="text-sm text-slate-600">Connection:</span>
								<span class="text-sm font-medium text-slate-900 text-right max-w-[60%]">
									{selectedConnection === 'other' ? connectionDetails : selectedConnection.replace(/-/g, ' ')}
								</span>
							</div>
							{#if location}
								<div class="flex items-start justify-between">
									<span class="text-sm text-slate-600">Location:</span>
									<span class="text-sm font-medium text-slate-900">{location}</span>
								</div>
							{/if}
							<div class="flex items-start justify-between">
								<span class="text-sm text-slate-600">Template:</span>
								<span class="text-sm font-medium text-slate-900 text-right max-w-[60%]">{template.title}</span>
							</div>
						</div>
						
						<div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
							<p class="text-sm text-blue-800">
								💡 These details help decision-makers understand why your voice matters and increases the likelihood of a response.
							</p>
						</div>
						
						<div class="flex gap-3">
							<Button 
								variant="secondary" 
								size="sm" 
								classNames="flex-1"
								on:click={prevStep}
								disabled={isTransitioning}
							>
								Back
							</Button>
							<Button 
								variant="primary" 
								size="sm" 
								classNames="flex-1"
								on:click={handleComplete}
								disabled={isTransitioning}
							>
								<CheckCircle2 class="mr-1 h-4 w-4" />
								Send Message
							</Button>
						</div>
					{/if}
				</div>
			{/key}
		</div>
	</div>
</div>