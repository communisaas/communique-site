<script lang="ts">
	import { Shield, TrendingUp, ChevronRight } from '@lucide/svelte';
	import { createEventDispatcher } from 'svelte';

	interface Props {
		/** Compact inline version */
		variant?: 'full' | 'compact' | 'banner';
		/** Show as dismissible banner */
		dismissible?: boolean;
	}

	let { variant = 'full', dismissible = false }: Props = $props();

	let dismissed = $state(false);

	const dispatch = createEventDispatcher<{
		verify: void;
		dismiss: void;
	}>();

	function handleVerify() {
		dispatch('verify');
	}

	function handleDismiss() {
		dismissed = true;
		dispatch('dismiss');
	}
</script>

{#if !dismissed}
	{#if variant === 'banner'}
		<!-- Banner Prompt -->
		<div
			class="relative overflow-hidden rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4"
		>
			<div class="flex items-center gap-4">
				<div class="rounded-full bg-blue-100 p-3">
					<Shield class="h-6 w-6 text-blue-600" />
				</div>

				<div class="flex-1">
					<div class="flex items-center gap-2">
						<h3 class="font-semibold text-slate-900">Boost Your Impact</h3>
						<span
							class="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700"
						>
							3x Response Rate
						</span>
					</div>
					<p class="mt-1 text-sm text-slate-600">
						Verify your identity to significantly increase the impact of your message with Congress
					</p>
				</div>

				<button
					type="button"
					onclick={handleVerify}
					class="flex-shrink-0 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg"
				>
					<span class="flex items-center gap-2">
						<span>Verify Now</span>
						<ChevronRight class="h-4 w-4" />
					</span>
				</button>

				{#if dismissible}
					<button
						type="button"
						onclick={handleDismiss}
						class="flex-shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
						aria-label="Dismiss"
					>
						<svg
							class="h-5 w-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				{/if}
			</div>
		</div>
	{:else if variant === 'compact'}
		<!-- Compact Card Prompt -->
		<div
			class="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm"
		>
			<div class="mb-4 flex items-start justify-between">
				<div class="flex items-start gap-3">
					<div class="rounded-full bg-blue-100 p-2.5">
						<Shield class="h-5 w-5 text-blue-600" />
					</div>
					<div>
						<h3 class="font-semibold text-slate-900">Verify Your Identity</h3>
						<p class="mt-1 text-sm text-slate-600">
							Verified constituents get priority attention from congressional offices
						</p>
					</div>
				</div>
			</div>

			<div class="mb-4 grid grid-cols-2 gap-3">
				<div class="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
					<div class="mb-1 flex items-center justify-center gap-1 text-xl font-bold text-green-700">
						<TrendingUp class="h-5 w-5" />
						<span>3x</span>
					</div>
					<p class="text-xs font-medium text-green-900">Response Rate</p>
				</div>

				<div class="rounded-lg border border-blue-200 bg-blue-50 p-3 text-center">
					<div class="mb-1 text-xl font-bold text-blue-700">87%</div>
					<p class="text-xs font-medium text-blue-900">Offices Prioritize</p>
				</div>
			</div>

			<button
				type="button"
				onclick={handleVerify}
				class="w-full rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg"
			>
				<span class="flex items-center justify-center gap-2">
					<Shield class="h-4 w-4" />
					<span>Start Verification</span>
					<ChevronRight class="h-4 w-4" />
				</span>
			</button>

			<p class="mt-3 text-center text-xs text-slate-600">
				<span class="font-medium">100% private</span> – Your address never stored
			</p>
		</div>
	{:else}
		<!-- Full Card Prompt -->
		<div class="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
			<div class="mb-6 text-center">
				<div
					class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg"
				>
					<Shield class="h-8 w-8 text-white" />
				</div>
				<h2 class="mb-2 text-2xl font-bold text-slate-900">Amplify Your Voice</h2>
				<p class="text-slate-600">
					Verified constituents receive significantly higher response rates from Congress
				</p>
			</div>

			<!-- Statistics -->
			<div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
				<div class="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
					<div
						class="mb-1 flex items-center justify-center gap-1 text-2xl font-bold text-green-700"
					>
						<TrendingUp class="h-6 w-6" />
						<span>3x</span>
					</div>
					<p class="text-sm font-medium text-green-900">Higher Response Rate</p>
					<p class="mt-1 text-xs text-green-700">vs. unverified messages</p>
				</div>

				<div class="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center">
					<div class="mb-1 text-2xl font-bold text-blue-700">87%</div>
					<p class="text-sm font-medium text-blue-900">Offices Prioritize</p>
					<p class="mt-1 text-xs text-blue-700">verified constituent mail</p>
				</div>

				<div class="rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-center">
					<div class="mb-1 text-2xl font-bold text-indigo-700">30 sec</div>
					<p class="text-sm font-medium text-indigo-900">Verification Time</p>
					<p class="mt-1 text-xs text-indigo-700">with NFC passport</p>
				</div>
			</div>

			<!-- Privacy Guarantee -->
			<div class="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
				<p class="mb-2 text-sm font-semibold text-green-900">Privacy Protected:</p>
				<ul class="space-y-1 text-sm text-green-800">
					<li class="flex items-start gap-2">
						<span class="text-green-600">✓</span>
						<span>Your address <strong>never leaves this device</strong></span>
					</li>
					<li class="flex items-start gap-2">
						<span class="text-green-600">✓</span>
						<span>We only store: verification status + timestamp</span>
					</li>
					<li class="flex items-start gap-2">
						<span class="text-green-600">✓</span>
						<span>Congress sees: "✓ Verified constituent from [District]"</span>
					</li>
				</ul>
			</div>

			<!-- CTA -->
			<button
				type="button"
				onclick={handleVerify}
				class="w-full rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-base font-semibold text-white shadow-lg transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl"
			>
				<span class="flex items-center justify-center gap-2">
					<Shield class="h-5 w-5" />
					<span>Start Verification</span>
					<ChevronRight class="h-5 w-5" />
				</span>
			</button>

			<p class="mt-4 text-center text-sm text-slate-600">
				Takes 30 seconds with NFC passport or 2-3 minutes with government ID
			</p>
		</div>
	{/if}
{/if}
