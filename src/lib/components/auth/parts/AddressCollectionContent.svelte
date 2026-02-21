<script lang="ts">
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { MapPin, CheckCircle2, AlertCircle, Search, Home } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';

	type Representative = {
		name: string;
		office: string;
	};

	type VerificationResult = {
		verified?: boolean;
		correctedAddress?: string;
		district?: string;
		/**
		 * Census Block GEOID (15-digit cell identifier) for three-tree ZK architecture
		 * PRIVACY: Neighborhood-level precision (600-3000 people), encrypted at rest
		 */
		cell_id?: string;
		representatives?: Representative[];
		[key: string]: unknown;
	};

	let {
		template,
		onclose: _onclose,
		oncomplete
	}: {
		template: {
			title: string;
			deliveryMethod: string;
		};
		onclose?: () => void;
		oncomplete: (data: {
			street?: string;
			city?: string;
			state?: string;
			zip?: string;
			address: string;
			verified: boolean;
			congressional_district?: string;
			/**
			 * Census Block GEOID (15-digit cell identifier) for three-tree ZK architecture
			 * PRIVACY: Neighborhood-level precision (600-3000 people)
			 */
			cell_id?: string;
			representatives?: Array<Record<string, unknown>>;
		}) => void;
	} = $props();

	let currentStep = $state('collect');

	// Address form data
	let streetAddress = $state('');
	let city = $state('');
	let stateCode = $state('');
	let zipCode = $state('');
	let addressError = $state('');
	let isVerifying = $state(false);
	let verificationResult = $state<VerificationResult | null>(null);
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
			const result = await api.post('/api/address/verify', {
				street: streetAddress,
				city,
				state: stateCode,
				zipCode
			});

			if (result.success && (result.data as VerificationResult)?.verified) {
				verificationResult = result.data as VerificationResult;
				selectedAddress = (result.data as VerificationResult).correctedAddress || fullAddress;
				currentStep = 'verify';
			} else {
				addressError = result.error || 'Unable to verify address. Please check and try again.';
			}
		} catch {
			addressError = 'Verification service temporarily unavailable. Please try again.';
		} finally {
			isVerifying = false;
		}
	}

	function acceptAddress() {
		oncomplete({
			street: streetAddress,
			city,
			state: stateCode,
			zip: zipCode,
			address: selectedAddress,
			verified: true,
			congressional_district: verificationResult?.district,
			cell_id: verificationResult?.cell_id, // 15-digit Census Block GEOID (three-tree mode)
			representatives: verificationResult?.representatives as
				| Array<Record<string, unknown>>
				| undefined
		});
	}

	function editAddress() {
		currentStep = 'collect';
		verificationResult = null;
	}

	function skipVerification() {
		const fullAddress = `${streetAddress}, ${city}, ${stateCode} ${zipCode}`;
		oncomplete({
			street: streetAddress,
			city,
			state: stateCode,
			zip: zipCode,
			address: fullAddress,
			verified: false
		});
	}

	function _handleKeydown(_event: KeyboardEvent) {
		if (_event.key === 'Enter' && !_event.shiftKey) {
			_event.preventDefault();
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
	<div class="-mt-2 flex justify-center pb-6">
		<div class="flex gap-2">
			{#each ['collect', 'verify', 'complete'] as step, i}
				<div
					class="h-2 rounded-full transition-all duration-500 ease-out {currentStep === step
						? 'w-12 bg-blue-600 shadow-lg shadow-blue-200'
						: ['collect', 'verify', 'complete'].indexOf(currentStep) > i
							? 'w-8 bg-blue-300'
							: 'w-8 bg-slate-200'}"
				></div>
			{/each}
		</div>
	</div>

	<!-- Content -->
	<div class="relative min-h-[400px] overflow-hidden">
		{#key currentStep}
			<div
				class="absolute inset-0"
				in:fly={{ x: 20, duration: 400, delay: 300, easing: quintOut }}
				out:fly={{ x: -20, duration: 300, easing: quintOut }}
				role="group"
				aria-label="Address collection step"
			>
				{#if currentStep === 'collect'}
					<!-- Address Collection Step -->
					<div class="mb-6 text-center">
						<div
							class="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-100"
						>
							<MapPin class="h-6 w-6 text-blue-600" />
						</div>
						<h2 class="mb-2 text-xl font-bold text-slate-900">Find your representatives</h2>
						<p class="text-slate-600">
							We need your address to send "{template.title}" to the right congressional offices
						</p>
					</div>

					<!-- Privacy Note -->
					<div class="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-3">
						<div class="flex items-start gap-2">
							<svg
								class="mt-0.5 h-4 w-4 shrink-0 text-blue-600"
								fill="currentColor"
								viewBox="0 0 20 20"
							>
								<path
									fill-rule="evenodd"
									d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
									clip-rule="evenodd"
								/>
							</svg>
							<div>
								<h3 class="text-sm font-medium text-blue-900">Privacy Protected</h3>
								<p class="mt-1 text-xs text-blue-700">
									Your address is only used to identify your representatives and is not stored or
									shared with third parties.
								</p>
							</div>
						</div>
					</div>

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
								class="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
							/>
						</div>

						<div class="grid grid-cols-2 gap-3">
							<div>
								<label for="city" class="mb-2 block text-sm font-medium text-slate-700">
									City
								</label>
								<input
									id="city"
									type="text"
									bind:value={city}
									placeholder="City"
									class="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
								/>
							</div>
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
									class="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
								/>
							</div>
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
								class="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
							/>
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
								<Search class="mr-2 h-4 w-4 animate-spin" />
								Verifying address...
							{:else}
								<Search class="mr-2 h-4 w-4" />
								Verify & Find Representatives
							{/if}
						</Button>

						<Button variant="secondary" size="sm" classNames="w-full" onclick={skipVerification}>
							Skip verification (may affect delivery)
						</Button>
					</div>
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
						<div class="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
							<p class="mb-2 font-medium text-slate-900">Your Representatives:</p>
							<div class="space-y-2">
								{#each verificationResult.representatives as rep}
									<div class="flex items-center gap-2 text-sm">
										<div class="h-2 w-2 rounded-full bg-blue-500"></div>
										<span class="text-slate-700">{rep.name} ({rep.office})</span>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<div class="flex gap-3">
						<Button variant="secondary" size="sm" classNames="flex-1" onclick={editAddress}>
							Edit Address
						</Button>
						<Button variant="primary" size="sm" classNames="flex-1" onclick={acceptAddress}>
							<CheckCircle2 class="mr-1 h-4 w-4" />
							Looks Good
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
