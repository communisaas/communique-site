<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { fade, fly, scale } from 'svelte/transition';
	import { quintOut, backOut } from 'svelte/easing';
	import { 
		X, 
		MapPin,
		CheckCircle2,
		AlertCircle,
		Search,
		Home
	} from '@lucide/svelte';
	import Button from '../ui/Button.svelte';
	
	export let template: {
		title: string;
		deliveryMethod: string;
	};
	
	const dispatch = createEventDispatcher<{ 
		close: void; 
		complete: { address: string; verified: boolean; representatives?: any[] };
	}>();
	
	let currentStep: 'collect' | 'verify' | 'complete' = 'collect';
	let isTransitioning = false;
	
	// Prevent background scrolling when modal is open
	onMount(() => {
		document.body.style.overflow = 'hidden';
	});
	
	onDestroy(() => {
		document.body.style.overflow = '';
	});
	
	// Address form data
	let streetAddress = '';
	let city = '';
	let state = '';
	let zipCode = '';
	let addressError = '';
	let isVerifying = false;
	let verificationResult: any = null;
	let selectedAddress: string = '';
	
	function handleClose() {
		dispatch('close');
	}
	
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
		if (!state.trim()) {
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
			const fullAddress = `${streetAddress}, ${city}, ${state} ${zipCode}`;
			
			// Call stubbed USPS verification API
			const response = await fetch('/api/address/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					street: streetAddress,
					city,
					state,
					zipCode
				})
			});
			
			const result = await response.json();
			
			if (response.ok && result.verified) {
				verificationResult = result;
				selectedAddress = result.correctedAddress || fullAddress;
				currentStep = 'verify';
			} else {
				addressError = result.error || 'Unable to verify address. Please check and try again.';
			}
		} catch (error) {
			console.error('Address verification error:', error);
			addressError = 'Verification service temporarily unavailable. Please try again.';
		} finally {
			isVerifying = false;
		}
	}
	
	function acceptAddress() {
		dispatch('complete', {
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
		const fullAddress = `${streetAddress}, ${city}, ${state} ${zipCode}`;
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
				{#each ['collect', 'verify', 'complete'] as step, i}
					<div 
						class="h-2 rounded-full transition-all duration-500 ease-out {
							currentStep === step 
								? 'w-12 bg-blue-600 shadow-lg shadow-blue-200' 
								: ['collect', 'verify', 'complete'].indexOf(currentStep) > i 
									? 'w-8 bg-blue-300' 
									: 'w-8 bg-slate-200'
						}"
					/>
				{/each}
			</div>
		</div>
		
		<!-- Content -->
		<div class="relative overflow-hidden min-h-[450px]">
			{#key currentStep}
				<div 
					class="absolute inset-0 p-6 pt-2"
					in:fly={{ x: 20, duration: 400, delay: 300, easing: quintOut }}
					out:fly={{ x: -20, duration: 300, easing: quintOut }}
					on:keydown={handleKeydown}
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
									autofocus
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
										bind:value={state}
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
								on:click={verifyAddress}
								disabled={isVerifying || !streetAddress.trim() || !city.trim() || !state.trim() || !zipCode.trim()}
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
								on:click={skipVerification}
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
								on:click={editAddress}
							>
								Edit Address
							</Button>
							<Button 
								variant="primary" 
								size="sm" 
								classNames="flex-1"
								on:click={acceptAddress}
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
</div>