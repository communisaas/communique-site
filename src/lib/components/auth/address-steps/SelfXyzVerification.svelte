<script lang="ts">
	import {
		Shield,
		QrCode,
		Smartphone,
		Check,
		Loader2,
		AlertCircle,
		RefreshCw
	} from '@lucide/svelte';
	interface Props {
		userId: string;
		templateSlug?: string;
		isLoading?: boolean;
		oncomplete?: (data: { verified: boolean; method: string }) => void;
		onerror?: (data: { message: string }) => void;
	}

	let { userId, templateSlug, isLoading = false, oncomplete, onerror }: Props = $props();

	let verificationState = $state<
		'idle' | 'initializing' | 'qr-ready' | 'waiting' | 'verified' | 'error'
	>('idle');
	let qrCodeUrl = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);
	let sessionId = $state<string | null>(null);
	let pollingInterval = $state<number | null>(null);

	async function initializeVerification() {
		verificationState = 'initializing';
		errorMessage = null;

		try {
			const response = await fetch('/api/identity/init', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					userId,
					templateSlug
				})
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Failed to initialize verification');
			}

			const data = await response.json();

			if (!data.qrCode) {
				throw new Error('No QR code received from verification service');
			}

			qrCodeUrl = data.qrCode;
			sessionId = data.sessionId;
			verificationState = 'qr-ready';

			// Start polling for verification status
			startPolling();
		} catch (error) {
			console.error('Self.xyz verification initialization failed:', error);
			errorMessage =
				error instanceof Error ? error.message : 'Failed to initialize verification process';
			verificationState = 'error';
			onerror?.({ message: errorMessage });
		}
	}

	function startPolling() {
		if (!sessionId) return;

		// Poll every 2 seconds for verification status
		pollingInterval = window.setInterval(async () => {
			try {
				const response = await fetch(`/api/identity/status?sessionId=${sessionId}`);

				if (!response.ok) {
					throw new Error('Failed to check verification status');
				}

				const data = await response.json();

				if (data.status === 'verified') {
					stopPolling();
					verificationState = 'verified';
					oncomplete?.({ verified: true, method: 'nfc-passport' });
				} else if (data.status === 'failed') {
					stopPolling();
					errorMessage = data.error || 'Verification failed';
					verificationState = 'error';
				} else if (data.status === 'pending') {
					if (verificationState !== 'waiting') {
						verificationState = 'waiting';
					}
				}
			} catch (error) {
				console.error('Status polling error:', error);
				// Don't stop polling on temporary errors
			}
		}, 2000);
	}

	function stopPolling() {
		if (pollingInterval) {
			clearInterval(pollingInterval);
			pollingInterval = null;
		}
	}

	function retry() {
		stopPolling();
		qrCodeUrl = null;
		sessionId = null;
		errorMessage = null;
		initializeVerification();
	}

	// Cleanup on component unmount
	$effect(() => {
		return () => {
			stopPolling();
		};
	});
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="text-center">
		<div
			class="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg"
		>
			<Shield class="h-8 w-8 text-white" />
		</div>
		<h3 class="mb-2 text-xl font-bold text-slate-900">Verify with NFC Passport</h3>
		<p class="text-sm text-slate-600">
			Tap your passport with your phone for instant, privacy-preserving verification
		</p>
	</div>

	<!-- Privacy Guarantee -->
	<div class="rounded-lg border border-green-200 bg-green-50 p-4">
		<div class="flex items-start gap-3">
			<div class="mt-0.5 rounded-full bg-green-100 p-1">
				<Check class="h-4 w-4 text-green-700" />
			</div>
			<div class="flex-1 space-y-1 text-sm">
				<p class="font-medium text-green-900">Maximum privacy protection</p>
				<ul class="space-y-1 text-green-700">
					<li class="flex items-start gap-2">
						<span class="text-green-600">•</span>
						<span>Your passport data <strong>never leaves your device</strong></span>
					</li>
					<li class="flex items-start gap-2">
						<span class="text-green-600">•</span>
						<span>We verify district membership <strong>without storing your address</strong></span>
					</li>
					<li class="flex items-start gap-2">
						<span class="text-green-600">•</span>
						<span>Cryptographic proof generated <strong>locally on your phone</strong></span>
					</li>
				</ul>
			</div>
		</div>
	</div>

	<!-- Verification Flow -->
	{#if verificationState === 'idle'}
		<!-- Initial State -->
		<div class="space-y-4">
			<div class="space-y-3">
				<h4 class="text-sm font-medium text-slate-900">How it works:</h4>
				<ol class="space-y-2 text-sm text-slate-600">
					<li class="flex items-start gap-3">
						<span
							class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700"
						>
							1
						</span>
						<span>Click "Generate QR Code" below</span>
					</li>
					<li class="flex items-start gap-3">
						<span
							class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700"
						>
							2
						</span>
						<span>Open the camera on your smartphone and scan the QR code</span>
					</li>
					<li class="flex items-start gap-3">
						<span
							class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700"
						>
							3
						</span>
						<span>Tap your NFC passport against the back of your phone</span>
					</li>
					<li class="flex items-start gap-3">
						<span
							class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700"
						>
							4
						</span>
						<span>Verification completes in ~30 seconds – done!</span>
					</li>
				</ol>
			</div>

			<button
				type="button"
				onclick={initializeVerification}
				disabled={isLoading}
				class="w-full rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-base font-semibold text-white shadow-lg transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
			>
				<span class="flex items-center justify-center gap-2">
					<QrCode class="h-5 w-5" />
					<span>Generate QR Code</span>
				</span>
			</button>
		</div>
	{:else if verificationState === 'initializing'}
		<!-- Initializing -->
		<div class="flex flex-col items-center justify-center py-8">
			<Loader2 class="mb-4 h-12 w-12 animate-spin text-blue-600" />
			<p class="text-sm font-medium text-slate-900">Generating secure QR code...</p>
			<p class="mt-1 text-xs text-slate-600">This takes just a moment</p>
		</div>
	{:else if verificationState === 'qr-ready' || verificationState === 'waiting'}
		<!-- QR Code Display -->
		<div class="space-y-4">
			<!-- QR Code -->
			<div class="rounded-xl border-2 border-blue-200 bg-white p-6">
				<div class="mx-auto w-fit rounded-lg bg-white p-4 shadow-inner">
					{#if qrCodeUrl}
						<img src={qrCodeUrl} alt="Verification QR Code" class="h-64 w-64" />
					{:else}
						<div class="flex h-64 w-64 items-center justify-center bg-slate-100">
							<Loader2 class="h-8 w-8 animate-spin text-slate-400" />
						</div>
					{/if}
				</div>

				{#if verificationState === 'waiting'}
					<div
						class="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-blue-700"
					>
						<Loader2 class="h-4 w-4 animate-spin" />
						<span>Waiting for verification...</span>
					</div>
				{:else}
					<div class="mt-4 flex items-center justify-center gap-2 text-sm text-slate-600">
						<Smartphone class="h-4 w-4" />
						<span>Scan with your smartphone camera</span>
					</div>
				{/if}
			</div>

			<!-- Instructions -->
			<div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
				<div class="flex items-start gap-3">
					<Smartphone class="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-700" />
					<div class="flex-1 space-y-2 text-sm text-blue-900">
						<p class="font-medium">On your smartphone:</p>
						<ol class="space-y-1 text-blue-800">
							<li>1. Open your camera and scan the QR code</li>
							<li>2. Follow the link that appears</li>
							<li>3. Tap your passport against your phone when prompted</li>
							<li>4. Keep your passport in place for 3-5 seconds</li>
						</ol>
					</div>
				</div>
			</div>

			<!-- Retry Button -->
			<button
				type="button"
				onclick={retry}
				class="w-full rounded-lg border-2 border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
			>
				<span class="flex items-center justify-center gap-2">
					<RefreshCw class="h-4 w-4" />
					<span>Generate New QR Code</span>
				</span>
			</button>
		</div>
	{:else if verificationState === 'verified'}
		<!-- Success State -->
		<div class="flex flex-col items-center justify-center py-8">
			<div
				class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 shadow-lg"
			>
				<Check class="h-8 w-8 text-green-600" />
			</div>
			<p class="text-lg font-semibold text-green-900">Verification Complete!</p>
			<p class="mt-2 text-sm text-slate-600">Your identity has been successfully verified</p>
		</div>
	{:else if verificationState === 'error'}
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
	{/if}

	<!-- Trust Indicator -->
	<div class="rounded-lg border border-slate-200 bg-white p-4">
		<div class="flex items-start gap-3">
			<div class="rounded-full bg-slate-100 p-2">
				<Check class="h-4 w-4 text-slate-600" />
			</div>
			<div class="flex-1 text-sm">
				<p class="font-medium text-slate-900">Trusted verification partner</p>
				<p class="mt-1 text-slate-600">
					Self.xyz is a privacy-preserving identity verification protocol trusted by government
					agencies and privacy-focused organizations worldwide.
				</p>
			</div>
		</div>
	</div>
</div>
