<script lang="ts">
	import { untrack } from 'svelte';
	import {
		Shield,
		FileText,
		ChevronRight,
		TrendingUp,
		Lock,
		Check,
		Smartphone
	} from '@lucide/svelte';
	import { isDigitalCredentialsSupported } from '$lib/core/identity/digital-credentials-api';

	interface Props {
		/** Show compact version (for inline contexts) */
		compact?: boolean;
		/** Pre-selected verification method */
		defaultMethod?: 'nfc' | 'government-id' | 'mdl' | null;
		onselect?: (data: { method: 'nfc' | 'government-id' | 'mdl' }) => void;
	}

	let { compact = false, defaultMethod = null, onselect }: Props = $props();

	let selectedMethod = $state<'nfc' | 'government-id' | 'mdl' | null>(untrack(() => defaultMethod));
	let mdlSupported = isDigitalCredentialsSupported();

	function selectMethod(method: 'nfc' | 'government-id' | 'mdl') {
		selectedMethod = method;
		onselect?.({ method });
	}
</script>

<div class="space-y-6">
	<!-- Value Proposition Header -->
	{#if !compact}
		<div class="text-center">
			<h2 class="mb-2 text-2xl font-bold text-slate-900">Make Your Voice Heard</h2>
			<p class="text-slate-600">
				Prove you're a real constituent — not a bot, not spam, not someone from another district
			</p>
		</div>
	{/if}

	<!-- Verification Method Selection -->
	<div class="space-y-4">
		<h3 class="text-sm font-medium text-slate-900">
			{compact ? 'Choose verification method:' : 'Choose how to verify:'}
		</h3>

		<!-- Digital ID (mDL) — shown first when supported (fastest/most private) -->
		{#if mdlSupported}
			<button
				type="button"
				onclick={() => selectMethod('mdl')}
				class="group relative w-full rounded-xl border-2 bg-white p-6 text-left transition-all hover:border-blue-300 hover:shadow-lg {selectedMethod ===
				'mdl'
					? 'border-blue-500 ring-4 ring-blue-100'
					: 'border-slate-200'}"
			>
				<!-- Fastest Badge -->
				<div
					class="absolute -top-3 left-4 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-md"
				>
					Fastest
				</div>

				<div class="flex items-start gap-4">
					<!-- Icon -->
					<div
						class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md"
					>
						<Smartphone class="h-6 w-6 text-white" />
					</div>

					<!-- Content -->
					<div class="flex-1">
						<div class="mb-2 flex items-center gap-2">
							<h4 class="text-lg font-semibold text-slate-900">Verify with Digital ID</h4>
							<span class="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
								10 seconds
							</span>
						</div>

						<p class="mb-3 text-sm text-slate-600">
							Use your state-issued digital driver's license — fastest, most private
						</p>

						<!-- Benefits -->
						<ul class="space-y-1.5 text-sm">
							<li class="flex items-start gap-2 text-slate-700">
								<Check class="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
								<span><span class="font-medium">10 seconds</span> verification time</span>
							</li>
							<li class="flex items-start gap-2 text-slate-700">
								<Check class="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
								<span
									><span class="font-medium">Maximum privacy</span> — browser-native verification</span
								>
							</li>
							<li class="flex items-start gap-2 text-slate-700">
								<Check class="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
								<span
									><span class="font-medium">No photos, no scans</span> — cryptographic proof</span
								>
							</li>
						</ul>
					</div>

					<!-- Selection Indicator -->
					<div class="flex-shrink-0">
						{#if selectedMethod === 'mdl'}
							<div
								class="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white"
							>
								<Check class="h-4 w-4" />
							</div>
						{:else}
							<ChevronRight
								class="h-6 w-6 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-blue-600"
							/>
						{/if}
					</div>
				</div>
			</button>
		{/if}

		<!-- NFC Passport (Recommended) -->
		<button
			type="button"
			onclick={() => selectMethod('nfc')}
			class="group relative w-full rounded-xl border-2 bg-white p-6 text-left transition-all hover:border-blue-300 hover:shadow-lg {selectedMethod ===
			'nfc'
				? 'border-blue-500 ring-4 ring-blue-100'
				: 'border-slate-200'}"
		>
			<!-- Recommended Badge -->
			<div
				class="absolute -top-3 left-4 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1 text-xs font-semibold text-white shadow-md"
			>
				Recommended
			</div>

			<div class="flex items-start gap-4">
				<!-- Icon -->
				<div
					class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md"
				>
					<Shield class="h-6 w-6 text-white" />
				</div>

				<!-- Content -->
				<div class="flex-1">
					<div class="mb-2 flex items-center gap-2">
						<h4 class="text-lg font-semibold text-slate-900">NFC Passport</h4>
						<span class="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
							{mdlSupported ? '30 seconds' : 'Fastest'}
						</span>
					</div>

					<p class="mb-3 text-sm text-slate-600">
						Tap your passport with your phone for instant verification. Maximum privacy, highest
						trust.
					</p>

					<!-- Benefits -->
					<ul class="space-y-1.5 text-sm">
						<li class="flex items-start gap-2 text-slate-700">
							<Check class="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
							<span><span class="font-medium">30 seconds</span> verification time</span>
						</li>
						<li class="flex items-start gap-2 text-slate-700">
							<Check class="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
							<span
								><span class="font-medium">High credibility</span> with congressional offices</span
							>
						</li>
						<li class="flex items-start gap-2 text-slate-700">
							<Check class="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
							<span
								><span class="font-medium">100% private</span> – data never leaves your device</span
							>
						</li>
					</ul>
				</div>

				<!-- Selection Indicator -->
				<div class="flex-shrink-0">
					{#if selectedMethod === 'nfc'}
						<div
							class="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white"
						>
							<Check class="h-4 w-4" />
						</div>
					{:else}
						<ChevronRight
							class="h-6 w-6 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-blue-600"
						/>
					{/if}
				</div>
			</div>
		</button>

		<!-- Government ID (Alternative) -->
		<button
			type="button"
			onclick={() => selectMethod('government-id')}
			class="group relative w-full rounded-xl border-2 bg-white p-6 text-left transition-all hover:border-slate-300 hover:shadow-lg {selectedMethod ===
			'government-id'
				? 'border-slate-500 ring-4 ring-slate-100'
				: 'border-slate-200'}"
		>
			<div class="flex items-start gap-4">
				<!-- Icon -->
				<div
					class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 shadow-sm"
				>
					<FileText class="h-6 w-6 text-slate-700" />
				</div>

				<!-- Content -->
				<div class="flex-1">
					<div class="mb-2 flex items-center gap-2">
						<h4 class="text-lg font-semibold text-slate-900">Government ID</h4>
						<span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
							Alternative
						</span>
					</div>

					<p class="mb-3 text-sm text-slate-600">
						Use your driver's license or state ID if you don't have an NFC-enabled passport.
					</p>

					<!-- Benefits -->
					<ul class="space-y-1.5 text-sm">
						<li class="flex items-start gap-2 text-slate-700">
							<Check class="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-600" />
							<span><span class="font-medium">2-3 minutes</span> verification time</span>
						</li>
						<li class="flex items-start gap-2 text-slate-700">
							<Check class="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-600" />
							<span
								><span class="font-medium">No passport required</span> – any government ID works</span
							>
						</li>
						<li class="flex items-start gap-2 text-slate-700">
							<Check class="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-600" />
							<span>
								<span class="font-medium">Secure processing</span> – ID verified by trusted partner
							</span>
						</li>
					</ul>
				</div>

				<!-- Selection Indicator -->
				<div class="flex-shrink-0">
					{#if selectedMethod === 'government-id'}
						<div
							class="flex h-6 w-6 items-center justify-center rounded-full bg-slate-600 text-white"
						>
							<Check class="h-4 w-4" />
						</div>
					{:else}
						<ChevronRight
							class="h-6 w-6 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-slate-600"
						/>
					{/if}
				</div>
			</div>
		</button>
	</div>

	<!-- Privacy Guarantee Footer -->
	{#if !compact}
		<div class="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6">
			<div class="flex items-start gap-4">
				<div class="rounded-full bg-green-100 p-3">
					<Lock class="h-6 w-6 text-green-700" />
				</div>
				<div class="flex-1 space-y-2">
					<h4 class="font-semibold text-slate-900">Your privacy is our foundation</h4>
					<div class="space-y-1 text-sm text-slate-700">
						<p class="flex items-start gap-2">
							<span class="text-green-600">✓</span>
							<span>
								<span class="font-medium">Your address never leaves this device.</span> We use cryptographic
								proofs to verify your district without storing your location.
							</span>
						</p>
						<p class="flex items-start gap-2">
							<span class="text-green-600">✓</span>
							<span>
								<span class="font-medium">Congressional offices see:</span> "✓ Verified constituent from
								[Your District]" – not your personal information.
							</span>
						</p>
						<p class="flex items-start gap-2">
							<span class="text-green-600">✓</span>
							<span>
								<span class="font-medium">We store:</span> Verification status + timestamp. That's it.
							</span>
						</p>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
