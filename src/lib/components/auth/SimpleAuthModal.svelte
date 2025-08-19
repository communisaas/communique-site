<script lang="ts">
	import { X } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { funnelAnalytics } from '$lib/analytics/funnel';

	let {
		isOpen = false,
		onClose = () => {},
		template
	}: {
		isOpen: boolean;
		onClose: () => void;
		template: any;
	} = $props();

	async function handleAuth(provider: string) {
		// Store return URL via secure cookie to avoid leaking state through query
		try {
			await fetch('/auth/prepare', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ returnTo: window.location.href })
			});
		} catch {}

		// Optional: mark onboarding start if not already captured
		if (template?.id) {
			funnelAnalytics.trackOnboardingStarted(template.id, 'direct-link');
		}
		window.location.href = `/auth/${provider}`;
	}
</script>

{#if isOpen}
	<!-- Simple Modal - No Complex System -->
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
		<div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
			<!-- Header -->
			<div class="mb-6 flex items-center justify-between">
				<h2 class="text-xl font-semibold text-slate-900">Sign in to continue</h2>
				<button onclick={onClose} aria-label="Close" class="text-slate-400 hover:text-slate-600">
					<X class="h-5 w-5" />
				</button>
			</div>

			<!-- OAuth Buttons -->
			<div class="space-y-3">
				<Button
					onclick={() => handleAuth('google')}
					classNames="w-full bg-blue-600 hover:bg-blue-700 text-white"
				>
					<svg class="mr-2 h-4 w-4" viewBox="0 0 24 24">
						<path
							fill="currentColor"
							d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
						/>
						<path
							fill="currentColor"
							d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
						/>
						<path
							fill="currentColor"
							d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
						/>
						<path
							fill="currentColor"
							d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
						/>
					</svg>
					Continue with Google
				</Button>

				<Button
					onclick={() => handleAuth('facebook')}
					classNames="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white"
				>
					<svg class="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
						<path
							d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
						/>
					</svg>
					Continue with Facebook
				</Button>
			</div>

			<!-- Next step hint -->
			<div class="mt-4 rounded-lg bg-slate-50 p-3 text-center">
				<p class="text-sm text-slate-600">
					{template?.deliveryMethod === 'both'
						? 'Next: Add your address to contact Congress'
						: 'Next: Send your message'}
				</p>
			</div>
		</div>
	</div>
{/if}
