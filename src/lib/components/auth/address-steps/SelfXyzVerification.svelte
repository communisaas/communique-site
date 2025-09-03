<script lang="ts">
	import { Shield, QrCode, Smartphone } from '@lucide/svelte';
	
	let {
		selfXyzQrCode
	}: {
		selfXyzQrCode: string | null;
	} = $props();
</script>

<div class="mb-6 text-center">
	<h2 class="mb-2 text-xl font-bold text-slate-900">Boost Your Impact</h2>
	<p class="text-sm text-slate-600">
		Verify your identity with Self.xyz for enhanced credibility with representatives
	</p>
</div>

<!-- Enhanced Credibility Explanation -->
<div
	class="mb-4 rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-3"
>
	<div class="flex items-start gap-3">
		<Shield class="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
		<div class="flex-1">
			<h3 class="mb-1 text-sm font-semibold text-blue-900">
				Enhanced Credibility Available
			</h3>
			<p class="text-xs text-blue-700">
				Passport verification through Self.xyz adds significant weight to your message
				with congressional offices.
			</p>
		</div>
	</div>
</div>

<!-- QR Code Display -->
{#if selfXyzQrCode}
	<div class="mb-6 flex justify-center">
		<div class="rounded-lg border border-slate-200 bg-white p-4">
			<div class="flex h-48 w-48 items-center justify-center rounded-lg bg-gray-100">
				<div class="text-center">
					<QrCode class="mx-auto mb-2 h-12 w-12 text-gray-400" />
					<p class="text-xs text-gray-500">
						QR Code: {selfXyzQrCode.slice(0, 20)}...
					</p>
					<p class="mt-1 text-xs text-gray-400">Use Self.xyz app to scan</p>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Instructions -->
<div class="mb-4 space-y-3">
	<div class="flex items-start gap-3 rounded-lg bg-indigo-50 p-3">
		<Smartphone class="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
		<div>
			<h3 class="text-sm font-medium text-indigo-900">1. Open Self App</h3>
			<p class="mt-1 text-xs text-indigo-700">Download Self.xyz app</p>
		</div>
	</div>

	<div class="flex items-start gap-3 rounded-lg bg-indigo-50 p-3">
		<QrCode class="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
		<div>
			<h3 class="text-sm font-medium text-indigo-900">2. Scan Code</h3>
			<p class="mt-1 text-xs text-indigo-700">Point camera at QR code</p>
		</div>
	</div>

	<div class="flex items-start gap-3 rounded-lg bg-indigo-50 p-3">
		<Shield class="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
		<div>
			<h3 class="text-sm font-medium text-indigo-900">3. Verify Passport</h3>
			<p class="mt-1 text-xs text-indigo-700">Follow app instructions</p>
		</div>
	</div>
</div>

<!-- Waiting Status -->
<div class="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
	<div class="flex items-center justify-center gap-2 text-slate-600">
		<div class="flex gap-1">
			<div class="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500"></div>
			<div
				class="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500"
				style="animation-delay: 0.1s"
			></div>
			<div
				class="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500"
				style="animation-delay: 0.2s"
			></div>
		</div>
		<span class="text-sm">Waiting for verification...</span>
	</div>
</div>