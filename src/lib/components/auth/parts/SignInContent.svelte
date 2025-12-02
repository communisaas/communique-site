<script lang="ts">
	import { Users } from 'lucide-svelte';
	import { modalActions } from '$lib/stores/modalSystem.svelte';
	import AuthButtons from './AuthButtons.svelte';

	let { onauth, onclose } = $props();

	async function handleAuth(provider: string) {
		try {
			// Prepare secure return cookie then redirect to OAuth
			await fetch('/auth/prepare', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ returnTo: window.location.pathname })
			});

			onauth?.(provider);
		} catch {
			console.error('Error occurred');
			onauth?.(provider);
		}
	}
</script>

<!-- Header -->
<div class="px-8 pb-6 pt-8 text-center">
	<div class="relative mb-6 inline-flex h-20 w-20 items-center justify-center">
		<!-- Pulse Effect -->
		<div
			class="absolute inset-0 animate-ping rounded-full bg-emerald-100 opacity-75 duration-[3000ms]"
		></div>
		<!-- Main Node -->
		<div
			class="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-50 to-teal-50 shadow-sm ring-1 ring-emerald-100"
		>
			<Users class="h-10 w-10 text-emerald-600 opacity-90" strokeWidth={1.5} />
		</div>
	</div>
	<h2 class="mb-2 text-2xl font-bold text-slate-900">Welcome to Communiqué</h2>
</div>

<!-- Auth Options -->
<div class="px-8 pb-6">
	<AuthButtons onAuth={handleAuth} />
</div>

<!-- Value Props -->
<div class="border-t border-slate-100 bg-slate-50 px-8 py-6">
	<h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
		Your account lets you
	</h3>
	<div class="space-y-2">
		<div class="flex items-start gap-3">
			<div
				class="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-blue-600"
			>
				<svg class="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="3"
						d="M5 13l4 4L19 7"
					/>
				</svg>
			</div>
			<p class="text-sm text-slate-600">Track message delivery and impact</p>
		</div>
		<div class="flex items-start gap-3">
			<div
				class="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-blue-600"
			>
				<svg class="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="3"
						d="M5 13l4 4L19 7"
					/>
				</svg>
			</div>
			<p class="text-sm text-slate-600">Save and share your own templates</p>
		</div>
		<div class="flex items-start gap-3">
			<div
				class="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-blue-600"
			>
				<svg class="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="3"
						d="M5 13l4 4L19 7"
					/>
				</svg>
			</div>
			<p class="text-sm text-slate-600">Join coordination efforts in your district</p>
		</div>
	</div>
</div>

<!-- Footer -->
<div class="border-t border-slate-100 bg-slate-50 px-8 py-4 text-center">
	<p class="text-xs text-slate-500">
		By verifying, you agree to our Terms of Service and Privacy Policy
	</p>
</div>

<style>
	@keyframes fill {
		from {
			width: 0%;
		}
		to {
			width: 100%;
		}
	}
</style>
