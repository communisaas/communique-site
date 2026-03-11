<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function pct(num: number, denom: number): string {
		if (denom === 0) return '0.0%';
		return (num / denom * 100).toFixed(1) + '%';
	}

	function formatDate(iso: string | null): string {
		if (!iso) return '--';
		return new Date(iso).toLocaleDateString('en-US', {
			month: 'short', day: 'numeric', year: 'numeric',
			hour: 'numeric', minute: '2-digit'
		});
	}

	const metricLabels: Record<string, string> = {
		open: 'Open Rate',
		click: 'Click Rate',
		verified_action: 'Verified Action Rate'
	};

	function isWinner(variant: typeof data.variants[0]): boolean {
		if (!data.isAbTest || data.variants.length < 2) return false;
		const a = data.variants[0];
		const b = data.variants[1];
		if (!a || !b) return false;
		const metric = data.abConfig?.winnerMetric ?? 'open';
		const scoreA = getScore(a, metric);
		const scoreB = getScore(b, metric);
		if (variant?.abVariant === 'A') return scoreA >= scoreB;
		return scoreB > scoreA;
	}

	function getScore(v: typeof data.variants[0], metric: string): number {
		if (!v) return 0;
		const sent = v.totalSent || 1;
		if (metric === 'click') return v.totalClicked / sent;
		return v.totalOpened / sent;
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center gap-4">
		<a
			href="/org/{data.org.slug}/emails"
			class="text-zinc-500 hover:text-zinc-300 transition-colors"
			aria-label="Back to emails"
		>
			<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
			</svg>
		</a>
		<div>
			<h1 class="text-xl font-semibold text-zinc-100">
				{#if data.isAbTest}A/B Test Results{:else}Email Details{/if}
			</h1>
			<p class="text-sm text-zinc-500 mt-1">
				{data.blast.subject}
			</p>
		</div>
	</div>

	{#if data.isAbTest && data.variants.length >= 2}
		{@const config = data.abConfig}

		<!-- Config summary -->
		<div class="rounded-lg border border-zinc-800/40 bg-zinc-900/20 px-4 py-3 flex items-center gap-6 text-xs text-zinc-500">
			<span>Winner by: <span class="text-zinc-300">{metricLabels[config?.winnerMetric ?? 'open']}</span></span>
			<span>Test group: <span class="text-zinc-300">{config?.testGroupPct ?? 20}%</span></span>
			<span>Split: <span class="text-zinc-300">{config?.splitPct ?? 50}/{100 - (config?.splitPct ?? 50)}</span></span>
			{#if data.variants[0]?.abWinnerPickedAt}
				<span>Winner picked: <span class="text-zinc-300">{formatDate(data.variants[0].abWinnerPickedAt)}</span></span>
			{:else}
				<span class="text-amber-400">Waiting for results...</span>
			{/if}
		</div>

		<!-- Side-by-side comparison -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			{#each data.variants as variant, i (variant?.id ?? i)}
				{#if variant}
					{@const winner = isWinner(variant)}
					<div class="rounded-xl border {winner ? 'border-teal-500/30 bg-teal-500/5' : 'border-zinc-800/60 bg-zinc-900/30'} p-6 space-y-4">
						<div class="flex items-center justify-between">
							<h2 class="text-lg font-medium text-zinc-100">Variant {variant.abVariant}</h2>
							{#if winner && data.variants[0]?.abWinnerPickedAt}
								<span class="rounded-md bg-teal-500/15 border border-teal-500/20 px-2 py-0.5 text-xs font-mono text-teal-400">WINNER</span>
							{/if}
						</div>

						<p class="text-sm text-zinc-300 truncate">{variant.subject}</p>

						<div class="grid grid-cols-2 gap-3">
							<div class="rounded-lg bg-zinc-800/40 px-3 py-2.5">
								<p class="text-xs text-zinc-500">Sent</p>
								<p class="text-lg font-mono tabular-nums text-zinc-100">{variant.totalSent.toLocaleString()}</p>
							</div>
							<div class="rounded-lg bg-zinc-800/40 px-3 py-2.5">
								<p class="text-xs text-zinc-500">Opened</p>
								<p class="text-lg font-mono tabular-nums text-zinc-100">{variant.totalOpened.toLocaleString()}</p>
								<p class="text-xs font-mono text-zinc-500">{pct(variant.totalOpened, variant.totalSent)}</p>
							</div>
							<div class="rounded-lg bg-zinc-800/40 px-3 py-2.5">
								<p class="text-xs text-zinc-500">Clicked</p>
								<p class="text-lg font-mono tabular-nums text-zinc-100">{variant.totalClicked.toLocaleString()}</p>
								<p class="text-xs font-mono text-zinc-500">{pct(variant.totalClicked, variant.totalSent)}</p>
							</div>
							<div class="rounded-lg bg-zinc-800/40 px-3 py-2.5">
								<p class="text-xs text-zinc-500">Bounced</p>
								<p class="text-lg font-mono tabular-nums text-zinc-100">{variant.totalBounced.toLocaleString()}</p>
								<p class="text-xs font-mono text-zinc-500">{pct(variant.totalBounced, variant.totalSent)}</p>
							</div>
						</div>

						<p class="text-xs text-zinc-600">Sent {formatDate(variant.sentAt)}</p>
					</div>
				{/if}
			{/each}
		</div>

		<!-- Winner send info -->
		{#if data.winnerBlast}
			<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-6 space-y-2">
				<h3 class="text-sm font-medium text-zinc-300">Winner Send</h3>
				<p class="text-sm text-zinc-400">
					Winning variant sent to {data.winnerBlast.totalSent.toLocaleString()} remaining recipients
					{#if data.winnerBlast.sentAt}on {formatDate(data.winnerBlast.sentAt)}{/if}
				</p>
				<div class="flex gap-4 text-xs text-zinc-500 font-mono">
					<span>{data.winnerBlast.totalOpened} opened ({pct(data.winnerBlast.totalOpened, data.winnerBlast.totalSent)})</span>
					<span>{data.winnerBlast.totalClicked} clicked ({pct(data.winnerBlast.totalClicked, data.winnerBlast.totalSent)})</span>
				</div>
			</div>
		{/if}
	{:else}
		<!-- Non-A/B blast detail -->
		<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-6">
			<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
				<div>
					<p class="text-xs text-zinc-500">Sent</p>
					<p class="text-xl font-mono tabular-nums text-zinc-100">{data.blast.totalSent.toLocaleString()}</p>
				</div>
				<div>
					<p class="text-xs text-zinc-500">Opened</p>
					<p class="text-xl font-mono tabular-nums text-zinc-100">{data.blast.totalOpened.toLocaleString()}</p>
					<p class="text-xs font-mono text-zinc-500">{pct(data.blast.totalOpened, data.blast.totalSent)}</p>
				</div>
				<div>
					<p class="text-xs text-zinc-500">Clicked</p>
					<p class="text-xl font-mono tabular-nums text-zinc-100">{data.blast.totalClicked.toLocaleString()}</p>
					<p class="text-xs font-mono text-zinc-500">{pct(data.blast.totalClicked, data.blast.totalSent)}</p>
				</div>
				<div>
					<p class="text-xs text-zinc-500">Bounced</p>
					<p class="text-xl font-mono tabular-nums text-zinc-100">{data.blast.totalBounced.toLocaleString()}</p>
					<p class="text-xs font-mono text-zinc-500">{pct(data.blast.totalBounced, data.blast.totalSent)}</p>
				</div>
			</div>
		</div>
	{/if}
</div>
