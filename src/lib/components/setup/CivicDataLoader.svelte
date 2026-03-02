<script lang="ts">
	/**
	 * CivicDataLoader — First-time IPFS data setup.
	 *
	 * Shows meaningful progress while district data, officials, and
	 * Merkle snapshot are fetched from IPFS and cached in IndexedDB.
	 *
	 * Voice: factual, imperative. No emotional framing.
	 * "District data" not "civic identity". Show what's happening.
	 */
	import { spring } from 'svelte/motion';
	import { fade, fly } from 'svelte/transition';
	import { HardDrive, Wifi, WifiOff, RefreshCw, CheckCircle2, AlertTriangle } from '@lucide/svelte';

	export type LoadStage =
		| 'checking-cache'
		| 'fetching-mapping'
		| 'fetching-officials'
		| 'fetching-snapshot'
		| 'caching'
		| 'ready'
		| 'error';

	export interface LoadProgress {
		stage: LoadStage;
		bytesLoaded?: number;
		bytesTotal?: number;
		gatewayIndex?: number;
		gatewayCount?: number;
		error?: string;
		cached?: boolean;
		stale?: boolean;
	}

	let {
		progress,
		onRetry,
		compact = false
	}: {
		progress: LoadProgress;
		onRetry?: () => void;
		compact?: boolean;
	} = $props();

	// Smooth progress bar
	const progressPercent = spring(0, { stiffness: 0.08, damping: 0.9 });

	// Stage weights for overall progress (total = 100)
	const stageWeights: Record<LoadStage, number> = {
		'checking-cache': 5,
		'fetching-mapping': 25,    // 3-5 MB
		'fetching-officials': 5,   // 504 KB
		'fetching-snapshot': 55,   // 15-25 MB (the big one)
		'caching': 8,
		'ready': 100,
		'error': 0
	};

	// Cumulative progress up to current stage start
	const stageCumulative: Record<LoadStage, number> = {
		'checking-cache': 0,
		'fetching-mapping': 5,
		'fetching-officials': 30,
		'fetching-snapshot': 35,
		'caching': 90,
		'ready': 100,
		'error': 0
	};

	$effect(() => {
		if (progress.stage === 'ready') {
			progressPercent.set(100);
			return;
		}
		if (progress.stage === 'error') return;

		const base = stageCumulative[progress.stage] ?? 0;
		const weight = stageWeights[progress.stage] ?? 0;

		if (progress.bytesTotal && progress.bytesTotal > 0 && progress.bytesLoaded !== undefined) {
			const fraction = Math.min(progress.bytesLoaded / progress.bytesTotal, 1);
			progressPercent.set(base + weight * fraction);
		} else {
			progressPercent.set(base + weight * 0.5);
		}
	});

	const stageLabel: Record<LoadStage, string> = {
		'checking-cache': 'Checking local data',
		'fetching-mapping': 'Fetching district boundaries',
		'fetching-officials': 'Fetching officials',
		'fetching-snapshot': 'Fetching Merkle snapshot',
		'caching': 'Caching locally',
		'ready': 'Ready',
		'error': 'Failed'
	};

	const isActive = $derived(
		progress.stage !== 'ready' && progress.stage !== 'error'
	);

	const bytesDisplay = $derived.by(() => {
		if (!progress.bytesLoaded) return null;
		const loaded = (progress.bytesLoaded / (1024 * 1024)).toFixed(1);
		if (progress.bytesTotal) {
			const total = (progress.bytesTotal / (1024 * 1024)).toFixed(1);
			return `${loaded} / ${total} MB`;
		}
		return `${loaded} MB`;
	});
</script>

{#if progress.cached && !progress.stale && progress.stage === 'ready'}
	<!-- Warm start: data already cached. Show nothing or minimal indicator -->
{:else if progress.stale && progress.stage === 'ready'}
	<!-- Stale cache refreshed in background — brief confirmation -->
	<div
		class="flex items-center gap-2 text-xs text-slate-400 py-1"
		in:fade={{ duration: 200 }}
		out:fade={{ duration: 300 }}
	>
		<HardDrive class="h-3 w-3" />
		<span>District data updated</span>
	</div>
{:else if progress.stage === 'error'}
	<!-- Error state with retry -->
	<div
		class="rounded-lg border border-red-200/60 bg-red-50/50 px-4 py-3"
		in:fly={{ y: 8, duration: 200 }}
	>
		<div class="flex items-start gap-3">
			<AlertTriangle class="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
			<div class="flex-1 min-w-0">
				<p class="text-sm font-medium text-red-900">District data unavailable</p>
				<p class="text-xs text-red-700 mt-0.5">
					{progress.error ?? 'IPFS gateways unreachable.'}
					{#if progress.gatewayIndex !== undefined && progress.gatewayCount}
						Tried {progress.gatewayIndex + 1} of {progress.gatewayCount} mirrors.
					{/if}
				</p>
			</div>
			{#if onRetry}
				<button
					onclick={onRetry}
					class="flex items-center gap-1.5 rounded-md bg-red-100 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-200 transition-colors shrink-0"
				>
					<RefreshCw class="h-3 w-3" />
					Retry
				</button>
			{/if}
		</div>
	</div>
{:else if isActive}
	<!-- Active loading state -->
	<div
		class={compact ? 'py-2' : 'rounded-lg border border-slate-200/60 bg-slate-50/50 px-4 py-3'}
		in:fly={{ y: 8, duration: 200 }}
	>
		<div class="space-y-2">
			<!-- Stage label + byte counter -->
			<div class="flex items-center justify-between gap-2">
				<div class="flex items-center gap-2 min-w-0">
					{#if progress.stage === 'checking-cache'}
						<HardDrive class="h-3.5 w-3.5 text-slate-400 shrink-0" />
					{:else}
						<Wifi class="h-3.5 w-3.5 text-teal-500 shrink-0" />
					{/if}
					<span class="text-sm text-slate-700 truncate">
						{stageLabel[progress.stage]}
					</span>
				</div>
				{#if bytesDisplay}
					<span class="font-mono text-xs text-slate-400 tabular-nums shrink-0">
						{bytesDisplay}
					</span>
				{/if}
			</div>

			<!-- Progress bar -->
			<div class="h-1 rounded-full bg-slate-200/80 overflow-hidden">
				<div
					class="h-full rounded-full bg-teal-500 transition-none"
					style="width: {$progressPercent}%"
				></div>
			</div>

			<!-- Gateway fallback indicator -->
			{#if progress.gatewayIndex !== undefined && progress.gatewayIndex > 0 && progress.gatewayCount}
				<p class="text-[11px] text-slate-400">
					Mirror {progress.gatewayIndex + 1} of {progress.gatewayCount}
				</p>
			{/if}
		</div>

		<!-- Context: first-time only, not compact mode -->
		{#if !compact && progress.stage === 'fetching-mapping'}
			<p class="text-[11px] text-slate-400 mt-2">
				One-time download. Stored on your device — no server needed after this.
			</p>
		{/if}
	</div>
{:else if progress.stage === 'ready' && !progress.cached}
	<!-- Just finished loading (cold start complete) — brief confirmation -->
	<div
		class="flex items-center gap-2 text-xs text-emerald-600 py-1"
		in:fly={{ y: 4, duration: 200 }}
		out:fade={{ duration: 1500 }}
	>
		<CheckCircle2 class="h-3.5 w-3.5" />
		<span>District data cached locally</span>
	</div>
{/if}
