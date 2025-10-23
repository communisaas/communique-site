<script lang="ts">
	import { FileText, ExternalLink, Check, Loader2, AlertCircle } from '@lucide/svelte';
	import { createEventDispatcher } from 'svelte';

	interface Props {
		userId: string;
		templateSlug?: string;
		isLoading?: boolean;
	}

	let { userId, templateSlug, isLoading = false }: Props = $props();

	let verificationState = $state<'idle' | 'initializing' | 'redirecting' | 'error'>('idle');
	let errorMessage = $state<string | null>(null);

	const dispatch = createEventDispatcher<{
		complete: { verified: boolean; method: string };
		error: { message: string };
	}>();

	async function initiateVerification() {
		verificationState = 'initializing';
		errorMessage = null;

		try {
			const response = await fetch('/api/identity/didit/init', {
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

			if (!data.verificationUrl) {
				throw new Error('No verification URL received');
			}

			// Redirect to Didit verification
			verificationState = 'redirecting';

			// Open in new window for better UX (user can close if needed)
			const verificationWindow = window.open(
				data.verificationUrl,
				'_blank',
				'width=600,height=800,scrollbars=yes'
			);

			if (!verificationWindow) {
				// Fallback: redirect current window if popup blocked
				window.location.href = data.verificationUrl;
			} else {
				// Monitor for window close or completion
				const checkInterval = setInterval(() => {
					if (verificationWindow.closed) {
						clearInterval(checkInterval);
						verificationState = 'idle';
					}
				}, 1000);
			}
		} catch (error) {
			console.error('Didit verification initialization failed:', error);
			errorMessage =
				error instanceof Error ? error.message : 'Failed to start verification process';
			verificationState = 'error';
			dispatch('error', { message: errorMessage });
		}
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="text-center">
		<div class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
			<FileText class="h-7 w-7 text-blue-600" />
		</div>
		<h3 class="mb-2 text-lg font-semibold text-slate-900">Verify with Government ID</h3>
		<p class="text-sm text-slate-600">
			Use your driver's license or state ID to verify your congressional district
		</p>
	</div>

	<!-- Privacy Guarantee -->
	<div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
		<div class="flex items-start gap-3">
			<div class="mt-0.5 rounded-full bg-green-100 p-1">
				<Check class="h-4 w-4 text-green-700" />
			</div>
			<div class="flex-1 space-y-1 text-sm">
				<p class="font-medium text-slate-900">Your privacy is protected</p>
				<ul class="space-y-1 text-slate-600">
					<li class="flex items-start gap-2">
						<span class="text-green-600">•</span>
						<span>Your ID never touches our servers</span>
					</li>
					<li class="flex items-start gap-2">
						<span class="text-green-600">•</span>
						<span>We only store: verification status + timestamp</span>
					</li>
					<li class="flex items-start gap-2">
						<span class="text-green-600">•</span>
						<span>Congress sees: ✓ Verified constituent from your district</span>
					</li>
				</ul>
			</div>
		</div>
	</div>

	<!-- How It Works -->
	<div class="space-y-3">
		<h4 class="text-sm font-medium text-slate-900">How it works:</h4>
		<ol class="space-y-2 text-sm text-slate-600">
			<li class="flex items-start gap-3">
				<span
					class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700"
				>
					1
				</span>
				<span>Click "Start Verification" to open our trusted verification partner (Didit.me)</span>
			</li>
			<li class="flex items-start gap-3">
				<span
					class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700"
				>
					2
				</span>
				<span>Take a photo of your government-issued ID</span>
			</li>
			<li class="flex items-start gap-3">
				<span
					class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700"
				>
					3
				</span>
				<span>Complete facial verification (selfie)</span>
			</li>
			<li class="flex items-start gap-3">
				<span
					class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700"
				>
					4
				</span>
				<span>Return here – you're verified!</span>
			</li>
		</ol>
	</div>

	<!-- Error State -->
	{#if errorMessage}
		<div class="rounded-lg border border-red-200 bg-red-50 p-4">
			<div class="flex items-start gap-3">
				<AlertCircle class="h-5 w-5 flex-shrink-0 text-red-600" />
				<div class="flex-1">
					<p class="text-sm font-medium text-red-900">Verification failed</p>
					<p class="mt-1 text-sm text-red-700">{errorMessage}</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- Action Button -->
	<button
		type="button"
		onclick={initiateVerification}
		disabled={isLoading || verificationState === 'initializing' || verificationState === 'redirecting'}
		class="group relative w-full rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-base font-semibold text-white shadow-lg transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
	>
		<span class="flex items-center justify-center gap-2">
			{#if verificationState === 'initializing'}
				<Loader2 class="h-5 w-5 animate-spin" />
				<span>Initializing verification...</span>
			{:else if verificationState === 'redirecting'}
				<Loader2 class="h-5 w-5 animate-spin" />
				<span>Opening verification window...</span>
			{:else}
				<FileText class="h-5 w-5" />
				<span>Start Verification</span>
				<ExternalLink class="h-4 w-4 opacity-75 transition-opacity group-hover:opacity-100" />
			{/if}
		</span>
	</button>

	<!-- Trust Indicator -->
	<div class="rounded-lg border border-slate-200 bg-white p-4">
		<div class="flex items-start gap-3">
			<div class="rounded-full bg-slate-100 p-2">
				<Check class="h-4 w-4 text-slate-600" />
			</div>
			<div class="flex-1 text-sm">
				<p class="font-medium text-slate-900">Trusted verification partner</p>
				<p class="mt-1 text-slate-600">
					Didit.me is a SOC 2 Type II certified identity verification provider trusted by
					government agencies and financial institutions.
				</p>
			</div>
		</div>
	</div>
</div>
