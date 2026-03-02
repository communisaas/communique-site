<script lang="ts">
	import { untrack } from 'svelte';
	import { ChevronLeft, Check } from '@lucide/svelte';

	import VerificationValueProp from './address-steps/VerificationValueProp.svelte';
	import GovernmentCredentialVerification from './GovernmentCredentialVerification.svelte';

	interface Props {
		userId: string;
		templateSlug?: string;
		/** Skip value proposition (if already shown earlier in flow) */
		skipValueProp?: boolean;
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
				provider: 'digital-credentials-api';
				credentialHash: string;
				issuedAt: number;
				expiresAt?: number;
			};
		}) => void;
		oncancel?: () => void;
		onback?: () => void;
	}

	let { userId, templateSlug, skipValueProp = false, cellId, oncomplete, oncancel, onback }: Props = $props();

	type FlowStep = 'value-prop' | 'verify-mdl' | 'complete';

	let currentStep = $state<FlowStep>(untrack(() => skipValueProp ? 'verify-mdl' : 'value-prop'));
	let verificationComplete = $state(false);
	let registrationInProgress = $state(false);
	let registrationError = $state<string | null>(null);
	let verificationData = $state<{
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
			expiresAt?: number;
		};
	} | null>(null);

	/**
	 * Handle mDL verification completion (callback props, not CustomEvent).
	 * GovernmentCredentialVerification uses Svelte 5 callback pattern.
	 *
	 * After identity verification succeeds, triggers Shadow Atlas three-tree
	 * registration so the user can generate ZK proofs for congressional submissions.
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

		// Trigger Shadow Atlas three-tree registration (non-blocking)
		// This registers the user's leaf hash in Tree 1 and fetches Tree 2/3 proofs,
		// enabling ZK proof generation for congressional submissions.
		if (cellId) {
			triggerShadowAtlasRegistration(data.cell_id ?? cellId);
		} else {
			console.warn('[Verification] No cellId available — Shadow Atlas registration deferred');
		}

		// Notify parent component
		oncomplete?.({
			...data,
			userId
		});
	}

	/**
	 * Register in Shadow Atlas three-tree architecture after identity verification.
	 *
	 * Generates client-side secrets (userSecret, registrationSalt) that NEVER
	 * leave the browser. Only the leaf hash (H4 of secrets + cellId + authorityLevel)
	 * is sent to the server.
	 */
	async function triggerShadowAtlasRegistration(resolvedCellId: string) {
		registrationInProgress = true;
		registrationError = null;

		try {
			const { registerThreeTree } = await import('$lib/core/identity/shadow-atlas-handler');
			const { poseidon2Hash4 } = await import('$lib/core/crypto/poseidon');

			// Generate client-side secrets (never sent to server)
			const userSecretBytes = new Uint8Array(32);
			const registrationSaltBytes = new Uint8Array(32);
			crypto.getRandomValues(userSecretBytes);
			crypto.getRandomValues(registrationSaltBytes);

			const userSecret =
				'0x' +
				Array.from(userSecretBytes)
					.map((b) => b.toString(16).padStart(2, '0'))
					.join('');
			const registrationSalt =
				'0x' +
				Array.from(registrationSaltBytes)
					.map((b) => b.toString(16).padStart(2, '0'))
					.join('');

			// Encode cellId (Census GEOID like "060750102001001") as a BN254 field element
			const cellIdBigInt = BigInt(resolvedCellId);
			const cellIdHex = '0x' + cellIdBigInt.toString(16).padStart(64, '0');

			// Encode authority level as a field element
			const authorityLevel = 5; // mDL = highest authority
			const authorityHex = '0x' + authorityLevel.toString(16).padStart(64, '0');

			// Compute leaf: Poseidon2_H4(userSecret, cellId, registrationSalt, authorityLevel)
			// Uses 2-round sponge with DOMAIN_HASH4 — matches Noir circuit exactly
			const leaf = await poseidon2Hash4(userSecret, cellIdHex, registrationSalt, authorityHex);

			const result = await registerThreeTree({
				userId,
				leaf,
				cellId: resolvedCellId,
				userSecret,
				registrationSalt,
				verificationMethod: 'digital-credentials-api'
			});

			if (result.success) {
				console.log('[Verification] Shadow Atlas registration complete:', {
					leafIndex: result.sessionCredential?.leafIndex,
					districts: result.sessionCredential?.districts?.length ?? 0,
					engagementTier: result.sessionCredential?.engagementTier ?? 0
				});
			} else {
				console.error('[Verification] Shadow Atlas registration failed:', result.error);
				registrationError = result.error ?? 'Registration failed';
			}
		} catch (error) {
			console.error('[Verification] Shadow Atlas registration error:', error);
			registrationError = error instanceof Error ? error.message : 'Unknown error';
		} finally {
			registrationInProgress = false;
		}
	}

	function handleMdlError(data: { message: string }) {
		console.error('mDL verification error:', data.message);
	}

	function handleMdlCancel() {
		// Since mDL is the only method, canceling goes back to value-prop or parent
		if (!skipValueProp) {
			currentStep = 'value-prop';
		} else {
			onback?.();
		}
	}

	function goBack() {
		if (currentStep === 'verify-mdl' && !skipValueProp) {
			currentStep = 'value-prop';
		} else {
			onback?.();
		}
	}

	function proceedFromValueProp() {
		currentStep = 'verify-mdl';
	}
</script>

<div class="mx-auto max-w-3xl">
	<!-- Progress Indicator -->
	{#if !verificationComplete}
		<div class="mb-8">
			<div class="flex items-center justify-between text-sm">
				<span class="font-medium text-slate-700">
					{#if currentStep === 'value-prop'}
						Step 1 of 2: Understand Verification
					{:else if currentStep === 'verify-mdl'}
						Step 2 of 2: Complete Verification
					{/if}
				</span>
				<span class="text-slate-500">
					{#if currentStep === 'value-prop'}
						50%
					{:else}
						99%
					{/if}
				</span>
			</div>
			<div class="mt-2 h-2 w-full rounded-full bg-slate-200">
				<div
					class="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-500"
					style="width: {currentStep === 'value-prop' ? '50%' : '99%'}"
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
								<span>Congressional offices will prioritize your message</span>
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
