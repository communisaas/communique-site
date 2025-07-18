<script lang="ts">
	import { page } from '$app/stores';
	import { Mail, MessageCircle } from '@lucide/svelte';

	// Get return URL from query params
	$: returnTo = $page.url.searchParams.get('returnTo') || '/dashboard';

	function handleGoogleLogin() {
		window.location.href = `/auth/google?returnTo=${encodeURIComponent(returnTo)}`;
	}

	function handleTwitterLogin() {
		window.location.href = `/auth/twitter?returnTo=${encodeURIComponent(returnTo)}`;
	}

	function handleFacebookLogin() {
		window.location.href = `/auth/facebook?returnTo=${encodeURIComponent(returnTo)}`;
	}

	function handleLinkedInLogin() {
		window.location.href = `/auth/linkedin?returnTo=${encodeURIComponent(returnTo)}`;
	}

	function handleDiscordLogin() {
		window.location.href = `/auth/discord?returnTo=${encodeURIComponent(returnTo)}`;
	}
</script>

<svelte:head>
	<title>Sign In - Communique</title>
	<meta name="description" content="Sign in to send your message to decision makers" />
</svelte:head>

<div
	class="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 sm:px-6 lg:px-8"
>
	<div class="w-full max-w-md space-y-8">
		<div class="text-center">
			<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-600">
				<Mail class="h-6 w-6 text-white" />
			</div>
			<h2 class="mt-6 text-3xl font-bold text-gray-900">Ready to send your message?</h2>
			<p class="mt-2 text-sm text-gray-600">
				Sign in to personalize your message and track its impact
			</p>
		</div>

		<div class="mt-8 space-y-4">
			<button
				type="button"
				on:click={handleGoogleLogin}
				class="group relative flex w-full justify-center rounded-md border border-transparent bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-md transition-all duration-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
			>
				<span class="absolute inset-y-0 left-0 flex items-center pl-3">
					<svg class="h-5 w-5" viewBox="0 0 24 24">
						<path
							fill="#4285F4"
							d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
						/>
						<path
							fill="#34A853"
							d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
						/>
						<path
							fill="#FBBC05"
							d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
						/>
						<path
							fill="#EA4335"
							d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
						/>
					</svg>
				</span>
				Continue with Google
			</button>

			<button
				type="button"
				on:click={handleTwitterLogin}
				class="group relative flex w-full justify-center rounded-md border border-transparent bg-black px-4 py-3 text-sm font-medium text-white shadow-md transition-all duration-200 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
			>
				<span class="absolute inset-y-0 left-0 flex items-center pl-3">
					<MessageCircle class="h-5 w-5" />
				</span>
				Continue with Twitter
			</button>

			<button
				type="button"
				on:click={handleFacebookLogin}
				class="group relative flex w-full justify-center rounded-md border border-transparent bg-blue-800 px-4 py-3 text-sm font-medium text-white shadow-md transition-all duration-200 hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
			>
				<span class="absolute inset-y-0 left-0 flex items-center pl-3">
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
						<path
							d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-1.5c-1.38 0-1.5.62-1.5 1.44V12h3l-.5 3h-2.5v6.8c4.56-.93 8-4.96 8-9.8z"
						/>
					</svg>
				</span>
				Continue with Facebook
			</button>

			<button
				type="button"
				on:click={handleLinkedInLogin}
				class="group relative flex w-full justify-center rounded-md border border-transparent bg-blue-700 px-4 py-3 text-sm font-medium text-white shadow-md transition-all duration-200 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
			>
				<span class="absolute inset-y-0 left-0 flex items-center pl-3">
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
						<path
							d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
						/>
					</svg>
				</span>
				Continue with LinkedIn
			</button>

			<button
				type="button"
				on:click={handleDiscordLogin}
				class="group relative flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-3 text-sm font-medium text-white shadow-md transition-all duration-200 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
			>
				<span class="absolute inset-y-0 left-0 flex items-center pl-3">
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
						<path
							d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"
						/>
					</svg>
				</span>
				Continue with Discord
			</button>
		</div>

		<div class="text-center">
			<p class="text-xs text-gray-500">
				By continuing, you agree to our Terms of Service and Privacy Policy
			</p>
		</div>

		<!-- Social proof for users coming from social media -->
		<div class="mt-8 text-center">
			<p class="mb-4 text-sm text-gray-600">Join thousands making their voices heard</p>
			<div class="flex justify-center space-x-8 text-sm text-gray-500">
				<div class="text-center">
					<div class="font-semibold text-blue-600">47K+</div>
					<div>Messages sent</div>
				</div>
				<div class="text-center">
					<div class="font-semibold text-green-600">2.1K+</div>
					<div>Responses</div>
				</div>
				<div class="text-center">
					<div class="font-semibold text-purple-600">890+</div>
					<div>Policy changes</div>
				</div>
			</div>
		</div>
	</div>
</div>
