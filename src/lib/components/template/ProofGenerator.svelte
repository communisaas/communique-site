<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { ShieldCheck, AlertCircle, Check, Loader2 } from 'lucide-svelte';

	interface Props {
		userId: string;
		templateId: string;
		templateData: {
			subject: string;
			message: string;
			recipientOffices: string[];
		};
		/** Skip credential check (for testing) */
		skipCredentialCheck?: boolean;
	}

	let { userId, templateId, templateData, skipCredentialCheck = false }: Props = $props();

	type ProofGenerationState =
		| { status: 'idle' }
		| { status: 'loading-credential' }
		| { status: 'initializing-prover'; progress: number }
		| { status: 'generating-proof'; progress: number }
		| { status: 'encrypting-witness' }
		| { status: 'submitting' }
		| { status: 'complete'; submissionId: string }
		| { status: 'error'; message: string; recoverable: boolean; retryAction?: () => void };

	let state = $state<ProofGenerationState>({ status: 'idle' });
	let educationIndex = $state(0);

	const dispatch = createEventDispatcher<{
		complete: { submissionId: string };
		cancel: void;
		error: { message: string };
	}>();

	// Educational messages that cycle during proof generation
	const educationalMessages = [
		{ icon: '✓', text: 'Your exact address stays private' },
		{
			icon: '✓',
			text: 'Congressional staff see: "Verified constituent from your district"'
		},
		{ icon: '✓', text: 'Building your civic reputation on-chain' }
	];

	// Cycle educational messages every 3 seconds during proof generation
	$effect(() => {
		if (state.status === 'generating-proof') {
			const interval = setInterval(() => {
				educationIndex = (educationIndex + 1) % educationalMessages.length;
			}, 3000);
			return () => clearInterval(interval);
		}
	});

	/**
	 * Main proof generation flow
	 */
	async function generateAndSubmit() {
		try {
			// Step 1: Load session credential from IndexedDB
			state = { status: 'loading-credential' };

			const { getSessionCredential } = await import('$lib/core/identity/session-credentials');
			const credential = await getSessionCredential(userId);

			if (!credential && !skipCredentialCheck) {
				state = {
					status: 'error',
					message: 'Session credential not found. Please verify your identity first.',
					recoverable: true,
					retryAction: () => {
						dispatch('cancel');
						// Parent component should redirect to identity verification
					}
				};
				return;
			}

			// Step 2: Initialize WASM prover (load circuit, trusted setup)
			state = { status: 'initializing-prover', progress: 0 };

			const { initializeProver } = await import('$lib/core/proof/prover');
			await initializeProver((progress) => {
				if (state.status === 'initializing-prover') {
					state = { status: 'initializing-prover', progress };
				}
			});

			// Step 3: Generate ZK proof (2-5s desktop, 8-15s mobile)
			state = { status: 'generating-proof', progress: 0 };

			const { generateProof } = await import('$lib/core/proof/prover');

			// Build witness inputs
			const witness = {
				identityCommitment: credential!.identityCommitment,
				leafIndex: credential!.leafIndex,
				merklePath: credential!.merklePath,
				merkleRoot: credential!.merkleRoot,
				actionId: templateId,
				timestamp: Date.now()
			};

			const proofResult = await generateProof(witness, (progress) => {
				if (state.status === 'generating-proof') {
					state = { status: 'generating-proof', progress };
				}
			});

			if (!proofResult.success) {
				state = {
					status: 'error',
					message: 'Proof generation failed. Please try again.',
					recoverable: true,
					retryAction: () => generateAndSubmit()
				};
				return;
			}

			// Step 4: Encrypt witness to TEE public key
			state = { status: 'encrypting-witness' };

			const { encryptWitness } = await import('$lib/core/proof/witness-encryption');
			const encryptedWitness = await encryptWitness(witness);

			// Step 5: Submit to backend
			state = { status: 'submitting' };

			const response = await fetch('/api/submissions/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					templateId,
					proof: proofResult.proof,
					publicInputs: proofResult.publicInputs,
					nullifier: proofResult.nullifier,
					encryptedWitness: encryptedWitness.ciphertext,
					witnessNonce: encryptedWitness.nonce,
					ephemeralPublicKey: encryptedWitness.ephemeralPublicKey,
					teeKeyId: encryptedWitness.teeKeyId,
					templateData
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				state = {
					status: 'error',
					message: errorData.error || 'Submission failed. Please try again.',
					recoverable: true,
					retryAction: () => generateAndSubmit()
				};
				return;
			}

			const data = await response.json();

			// Success!
			state = { status: 'complete', submissionId: data.submissionId };
			dispatch('complete', { submissionId: data.submissionId });
		} catch (error) {
			console.error('[ProofGenerator] Generation failed:', error);
			state = {
				status: 'error',
				message:
					error instanceof Error
						? error.message
						: 'An unexpected error occurred. Please try again.',
				recoverable: true,
				retryAction: () => generateAndSubmit()
			};
			dispatch('error', { message: state.message });
		}
	}

	function handleRetry() {
		if (state.status === 'error' && state.retryAction) {
			state.retryAction();
		}
	}

	function handleCancel() {
		dispatch('cancel');
	}
</script>

<div class="proof-generator">
	{#if state.status === 'idle'}
		<!-- Initial state - show preview and submit button -->
		<div class="space-y-6">
			<div class="rounded-lg border border-slate-200 bg-white p-6">
				<h3 class="mb-4 text-lg font-semibold text-slate-900">Ready to send</h3>

				<div class="space-y-3">
					<div>
						<p class="text-sm font-medium text-slate-700">Subject:</p>
						<p class="text-sm text-slate-600">{templateData.subject}</p>
					</div>

					<div>
						<p class="text-sm font-medium text-slate-700">Recipients:</p>
						<p class="text-sm text-slate-600">
							{templateData.recipientOffices.length} congressional
							{templateData.recipientOffices.length === 1 ? 'office' : 'offices'}
						</p>
					</div>

					<div class="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
						<p class="mb-2 font-medium">Privacy Protection:</p>
						<ul class="space-y-1 text-sm">
							<li class="flex items-start gap-2">
								<span class="text-blue-600">✓</span>
								<span>Your message will be delivered anonymously</span>
							</li>
							<li class="flex items-start gap-2">
								<span class="text-blue-600">✓</span>
								<span>Congressional staff will only see "Verified constituent"</span>
							</li>
							<li class="flex items-start gap-2">
								<span class="text-blue-600">✓</span>
								<span>Your reputation will be updated on-chain</span>
							</li>
						</ul>
					</div>
				</div>
			</div>

			<div class="flex gap-3">
				<button
					type="button"
					onclick={handleCancel}
					class="flex-1 rounded-lg border border-slate-300 bg-white px-6 py-3 text-base font-semibold text-slate-700 transition-colors hover:bg-slate-50"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={generateAndSubmit}
					class="flex-1 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-lg transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl"
				>
					Send to Representative
				</button>
			</div>
		</div>
	{:else if state.status === 'loading-credential'}
		<!-- Loading session credential -->
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<Loader2 class="mb-4 h-12 w-12 animate-spin text-blue-600" />
			<h3 class="mb-2 text-lg font-semibold text-slate-900">Loading credentials...</h3>
			<p class="text-sm text-slate-600">Retrieving your verification status</p>
		</div>
	{:else if state.status === 'initializing-prover'}
		<!-- Initializing WASM prover -->
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<ShieldCheck class="mb-4 h-12 w-12 animate-pulse text-blue-600" />
			<h3 class="mb-2 text-lg font-semibold text-slate-900">Initializing secure delivery...</h3>
			<p class="mb-4 text-sm text-slate-600">Loading privacy protection system</p>

			<!-- Progress bar -->
			<div class="w-full max-w-md">
				<div class="h-2 w-full rounded-full bg-slate-200">
					<div
						class="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300"
						style="width: {state.progress}%"
					></div>
				</div>
				<p class="mt-2 text-xs text-slate-500">{Math.round(state.progress)}%</p>
			</div>
		</div>
	{:else if state.status === 'generating-proof'}
		<!-- Generating ZK proof (main wait time) -->
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<ShieldCheck class="mb-4 h-12 w-12 animate-pulse text-blue-600" />
			<h3 class="mb-2 text-lg font-semibold text-slate-900">Preparing secure delivery...</h3>
			<p class="mb-6 text-sm text-slate-600">
				Proving you're a constituent without revealing your identity
			</p>

			<!-- Progress bar -->
			<div class="mb-6 w-full max-w-md">
				<div class="h-2 w-full rounded-full bg-slate-200">
					<div
						class="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300"
						style="width: {state.progress}%"
					></div>
				</div>
				<p class="mt-2 text-xs text-slate-500">{Math.round(state.progress)}%</p>
			</div>

			<!-- Educational messaging (cycles every 3s) -->
			<div class="w-full max-w-md">
				<div
					class="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900 transition-opacity duration-500"
				>
					<div class="flex items-start gap-2">
						<span class="text-green-600">{educationalMessages[educationIndex].icon}</span>
						<span>{educationalMessages[educationIndex].text}</span>
					</div>
				</div>
			</div>
		</div>
	{:else if state.status === 'encrypting-witness'}
		<!-- Encrypting witness -->
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<ShieldCheck class="mb-4 h-12 w-12 animate-pulse text-blue-600" />
			<h3 class="mb-2 text-lg font-semibold text-slate-900">Encrypting delivery...</h3>
			<p class="text-sm text-slate-600">Securing your message</p>
		</div>
	{:else if state.status === 'submitting'}
		<!-- Submitting to backend -->
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<Loader2 class="mb-4 h-12 w-12 animate-spin text-blue-600" />
			<h3 class="mb-2 text-lg font-semibold text-slate-900">Submitting...</h3>
			<p class="text-sm text-slate-600">Sending to congressional offices</p>
		</div>
	{:else if state.status === 'complete'}
		<!-- Success state -->
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<div
				class="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-600 shadow-2xl"
			>
				<Check class="h-10 w-10 text-white" strokeWidth={3} />
			</div>

			<h3 class="mb-2 text-2xl font-bold text-slate-900">Message Delivered!</h3>
			<p class="mb-6 text-sm text-slate-600">
				Your message was delivered anonymously to congressional offices
			</p>

			<div class="w-full max-w-md">
				<div class="rounded-lg border border-green-200 bg-green-50 p-4">
					<p class="mb-2 text-sm font-medium text-green-900">What happened:</p>
					<ul class="space-y-1 text-left text-sm text-green-800">
						<li class="flex items-start gap-2">
							<span class="text-green-600">✓</span>
							<span
								>Delivered to {templateData.recipientOffices.length} congressional office(s)</span
							>
						</li>
						<li class="flex items-start gap-2">
							<span class="text-green-600">✓</span>
							<span>Your identity was protected with zero-knowledge cryptography</span>
						</li>
						<li class="flex items-start gap-2">
							<span class="text-green-600">✓</span>
							<span>Your civic reputation was updated on-chain</span>
						</li>
					</ul>
				</div>
			</div>

			<button
				type="button"
				onclick={() => dispatch('complete', { submissionId: state.submissionId })}
				class="mt-6 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-3 text-base font-semibold text-white shadow-lg transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl"
			>
				Continue
			</button>
		</div>
	{:else if state.status === 'error'}
		<!-- Error state with recovery -->
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<AlertCircle class="mb-4 h-12 w-12 text-red-600" />
			<h3 class="mb-2 text-xl font-bold text-slate-900">Something went wrong</h3>
			<p class="mb-6 text-sm text-slate-600">{state.message}</p>

			<div class="flex gap-3">
				<button
					type="button"
					onclick={handleCancel}
					class="rounded-lg border border-slate-300 bg-white px-6 py-3 text-base font-semibold text-slate-700 transition-colors hover:bg-slate-50"
				>
					Cancel
				</button>
				{#if state.recoverable && state.retryAction}
					<button
						type="button"
						onclick={handleRetry}
						class="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-lg transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl"
					>
						Try Again
					</button>
				{/if}
			</div>

			<div class="mt-6 w-full max-w-md">
				<div class="rounded-lg border border-blue-200 bg-blue-50 p-4 text-left">
					<p class="mb-2 text-sm font-medium text-blue-900">Need help?</p>
					<ul class="space-y-1 text-sm text-blue-800">
						<li>• Check your internet connection</li>
						<li>• Try refreshing the page</li>
						<li>
							• Contact support at <a href="mailto:support@communique.app" class="underline"
								>support@communique.app</a
							>
						</li>
					</ul>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.proof-generator {
		width: 100%;
		max-width: 42rem;
		margin: 0 auto;
	}
</style>
