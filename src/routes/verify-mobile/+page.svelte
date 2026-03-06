<script lang="ts">
	import { page } from '$app/stores';
	import { AlertCircle } from '@lucide/svelte';
	import GovernmentCredentialVerification from '$lib/components/auth/GovernmentCredentialVerification.svelte';

	const session = $derived($page.url.searchParams.get('session'));

	let verificationComplete = $state(false);
	let verificationError = $state<string | null>(null);

	function handleComplete(data: { verified: boolean; district?: string }) {
		if (data.verified) {
			verificationComplete = true;
		}
	}

	function handleError(data: { message: string }) {
		verificationError = data.message;
	}
</script>

<svelte:head>
	<title>Mobile Identity Verification | Commons</title>
</svelte:head>

<div class="flex min-h-[calc(100vh-48px)] items-center justify-center px-4 py-8">
	<div class="w-full max-w-md">
		{#if !session}
			<!-- No session param — invalid link -->
			<div class="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
				<div class="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
					<AlertCircle class="h-6 w-6 text-red-600" />
				</div>
				<h1 class="text-lg font-semibold text-red-900">Invalid verification link</h1>
				<p class="mt-2 text-sm text-red-700">
					This link is missing a session token. Scan the QR code from your desktop browser to get a valid link.
				</p>
			</div>
		{:else if verificationComplete}
			<!-- Success — tell user to return to desktop -->
			<div class="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
				<div class="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
					<span class="text-2xl">&#10003;</span>
				</div>
				<h1 class="text-lg font-semibold text-green-900">Verification complete</h1>
				<p class="mt-2 text-sm text-green-700">
					You can close this tab and return to your desktop browser.
				</p>
			</div>
		{:else}
			<!-- Verification flow -->
			<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
				<h1 class="mb-1 text-center text-lg font-semibold text-slate-900">Mobile Identity Verification</h1>
				<p class="mb-6 text-center text-sm text-slate-500">
					Verify your identity using your phone's digital wallet.
				</p>

				{#if verificationError}
					<div class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
						{verificationError}
					</div>
				{/if}

				<GovernmentCredentialVerification
					userId={session}
					oncomplete={handleComplete}
					onerror={handleError}
				/>
			</div>
		{/if}
	</div>
</div>
