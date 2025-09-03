<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { createModalStore } from '$lib/stores/modalSystem';
	import UnifiedModal from '$lib/components/ui/UnifiedModal.svelte';
	import { AddressForm, AddressVerification, SelfXyzVerification, CompletionStep } from './address-steps';

	let {
		template,
		user,
		isOpen = true,
		onclose,
		oncomplete
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
		onclose?: () => void;
		oncomplete?: (payload: {
			address: string;
			verified: boolean;
			enhancedCredibility?: boolean;
		}) => void;
	} = $props();

	const dispatch = createEventDispatcher<{
		close: void;
		complete: { address: string; verified: boolean; enhancedCredibility?: boolean };
	}>();
	
	// Modal system integration
	const modalStore = createModalStore('address-requirement-modal', 'address');

	let currentStep = $state<'collect' | 'selfxyz' | 'verify' | 'complete'>('collect');
	let showSelfXyzOption = $state(false);
	let selfXyzQrCode = $state<string | null>(null);
	let selfXyzVerifying = $state(false);

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
		// Modal system handles cleanup
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
		onclose?.();
		dispatch('close');
		modalStore.close();
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

					oncomplete?.({ address: verifiedAddress, verified: true, enhancedCredibility: true });
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
		const name = Array.isArray(credentialSubject.name)
			? credentialSubject.name.join(' ')
			: credentialSubject.name;

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
			const payload = { address: selectedAddress, verified: true };
			oncomplete?.(payload);
			dispatch('complete', payload);
		}
	}

	function proceedWithBasicAddress() {
		const payload = { address: selectedAddress, verified: true };
		oncomplete?.(payload);
		dispatch('complete', payload);
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

<UnifiedModal
	bind:this={unifiedModal}
	id="address-requirement-modal"
	type="address"
	size="sm"
	closeOnBackdrop={true}
	closeOnEscape={true}
>
	{#snippet children(data)}
		<div class="flex-1 overflow-y-auto">
			{#key currentStep}
				<div
					class="min-h-0 p-6"
					in:fly={{ x: 20, duration: 400, delay: 300, easing: quintOut }}
					out:fly={{ x: -20, duration: 300, easing: quintOut }}
					onkeydown={handleKeydown}
				>
					{#if currentStep === 'collect'}
						<AddressForm
							{template}
							bind:streetAddress
							bind:city
							bind:stateCode
							bind:zipCode
							bind:addressError
							{isVerifying}
							onVerifyAddress={verifyAddress}
							onKeydown={handleKeydown}
						/>
					{:else if currentStep === 'verify'}
						<AddressVerification
							{selectedAddress}
							{verificationResult}
							onEditAddress={editAddress}
							onAcceptAddress={acceptAddress}
						/>
					{:else if currentStep === 'selfxyz'}
						<SelfXyzVerification {selfXyzQrCode} />
					{:else}
						<CompletionStep />
					{/if}
				</div>
			{/key}
		</div>
	{/snippet}
</UnifiedModal>
