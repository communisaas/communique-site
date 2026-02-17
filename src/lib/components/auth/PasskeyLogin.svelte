<!--
 * PasskeyLogin.svelte
 *
 * Passkey authentication component for returning users.
 * Shown alongside or below OAuth buttons for streamlined sign-in.
 *
 * States: idle → authenticating → success/error
 -->

<script lang="ts">
	import { startAuthentication } from '@simplewebauthn/browser';
	import { Fingerprint, Loader2, AlertCircle } from 'lucide-svelte';
	import { browser } from '$app/environment';
	import { invalidateAll } from '$app/navigation';

	let { email = $bindable(), onauthenticated }: {
		email?: string;
		onauthenticated?: () => void
	} = $props();

	type State = 'idle' | 'authenticating' | 'error';
	let uiState: State = $state('idle');
	let errorMessage: string | null = $state(null);
	let isSupported = $state(false);
	let localEmail = $state(email || '');
	let showEmailInput = $state(!email);

	// Feature detection
	$effect(() => {
		if (browser && window.PublicKeyCredential) {
			isSupported = true;
		}
	});

	// Sync email prop changes
	$effect(() => {
		if (email) {
			localEmail = email;
			showEmailInput = false;
		}
	});

	async function handleAuthenticate() {
		if (uiState ==='authenticating') return;

		// Validate email
		const emailValue = localEmail.trim();
		if (!emailValue) {
			errorMessage = 'Please enter your email address';
			return;
		}

		if (!emailValue.includes('@')) {
			errorMessage = 'Please enter a valid email address';
			return;
		}

		uiState = 'authenticating';
		errorMessage = null;

		try {
			// Step 1: Get authentication options from server
			const optionsRes = await fetch('/api/auth/passkey/authenticate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'options',
					email: emailValue
				})
			});

			if (!optionsRes.ok) {
				const error = await optionsRes.json();
				throw new Error(error.message || 'Failed to get authentication options');
			}

			const { options, sessionId } = await optionsRes.json();

			// Step 2: Trigger browser's WebAuthn ceremony
			const authResp = await startAuthentication({ optionsJSON: options });

			// Step 3: Verify the authentication with server
			const verifyRes = await fetch('/api/auth/passkey/authenticate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'verify',
					response: authResp,
					sessionId
				})
			});

			if (!verifyRes.ok) {
				const error = await verifyRes.json();
				throw new Error(error.message || 'Authentication failed');
			}

			const result = await verifyRes.json();

			if (result.success) {
				// Server has set auth-session cookie
				// Refresh page state or trigger callback
				onauthenticated?.();

				// Refresh the page to load user session
				await invalidateAll();
			} else {
				throw new Error('Authentication failed');
			}
		} catch (err) {
			console.error('Passkey authentication error:', err);
			uiState = 'idle';

			if (err instanceof Error) {
				// User-friendly error messages
				if (err.message.includes('abort')) {
					errorMessage = 'Authentication cancelled.';
				} else if (err.message.includes('timeout')) {
					errorMessage = 'Authentication timed out. Please try again.';
				} else if (err.message.includes('not found') || err.message.includes('No passkey')) {
					errorMessage = 'No passkey found for this email. Sign in with OAuth first.';
				} else if (err.message.includes('credential')) {
					errorMessage = 'Passkey not recognized. Try signing in with OAuth.';
				} else {
					errorMessage = err.message;
				}
			} else {
				errorMessage = 'An unexpected error occurred. Please try again.';
			}
		}
	}

	function dismissError() {
		errorMessage = null;
	}
</script>

{#if isSupported}
	<div class="space-y-3">
		<!-- Divider (if not first element) -->
		<div class="flex items-center gap-3">
			<div class="h-px flex-1 bg-slate-200"></div>
			<span class="text-xs font-medium text-slate-400">or</span>
			<div class="h-px flex-1 bg-slate-200"></div>
		</div>

		<!-- Passkey login section -->
		<div class="space-y-2">
			{#if showEmailInput}
				<!-- Email input field -->
				<input
					type="email"
					bind:value={localEmail}
					placeholder="your.email@example.com"
					onkeydown={(e) => {
						if (e.key === 'Enter' && uiState ==='idle') {
							handleAuthenticate();
						}
					}}
					class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
				/>
			{/if}

			<!-- Passkey button -->
			<button
				onclick={handleAuthenticate}
				disabled={uiState ==='authenticating'}
				class="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 shadow-sm transition-all hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900 active:scale-[0.98] disabled:cursor-wait disabled:opacity-90"
			>
				{#if uiState ==='authenticating'}
					<Loader2 class="h-4 w-4 animate-spin text-emerald-600" />
					<span class="text-emerald-900">Verifying...</span>
				{:else}
					<Fingerprint class="h-4 w-4 text-emerald-600" />
					<span>Sign in with Passkey</span>
				{/if}
			</button>

			<!-- Error message -->
			{#if errorMessage}
				<div class="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm">
					<AlertCircle class="h-4 w-4 flex-shrink-0 text-red-600" />
					<div class="flex-1">
						<p class="text-red-700">{errorMessage}</p>
					</div>
					<button
						onclick={dismissError}
						class="text-red-400 transition-colors hover:text-red-600"
						aria-label="Dismiss error"
					>
						<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
