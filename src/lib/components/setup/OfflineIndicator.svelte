<script lang="ts">
	/**
	 * OfflineIndicator — Shows what works without network.
	 *
	 * Once IPFS data is cached, district lookup + officials work offline.
	 * This indicator shows capability status, not connection status.
	 *
	 * Voice: factual. State what works.
	 */
	import { fade } from 'svelte/transition';
	import { HardDrive, WifiOff, Wifi } from '@lucide/svelte';
	import { browser } from '$app/environment';

	let {
		dataCached = false,
		compact = false
	}: {
		dataCached?: boolean;
		compact?: boolean;
	} = $props();

	let isOffline = $state(false);

	$effect(() => {
		if (!browser) return;
		isOffline = !navigator.onLine;
		const goOffline = () => { isOffline = true; };
		const goOnline = () => { isOffline = false; };
		window.addEventListener('offline', goOffline);
		window.addEventListener('online', goOnline);
		return () => {
			window.removeEventListener('offline', goOffline);
			window.removeEventListener('online', goOnline);
		};
	});

	let expanded = $state(false);
</script>

{#if isOffline && dataCached}
	<!-- Offline but functional — show what works -->
	<div
		class="rounded-lg border border-slate-200/60 bg-slate-50/50 px-3 py-2"
		in:fade={{ duration: 200 }}
	>
		<button
			class="flex items-center gap-2 w-full text-left"
			onclick={() => (expanded = !expanded)}
		>
			<WifiOff class="h-3.5 w-3.5 text-slate-400 shrink-0" />
			<span class="text-xs font-medium text-slate-600 flex-1">Offline — district data available</span>
			<span class="text-[10px] text-slate-400">{expanded ? '−' : '+'}</span>
		</button>
		{#if expanded}
			<div class="mt-2 pl-5.5 space-y-1 text-[11px] text-slate-500" in:fade={{ duration: 150 }}>
				<p class="flex items-center gap-1.5">
					<span class="h-1 w-1 rounded-full bg-emerald-400"></span>
					District lookup
				</p>
				<p class="flex items-center gap-1.5">
					<span class="h-1 w-1 rounded-full bg-emerald-400"></span>
					Officials
				</p>
				<p class="flex items-center gap-1.5">
					<span class="h-1 w-1 rounded-full bg-emerald-400"></span>
					Template browsing
				</p>
				<p class="flex items-center gap-1.5">
					<span class="h-1 w-1 rounded-full bg-slate-300"></span>
					<span class="text-slate-400">Sending messages</span>
				</p>
				<p class="flex items-center gap-1.5">
					<span class="h-1 w-1 rounded-full bg-slate-300"></span>
					<span class="text-slate-400">Registering positions</span>
				</p>
			</div>
		{/if}
	</div>
{:else if isOffline && !dataCached}
	<!-- Offline and no data — can't do much -->
	<div
		class="flex items-center gap-2 rounded-lg border border-red-200/60 bg-red-50/30 px-3 py-2"
		in:fade={{ duration: 200 }}
	>
		<WifiOff class="h-3.5 w-3.5 text-red-400 shrink-0" />
		<span class="text-xs text-red-700">Offline. Connect to load district data.</span>
	</div>
{:else if !isOffline && dataCached && !compact}
	<!-- Online with cached data — subtle indicator -->
	<button
		class="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-500 transition-colors"
		onclick={() => (expanded = !expanded)}
	>
		<HardDrive class="h-3 w-3" />
		<span>District data stored locally</span>
	</button>
	{#if expanded}
		<div class="mt-1 pl-4.5 text-[11px] text-slate-400" in:fade={{ duration: 150 }}>
			<p>Works offline. No server needed for district lookup or officials.</p>
		</div>
	{/if}
{/if}
