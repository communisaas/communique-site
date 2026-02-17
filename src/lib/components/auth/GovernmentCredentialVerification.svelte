<!--
 * Government Credential Verification Component (mDL / Digital ID)
 *
 * W3C Digital Credentials API integration for browser-native wallet verification.
 * Uses Svelte 5 callback props (NOT createEventDispatcher).
 *
 * Flow: idle -> requesting (OS wallet prompt) -> verifying (server) -> complete / error
 * Unsupported browsers get a clear fallback message.
 *
 * Privacy: Only postal code, city, and state are shared via selective disclosure.
 -->

<script lang="ts">
	import {
		Smartphone,
		Loader2,
		Check,
		AlertCircle,
		ShieldCheck,
		RefreshCw,
		Info
	} from '@lucide/svelte';
	import {
		isDigitalCredentialsSupported,
		requestCredential,
		type CredentialRequestResult
	} from '$lib/core/identity/digital-credentials-api';

	interface Props {
		userId: string;
		templateSlug?: string;
		oncomplete?: (data: {
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
		}) => void;
		onerror?: (data: { message: string }) => void;
		oncancel?: () => void;
	}

	let { userId, templateSlug, oncomplete, onerror, oncancel }: Props = $props();

	type VerificationState =
		| 'idle'
		| 'requesting'
		| 'verifying'
		| 'complete'
		| 'error'
		| 'unsupported';

	let state = $state<VerificationState>(
		isDigitalCredentialsSupported() ? 'idle' : 'unsupported'
	);
	let errorMessage = $state<string | null>(null);
	let verificationResult = $state<{
		district?: string;
		state?: string;
		credentialHash?: string;
	} | null>(null);

	async function startVerification() {
		state = 'requesting';
		errorMessage = null;

		try {
			// Step 1: Get request config from server
			const startResponse = await fetch('/api/identity/verify-mdl/start', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId, templateSlug })
			});

			if (!startResponse.ok) {
				const err = await startResponse.json();
				throw new Error(err.message || 'Failed to start verification');
			}

			const { requests, nonce } = await startResponse.json();

			// Step 2: Request credential from wallet
			const result: CredentialRequestResult = await requestCredential({ requests });

			if (!result.success) {
				if (result.error === 'user_cancelled') {
					state = 'idle';
					return;
				}
				throw new Error(result.message);
			}

			// Step 3: Verify on server
			state = 'verifying';

			const verifyResponse = await fetch('/api/identity/verify-mdl/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					protocol: result.protocol,
					data: result.data,
					nonce
				})
			});

			if (!verifyResponse.ok) {
				const err = await verifyResponse.json();
				throw new Error(err.message || 'Verification failed');
			}

			const verification = await verifyResponse.json();

			verificationResult = {
				district: verification.district,
				state: verification.state,
				credentialHash: verification.credentialHash
			};

			state = 'complete';

			// Notify parent
			oncomplete?.({
				verified: true,
				method: 'mdl',
				district: verification.district,
				state: verification.state,
				providerData: {
					provider: 'digital-credentials-api',
					credentialHash: verification.credentialHash,
					issuedAt: Date.now()
				}
			});
		} catch (err) {
			state = 'error';
			errorMessage = err instanceof Error ? err.message : 'Verification failed';
			onerror?.({ message: errorMessage });
		}
	}

	function retry() {
		errorMessage = null;
		startVerification();
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="text-center">
		<div
			class="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg"
		>
			<Smartphone class="h-8 w-8 text-white" />
		</div>
		<h3 class="mb-2 text-xl font-bold text-slate-900">Verify with Digital ID</h3>
		<p class="text-sm text-slate-600">
			Use your state-issued digital driver's license for instant, private verification
		</p>
	</div>

	{#if state === 'idle'}
		<!-- Privacy Guarantee -->
		<div class="rounded-lg border border-green-200 bg-green-50 p-4">
			<div class="flex items-start gap-3">
				<div class="mt-0.5 rounded-full bg-green-100 p-1">
					<ShieldCheck class="h-4 w-4 text-green-700" />
				</div>
				<div class="flex-1 space-y-1 text-sm">
					<p class="font-medium text-green-900">Selective disclosure -- maximum privacy</p>
					<ul class="space-y-1 text-green-700">
						<li class="flex items-start gap-2">
							<span class="text-green-600">&#8226;</span>
							<span>Only your <strong>postal code, city, and state</strong> are shared</span>
						</li>
						<li class="flex items-start gap-2">
							<span class="text-green-600">&#8226;</span>
							<span>Your name, photo, and license number are <strong>never transmitted</strong></span>
						</li>
						<li class="flex items-start gap-2">
							<span class="text-green-600">&#8226;</span>
							<span>Cryptographically verified by your <strong>state DMV issuer</strong></span>
						</li>
					</ul>
				</div>
			</div>
		</div>

		<!-- How it works -->
		<div class="space-y-3">
			<h4 class="text-sm font-medium text-slate-900">How it works:</h4>
			<ol class="space-y-2 text-sm text-slate-600">
				<li class="flex items-start gap-3">
					<span
						class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700"
					>
						1
					</span>
					<span>Click "Verify with Digital ID" below</span>
				</li>
				<li class="flex items-start gap-3">
					<span
						class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700"
					>
						2
					</span>
					<span>Your device will show your digital wallet</span>
				</li>
				<li class="flex items-start gap-3">
					<span
						class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700"
					>
						3
					</span>
					<span>Approve sharing your postal code and state -- that's it!</span>
				</li>
			</ol>
		</div>

		<!-- CTA Button -->
		<button
			type="button"
			onclick={startVerification}
			class="w-full rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-base font-semibold text-white shadow-lg transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl"
		>
			<span class="flex items-center justify-center gap-2">
				<Smartphone class="h-5 w-5" />
				<span>Verify with Digital ID</span>
			</span>
		</button>
	{:else if state === 'requesting'}
		<!-- Wallet Prompt State -->
		<div class="flex flex-col items-center justify-center py-8">
			<div class="relative mb-6">
				<div
					class="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100"
				>
					<Smartphone class="h-10 w-10 text-blue-600" />
				</div>
				<div
					class="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md"
				>
					<Loader2 class="h-5 w-5 animate-spin text-blue-600" />
				</div>
			</div>
			<p class="text-lg font-semibold text-slate-900">Waiting for wallet...</p>
			<p class="mt-2 max-w-xs text-center text-sm text-slate-600">
				Your device will prompt you to share <strong>only</strong> your postal code, city, and state
			</p>
			<p class="mt-4 text-xs text-slate-400">
				You can cancel the wallet prompt at any time
			</p>
		</div>
	{:else if state === 'verifying'}
		<!-- Server Verification State -->
		<div class="flex flex-col items-center justify-center py-8">
			<Loader2 class="mb-4 h-12 w-12 animate-spin text-blue-600" />
			<p class="text-lg font-semibold text-slate-900">Verifying your credential...</p>
			<p class="mt-2 text-sm text-slate-600">
				Checking your digital ID with the state issuer
			</p>
		</div>
	{:else if state === 'complete'}
		<!-- Success State -->
		<div class="flex flex-col items-center justify-center py-8">
			<div
				class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 shadow-lg"
			>
				<Check class="h-8 w-8 text-green-600" />
			</div>
			<p class="text-lg font-semibold text-green-900">Verified!</p>
			{#if verificationResult?.district}
				<p class="mt-2 text-sm text-slate-600">
					District: <span class="font-medium text-slate-900">{verificationResult.district}</span>
				</p>
			{/if}
			{#if verificationResult?.state}
				<p class="mt-1 text-sm text-slate-600">
					State: <span class="font-medium text-slate-900">{verificationResult.state}</span>
				</p>
			{/if}
		</div>
	{:else if state === 'error'}
		<!-- Error State -->
		<div class="space-y-4">
			<div class="rounded-lg border border-red-200 bg-red-50 p-4">
				<div class="flex items-start gap-3">
					<AlertCircle class="h-5 w-5 flex-shrink-0 text-red-600" />
					<div class="flex-1">
						<p class="text-sm font-medium text-red-900">Verification failed</p>
						<p class="mt-1 text-sm text-red-700">{errorMessage}</p>
					</div>
				</div>
			</div>

			<button
				type="button"
				onclick={retry}
				class="w-full rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg"
			>
				<span class="flex items-center justify-center gap-2">
					<RefreshCw class="h-5 w-5" />
					<span>Try Again</span>
				</span>
			</button>
		</div>
	{:else if state === 'unsupported'}
		<!-- Unsupported Browser State -->
		<div class="space-y-4">
			<div class="rounded-lg border border-amber-200 bg-amber-50 p-4">
				<div class="flex items-start gap-3">
					<Info class="h-5 w-5 flex-shrink-0 text-amber-600" />
					<div class="flex-1">
						<p class="text-sm font-medium text-amber-900">
							Digital ID not available in this browser
						</p>
						<p class="mt-1 text-sm text-amber-700">
							The Digital Credentials API requires Chrome 141+ or Safari 26+.
							You can still verify using one of the alternative methods below.
						</p>
					</div>
				</div>
			</div>

			<div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
				<p class="mb-3 text-sm font-medium text-slate-900">Alternative verification methods:</p>
				<ul class="space-y-2 text-sm text-slate-600">
					<li class="flex items-start gap-2">
						<span class="font-medium text-slate-700">NFC Passport</span>
						<span>-- Tap your passport with your phone (30 seconds)</span>
					</li>
					<li class="flex items-start gap-2">
						<span class="font-medium text-slate-700">Government ID Scan</span>
						<span>-- Upload a photo of your driver's license or state ID</span>
					</li>
				</ul>
			</div>

			{#if oncancel}
				<button
					type="button"
					onclick={oncancel}
					class="w-full rounded-lg border-2 border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
				>
					Choose Another Method
				</button>
			{/if}
		</div>
	{/if}

	<!-- Trust Indicator (shown in idle, requesting, verifying states) -->
	{#if state === 'idle' || state === 'requesting' || state === 'verifying'}
		<div class="rounded-lg border border-slate-200 bg-white p-4">
			<div class="flex items-start gap-3">
				<div class="rounded-full bg-slate-100 p-2">
					<ShieldCheck class="h-4 w-4 text-slate-600" />
				</div>
				<div class="flex-1 text-sm">
					<p class="font-medium text-slate-900">Browser-native verification</p>
					<p class="mt-1 text-slate-600">
						Your digital ID is verified directly by your browser using the W3C Digital Credentials
						API. No third-party services see your data.
					</p>
				</div>
			</div>
		</div>
	{/if}
</div>
