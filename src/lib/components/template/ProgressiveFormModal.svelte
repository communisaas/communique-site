<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { fade, fly, scale } from 'svelte/transition';
	import { quintOut, backOut } from 'svelte/easing';
	import { X, ArrowRight, ArrowLeft, User, MapPin, Send, CheckCircle2 } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { coordinated, useTimerCleanup } from '$lib/utils/timerCoordinator';

	let {
		template,
		user = null
	}: {
		template: {
			id: string;
			title: string;
			description: string;
			slug: string;
			deliveryMethod: string;
			preview?: string;
		};
		user?: { id: string; name: string; address?: string } | null;
	} = $props();

	const dispatch = createEventDispatcher<{
		close: void;
		send: { name: string; address?: string; email?: string };
	}>();

	// Component ID for timer coordination
	const componentId = 'progressive-form-modal-' + Math.random().toString(36).substring(2, 15);

	type Step = 'name' | 'address' | 'send';
	let currentStep: Step = $state('name');
	let isTransitioning = $state(false);

	// Form data
	let name = $state(user?.name || '');
	let address = $state(user?.address || '');
	let email = $state('');

	// Validation states
	let nameError = $state('');
	let addressError = $state('');
	let emailError = $state('');

	const isCongressional = $derived(template.deliveryMethod === 'cwc');
	const isAuthFlow = $derived(template.deliveryMethod === 'auth');
	const requiresAddress = $derived(isCongressional && !isAuthFlow);
	const requiresEmail = $derived(!user || isAuthFlow); // Always need email for auth flow

	// Determine the flow based on template type and user status
	const steps = $derived(getSteps());
	const currentStepIndex = $derived(steps.indexOf(currentStep));
	const isLastStep = $derived(currentStepIndex === steps.length - 1);

	function getSteps(): Step[] {
		if (isAuthFlow) {
			// Auth flow for template creators - always need name/email
			return ['name', 'send'];
		} else if (user) {
			// Authenticated user
			if (user.address && isCongressional) {
				return ['send']; // Skip directly to send
			} else if (isCongressional) {
				return ['address', 'send']; // Need address for congressional
			} else {
				return ['send']; // Direct email, no address needed
			}
		} else {
			// Guest user
			if (isCongressional) {
				return ['name', 'address', 'send']; // Need name and address
			} else {
				return ['name', 'send']; // Only need name for direct email
			}
		}
	}

	onMount(() => {
		// Prevent background scrolling when modal is open
		if (browser) {
			document.body.style.overflow = 'hidden';
		}

		// If user is authenticated and has address, skip to send step
		if (user?.address && isCongressional) {
			currentStep = 'send';
		} else if (user && !isCongressional) {
			currentStep = 'send';
		}
	});

	onDestroy(() => {
		if (browser) {
			document.body.style.overflow = '';
		}
		useTimerCleanup(componentId)();
	});

	function validateName(): boolean {
		nameError = '';
		if (!name.trim()) {
			nameError = 'Please enter your name';
			return false;
		}
		if (name.trim().length < 2) {
			nameError = 'Name must be at least 2 characters';
			return false;
		}
		return true;
	}

	function validateAddress(): boolean {
		addressError = '';
		if (!address.trim()) {
			addressError = 'Please enter your address';
			return false;
		}
		// Basic address validation - should contain street and city/state
		const addressParts = address.trim().split(',');
		if (addressParts.length < 2) {
			addressError = 'Please enter a complete address (street, city, state)';
			return false;
		}
		return true;
	}

	function validateEmail(): boolean {
		emailError = '';
		if ((requiresEmail || isAuthFlow) && !email.trim()) {
			emailError = 'Please enter your email';
			return false;
		}
		if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			emailError = 'Please enter a valid email address';
			return false;
		}
		return true;
	}

	function nextStep() {
		if (isTransitioning) return;

		// Validate current step
		let isValid = true;
		if (currentStep === 'name') {
			isValid = validateName() && validateEmail();
		} else if (currentStep === 'address') {
			isValid = validateAddress();
		}

		if (!isValid) return;

		isTransitioning = true;

		const nextIndex = currentStepIndex + 1;
		if (nextIndex < steps.length) {
			currentStep = steps[nextIndex];
		}

		coordinated.setTimeout(() => (isTransitioning = false), 300, 'transition', componentId);
	}

	function prevStep() {
		if (isTransitioning) return;

		isTransitioning = true;

		const prevIndex = currentStepIndex - 1;
		if (prevIndex >= 0) {
			currentStep = steps[prevIndex];
		}

		coordinated.setTimeout(() => (isTransitioning = false), 300, 'transition', componentId);
	}

	function handleSend() {
		// Final validation
		let isValid = true;
		if (!user) {
			isValid = validateName() && validateEmail();
		}
		if (requiresAddress && !user?.address) {
			isValid = isValid && validateAddress();
		}

		if (!isValid) return;

		dispatch('send', {
			name: user?.name || name,
			address: user?.address || (requiresAddress ? address : undefined),
			email: user ? undefined : email
		});
	}

	function handleClose() {
		dispatch('close');
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			if (isLastStep) {
				handleSend();
			} else {
				nextStep();
			}
		}
	}
</script>

<div
	class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
	onclick={handleClose}
	onkeydown={(e) => {
		if (e.key === 'Escape') handleClose();
	}}
	role="dialog"
	aria-modal="true"
	aria-label="Progressive form modal"
	tabindex="0"
	in:fade={{ duration: 300, easing: quintOut }}
	out:fade={{ duration: 200 }}
>
	<div
		class="fixed inset-x-4 top-1/2 mx-auto max-w-md -translate-y-1/2 transform overflow-hidden rounded-2xl bg-white shadow-2xl"
		onclick={(e) => {
			e.stopPropagation();
		}}
		onkeydown={(e) => {
			e.stopPropagation();
		}}
		role="document"
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
			onclick={handleClose}
			class="absolute right-4 top-4 z-10 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
		>
			<X class="h-5 w-5" />
		</button>

		<!-- Progress Indicator -->
		{#if steps.length > 1}
			<div class="flex justify-center pb-4 pt-6">
				<div class="flex gap-2">
					{#each steps as step, i}
						<div
							class="h-2 rounded-full transition-all duration-500 ease-out {i <= currentStepIndex
								? 'w-12 bg-blue-600 shadow-lg shadow-blue-200'
								: 'w-8 bg-slate-200'}"
						></div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Content -->
		<div class="relative min-h-[400px] overflow-hidden">
			{#key currentStep}
				<div
					class="absolute inset-0 p-6 pt-2"
					in:fly={{ x: 20, duration: 400, delay: 300, easing: quintOut }}
					out:fly={{ x: -20, duration: 300, easing: quintOut }}
					onkeydown={handleKeydown}
					role="form"
					tabindex="-1"
				>
					{#if currentStep === 'name'}
						<!-- Name Collection Step -->
						<div class="mb-6 text-center">
							<div
								class="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-100"
							>
								<User class="h-6 w-6 text-blue-600" />
							</div>
							<h2 class="mb-2 text-xl font-bold text-slate-900">Let's get started</h2>
							<p class="text-slate-600">We need your name to personalize your message</p>
						</div>

						<div class="mb-6 space-y-4">
							<div>
								<label for="name" class="mb-2 block text-sm font-medium text-slate-700">
									Your name
								</label>
								<input
									id="name"
									type="text"
									bind:value={name}
									onblur={validateName}
									placeholder="Enter your full name"
									class="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 {nameError
										? 'border-red-300'
										: ''}"
								/>
								{#if nameError}
									<p class="mt-1 text-sm text-red-600">{nameError}</p>
								{/if}
							</div>

							{#if requiresEmail}
								<div>
									<label for="email" class="mb-2 block text-sm font-medium text-slate-700">
										Email address {isAuthFlow ? '(required)' : '(optional)'}
									</label>
									<input
										id="email"
										type="email"
										bind:value={email}
										onblur={validateEmail}
										placeholder="your@email.com"
										class="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 {emailError
											? 'border-red-300'
											: ''}"
									/>
									{#if emailError}
										<p class="mt-1 text-sm text-red-600">{emailError}</p>
									{/if}
									<p class="mt-1 text-xs text-slate-500">
										{#if isAuthFlow}
											Required: we'll use this to create your account
										{:else}
											Optional: for delivery confirmations and impact tracking
										{/if}
									</p>
								</div>
							{/if}
						</div>

						<div class="flex gap-3">
							<Button
								variant="secondary"
								size="sm"
								classNames="flex-1"
								onclick={handleClose}
								disabled={isTransitioning}
							>
								Cancel
							</Button>
							<Button
								variant="primary"
								size="sm"
								classNames="flex-1"
								onclick={nextStep}
								disabled={isTransitioning || !name.trim() || (isAuthFlow && !email.trim())}
							>
								{isLastStep ? 'Send message' : 'Continue'}
								<ArrowRight class="ml-1 h-4 w-4" />
							</Button>
						</div>
					{:else if currentStep === 'address'}
						<!-- Address Collection Step -->
						<div class="mb-6 text-center">
							<div
								class="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-100"
							>
								<MapPin class="h-6 w-6 text-blue-600" />
							</div>
							<h2 class="mb-2 text-xl font-bold text-slate-900">Where are you located?</h2>
							<p class="text-slate-600">We need your address to identify your representatives</p>
						</div>

						<div class="mb-6 space-y-4">
							<div>
								<label for="address" class="mb-2 block text-sm font-medium text-slate-700">
									Your address
								</label>
								<textarea
									id="address"
									bind:value={address}
									onblur={validateAddress}
									placeholder="123 Main Street, City, State, ZIP"
									rows="3"
									class="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 {addressError
										? 'border-red-300'
										: ''}"
								></textarea>
								{#if addressError}
									<p class="mt-1 text-sm text-red-600">{addressError}</p>
								{/if}
								<p class="mt-1 text-xs text-slate-500">
									This will be used to identify your congressional representatives
								</p>
							</div>
						</div>

						<div class="flex gap-3">
							<Button
								variant="secondary"
								size="sm"
								classNames="flex-1"
								onclick={prevStep}
								disabled={isTransitioning}
							>
								<ArrowLeft class="mr-1 h-4 w-4" />
								Back
							</Button>
							<Button
								variant="primary"
								size="sm"
								classNames="flex-1"
								onclick={nextStep}
								disabled={isTransitioning || !address.trim()}
							>
								{isLastStep ? 'Send message' : 'Continue'}
								<ArrowRight class="ml-1 h-4 w-4" />
							</Button>
						</div>
					{:else}
						<!-- Send Step -->
						<div class="mb-6 text-center">
							<div
								class="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100"
							>
								<Send class="h-6 w-6 text-green-600" />
							</div>
							<h2 class="mb-2 text-xl font-bold text-slate-900">
								{#if isAuthFlow}
									Ready to save your template!
								{:else}
									Ready to send!
								{/if}
							</h2>
							<p class="text-slate-600">
								{#if isAuthFlow}
									We'll create your account and save your advocacy template
								{:else if isCongressional}
									Your message will be sent to your congressional representatives
								{:else}
									Your message will be sent directly to the recipients
								{/if}
							</p>
						</div>

						<!-- Summary -->
						<div class="mb-6 space-y-2 rounded-lg bg-slate-50 p-4">
							<div class="flex items-center justify-between">
								<span class="text-sm text-slate-600">Template:</span>
								<span class="text-sm font-medium text-slate-900">{template.title}</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-sm text-slate-600">Sender:</span>
								<span class="text-sm font-medium text-slate-900">{user?.name || name}</span>
							</div>
							{#if requiresAddress}
								<div class="flex items-start justify-between">
									<span class="text-sm text-slate-600">Address:</span>
									<span class="max-w-[60%] text-right text-sm font-medium text-slate-900">
										{user?.address || address}
									</span>
								</div>
							{/if}
							{#if email && !user}
								<div class="flex items-center justify-between">
									<span class="text-sm text-slate-600">Email:</span>
									<span class="text-sm font-medium text-slate-900">{email}</span>
								</div>
							{/if}
						</div>

						<div class="flex gap-3">
							{#if steps.length > 1}
								<Button
									variant="secondary"
									size="sm"
									classNames="flex-1"
									onclick={prevStep}
									disabled={isTransitioning}
								>
									<ArrowLeft class="mr-1 h-4 w-4" />
									Back
								</Button>
							{:else}
								<Button
									variant="secondary"
									size="sm"
									classNames="flex-1"
									onclick={handleClose}
									disabled={isTransitioning}
								>
									Cancel
								</Button>
							{/if}
							<Button
								variant="primary"
								size="sm"
								classNames="flex-1"
								onclick={handleSend}
								disabled={isTransitioning}
							>
								<Send class="mr-1 h-4 w-4" />
								{#if isAuthFlow}
									Create account & save
								{:else}
									Send message
								{/if}
							</Button>
						</div>
					{/if}
				</div>
			{/key}
		</div>
	</div>
</div>
