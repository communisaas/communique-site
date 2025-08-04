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
		Home,
		Shield,
		ExternalLink,
		Info,
		QrCode,
		Smartphone
	} from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import VerificationBadge from '$lib/components/ui/VerificationBadge.svelte';
	
	let { 
		template,
		user,
		isOpen = true
	}: {
		template: {
			title: string;
			deliveryMethod: string;
			slug: string;
		};
		user?: {
			name?: string | null;
			is_verified?: boolean;
		} | null;
		isOpen?: boolean;
	} = $props();
	
	const dispatch = createEventDispatcher<{ 
		close: void; 
		complete: { address: string; verified: boolean; enhancedCredibility?: boolean };
	}>();
	
	let currentStep = $state<'collect' | 'selfxyz' | 'verify' | 'complete'>('collect');
	let showSelfXyzOption = $state(false);
	let selfXyzQrCode = $state<string | null>(null);
	let selfXyzVerifying = $state(false);
	
	// Prevent background scrolling when modal is open
	onMount(() => {
		if (isOpen) {
			document.body.style.overflow = 'hidden';
		}
	});
	
	onDestroy(() => {
		document.body.style.overflow = '';
	});
	
	// Address form data
	let streetAddress = $state('');
	let city = $state('');
	let stateCode = $state('');
	let zipCode = $state('');
	let addressError = $state('');
	let isVerifying = $state(false);
	let verificationResult = $state<Record<string, unknown> | null>(null);
	let selectedAddress = $state('');
	
	function handleClose() {
		document.body.style.overflow = '';
		dispatch('close');
	}
	
	function offerSelfXyzUpgrade() {
		currentStep = 'selfxyz';
	}
	
	async function initiateSelfXyzVerification() {
		currentStep = 'selfxyz';
		selfXyzVerifying = true;
		
		try {
			// Generate a unique user ID for this verification session
			const userId = crypto.randomUUID();
			
			// Call backend to create Self.xyz verification session
			const response = await fetch('/api/identity/init', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					userId,
					templateSlug: template.slug,
					requireAddress: true, // We need nationality/issuing state for rep lookup
					disclosures: {
						nationality: true,
						issuing_state: true,
						name: true,
						minimumAge: 18,
						ofac: true
					}
				})
			});
			
			const result = await response.json();
			
			if (result.success) {
				selfXyzQrCode = result.qrCodeData;
				// Start polling for verification completion
				pollForSelfXyzCompletion(userId);
			} else {
				// Fallback to manual address entry
				currentStep = 'collect';
			}
		} catch (error) {
			// Fallback to manual address entry
			currentStep = 'collect';
		} finally {
			selfXyzVerifying = false;
		}
	}
	
	async function pollForSelfXyzCompletion(userId: string) {
		const pollInterval = setInterval(async () => {
			try {
				const response = await fetch(`/api/identity/status/${userId}`);
				const result = await response.json();
				
				if (result.verified) {
					clearInterval(pollInterval);
					
					// Extract address from nationality/issuing state
					const verifiedAddress = extractAddressFromSelfXyz(result.credentialSubject);
					
					dispatch('complete', {
						address: verifiedAddress,
						verified: true,
						enhancedCredibility: true
					});
				} else if (result.failed) {
					clearInterval(pollInterval);
					// Fallback to manual address entry
					currentStep = 'collect';
				}
			} catch (error) {
				// Continue polling or fallback after timeout
			}
		}, 2000);
		
		// Stop polling after 5 minutes
		setTimeout(() => {
			clearInterval(pollInterval);
			if (currentStep === 'selfxyz') {
				currentStep = 'collect';
			}
		}, 300000);
	}
	
	function extractAddressFromSelfXyz(credentialSubject: any): string {
		// For congressional routing, we use nationality/issuing_state
		// This provides the country-level routing needed for representatives
		const country = credentialSubject.nationality || credentialSubject.issuing_state;
		const name = Array.isArray(credentialSubject.name) ? credentialSubject.name.join(' ') : credentialSubject.name;
		
		return `${name} - Verified ${country} Citizen (Self.xyz)`;
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
			
			// Call API for address verification
			const response = await fetch('/api/address/verify', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					street: streetAddress,
					city,
					state: stateCode,
					zipCode
				})
			});
			
			const result = await response.json();
			
			if (response.ok && result.success && result.data?.verified) {
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
		// If user is not verified, offer Self.xyz upgrade
		if (user && !user.is_verified) {
			currentStep = 'selfxyz';
		} else {
			// Proceed with standard address verification
			dispatch('complete', {
				address: selectedAddress,
				verified: true
			});
		}
	}
	
	function proceedWithBasicAddress() {
		dispatch('complete', {
			address: selectedAddress,
			verified: true
		});
	}
	
	function editAddress() {
		currentStep = 'collect';
		verificationResult = null;
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

{#if isOpen}
<div 
	class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm modal-backdrop"
	onclick={handleClose}
	in:fade={{ duration: 300, easing: quintOut }}
	out:fade={{ duration: 200 }}
>
	<div 
		class="fixed inset-x-4 top-1/2 mx-auto max-w-md -translate-y-1/2 transform overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col max-h-[85vh]"
		onclick={(e) => { e.stopPropagation(); }}
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
			class="absolute right-2 top-2 z-10 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
		>
			<X class="h-4 w-4" />
		</button>
		
		<!-- Content -->
		<div class="flex-1 overflow-y-auto">
			{#key currentStep}
				<div 
					class="p-6 min-h-0"
					in:fly={{ x: 20, duration: 400, delay: 300, easing: quintOut }}
					out:fly={{ x: -20, duration: 300, easing: quintOut }}
					onkeydown={handleKeydown}
				>
					{#if currentStep === 'collect'}
						<!-- Address Collection Step -->
						<div class="text-center mb-6">
							<h2 class="mb-2 text-xl font-bold text-slate-900">
								Enter Your Address
							</h2>
							<p class="text-sm text-slate-600">
								Congressional messages need your address to route to the correct representatives
							</p>
						</div>
						
						<!-- Template Context -->
						<div class="mb-6 p-3 bg-slate-50 rounded-lg border border-slate-200">
							<div class="flex items-center gap-2">
								<Info class="w-4 h-4 text-slate-500" />
								<span class="text-sm text-slate-700">You're sending: <strong>{template.title}</strong></span>
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
						
					{:else if currentStep === 'selfxyz'}
						<!-- Self.xyz Enhancement Option -->
						<div class="text-center mb-6">
							<h2 class="mb-2 text-xl font-bold text-slate-900">
								Boost Your Impact
							</h2>
							<p class="text-sm text-slate-600">
								Verify your identity with Self.xyz for enhanced credibility with representatives
							</p>
						</div>
						
						<!-- Enhanced Credibility Explanation -->
						<div class="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
							<div class="flex items-start gap-3">
								<Shield class="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
								<div class="flex-1">
									<h3 class="text-sm font-semibold text-blue-900 mb-1">
										Enhanced Credibility Available
									</h3>
									<p class="text-xs text-blue-700">
										Passport verification through Self.xyz adds significant weight to your message with congressional offices.
									</p>
								</div>
							</div>
						</div>
						
						<!-- QR Code Display -->
						{#if selfXyzQrCode}
							<div class="flex justify-center mb-6">
								<div class="p-4 bg-white rounded-lg border border-slate-200">
									<div class="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center">
										<div class="text-center">
											<QrCode class="h-12 w-12 text-gray-400 mx-auto mb-2" />
											<p class="text-xs text-gray-500">QR Code: {selfXyzQrCode.slice(0, 20)}...</p>
											<p class="text-xs text-gray-400 mt-1">Use Self.xyz app to scan</p>
										</div>
									</div>
								</div>
							</div>
							
							<!-- Instructions -->
							<div class="space-y-3 mb-4">
								<div class="flex items-start gap-3 p-3 bg-indigo-50 rounded-lg">
									<Smartphone class="h-4 w-4 text-indigo-600 mt-0.5 shrink-0" />
									<div>
										<h3 class="text-sm font-medium text-indigo-900">1. Open Self App</h3>
										<p class="text-xs text-indigo-700 mt-1">Download Self.xyz app</p>
									</div>
								</div>
								
								<div class="flex items-start gap-3 p-3 bg-indigo-50 rounded-lg">
									<QrCode class="h-4 w-4 text-indigo-600 mt-0.5 shrink-0" />
									<div>
										<h3 class="text-sm font-medium text-indigo-900">2. Scan Code</h3>
										<p class="text-xs text-indigo-700 mt-1">Point camera at QR code</p>
									</div>
								</div>
								
								<div class="flex items-start gap-3 p-3 bg-indigo-50 rounded-lg">
									<Shield class="h-4 w-4 text-indigo-600 mt-0.5 shrink-0" />
									<div>
										<h3 class="text-sm font-medium text-indigo-900">3. Verify Passport</h3>
										<p class="text-xs text-indigo-700 mt-1">Follow app instructions</p>
									</div>
								</div>
							</div>
							
							<!-- Waiting Status -->
							<div class="text-center mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
								<div class="flex items-center justify-center gap-2 text-slate-600">
									<div class="flex gap-1">
										<div class="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></div>
										<div class="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
										<div class="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
									</div>
									<span class="text-sm">Waiting for verification...</span>
								</div>
							</div>
						{:else}
							<div class="space-y-3 mb-4">
								<Button 
									variant="primary"
									size="sm" 
									classNames="w-full"
									onclick={initiateSelfXyzVerification}
									disabled={selfXyzVerifying}
								>
									<Shield class="mr-2 h-4 w-4" />
									{selfXyzVerifying ? 'Starting...' : 'Verify with Self.xyz'}
									<QrCode class="ml-2 h-4 w-4" />
								</Button>
							</div>
						{/if}
						
						<div class="space-y-3">
							<Button 
								variant="secondary" 
								size="sm" 
								classNames="w-full"
								onclick={proceedWithBasicAddress}
							>
								Continue without Verification
							</Button>
							
							<Button 
								variant="ghost" 
								size="sm" 
								classNames="w-full text-slate-500"
								onclick={handleClose}
							>
								Cancel
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
{/if}