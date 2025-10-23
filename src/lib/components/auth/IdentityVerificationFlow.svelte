<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { ChevronLeft, Check } from '@lucide/svelte';

	import VerificationChoice from './address-steps/VerificationChoice.svelte';
	import VerificationValueProp from './address-steps/VerificationValueProp.svelte';
	import SelfXyzVerification from './address-steps/SelfXyzVerification.svelte';
	import DiditVerification from './address-steps/DiditVerification.svelte';

	interface Props {
		userId: string;
		templateSlug?: string;
		/** Skip value proposition (if already shown earlier in flow) */
		skipValueProp?: boolean;
		/** Default verification method (if user already made a choice) */
		defaultMethod?: 'nfc' | 'government-id' | null;
	}

	let {
		userId,
		templateSlug,
		skipValueProp = false,
		defaultMethod = null
	}: Props = $props();

	type FlowStep = 'value-prop' | 'choice' | 'verify-nfc' | 'verify-id' | 'complete';

	let currentStep = $state<FlowStep>(skipValueProp ? 'choice' : 'value-prop');
	let selectedMethod = $state<'nfc' | 'government-id' | null>(defaultMethod);
	let verificationComplete = $state(false);
	let verificationData = $state<{ verified: boolean; method: string } | null>(null);

	const dispatch = createEventDispatcher<{
		complete: { verified: boolean; method: string; userId: string };
		cancel: void;
		back: void;
	}>();

	function handleMethodSelection(event: CustomEvent<{ method: 'nfc' | 'government-id' }>) {
		selectedMethod = event.detail.method;

		// Automatically advance to verification step
		if (selectedMethod === 'nfc') {
			currentStep = 'verify-nfc';
		} else if (selectedMethod === 'government-id') {
			currentStep = 'verify-id';
		}
	}

	function handleVerificationComplete(event: CustomEvent<{ verified: boolean; method: string }>) {
		verificationComplete = true;
		verificationData = event.detail;
		currentStep = 'complete';

		// Notify parent component
		dispatch('complete', {
			...event.detail,
			userId
		});
	}

	function handleVerificationError(event: CustomEvent<{ message: string }>) {
		console.error('Verification error:', event.detail.message);
		// Error handling is managed within child components
		// Could optionally dispatch to parent for additional handling
	}

	function goBack() {
		if (currentStep === 'verify-nfc' || currentStep === 'verify-id') {
			currentStep = 'choice';
			selectedMethod = null;
		} else if (currentStep === 'choice' && !skipValueProp) {
			currentStep = 'value-prop';
		} else {
			dispatch('back');
		}
	}

	function proceedFromValueProp() {
		currentStep = 'choice';
	}
</script>

<div class="mx-auto max-w-3xl">
	<!-- Progress Indicator -->
	{#if !verificationComplete}
		<div class="mb-8">
			<div class="flex items-center justify-between text-sm">
				<span class="font-medium text-slate-700">
					{#if currentStep === 'value-prop'}
						Step 1 of 3: Understand Verification
					{:else if currentStep === 'choice'}
						Step 2 of 3: Choose Method
					{:else if currentStep === 'verify-nfc' || currentStep === 'verify-id'}
						Step 3 of 3: Complete Verification
					{/if}
				</span>
				<span class="text-slate-500">
					{#if currentStep === 'value-prop'}
						33%
					{:else if currentStep === 'choice'}
						66%
					{:else}
						99%
					{/if}
				</span>
			</div>
			<div class="mt-2 h-2 w-full rounded-full bg-slate-200">
				<div
					class="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-500"
					style="width: {currentStep === 'value-prop' ? '33%' : currentStep === 'choice' ? '66%' : '99%'}"
				></div>
			</div>
		</div>
	{/if}

	<!-- Back Button (except on first and last steps) -->
	{#if currentStep !== 'value-prop' && currentStep !== 'complete' && !skipValueProp}
		<button
			type="button"
			onclick={goBack}
			class="mb-6 flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
		>
			<ChevronLeft class="h-4 w-4" />
			<span>Back</span>
		</button>
	{/if}

	<!-- Step Content -->
	<div class="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
		{#if currentStep === 'value-prop'}
			<!-- Value Proposition -->
			<VerificationValueProp variant="full" />

			<div class="mt-8">
				<button
					type="button"
					onclick={proceedFromValueProp}
					class="w-full rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl"
				>
					Continue to Verification
				</button>
			</div>

		{:else if currentStep === 'choice'}
			<!-- Method Selection -->
			<VerificationChoice
				defaultMethod={selectedMethod}
				on:select={handleMethodSelection}
			/>

		{:else if currentStep === 'verify-nfc'}
			<!-- NFC Passport Verification -->
			<SelfXyzVerification
				{userId}
				{templateSlug}
				on:complete={handleVerificationComplete}
				on:error={handleVerificationError}
			/>

		{:else if currentStep === 'verify-id'}
			<!-- Government ID Verification -->
			<DiditVerification
				{userId}
				{templateSlug}
				on:complete={handleVerificationComplete}
				on:error={handleVerificationError}
			/>

		{:else if currentStep === 'complete'}
			<!-- Success State -->
			<div class="py-12 text-center">
				<div class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-600 shadow-2xl">
					<Check class="h-10 w-10 text-white" strokeWidth={3} />
				</div>

				<h2 class="mb-3 text-3xl font-bold text-slate-900">
					Verification Complete!
				</h2>

				<p class="mb-2 text-lg text-slate-600">
					Your identity has been successfully verified
				</p>

				<div class="mx-auto mb-8 max-w-md">
					<div class="mt-6 rounded-lg border border-green-200 bg-green-50 p-4">
						<p class="text-sm font-medium text-green-900">
							What happens next:
						</p>
						<ul class="mt-2 space-y-1 text-sm text-green-800">
							<li class="flex items-start gap-2">
								<span class="text-green-600">✓</span>
								<span>Your messages will be marked as verified</span>
							</li>
							<li class="flex items-start gap-2">
								<span class="text-green-600">✓</span>
								<span>Congressional offices will prioritize your voice</span>
							</li>
							<li class="flex items-start gap-2">
								<span class="text-green-600">✓</span>
								<span>You'll build reputation with every civic action</span>
							</li>
						</ul>
					</div>
				</div>

				<div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
					<button
						type="button"
						onclick={() => dispatch('complete', { ...verificationData!, userId })}
						class="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-3 text-base font-semibold text-white shadow-lg transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl"
					>
						Continue to Message Submission
					</button>
				</div>
			</div>
		{/if}
	</div>

	<!-- Help Text -->
	{#if currentStep !== 'complete'}
		<div class="mt-6 text-center">
			<p class="text-sm text-slate-600">
				Having trouble? <a href="/help/verification" class="font-medium text-blue-600 hover:text-blue-700">Get help with verification</a>
			</p>
		</div>
	{/if}
</div>
