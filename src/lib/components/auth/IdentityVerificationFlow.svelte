<script lang="ts">
	import { untrack } from 'svelte';
	import { ChevronLeft, Check } from '@lucide/svelte';

	import VerificationChoice from './address-steps/VerificationChoice.svelte';
	import VerificationValueProp from './address-steps/VerificationValueProp.svelte';
	import SelfXyzVerification from './address-steps/SelfXyzVerification.svelte';
	import DiditVerification from './address-steps/DiditVerification.svelte';
	import GovernmentCredentialVerification from './GovernmentCredentialVerification.svelte';

	interface Props {
		userId: string;
		templateSlug?: string;
		/** Skip value proposition (if already shown earlier in flow) */
		skipValueProp?: boolean;
		/** Default verification method (if user already made a choice) */
		defaultMethod?: 'nfc' | 'government-id' | 'mdl' | null;
		/**
		 * Census Block GEOID (15-digit cell identifier) for three-tree ZK architecture
		 * PRIVACY: Neighborhood-level precision (600-3000 people)
		 */
		cellId?: string;
		oncomplete?: (data: {
			verified: boolean;
			method: string;
			userId: string;
			district?: string;
			state?: string;
			address?: { street: string; city: string; state: string; zip: string };
			cell_id?: string;
			providerData?: {
				provider: 'self.xyz' | 'didit.me' | 'digital-credentials-api';
				credentialHash: string;
				issuedAt: number;
				expiresAt?: number;
			};
		}) => void;
		oncancel?: () => void;
		onback?: () => void;
	}

	let { userId, templateSlug, skipValueProp = false, defaultMethod = null, cellId, oncomplete, oncancel, onback }: Props = $props();

	type FlowStep = 'value-prop' | 'choice' | 'verify-nfc' | 'verify-id' | 'verify-mdl' | 'complete';

	let currentStep = $state<FlowStep>(untrack(() => skipValueProp ? 'choice' : 'value-prop'));
	let selectedMethod = $state<'nfc' | 'government-id' | 'mdl' | null>(untrack(() => defaultMethod));
	let verificationComplete = $state(false);
	let verificationData = $state<{
		verified: boolean;
		method: string;
		district?: string;
		state?: string;
		address?: { street: string; city: string; state: string; zip: string };
		cell_id?: string;
		providerData?: {
			provider: 'self.xyz' | 'didit.me' | 'digital-credentials-api';
			credentialHash: string;
			issuedAt: number;
			expiresAt?: number;
		};
	} | null>(null);

	function handleMethodSelection(data: { method: 'nfc' | 'government-id' | 'mdl' }) {
		selectedMethod = data.method;

		// Automatically advance to verification step
		if (selectedMethod === 'nfc') {
			currentStep = 'verify-nfc';
		} else if (selectedMethod === 'government-id') {
			currentStep = 'verify-id';
		} else if (selectedMethod === 'mdl') {
			currentStep = 'verify-mdl';
		}
	}

	async function handleVerificationComplete(data: {
		verified: boolean;
		method: string;
		district?: string;
		state?: string;
		address?: { street: string; city: string; state: string; zip: string };
		/**
		 * Census Block GEOID (15-digit cell identifier) for three-tree ZK architecture
		 * PRIVACY: Neighborhood-level precision (600-3000 people), encrypted at rest
		 */
		cell_id?: string;
		providerData?: {
			provider: 'self.xyz' | 'didit.me';
			credentialHash: string;
			issuedAt: number;
			expiresAt?: number;
		};
	}) {
		verificationComplete = true;
		verificationData = data;
		currentStep = 'complete';

		// Add verified location signal to IndexedDB (client-side only)
		// This is the highest confidence signal (1.0) in our 5-signal progressive inference
		if (data.district && data.state) {
			try {
				const { addVerifiedLocationSignal } = await import('$lib/core/location');
				await addVerifiedLocationSignal(data.district || '', data.state || '');
				console.log('[Verification] Added verified location signal:', {
					district: data.district,
					state: data.state
				});
			} catch (error) {
				console.error('[Verification] Failed to add location signal:', error);
			}
		}

		// Handle complete verification flow: encryption + storage + caching
		// This is the critical integration point that makes progressive verification work
		if (data.address && data.providerData) {
			try {
				// Step 1: Encrypt address and store blob (existing flow)
				const { handleVerificationComplete: processVerification } = await import(
					'$lib/core/identity/verification-handler'
				);

				const result = await processVerification(userId, {
					method: data.method as 'nfc-passport' | 'government-id',
					verified: data.verified,
					providerData: data.providerData,
					address: data.address,
					district: data.district
						? {
								congressional: data.district
							}
						: undefined
				});

				if (result.success) {
					console.log('[Verification Flow] Complete encryption/storage flow successful:', {
						blobId: result.blobId,
						sessionCached: !!result.sessionCredential
					});
				} else {
					console.error('[Verification Flow] Encryption/storage failed:', result.error);
					// Don't block UI - allow user to continue even if storage fails
					// They can retry later or verification can be re-triggered
				}

				// Step 2: Register in Shadow Atlas for ZK proof generation (new flow)
				if (data.district && data.providerData) {
					try {
						const { registerInShadowAtlas, generateIdentityCommitment } = await import(
							'$lib/core/identity/shadow-atlas-handler'
						);

						// Generate identity commitment from provider data
						const identityCommitment = await generateIdentityCommitment(data.providerData);

						// Register in Shadow Atlas (with cell_id for three-tree architecture)
						// Use cell_id from data if available, otherwise use cellId prop
						const resolvedCellId = data.cell_id || cellId;
						const atlasResult = await registerInShadowAtlas({
							userId,
							identityCommitment,
							congressionalDistrict: (data.district as string) || '',
							cellId: (resolvedCellId as string | undefined),
							verificationMethod:
								data.providerData.provider === 'self.xyz' ? 'self.xyz' : 'didit',
							verificationId: data.providerData.credentialHash
						} as any);

						if (atlasResult.success) {
							console.log('[Verification Flow] Shadow Atlas registration successful:', {
								district: data.district,
								leafIndex: atlasResult.sessionCredential?.leafIndex,
								expiresAt: atlasResult.sessionCredential?.expiresAt,
								credentialType: 'three-tree'
							});
						} else {
							console.error(
								'[Verification Flow] Shadow Atlas registration failed:',
								atlasResult.error
							);
							// Non-blocking error - user can still proceed
							// Proof generation will fail gracefully and prompt re-registration
						}
					} catch (error) {
						console.error('[Verification Flow] Failed to register in Shadow Atlas:', error);
						// Non-blocking error - log and continue
					}
				}
			} catch (error) {
				console.error('[Verification Flow] Failed to process verification:', error);
				// Non-blocking error - log and continue
			}
		}

		// Notify parent component
		oncomplete?.({
			...data,
			userId
		});
	}

	function handleVerificationError(data: { message: string }) {
		console.error('Verification error:', data.message);
		// Error handling is managed within child components
		// Could optionally dispatch to parent for additional handling
	}

	/**
	 * Handle mDL verification completion (callback props, not CustomEvent).
	 * GovernmentCredentialVerification uses Svelte 5 callback pattern.
	 */
	async function handleMdlComplete(data: {
		verified: boolean;
		method: string;
		district?: string;
		state?: string;
		address?: { street: string; city: string; state: string; zip: string };
		cell_id?: string;
		providerData?: {
			provider: 'digital-credentials-api';
			credentialHash: string;
			issuedAt: number;
		};
	}) {
		verificationComplete = true;
		verificationData = data;
		currentStep = 'complete';

		// Add verified location signal to IndexedDB (client-side only)
		if (data.district && data.state) {
			try {
				const { addVerifiedLocationSignal } = await import('$lib/core/location');
				await addVerifiedLocationSignal(data.district, data.state);
				console.log('[Verification] Added verified location signal:', {
					district: data.district,
					state: data.state
				});
			} catch (error) {
				console.error('[Verification] Failed to add location signal:', error);
			}
		}

		// Notify parent component
		oncomplete?.({
			...data,
			userId
		});
	}

	function handleMdlError(data: { message: string }) {
		console.error('mDL verification error:', data.message);
	}

	function handleMdlCancel() {
		currentStep = 'choice';
		selectedMethod = null;
	}

	function goBack() {
		if (currentStep === 'verify-nfc' || currentStep === 'verify-id' || currentStep === 'verify-mdl') {
			currentStep = 'choice';
			selectedMethod = null;
		} else if (currentStep === 'choice' && !skipValueProp) {
			currentStep = 'value-prop';
		} else {
			onback?.();
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
					{:else if currentStep === 'verify-nfc' || currentStep === 'verify-id' || currentStep === 'verify-mdl'}
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
					style="width: {currentStep === 'value-prop'
						? '33%'
						: currentStep === 'choice'
							? '66%'
							: '99%'}"
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
			<VerificationChoice defaultMethod={selectedMethod} onselect={handleMethodSelection} />
		{:else if currentStep === 'verify-nfc'}
			<!-- NFC Passport Verification -->
			<SelfXyzVerification
				{userId}
				{templateSlug}
				oncomplete={handleVerificationComplete}
				onerror={handleVerificationError}
			/>
		{:else if currentStep === 'verify-id'}
			<!-- Government ID Verification -->
			<DiditVerification
				{userId}
				{templateSlug}
				oncomplete={handleVerificationComplete}
				onerror={handleVerificationError}
			/>
		{:else if currentStep === 'verify-mdl'}
			<!-- mDL / Digital ID Verification (Svelte 5 callback props) -->
			<GovernmentCredentialVerification
				{userId}
				{templateSlug}
				oncomplete={handleMdlComplete}
				onerror={handleMdlError}
				oncancel={handleMdlCancel}
			/>
		{:else if currentStep === 'complete'}
			<!-- Success State -->
			<div class="py-12 text-center">
				<div
					class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-600 shadow-2xl"
				>
					<Check class="h-10 w-10 text-white" strokeWidth={3} />
				</div>

				<h2 class="mb-3 text-3xl font-bold text-slate-900">Verification Complete!</h2>

				<p class="mb-2 text-lg text-slate-600">Your identity has been successfully verified</p>

				<div class="mx-auto mb-8 max-w-md">
					<div class="mt-6 rounded-lg border border-green-200 bg-green-50 p-4">
						<p class="text-sm font-medium text-green-900">What happens next:</p>
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
						onclick={() => oncomplete?.({ ...verificationData!, userId })}
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
				Having trouble? <a
					href="/help/verification"
					class="font-medium text-blue-600 hover:text-blue-700">Get help with verification</a
				>
			</p>
		</div>
	{/if}
</div>
