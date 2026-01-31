<script lang="ts">
	/**
	 * AuthButtons — Perceptually-Engineered OAuth Provider Selection
	 *
	 * Design principles (from perceptual-engineering skill):
	 * 1. Visual hierarchy matches trust hierarchy (Sybil resistance)
	 * 2. Working memory: exactly 4 providers (4±1 chunk limit)
	 * 3. Recognition over recall: all buttons show names
	 * 4. Space as structure: 2+2 layout creates clear grouping
	 *
	 * Trust tiers:
	 * - Primary (full-width): Coinbase ⭐⭐⭐⭐⭐, Google ⭐⭐⭐⭐, LinkedIn ⭐⭐⭐⭐
	 * - Secondary (half-width): Facebook ⭐⭐⭐, X/Twitter ⭐⭐
	 */
	import { Loader2 } from 'lucide-svelte';

	let { onAuth } = $props<{ onAuth: (provider: string) => Promise<void> | void }>();
	let loadingProvider = $state<string | null>(null);

	async function handleAuthClick(provider: string) {
		if (loadingProvider) return;
		loadingProvider = provider;

		try {
			await onAuth(provider);
		} catch (error) {
			console.error('Auth error:', error);
			loadingProvider = null;
		}
	}

	// Primary providers: HIGH Sybil resistance (phone verification, professional identity)
	const primaryProviders = [
		{ provider: 'coinbase', name: 'Coinbase', color: '#0052FF' },  // KYC-verified
		{ provider: 'google', name: 'Google', color: '#4285F4' },
		{ provider: 'linkedin', name: 'LinkedIn', color: '#0077B5' }
	];

	// Secondary providers: MODERATE/LOW Sybil resistance
	const secondaryProviders = [
		{ provider: 'facebook', name: 'Facebook', color: '#1877F2' },
		{ provider: 'twitter', name: 'X', color: '#000000' }
	];
</script>

<div class="space-y-2">
	<!-- Primary providers: HIGH trust (Google, LinkedIn) -->
	{#each primaryProviders as auth}
		<button
			onclick={() => handleAuthClick(auth.provider)}
			disabled={loadingProvider !== null}
			class="relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 transition-all duration-300 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm active:scale-[0.98] disabled:cursor-wait disabled:opacity-100"
		>
			<!-- Fluid fill on loading (300ms timing = RHYTHM.beat) -->
			{#if loadingProvider === auth.provider}
				<div
					class="absolute inset-0 z-0 origin-left animate-[fill_2s_ease-out_forwards]"
					style="background-color: {auth.color};"
				></div>
			{/if}

			<div
				class="relative z-10 flex items-center gap-3 transition-colors duration-300"
				class:text-white={loadingProvider === auth.provider}
			>
				{#if loadingProvider === auth.provider}
					<Loader2 class="h-5 w-5 animate-spin" />
					<span>Connecting...</span>
				{:else}
					{#if auth.provider === 'coinbase'}
						<!-- Coinbase: KYC-verified exchange -->
						<svg class="h-5 w-5" viewBox="0 0 24 24" fill="#0052FF">
							<path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 19.5c-4.142 0-7.5-3.358-7.5-7.5S7.858 4.5 12 4.5s7.5 3.358 7.5 7.5-3.358 7.5-7.5 7.5zm3.75-7.5c0 2.071-1.679 3.75-3.75 3.75S8.25 14.071 8.25 12 9.929 8.25 12 8.25s3.75 1.679 3.75 3.75z"/>
						</svg>
					{:else if auth.provider === 'google'}
						<!-- Google: Multi-color logo (brand recognition) -->
						<svg class="h-5 w-5" viewBox="0 0 24 24">
							<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
							<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
							<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
							<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
						</svg>
					{:else}
						<!-- LinkedIn: Professional network badge -->
						<svg class="h-5 w-5" viewBox="0 0 24 24" fill="#0077B5">
							<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
						</svg>
					{/if}
					<span>Continue with {auth.name}</span>
				{/if}
			</div>
		</button>
	{/each}

	<!-- Secondary providers: MODERATE/LOW trust (Facebook, X) — 2-column grid with names -->
	<div class="grid grid-cols-2 gap-2">
		{#each secondaryProviders as auth}
			<button
				onclick={() => handleAuthClick(auth.provider)}
				disabled={loadingProvider !== null}
				class="relative flex items-center justify-center gap-2 overflow-hidden rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-all duration-300 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm active:scale-[0.98] disabled:cursor-wait disabled:opacity-50"
			>
				{#if loadingProvider === auth.provider}
					<div
						class="absolute inset-0 z-0 animate-[fill_2s_ease-out_forwards]"
						style="background-color: {auth.color}; opacity: 0.15;"
					></div>
					<Loader2 class="relative z-10 h-4 w-4 animate-spin" />
					<span class="relative z-10 text-xs">Connecting...</span>
				{:else}
					{#if auth.provider === 'facebook'}
						<!-- Facebook: Classic blue badge -->
						<div class="flex h-4 w-4 items-center justify-center rounded bg-[#1877F2] text-xs font-bold text-white">
							f
						</div>
					{:else}
						<!-- X/Twitter: Mathematical symbol -->
						<div class="flex h-4 w-4 items-center justify-center rounded bg-black text-xs font-bold text-white">
							𝕏
						</div>
					{/if}
					<span>{auth.name}</span>
				{/if}
			</button>
		{/each}
	</div>
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
