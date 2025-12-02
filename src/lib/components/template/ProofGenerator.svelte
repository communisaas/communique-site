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
		/** User address for encryption */
		address: string;
	}

	let { userId, templateId, templateData, skipCredentialCheck = false, address }: Props = $props();

	type ProofGenerationState =
		| { status: 'idle' }
		| { status: 'loading-credential' }
		| { status: 'initializing-prover'; progress: number }
		| { status: 'generating-proof'; progress: number }
		| { status: 'fetching-attestation' }
		| { status: 'verifying-attestation'; pcr0?: string }
		| { status: 'encrypting-witness'; benchmark?: any }
		| { status: 'paused-on-benchmark'; benchmark: any }
		| { status: 'submitting' }
		| { status: 'complete'; submissionId: string; benchmark?: any }
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
			let credential = await getSessionCredential(userId);

			// Generate mock credentials if skipping check (for testing/demo)
			if (!credential && skipCredentialCheck) {
				console.log('[ProofGenerator] Using mock credentials for demo');
				credential = {
					userId,
					identityCommitment: '0x0000000000000000000000000000000000000000000000000000000000000001',
					leafIndex: 0,
					merklePath: Array(12).fill(
						'0x0000000000000000000000000000000000000000000000000000000000000003'
					),
					merkleRoot: '0x0000000000000000000000000000000000000000000000000000000000000002',
					congressionalDistrict: 'DEMO-00',
					verificationMethod: 'self.xyz' as const,
					createdAt: new Date(),
					expiresAt: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000)
				};
			}

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

			// Step 2: Prepare Witness Data
			// Convert template ID to field element using Poseidon hash
			const { poseidonHash } = await import('$lib/core/crypto/poseidon');
			const actionId = await poseidonHash(templateId);

			console.log('[ProofGenerator] Template ID hashed to action ID:', {
				templateId,
				actionId: actionId.slice(0, 16) + '...'
			});

			// Build witness inputs
			const witness = {
				identityCommitment: credential!.identityCommitment,
				leafIndex: credential!.leafIndex,
				merklePath: credential!.merklePath,
				merkleRoot: credential!.merkleRoot,
				actionId: actionId,
				timestamp: Date.now(),
				address
			};

			// Step 3: Generate ZK Proof
			// Use the Orchestrator to run proving in a Web Worker (non-blocking)
			const { proverOrchestrator } = await import('$lib/core/proof/prover-orchestrator');

			// Initialize if needed (idempotent)
			state = { status: 'initializing-prover', progress: 0 };
			await proverOrchestrator.init();

			// Generate proof
			const proofResult = await proverOrchestrator.prove(witness, (stage, percent) => {
				// Map worker stages to UI states
				if (stage === 'generating-keys') {
					state = { status: 'initializing-prover', progress: percent };
				} else if (stage === 'proving') {
					state = { status: 'generating-proof', progress: percent };
				} else if (stage === 'finalizing') {
					state = { status: 'generating-proof', progress: 95 };
				}
			});

			if (!proofResult.success) {
				state = {
					status: 'error',
					message: proofResult.error || 'Proof generation failed. Please try again.',
					recoverable: true,
					retryAction: () => generateAndSubmit()
				};
				return;
			}

			// Step 4: Fetch and verify Nitro Enclave attestation
			let encryptedWitness;
			if (credential!.congressionalDistrict === 'DEMO-00') {
				console.log('[ProofGenerator] Using Nitro Enclave demo mode');

				// Fetch attestation document
				state = { status: 'fetching-attestation' };
				const { fetchNitroAttestation, verifyNitroAttestation, encryptToNitroEnclave } =
					await import('$lib/core/proof/nitro-enclave-demo');

				const attestation = await fetchNitroAttestation();

				// Verify attestation
				state = { status: 'verifying-attestation', pcr0: attestation.pcrs.pcr0 };
				const isValid = await verifyNitroAttestation(attestation);

				if (!isValid) {
					state = {
						status: 'error',
						message: 'Nitro Enclave attestation verification failed',
						recoverable: true,
						retryAction: () => generateAndSubmit()
					};
					return;
				}

				// Encrypt witness to Nitro Enclave
				state = { status: 'encrypting-witness' };
				const encrypted = await encryptToNitroEnclave(witness, attestation);

				// Store benchmark data
				encryptedWitness = {
					ciphertext: encrypted.ciphertext,
					nonce: encrypted.nonce,
					ephemeralPublicKey: encrypted.ephemeralPublicKey,
					teeKeyId: encrypted.enclaveKeyId
				};

				// Update state with benchmark
				state = { status: 'paused-on-benchmark', benchmark: encrypted.benchmark };

				// Don't auto-continue - wait for user to click "Continue"
				return;
			} else {
				// Real encryption for production
				state = { status: 'encrypting-witness' };
				const { encryptWitness } = await import('$lib/core/proof/witness-encryption');
				encryptedWitness = await encryptWitness(witness);
			}

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

	async function handleContinue() {
		if (state.status !== 'paused-on-benchmark') return;

		// For demo mode, just show completion
		// In production, this would continue with actual submission
		state = { status: 'submitting' };

		// Simulate submission delay
		await new Promise((resolve) => setTimeout(resolve, 1500));

		// Demo completion
		state = {
			status: 'complete',
			submissionId: 'demo-' + Date.now(),
			benchmark: state.status === 'paused-on-benchmark' ? state.benchmark : undefined
		};

		dispatch('complete', { submissionId: 'demo-' + Date.now() });
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
	{:else if state.status === 'fetching-attestation'}
		<!-- Fetching Nitro Enclave attestation -->
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<Loader2 class="mb-4 h-12 w-12 animate-spin text-purple-600" />
			<h3 class="mb-2 text-lg font-semibold text-slate-900">
				Fetching Nitro Enclave attestation...
			</h3>
			<p class="text-sm text-slate-600">Requesting secure enclave proof</p>
		</div>
	{:else if state.status === 'verifying-attestation'}
		<!-- Verifying Nitro attestation -->
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<ShieldCheck class="mb-4 h-12 w-12 animate-pulse text-purple-600" />
			<h3 class="mb-2 text-lg font-semibold text-slate-900">Verifying secure enclave...</h3>
			<p class="mb-6 text-sm text-slate-600">
				Cryptographically verifying AWS Nitro Enclave integrity
			</p>

			{#if state.pcr0}
				<div class="w-full max-w-md">
					<div class="rounded-lg border border-purple-200 bg-purple-50 p-4 text-left">
						<p class="mb-2 text-xs font-medium text-purple-900">
							Platform Configuration Register (PCR0):
						</p>
						<code class="block overflow-x-auto font-mono text-xs text-purple-800">
							{state.pcr0.slice(0, 32)}...
						</code>
						<p class="mt-2 text-xs text-purple-700">✓ Enclave image measurement verified</p>
					</div>
				</div>
			{/if}
		</div>
	{:else if state.status === 'encrypting-witness'}
		<!-- Encrypting witness (with optional benchmark) -->
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<ShieldCheck class="mb-4 h-12 w-12 animate-pulse text-blue-600" />
			<h3 class="mb-2 text-lg font-semibold text-slate-900">Encrypting delivery...</h3>
			<p class="mb-6 text-sm text-slate-600">Securing your message with P-256 ECDH + AES-256-GCM</p>

			{#if state.benchmark}
				<div class="w-full max-w-md space-y-3">
					<div class="rounded-lg border border-green-200 bg-green-50 p-4">
						<p class="mb-3 text-sm font-medium text-green-900">Encryption Benchmark:</p>
						<div class="space-y-2 text-left text-xs text-green-800">
							<div class="flex justify-between">
								<span>Key Derivation (ECDH):</span>
								<span class="font-mono font-semibold"
									>{state.benchmark.steps.keyDerivation.toFixed(2)}ms</span
								>
							</div>
							<div class="flex justify-between">
								<span>AES-256-GCM Encryption:</span>
								<span class="font-mono font-semibold"
									>{state.benchmark.steps.encryption.toFixed(2)}ms</span
								>
							</div>
							<div class="flex justify-between border-t border-green-300 pt-2 font-medium">
								<span>Total Time:</span>
								<span class="font-mono">{state.benchmark.totalTime.toFixed(2)}ms</span>
							</div>
						</div>
					</div>

					<div class="rounded-lg border border-blue-200 bg-blue-50 p-3 text-left">
						<p class="mb-2 text-xs font-medium text-blue-900">Cryptographic Details:</p>
						<div class="space-y-1 text-xs text-blue-800">
							<div>Curve: <code class="font-mono">{state.benchmark.crypto.curve}</code></div>
							<div>Cipher: <code class="font-mono">{state.benchmark.crypto.cipher}</code></div>
							<div>KDF: <code class="font-mono">{state.benchmark.crypto.kdf}</code></div>
							<div>
								Enclave Key ID: <code class="font-mono">{state.benchmark.crypto.enclaveKeyId}</code>
							</div>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{:else if state.status === 'paused-on-benchmark'}
		<!-- Paused on benchmark - user must click to continue -->
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<ShieldCheck class="mb-4 h-12 w-12 text-green-600" />
			<h3 class="mb-2 text-lg font-semibold text-slate-900">Encryption Complete!</h3>
			<p class="mb-6 text-sm text-slate-600">Review the cryptographic details below</p>

			<div class="mb-6 w-full max-w-md space-y-3">
				<div class="rounded-lg border border-green-200 bg-green-50 p-4">
					<p class="mb-3 text-sm font-medium text-green-900">Encryption Benchmark:</p>
					<div class="space-y-2 text-left text-xs text-green-800">
						<div class="flex justify-between">
							<span>Key Derivation (ECDH):</span>
							<span class="font-mono font-semibold"
								>{state.benchmark.steps.keyDerivation.toFixed(2)}ms</span
							>
						</div>
						<div class="flex justify-between">
							<span>AES-256-GCM Encryption:</span>
							<span class="font-mono font-semibold"
								>{state.benchmark.steps.encryption.toFixed(2)}ms</span
							>
						</div>
						<div class="flex justify-between border-t border-green-300 pt-2 font-medium">
							<span>Total Time:</span>
							<span class="font-mono">{state.benchmark.totalTime.toFixed(2)}ms</span>
						</div>
					</div>
				</div>

				<div class="rounded-lg border border-blue-200 bg-blue-50 p-3 text-left">
					<p class="mb-2 text-xs font-medium text-blue-900">Cryptographic Details:</p>
					<div class="space-y-1 text-xs text-blue-800">
						<div>Curve: <code class="font-mono">{state.benchmark.crypto.curve}</code></div>
						<div>Cipher: <code class="font-mono">{state.benchmark.crypto.cipher}</code></div>
						<div>KDF: <code class="font-mono">{state.benchmark.crypto.kdf}</code></div>
						<div>
							Enclave Key ID: <code class="font-mono">{state.benchmark.crypto.enclaveKeyId}</code>
						</div>
					</div>
				</div>
			</div>

			<button
				type="button"
				onclick={handleContinue}
				class="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-3 text-base font-semibold text-white shadow-lg transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl"
			>
				Continue to Submit
			</button>
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
