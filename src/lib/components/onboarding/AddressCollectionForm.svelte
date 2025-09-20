<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { MapPin, CheckCircle2, AlertCircle, Loader2, Home } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';

	let {
		template
	}: {
		template: {
			title: string;
			deliveryMethod: string;
		};
	} = $props();

	const dispatch = createEventDispatcher<{
		complete: {
			address: string;
			verified: boolean;
			representatives?: Array<Record<string, unknown>>;
		};
	}>();

	let currentStep = $state<'collect' | 'verify' | 'complete'>('collect');

	// Address form data
	let streetAddress = $state('');
	let city = $state('');
	let stateCode = $state('');
	let zipCode = $state('');
	let addressError = $state('');
	let isVerifying = $state(false);
	let isSaving = $state(false);
	let verificationResult = $state<Record<string, unknown> | null>(null);
	let selectedAddress = $state('');

	function validateAddress(): boolean {
		addressError = '';

		if (!streetAddress.trim()) {
			addressError = 'Please enter your street address';
			return false;
		}
		if (!city.trim()) {
			addressError = 'Please enter your city';
			return false;
		}
		if (!stateCode.trim()) {
			addressError = 'Please enter your state';
			return false;
		}
		if (!zipCode.trim() || !/^\d{5}(-\d{4})?$/.test(zipCode)) {
			addressError = 'Please enter a valid ZIP code';
			return false;
		}

		return true;
	}

	async function verifyAddress() {
		if (!validateAddress()) return;

		isVerifying = true;
		addressError = '';

		try {
			const fullAddress = `${streetAddress}, ${city}, ${stateCode} ${zipCode}`;

			// Call real address verification API (Census Bureau + ZIP lookup)
			const { api } = await import('$lib/core/api/client');
			const result = await api.post('/address/verify', {
				street: streetAddress,
				city,
				state: stateCode,
				zipCode
			});

			if (result.success && result.data) {
				// Type guard for address verification data
				const data = result.data as Record<string, unknown>;
				if (data.verified) {
					verificationResult = data;
					selectedAddress = (data.correctedAddress as string) || fullAddress;
					currentStep = 'verify';
				} else {
					addressError = (data.error as string) || 'Unable to verify address. Please check and try again.';
				}
			} else {
				addressError = (result.error as string) || 'Unable to verify address. Please check and try again.';
			}
		} catch (error) {
			console.error('Address verification error:', error);
			addressError =
				error instanceof Error
					? error.message
					: 'Verification service temporarily unavailable. Please try again.';
		} finally {
			isVerifying = false;
		}
	}

	function acceptAddress() {
		isSaving = true;
		dispatch('complete', {
			address: selectedAddress,
			verified: true,
			representatives: Array.isArray(verificationResult?.representatives) && verificationResult.representatives.every(item => typeof item === 'object' && item !== null) ? verificationResult.representatives as Record<string, unknown>[] : undefined,
			district: verificationResult?.district as string | undefined,
			streetAddress,
			city,
			state: stateCode,
			zipCode
		});
	}

	function editAddress() {
		currentStep = 'collect';
		verificationResult = null;
	}

	function skipVerification() {
		const fullAddress = `${streetAddress}, ${city}, ${stateCode} ${zipCode}`;
		dispatch('complete', {
			address: fullAddress,
			verified: false
		});
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			if (currentStep === 'collect') {
				verifyAddress();
			} else if (currentStep === 'verify') {
				acceptAddress();
			}
		}
	}
</script>

<div class="p-6">
	<!-- Progress Indicator -->
	<div class="-mt-2 flex justify-center pb-4">
		<div class="flex gap-2">
			{#each ['collect', 'verify', 'complete'] as step, i}
				<div
					class="h-2 rounded-full transition-all duration-500 ease-out {currentStep === step
						? 'w-12 bg-participation-primary-600 shadow-lg shadow-participation-primary-200'
						: ['collect', 'verify', 'complete'].indexOf(currentStep) > i
							? 'w-8 bg-participation-primary-300'
							: 'w-8 bg-slate-200'}"
				></div>
			{/each}
		</div>
	</div>

	<!-- Content -->
	<div class="relative">
		{#key currentStep}
			<div
				in:fly={{ x: 20, duration: 400, delay: 300, easing: quintOut }}
				out:fly={{ x: -20, duration: 300, easing: quintOut }}
				onkeydown={handleKeydown}
			>
				{#if currentStep === 'collect'}
					<!-- Address Collection Step -->

					<!-- Compact value prop -->
					<div class="mb-4 border-l-4 border-green-400 bg-green-50 p-3">
						<p class="text-sm font-medium text-green-800">
							Your address unlocks personalized delivery routes. Messages reach the right offices,
							show local support, and carry more weight when they come from real constituents.
						</p>
					</div>

					<!-- Form Fields -->
					<div class="mb-6 space-y-4">
						<div>
							<label for="street" class="mb-2 block text-sm font-medium text-slate-700">
								Street Address
							</label>
							<input
								id="street"
								type="text"
								bind:value={streetAddress}
								placeholder="123 Main Street"
								class="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-participation-primary-500 focus:ring-2 focus:ring-participation-primary-500"
							/>
						</div>

						<div>
							<label for="city" class="mb-2 block text-sm font-medium text-slate-700"> City </label>
							<input
								id="city"
								type="text"
								bind:value={city}
								placeholder="City"
								class="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-participation-primary-500 focus:ring-2 focus:ring-participation-primary-500"
							/>
						</div>

						<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<div>
								<label for="state" class="mb-2 block text-sm font-medium text-slate-700">
									State
								</label>
								<input
									id="state"
									type="text"
									bind:value={stateCode}
									placeholder="CA"
									maxlength="2"
									class="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-participation-primary-500 focus:ring-2 focus:ring-participation-primary-500"
								/>
							</div>
							<div>
								<label for="zip" class="mb-2 block text-sm font-medium text-slate-700">
									ZIP Code
								</label>
								<input
									id="zip"
									type="text"
									bind:value={zipCode}
									placeholder="12345"
									maxlength="10"
									class="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-participation-primary-500 focus:ring-2 focus:ring-participation-primary-500"
								/>
							</div>
						</div>

						{#if addressError}
							<div class="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
								<AlertCircle class="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
								<p class="text-sm text-red-700">{addressError}</p>
							</div>
						{/if}
					</div>

					<div class="space-y-3">
						<Button
							variant="primary"
							size="sm"
							classNames="w-full"
							onclick={verifyAddress}
							disabled={isVerifying ||
								!streetAddress.trim() ||
								!city.trim() ||
								!stateCode.trim() ||
								!zipCode.trim()}
						>
							{#if isVerifying}
								<Loader2 class="mr-2 h-4 w-4 animate-spin" />
								Verifying address...
							{:else}
								<CheckCircle2 class="mr-2 h-4 w-4" />
								Continue
							{/if}
						</Button>

						<Button variant="secondary" size="sm" classNames="w-full" onclick={skipVerification}>
							Skip for now
						</Button>
					</div>

					<!-- Privacy Note at bottom -->
					<p class="mt-6 text-center text-xs text-slate-500">
						Your address is saved to your profile for future messages and never shared with third
						parties.
					</p>
				{:else if currentStep === 'verify'}
					<!-- Address Verification Step -->
					<div class="mb-6 text-center">
						<div
							class="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100"
						>
							<CheckCircle2 class="h-6 w-6 text-green-600" />
						</div>
						<h2 class="mb-2 text-xl font-bold text-slate-900">Confirm your address</h2>
						<p class="text-slate-600">We've verified your address and found your representatives</p>
					</div>

					<!-- Verified Address -->
					<div class="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
						<div class="flex items-start gap-3">
							<Home class="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
							<div>
								<p class="font-medium text-slate-900">Verified Address:</p>
								<p class="mt-1 text-sm text-slate-600">{selectedAddress}</p>
							</div>
						</div>
					</div>

					<!-- Representatives Found -->
					{#if verificationResult?.representatives}
						<div
							class="mb-6 rounded-lg border border-participation-primary-200 bg-participation-primary-50 p-4"
						>
							<p class="mb-2 font-medium text-slate-900">Your Representatives:</p>
							<div class="space-y-2">
								{#each (Array.isArray(verificationResult.representatives) ? verificationResult.representatives : []) as rep}
									<div class="flex items-center gap-2 text-sm">
										<div class="h-2 w-2 rounded-full bg-participation-primary-500"></div>
										<span class="text-slate-700">{(rep as any).name} ({(rep as any).office})</span>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<div class="flex gap-3">
						<Button
							variant="secondary"
							size="sm"
							classNames="flex-1"
							onclick={editAddress}
							disabled={isSaving}
						>
							Edit Address
						</Button>
						<Button
							variant="primary"
							size="sm"
							classNames="flex-1"
							onclick={acceptAddress}
							disabled={isSaving}
						>
							{#if isSaving}
								<Loader2 class="mr-1 h-4 w-4 animate-spin" />
								Saving...
							{:else}
								<CheckCircle2 class="mr-1 h-4 w-4" />
								Looks Good
							{/if}
						</Button>
					</div>
				{:else}
					<!-- Completion Step -->
					<div class="mb-6 text-center">
						<div
							class="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100"
						>
							<CheckCircle2 class="h-6 w-6 text-green-600" />
						</div>
						<h2 class="mb-2 text-xl font-bold text-slate-900">You're all set!</h2>
						<p class="text-slate-600">Your address has been saved and verified</p>
					</div>
				{/if}
			</div>
		{/key}
	</div>
</div>
