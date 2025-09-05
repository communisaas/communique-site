<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { 
		MapPin,
		CheckCircle2,
		AlertCircle,
		Search,
		Home
	} from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';

	let {
		template,
		onclose,
		oncomplete
	}: {
		template: {
			title: string;
			deliveryMethod: string;
		};
		onclose?: () => void;
		oncomplete: (data: { address: string; verified: boolean; representatives?: Array<Record<string, unknown>> }) => void;
	} = $props();

	let currentStep = $state('collect');

	// Address form data
	let streetAddress = $state('');
	let city = $state('');
	let stateCode = $state('');
	let zipCode = $state('');
	let addressError = $state('');
	let isVerifying = $state(false);
	let verificationResult = $state(null as Record<string, unknown> | null);
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
			
			if (result.success && result.data?.verified) {
				verificationResult = result.data;
				selectedAddress = result.data.correctedAddress || fullAddress;
				currentStep = 'verify';
			} else {
				addressError = result.error || 'Unable to verify address. Please check and try again.';
			}
		} catch (error) {
			addressError = 'Verification service temporarily unavailable. Please try again.';
		} finally {
			isVerifying = false;
		}
	}

	function acceptAddress() {
		oncomplete({
			address: selectedAddress,
			verified: true,
			representatives: verificationResult?.representatives
		});
	}

	function editAddress() {
		currentStep = 'collect';
		verificationResult = null;
	}

	function skipVerification() {
		const fullAddress = `${streetAddress}, ${city}, ${stateCode} ${zipCode}`;
		oncomplete({
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
	<div class="flex justify-center pb-6 -mt-2">
		<div class="flex gap-2">
			{#each ['collect', 'verify', 'complete'] as step, i}
				<div 
					class="h-2 rounded-full transition-all duration-500 ease-out {
						currentStep === step 
							? 'w-12 bg-blue-600 shadow-lg shadow-blue-200' 
							: ['collect', 'verify', 'complete'].indexOf(currentStep) > i 
								? 'w-8 bg-blue-300' 
								: 'w-8 bg-slate-200'
					}"
				></div>
			{/each}
		</div>
	</div>

	<!-- Content -->
	<div class="relative overflow-hidden min-h-[400px]">
		{#key currentStep}
			<div 
				class="absolute inset-0"
				in:fly={{ x: 20, duration: 400, delay: 300, easing: quintOut }}
				out:fly={{ x: -20, duration: 300, easing: quintOut }}
				onkeydown={handleKeydown}
				role="region"
				aria-label="Address collection step"
			>
				{#if currentStep === 'collect'}
					<!-- Address Collection Step -->
					<div class="text-center mb-6">
						<div class="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
							<MapPin class="h-6 w-6 text-blue-600" />
						</div>
						<h2 class="text-xl font-bold text-slate-900 mb-2">
							Find your representatives
						</h2>
						<p class="text-slate-600">
							We need your address to send "{template.title}" to the right congressional offices
						</p>
					</div>
					
					<!-- Privacy Note -->
					<div class="mb-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
						<div class="flex items-start gap-2">
							<svg class="w-4 h-4 text-blue-600 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
							</svg>
							<div>
								<h3 class="text-sm font-medium text-blue-900">Privacy Protected</h3>
								<p class="text-xs text-blue-700 mt-1">
									Your address is only used to identify your representatives and is not stored or shared with third parties.
								</p>
							</div>
						</div>
					</div>
					
					<div class="space-y-4 mb-6">
						<div>
							<label for="street" class="block text-sm font-medium text-slate-700 mb-2">
								Street Address
							</label>
							<input
								id="street"
								type="text"
								bind:value={streetAddress}
								placeholder="123 Main Street"
								class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							/>
						</div>
						
						<div class="grid grid-cols-2 gap-3">
							<div>
								<label for="city" class="block text-sm font-medium text-slate-700 mb-2">
									City
								</label>
								<input
									id="city"
									type="text"
									bind:value={city}
									placeholder="City"
									class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
								/>
							</div>
							<div>
								<label for="state" class="block text-sm font-medium text-slate-700 mb-2">
									State
								</label>
								<input
									id="state"
									type="text"
									bind:value={stateCode}
									placeholder="CA"
									maxlength="2"
									class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
								/>
							</div>
						</div>
						
						<div>
							<label for="zip" class="block text-sm font-medium text-slate-700 mb-2">
								ZIP Code
							</label>
							<input
								id="zip"
								type="text"
								bind:value={zipCode}
								placeholder="12345"
								maxlength="10"
								class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							/>
						</div>
						
						{#if addressError}
							<div class="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
								<AlertCircle class="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
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
							disabled={isVerifying || !streetAddress.trim() || !city.trim() || !stateCode.trim() || !zipCode.trim()}
						>
							{#if isVerifying}
								<Search class="mr-2 h-4 w-4 animate-spin" />
								Verifying address...
							{:else}
								<Search class="mr-2 h-4 w-4" />
								Verify & Find Representatives
							{/if}
						</Button>
						
						<Button 
							variant="secondary" 
							size="sm" 
							classNames="w-full"
							onclick={skipVerification}
						>
							Skip verification (may affect delivery)
						</Button>
					</div>
					
				{:else if currentStep === 'verify'}
					<!-- Address Verification Step -->
					<div class="text-center mb-6">
						<div class="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4">
							<CheckCircle2 class="h-6 w-6 text-green-600" />
						</div>
						<h2 class="text-xl font-bold text-slate-900 mb-2">
							Confirm your address
						</h2>
						<p class="text-slate-600">
							We've verified your address and found your representatives
						</p>
					</div>
					
					<!-- Verified Address -->
					<div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
						<div class="flex items-start gap-3">
							<Home class="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
							<div>
								<p class="font-medium text-slate-900">Verified Address:</p>
								<p class="text-sm text-slate-600 mt-1">{selectedAddress}</p>
							</div>
						</div>
					</div>
					
					<!-- Representatives Found -->
					{#if verificationResult?.representatives}
						<div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
							<p class="font-medium text-slate-900 mb-2">Your Representatives:</p>
							<div class="space-y-2">
								{#each verificationResult.representatives as rep}
									<div class="flex items-center gap-2 text-sm">
										<div class="w-2 h-2 bg-blue-500 rounded-full"></div>
										<span class="text-slate-700">{rep.name} ({rep.office})</span>
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
						>
							Edit Address
						</Button>
						<Button 
							variant="primary" 
							size="sm" 
							classNames="flex-1"
							onclick={acceptAddress}
						>
							<CheckCircle2 class="mr-1 h-4 w-4" />
							Looks Good
						</Button>
					</div>
					
				{:else}
					<!-- Completion Step -->
					<div class="text-center mb-6">
						<div class="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4">
							<CheckCircle2 class="h-6 w-6 text-green-600" />
						</div>
						<h2 class="text-xl font-bold text-slate-900 mb-2">
							You're all set!
						</h2>
						<p class="text-slate-600">
							Your address has been saved and verified
						</p>
					</div>
				{/if}
			</div>
		{/key}
	</div>
</div>