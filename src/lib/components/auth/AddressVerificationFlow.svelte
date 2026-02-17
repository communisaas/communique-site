<!--
  AddressVerificationFlow.svelte — Wave 3A

  Standalone Tier 2 address-only verification flow.
  Collects address, geocodes via Census Bureau, shows matched district,
  then issues a DistrictCredential via /api/identity/verify-address.

  Flow: address-input -> verifying -> confirm-district -> issuing-credential -> complete
-->

<script lang="ts">
	import { MapPin, CheckCircle2, Loader2, AlertCircle, Building2, ChevronRight } from '@lucide/svelte';
	import { invalidateAll } from '$app/navigation';
	import { storeCredential } from '$lib/core/identity/credential-store';

	type FlowStep = 'address-input' | 'verifying' | 'confirm-district' | 'issuing-credential' | 'complete';

	let { userId, onComplete, onCancel }: {
		userId: string;
		onComplete?: (detail: { district: string; method: string }) => void;
		onCancel?: () => void;
	} = $props();

	// Form fields (never name a variable "state" — conflicts with $state rune)
	let street: string = $state('');
	let city: string = $state('');
	let stateCode: string = $state('');
	let zipCode: string = $state('');

	// Flow state
	let flowStep: FlowStep = $state('address-input');
	let errorMessage: string = $state('');

	// Verification results from /api/address/verify
	let verifiedDistrict: string = $state('');
	let verifiedStateSenate: string = $state('');
	let verifiedStateAssembly: string = $state('');
	let correctedAddress: string = $state('');
	let representatives: Array<{
		name: string;
		office: string;
		chamber: string;
		party: string;
		district?: string;
	}> = $state([]);

	// Derived: form validation
	let isFormValid: boolean = $derived(
		street.trim().length > 0 &&
		city.trim().length > 0 &&
		stateCode.trim().length === 2 &&
		/^\d{5}(-\d{4})?$/.test(zipCode.trim())
	);

	/**
	 * Step 1: Submit address to Census geocoder
	 */
	async function handleVerifyAddress() {
		if (!isFormValid) return;

		flowStep = 'verifying';
		errorMessage = '';

		try {
			const response = await fetch('/api/address/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					street: street.trim(),
					city: city.trim(),
					state: stateCode.trim().toUpperCase(),
					zipCode: zipCode.trim()
				})
			});

			const data = await response.json();

			if (!response.ok || !data.verified) {
				errorMessage = data.error || 'Address verification failed. Please check your address and try again.';
				flowStep = 'address-input';
				return;
			}

			// Store verification results
			verifiedDistrict = data.district || '';
			correctedAddress = data.correctedAddress || '';
			representatives = data.representatives || [];

			// Extract state-level districts from Census data if available
			// (The Census geocoder response may include state legislative districts)
			verifiedStateSenate = '';
			verifiedStateAssembly = '';

			flowStep = 'confirm-district';
		} catch (err) {
			console.error('[AddressVerificationFlow] Geocoding error:', err);
			errorMessage = 'Unable to verify address. Please try again.';
			flowStep = 'address-input';
		}
	}

	/**
	 * Step 2: Confirm district and issue credential
	 */
	async function handleConfirmDistrict() {
		flowStep = 'issuing-credential';
		errorMessage = '';

		try {
			const response = await fetch('/api/identity/verify-address', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					district: verifiedDistrict,
					state_senate_district: verifiedStateSenate || undefined,
					state_assembly_district: verifiedStateAssembly || undefined,
					verification_method: 'civic_api'
				})
			});

			const data = await response.json();

			if (!response.ok) {
				errorMessage = data.error || 'Failed to issue district credential. Please try again.';
				flowStep = 'confirm-district';
				return;
			}

			// Store credential in IndexedDB wallet for offline access
			if (data.credential) {
				await storeCredential(
					userId,
					'district_residency',
					data.credential,
					data.credential.expirationDate
				);
			}

			// Refresh session data so trust_tier reflects the upgrade
			await invalidateAll();

			flowStep = 'complete';

			// Notify parent after a brief delay to show success state
			setTimeout(() => {
				onComplete?.({ district: verifiedDistrict, method: 'civic_api' });
			}, 1500);
		} catch (err) {
			console.error('[AddressVerificationFlow] Credential issuance error:', err);
			errorMessage = 'Unable to issue credential. Please try again.';
			flowStep = 'confirm-district';
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && isFormValid && flowStep === 'address-input') {
			handleVerifyAddress();
		}
	}

	function handleCancel() {
		onCancel?.();
	}

	function handleEditAddress() {
		flowStep = 'address-input';
		errorMessage = '';
	}
</script>

<div class="mx-auto w-full max-w-lg">
	<!-- Step Indicator -->
	<div class="mb-6 flex items-center justify-center gap-2">
		{#each ['address-input', 'confirm-district', 'complete'] as step, i}
			{@const stepLabels = ['Address', 'Confirm', 'Done']}
			{@const stepIndex = ['address-input', 'confirm-district', 'complete'].indexOf(flowStep)}
			{@const isActive = i <= stepIndex || flowStep === 'verifying' && i === 0 || flowStep === 'issuing-credential' && i <= 1}
			<div class="flex items-center gap-2">
				<div
					class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-300"
					class:bg-emerald-600={isActive}
					class:text-white={isActive}
					class:bg-slate-200={!isActive}
					class:text-slate-500={!isActive}
				>
					{#if i < stepIndex || (flowStep === 'complete' && i <= 2)}
						<CheckCircle2 class="h-4 w-4" />
					{:else}
						{i + 1}
					{/if}
				</div>
				<span class="text-xs font-medium" class:text-emerald-700={isActive} class:text-slate-400={!isActive}>
					{stepLabels[i]}
				</span>
				{#if i < 2}
					<ChevronRight class="h-3 w-3 text-slate-300" />
				{/if}
			</div>
		{/each}
	</div>

	<!-- ADDRESS INPUT STEP -->
	{#if flowStep === 'address-input'}
		<div class="space-y-5">
			<div class="text-center">
				<div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
					<MapPin class="h-6 w-6 text-emerald-600" />
				</div>
				<h3 class="text-lg font-semibold text-slate-900">Verify Your Address</h3>
				<p class="mt-1 text-sm text-slate-600">
					Confirm your district to send messages to your representatives.
				</p>
				<p class="mt-1 text-xs font-medium text-emerald-700">
					Address used once for verification, then deleted.
				</p>
			</div>

			<div class="space-y-3">
				<div>
					<label for="avf-street" class="mb-1 block text-sm font-medium text-slate-700">
						Street Address
					</label>
					<input
						id="avf-street"
						type="text"
						bind:value={street}
						placeholder="123 Main Street"
						class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
						onkeydown={handleKeydown}
					/>
				</div>

				<div class="grid grid-cols-6 gap-3">
					<div class="col-span-3">
						<label for="avf-city" class="mb-1 block text-sm font-medium text-slate-700">City</label>
						<input
							id="avf-city"
							type="text"
							bind:value={city}
							placeholder="San Francisco"
							class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							onkeydown={handleKeydown}
						/>
					</div>
					<div class="col-span-1">
						<label for="avf-state" class="mb-1 block text-sm font-medium text-slate-700">State</label>
						<input
							id="avf-state"
							type="text"
							bind:value={stateCode}
							placeholder="CA"
							maxlength={2}
							class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-center text-sm uppercase transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							onkeydown={handleKeydown}
						/>
					</div>
					<div class="col-span-2">
						<label for="avf-zip" class="mb-1 block text-sm font-medium text-slate-700">ZIP</label>
						<input
							id="avf-zip"
							type="text"
							bind:value={zipCode}
							placeholder="94102"
							maxlength={10}
							class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							onkeydown={handleKeydown}
						/>
					</div>
				</div>
			</div>

			{#if errorMessage}
				<div class="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
					<AlertCircle class="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
					<p class="text-sm text-red-700">{errorMessage}</p>
				</div>
			{/if}

			<button
				type="button"
				class="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
				onclick={handleVerifyAddress}
				disabled={!isFormValid}
			>
				<MapPin class="h-4 w-4" />
				Verify Address
			</button>

			{#if onCancel}
				<button
					type="button"
					class="w-full text-center text-sm text-slate-500 transition-colors hover:text-slate-700"
					onclick={handleCancel}
				>
					Cancel
				</button>
			{/if}

			<!-- Privacy note -->
			<details class="text-center">
				<summary class="cursor-pointer text-xs text-slate-400 hover:text-slate-600">
					How is my address used?
				</summary>
				<p class="mt-2 text-xs leading-relaxed text-slate-500">
					Your address is sent to the U.S. Census Bureau to determine your congressional district.
					After verification, the address is permanently deleted. Only your district is stored
					as a verifiable credential.
				</p>
			</details>
		</div>

	<!-- VERIFYING STEP (loading) -->
	{:else if flowStep === 'verifying'}
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
				<Loader2 class="h-8 w-8 animate-spin text-emerald-600" />
			</div>
			<h3 class="text-lg font-semibold text-slate-900">Verifying Address</h3>
			<p class="mt-2 text-sm text-slate-600">
				Looking up your congressional district...
			</p>
		</div>

	<!-- CONFIRM DISTRICT STEP -->
	{:else if flowStep === 'confirm-district'}
		<div class="space-y-5">
			<div class="text-center">
				<div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
					<Building2 class="h-6 w-6 text-emerald-600" />
				</div>
				<h3 class="text-lg font-semibold text-slate-900">Your District</h3>
				<p class="mt-1 text-sm text-slate-600">
					Confirm this is correct to receive your district credential.
				</p>
			</div>

			<!-- District Card -->
			<div class="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-5">
				<div class="mb-3 flex items-center gap-2">
					<MapPin class="h-5 w-5 text-emerald-600" />
					<span class="text-lg font-bold text-emerald-900">{verifiedDistrict}</span>
				</div>
				{#if correctedAddress}
					<p class="mb-3 text-xs text-slate-500">
						Verified address: {correctedAddress}
					</p>
				{/if}

				<!-- Representatives -->
				{#if representatives.length > 0}
					<div class="space-y-2">
						<p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Your Representatives</p>
						{#each representatives as rep}
							<div class="flex items-center gap-3 rounded-lg bg-white/70 px-3 py-2">
								<div class="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
									{rep.chamber === 'house' ? 'H' : 'S'}
								</div>
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm font-medium text-slate-900">{rep.name}</p>
									<p class="truncate text-xs text-slate-500">{rep.office}</p>
								</div>
								{#if rep.party}
									<span class="text-xs font-medium text-slate-400">({rep.party})</span>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>

			{#if errorMessage}
				<div class="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
					<AlertCircle class="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
					<p class="text-sm text-red-700">{errorMessage}</p>
				</div>
			{/if}

			<div class="flex gap-3">
				<button
					type="button"
					class="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
					onclick={handleEditAddress}
				>
					Edit Address
				</button>
				<button
					type="button"
					class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-emerald-700"
					onclick={handleConfirmDistrict}
				>
					<CheckCircle2 class="h-4 w-4" />
					Confirm &amp; Get Credential
				</button>
			</div>
		</div>

	<!-- ISSUING CREDENTIAL STEP (loading) -->
	{:else if flowStep === 'issuing-credential'}
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-100">
				<Loader2 class="h-8 w-8 animate-spin text-teal-600" />
			</div>
			<h3 class="text-lg font-semibold text-slate-900">Issuing Credential</h3>
			<p class="mt-2 text-sm text-slate-600">
				Creating your verifiable district credential...
			</p>
		</div>

	<!-- COMPLETE STEP -->
	{:else if flowStep === 'complete'}
		<div class="flex flex-col items-center justify-center py-8 text-center">
			<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
				<CheckCircle2 class="h-8 w-8 text-emerald-600" />
			</div>
			<h3 class="text-lg font-bold text-emerald-900">District Verified</h3>
			<p class="mt-2 text-sm text-slate-600">
				You're verified as a constituent of <strong class="text-emerald-700">{verifiedDistrict}</strong>.
			</p>
			<p class="mt-1 text-xs text-slate-500">
				You can now send messages to your representatives.
			</p>

			<div class="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
				<div class="flex items-center gap-2 text-sm font-medium text-emerald-800">
					<CheckCircle2 class="h-4 w-4" />
					Trust Tier 2: Address Attested
				</div>
			</div>
		</div>
	{/if}
</div>
