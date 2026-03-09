<script lang="ts">
	import VerificationPacket from '$lib/components/org/VerificationPacket.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function fmt(n: number): string {
		return n.toLocaleString('en-US');
	}
</script>

<div class="space-y-6">
	<!-- Page title -->
	<div>
		<h1 class="text-xl font-semibold text-zinc-100">Dashboard</h1>
		<p class="text-sm text-zinc-500 mt-1">Verification conditions for {data.org.name}</p>
	</div>

	<!-- Verification packet — primary surface -->
	<VerificationPacket
		packet={data.packet}
		label={data.stats.activeCampaigns > 0
			? `Verification Packet \u00b7 ${data.stats.activeCampaigns} active campaign${data.stats.activeCampaigns === 1 ? '' : 's'}`
			: 'Verification Packet'}
	/>

	<!-- Quick stats -->
	<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
		<div class="rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-4">
			<p class="font-mono tabular-nums text-2xl font-bold text-zinc-100">{fmt(data.stats.supporters)}</p>
			<p class="text-xs text-zinc-500">Supporters</p>
		</div>
		<div class="rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-4">
			<p class="font-mono tabular-nums text-2xl font-bold text-zinc-100">{fmt(data.stats.campaigns)}</p>
			<p class="text-xs text-zinc-500">Campaigns</p>
		</div>
		<div class="rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-4">
			<p class="font-mono tabular-nums text-2xl font-bold text-zinc-100">{fmt(data.stats.templates)}</p>
			<p class="text-xs text-zinc-500">Templates</p>
		</div>
		<div class="rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-4">
			<p class="text-xs text-zinc-500">Role</p>
			<p class="font-mono text-sm text-zinc-300 mt-1">{data.membership.role}</p>
		</div>
	</div>

	<!-- Getting started (only when no supporters) -->
	{#if data.stats.supporters === 0}
		<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-6">
			<p class="text-sm font-medium text-zinc-300 mb-3">Get started</p>
			<div class="space-y-2">
				<a href="/org/{data.org.slug}/supporters/import" class="flex items-center gap-3 text-sm text-zinc-400 hover:text-teal-400 transition-colors">
					<span class="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center text-xs text-zinc-500">1</span>
					Import supporters from CSV or Action Network
				</a>
				<a href="/org/{data.org.slug}/campaigns" class="flex items-center gap-3 text-sm text-zinc-400 hover:text-teal-400 transition-colors">
					<span class="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center text-xs text-zinc-500">2</span>
					Create your first campaign
				</a>
			</div>
		</div>
	{/if}
</div>
