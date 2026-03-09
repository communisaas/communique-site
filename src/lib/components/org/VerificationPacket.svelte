<script lang="ts">
	import { spring } from 'svelte/motion';

	interface TierCount {
		tier: number;
		label: string;
		count: number;
	}

	interface Packet {
		total: number;
		verified: number;
		verifiedPct: number;
		gds: number | null;
		ald: number | null;
		temporalEntropy: number | null;
		burstVelocity: number | null;
		cai: number | null;
		tiers: TierCount[];
		districtCount: number;
		lastUpdated: string;
	}

	let {
		packet,
		showDebate = false,
		label = 'Verification Packet'
	}: {
		packet: Packet | null;
		showDebate?: boolean;
		label?: string;
	} = $props();

	// Spring-animated values: stiffness 0.15, damping 0.8 — weighted, inevitable
	const springOpts = { stiffness: 0.15, damping: 0.8 };
	const animVerified = spring(0, springOpts);
	const animTotal = spring(0, springOpts);
	const animPct = spring(0, springOpts);
	const animGds = spring(0, springOpts);
	const animAld = spring(0, springOpts);
	const animDistricts = spring(0, springOpts);

	$effect(() => {
		if (packet) {
			animVerified.set(packet.verified);
			animTotal.set(packet.total);
			animPct.set(packet.verifiedPct);
			animGds.set(packet.gds ?? 0);
			animAld.set(packet.ald ?? 0);
			animDistricts.set(packet.districtCount);
		}
	});

	function fmt(n: number): string {
		return Math.round(n).toLocaleString('en-US');
	}

	function fmtScore(n: number, hasValue: boolean): string {
		if (!hasValue) return '\u2014';
		return n.toFixed(2);
	}

	// Tier bar: max width relative to largest tier (-1 = suppressed for k-anonymity)
	function tierBarWidth(tiers: TierCount[], tier: TierCount): string {
		if (tier.count <= 0) return '2%';
		const max = Math.max(...tiers.map((t) => t.count), 1);
		return `${Math.max((tier.count / max) * 100, 2)}%`;
	}

	// Tier color by level
	function tierColor(tier: number): string {
		switch (tier) {
			case 4: return 'bg-emerald-500';
			case 3: return 'bg-emerald-500/70';
			case 2: return 'bg-teal-500/60';
			case 1: return 'bg-teal-500/40';
			default: return 'bg-zinc-600';
		}
	}

	// Coordination integrity score quality indicator
	function scoreQuality(val: number | null): string {
		if (val === null) return 'text-zinc-600';
		if (val >= 0.8) return 'text-emerald-400';
		if (val >= 0.5) return 'text-teal-400';
		return 'text-zinc-400';
	}

	const isEmpty = $derived(!packet || packet.total === 0);

	// Non-null packet accessor for use inside {:else} block where isEmpty is false
	const p = $derived(packet!);

</script>

<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-6 space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<p class="text-xs font-mono uppercase tracking-wider text-zinc-500">{label}</p>
		{#if packet && !isEmpty}
			<span class="text-[10px] font-mono text-zinc-700">
				{new Date(packet.lastUpdated).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
			</span>
		{/if}
	</div>

	{#if isEmpty}
		<!-- Empty state -->
		<div class="py-6 text-center">
			<p class="font-mono tabular-nums text-3xl font-bold text-zinc-700">0</p>
			<p class="text-xs text-zinc-600 mt-2">No actions recorded yet</p>
			<p class="text-xs text-zinc-700 mt-1">Verification conditions will accumulate here once the campaign is active.</p>
		</div>
	{:else}
		<!-- Primary counts: verified / total / % -->
		<div class="grid grid-cols-3 gap-6">
			<div>
				<p class="font-mono tabular-nums text-3xl font-bold text-emerald-400">
					{fmt($animVerified)}
				</p>
				<p class="text-xs text-zinc-500 mt-1">verified</p>
			</div>
			<div>
				<p class="font-mono tabular-nums text-3xl font-bold text-zinc-100">
					{fmt($animTotal)}
				</p>
				<p class="text-xs text-zinc-500 mt-1">total</p>
			</div>
			<div>
				<p class="font-mono tabular-nums text-3xl font-bold text-zinc-100">
					{fmt($animPct)}<span class="text-lg text-zinc-500">%</span>
				</p>
				<p class="text-xs text-zinc-500 mt-1">verified rate</p>
			</div>
		</div>

		<!-- Progress bar -->
		<div class="h-2 rounded-full bg-zinc-800 overflow-hidden">
			<div
				class="h-2 rounded-full bg-emerald-500/60 transition-all duration-700 ease-out"
				style="width: {Math.min($animPct, 100)}%"
			></div>
		</div>

		<!-- Coordination integrity scores -->
		<div>
			<p class="text-[10px] font-mono uppercase tracking-wider text-zinc-600 mb-3">Coordination Integrity</p>
			<div class="grid grid-cols-5 gap-3">
				<div class="text-center" title="Geographic Diversity Score: How spread across districts are the actions? Higher = more diverse.">
					<p class="font-mono tabular-nums text-lg font-semibold {scoreQuality(p.gds)}">
						{fmtScore($animGds, p.gds !== null)}
					</p>
					<p class="text-[10px] text-zinc-600 mt-0.5">Geo Spread</p>
				</div>
				<div class="text-center" title="Author Linkage Diversity: How unique are the messages? Higher = more original content.">
					<p class="font-mono tabular-nums text-lg font-semibold {scoreQuality(p.ald)}">
						{fmtScore($animAld, p.ald !== null)}
					</p>
					<p class="text-[10px] text-zinc-600 mt-0.5">Msg Unique</p>
				</div>
				<div class="text-center" title="Temporal Entropy: How spread over time are the actions? Higher = more organic timing.">
					<p class="font-mono tabular-nums text-lg font-semibold {scoreQuality(p.temporalEntropy)}">
						{p.temporalEntropy !== null ? p.temporalEntropy.toFixed(1) : '\u2014'}
					</p>
					<p class="text-[10px] text-zinc-600 mt-0.5">Time Spread</p>
				</div>
				<div class="text-center" title="Burst Velocity: Peak vs average action rate. Low = organic, high = coordinated surge.">
					<p class="font-mono tabular-nums text-lg font-semibold {p.burstVelocity !== null && p.burstVelocity > 5 ? 'text-amber-400' : 'text-zinc-400'}">
						{p.burstVelocity !== null ? p.burstVelocity.toFixed(1) : '\u2014'}
					</p>
					<p class="text-[10px] text-zinc-600 mt-0.5">Burst</p>
				</div>
				<div class="text-center" title="Coordination Authenticity Index: Ratio of long-term engaged participants. Higher = deeper engagement.">
					<p class="font-mono tabular-nums text-lg font-semibold {scoreQuality(p.cai)}">
						{p.cai !== null ? p.cai.toFixed(2) : '\u2014'}
					</p>
					<p class="text-[10px] text-zinc-600 mt-0.5">Depth</p>
				</div>
			</div>
		</div>

		<!-- Tier distribution -->
		<div>
			<p class="text-[10px] font-mono uppercase tracking-wider text-zinc-600 mb-3">Tier Distribution</p>
			<div class="space-y-1.5">
				{#each [...p.tiers].reverse() as tier}
					<div class="flex items-center gap-3">
						<span class="w-20 text-[10px] font-mono text-zinc-500 text-right">
							{tier.label}
							<span class="text-zinc-700">T{tier.tier}</span>
						</span>
						<div class="flex-1 h-4 rounded bg-zinc-800/60 overflow-hidden">
							<div
								class="h-full rounded {tierColor(tier.tier)} transition-all duration-700 ease-out"
								style="width: {tierBarWidth(p.tiers, tier)}"
							></div>
						</div>
						<span class="w-10 text-xs font-mono tabular-nums text-zinc-500 text-right" title={tier.count === -1 ? 'Suppressed for privacy (fewer than 5)' : ''}>
							{tier.count === -1 ? '<5' : tier.count}
						</span>
					</div>
				{/each}
			</div>
		</div>

		<!-- Geographic spread -->
		<div class="flex items-center justify-between rounded-lg border border-zinc-800/40 bg-zinc-950/30 px-4 py-3">
			<div class="flex items-center gap-2">
				<svg class="w-4 h-4 text-teal-500/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
					<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
				</svg>
				<span class="text-xs text-zinc-500">districts reached</span>
			</div>
			<span class="font-mono tabular-nums text-lg font-semibold text-teal-400">
				{fmt($animDistricts)}
			</span>
		</div>
	{/if}
</div>
