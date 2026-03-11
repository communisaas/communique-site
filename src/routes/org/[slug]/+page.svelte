<script lang="ts">
	import VerificationPacket from '$lib/components/org/VerificationPacket.svelte';
	import OnboardingChecklist from '$lib/components/org/OnboardingChecklist.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function fmt(n: number): string {
		return n.toLocaleString('en-US');
	}

	function relativeTime(iso: string): string {
		const diff = Date.now() - new Date(iso).getTime();
		if (diff < 0) return 'just now'; // I5: guard clock skew / future timestamps
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		return `${days}d ago`;
	}

	function statusColor(status: string): string {
		switch (status) {
			case 'ACTIVE': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
			case 'DRAFT': return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20';
			case 'PAUSED': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
			case 'COMPLETE': return 'text-teal-400 bg-teal-500/10 border-teal-500/20';
			default: return 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20';
		}
	}

	function tierColor(tier: number): string {
		switch (tier) {
			case 4: return 'bg-emerald-500';
			case 3: return 'bg-emerald-500/70';
			case 2: return 'bg-teal-500/60';
			case 1: return 'bg-teal-500/40';
			default: return 'bg-zinc-600';
		}
	}

	// Funnel percentages (relative to imported)
	const funnel = $derived(data.funnel);
	const funnelMax = $derived(Math.max(funnel.imported, 1));
	const funnelSteps = $derived([
		{ label: 'Imported', count: funnel.imported, pct: 100 },
		{ label: 'Postal Resolved', count: funnel.postalResolved, pct: Math.round((funnel.postalResolved / funnelMax) * 100) },
		{ label: 'Identity Verified', count: funnel.identityVerified, pct: Math.round((funnel.identityVerified / funnelMax) * 100) },
		{ label: 'District Verified', count: funnel.districtVerified, pct: Math.round((funnel.districtVerified / funnelMax) * 100) }
	]);

	// Tier distribution
	const tierTotal = $derived(data.tiers.reduce((s, t) => s + t.count, 0));
	const tierMax = $derived(Math.max(...data.tiers.map(t => t.count), 1));

	// Endorsement management state
	let endorsedList = $state(data.endorsedTemplates ?? []);
	let searchQuery = $state('');
	let searchResults = $state<Array<{
		id: string; slug: string; title: string; description: string;
		verified_sends: number; unique_districts: number; similarity: number | null;
	}>>([]);
	let searching = $state(false);
	let searchTimeout: ReturnType<typeof setTimeout> | null = null;
	let errorFlash = $state('');
	let errorTimeout: ReturnType<typeof setTimeout> | null = null;

	const endorsedIds = $derived(new Set(endorsedList.map(e => e.templateId)));

	function showError(msg: string): void {
		errorFlash = msg;
		if (errorTimeout) clearTimeout(errorTimeout);
		errorTimeout = setTimeout(() => { errorFlash = ''; }, 3000);
	}

	function handleSearchInput(e: Event): void {
		const q = (e.target as HTMLInputElement).value;
		searchQuery = q;
		if (searchTimeout) clearTimeout(searchTimeout);
		if (q.trim().length < 2) {
			searchResults = [];
			return;
		}
		searching = true;
		searchTimeout = setTimeout(async () => {
			try {
				const res = await fetch('/api/templates/search', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						query: q.trim(),
						limit: 5,
						excludeIds: [...endorsedIds]
					})
				});
				if (res.ok) {
					const json = await res.json();
					searchResults = json.templates ?? [];
				}
			} catch { /* graceful */ }
			searching = false;
		}, 300);
	}

	async function endorseTemplate(templateId: string): Promise<void> {
		const found = searchResults.find(t => t.id === templateId);
		if (!found) return;

		const optimisticEntry = {
			id: crypto.randomUUID(),
			templateId: found.id,
			slug: found.slug,
			title: found.title,
			description: found.description,
			sends: found.verified_sends,
			districts: found.unique_districts ?? 0,
			endorsedAt: new Date().toISOString()
		};
		endorsedList = [optimisticEntry, ...endorsedList];
		searchResults = searchResults.filter(t => t.id !== templateId);

		try {
			const res = await fetch(`/api/org/${data.org.slug}/endorsements`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ templateId })
			});
			if (!res.ok) {
				endorsedList = endorsedList.filter(e => e.id !== optimisticEntry.id);
				searchResults = [found, ...searchResults];
				showError('Failed to endorse — try again');
			}
		} catch {
			endorsedList = endorsedList.filter(e => e.id !== optimisticEntry.id);
			searchResults = [found, ...searchResults];
			showError('Network error — try again');
		}
	}

	async function removeEndorsement(templateId: string): Promise<void> {
		const prevList = endorsedList;
		endorsedList = endorsedList.filter(e => e.templateId !== templateId);

		try {
			const res = await fetch(`/api/org/${data.org.slug}/endorsements`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ templateId })
			});
			if (!res.ok) {
				endorsedList = prevList;
				showError('Failed to remove — try again');
			}
		} catch {
			endorsedList = prevList;
			showError('Network error — try again');
		}
	}
</script>

<div class="space-y-6">
	<!-- Page title -->
	<div>
		<h1 class="text-xl font-semibold text-zinc-100">Dashboard</h1>
		<p class="text-sm text-zinc-500 mt-1">Verification signals for {data.org.name}</p>
	</div>

	<!-- ===== Onboarding Checklist (first-run) ===== -->
	{#if !data.onboardingComplete}
		<OnboardingChecklist
			orgSlug={data.org.slug}
			onboarding={data.onboardingState}
			orgDescription={data.org.description}
			billingEmail={data.org.billing_email ?? null}
		/>
	{/if}

	<!-- ===== SECTION 1: Verification Funnel ===== -->
	<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-6">
		<p class="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-4">Verification Funnel</p>

		{#if funnel.imported === 0}
			<div class="py-4 text-center">
				<p class="text-sm text-zinc-600">No supporters yet. Import supporters to see verification progress.</p>
			</div>
		{:else}
			<div class="space-y-3">
				{#each funnelSteps as step, i}
					<div class="flex items-center gap-4">
						<div class="w-32 flex items-center gap-2">
							<span class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono {step.count > 0 ? 'bg-teal-500/20 text-teal-400' : 'bg-zinc-800 text-zinc-600'}">
								{i + 1}
							</span>
							<span class="text-xs text-zinc-400 truncate">{step.label}</span>
						</div>
						<div class="flex-1 h-6 rounded bg-zinc-800/60 overflow-hidden relative">
							<div
								class="h-full rounded transition-all duration-700 ease-out {i === 0 ? 'bg-zinc-600' : i === 1 ? 'bg-teal-500/40' : i === 2 ? 'bg-teal-500/60' : 'bg-emerald-500/70'}"
								style="width: {Math.max(step.pct, 1)}%"
							></div>
							{#if step.count > 0}
								<span class="absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-mono tabular-nums text-zinc-400">
									{step.pct}%
								</span>
							{/if}
						</div>
						<span class="w-16 text-right font-mono tabular-nums text-sm text-zinc-300">
							{fmt(step.count)}
						</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- ===== SECTION 2: Tier Distribution ===== -->
	<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-6">
		<div class="flex items-center justify-between mb-4">
			<p class="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Engagement Tier Distribution</p>
			{#if tierTotal > 0}
				<span class="text-xs font-mono tabular-nums text-zinc-600">{fmt(tierTotal)} actions</span>
			{/if}
		</div>

		{#if tierTotal === 0}
			<div class="py-4 text-center">
				<p class="text-sm text-zinc-600">No campaign actions yet. Tier distribution will appear as supporters take action.</p>
			</div>
		{:else}
			<div class="space-y-2">
				{#each [...data.tiers].reverse() as tier}
					<div class="flex items-center gap-3">
						<span class="w-24 text-[10px] font-mono text-zinc-500 text-right">
							{tier.label}
							<span class="text-zinc-700">T{tier.tier}</span>
						</span>
						<div class="flex-1 h-5 rounded bg-zinc-800/60 overflow-hidden">
							<div
								class="h-full rounded {tierColor(tier.tier)} transition-all duration-700 ease-out"
								style="width: {tier.count > 0 ? Math.max((tier.count / tierMax) * 100, 2) : 0}%"
							></div>
						</div>
						<span class="w-14 text-xs font-mono tabular-nums text-zinc-500 text-right">
							{fmt(tier.count)}
						</span>
						<span class="w-10 text-[10px] font-mono tabular-nums text-zinc-600 text-right">
							{Math.round((tier.count / tierTotal) * 100)}%
						</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- ===== Verification Packet (Coordination Integrity) ===== -->
	<VerificationPacket
		packet={data.packet}
		label={data.stats.activeCampaigns > 0
			? `Coordination Integrity \u00b7 ${data.stats.activeCampaigns} active campaign${data.stats.activeCampaigns === 1 ? '' : 's'}`
			: 'Coordination Integrity'}
	/>

	<!-- ===== SECTION 3: Campaign List ===== -->
	<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-6">
		<div class="flex items-center justify-between mb-4">
			<p class="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Campaigns</p>
			<a
				href="/org/{data.org.slug}/campaigns"
				class="text-xs text-zinc-600 hover:text-teal-400 transition-colors"
			>
				View all
			</a>
		</div>

		{#if data.campaigns.length === 0}
			<div class="py-4 text-center">
				<p class="text-sm text-zinc-600">No campaigns yet.</p>
				<a
					href="/org/{data.org.slug}/campaigns/new"
					class="inline-block mt-2 text-xs text-teal-500 hover:text-teal-400 transition-colors"
				>
					Create your first campaign
				</a>
			</div>
		{:else}
			<div class="space-y-2">
				{#each data.campaigns as campaign (campaign.id)}
					<a
						href="/org/{data.org.slug}/campaigns/{campaign.id}"
						class="flex items-center gap-3 rounded-lg border border-zinc-800/40 bg-zinc-950/40 px-4 py-3 transition-colors hover:border-teal-900/40 group"
					>
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<p class="text-sm font-medium text-zinc-200 group-hover:text-teal-400 transition-colors truncate">
									{campaign.title}
								</p>
								<span class="text-[10px] font-mono px-1.5 py-0.5 rounded border {statusColor(campaign.status)} flex-shrink-0">
									{campaign.status}
								</span>
							</div>
							<p class="text-xs text-zinc-600 mt-0.5">
								{campaign.type}
								<span class="text-zinc-700 mx-1">&middot;</span>
								{fmt(campaign.verifiedActions)} verified / {fmt(campaign.totalActions)} total
								<span class="text-zinc-700 mx-1">&middot;</span>
								{relativeTime(campaign.updatedAt)}
							</p>
						</div>
						{#if campaign.totalActions > 0}
							{@const pct = Math.round((campaign.verifiedActions / campaign.totalActions) * 100)}
							<div class="flex-shrink-0 w-12 h-12 relative">
								<!-- Mini verified-rate ring -->
								<svg viewBox="0 0 36 36" class="w-12 h-12 -rotate-90">
									<circle cx="18" cy="18" r="15" fill="none" stroke-width="3"
										class="stroke-zinc-800" />
									<circle cx="18" cy="18" r="15" fill="none" stroke-width="3"
										stroke-dasharray="{pct * 0.942} {(100 - pct) * 0.942}"
										class="stroke-teal-500/60" />
								</svg>
								<span class="absolute inset-0 flex items-center justify-center text-[9px] font-mono tabular-nums text-zinc-400">
									{pct}%
								</span>
							</div>
						{/if}
					</a>
				{/each}
			</div>
		{/if}
	</div>

	<!-- ===== SECTION 4: Quick Actions ===== -->
	<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
		<a
			href="/org/{data.org.slug}/campaigns/new"
			class="rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-4 text-center hover:border-teal-900/40 transition-colors group"
		>
			<svg class="w-5 h-5 mx-auto text-zinc-600 group-hover:text-teal-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
			</svg>
			<p class="text-xs text-zinc-400 mt-2 group-hover:text-zinc-300 transition-colors">Create Campaign</p>
		</a>
		<a
			href="/org/{data.org.slug}/supporters/import"
			class="rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-4 text-center hover:border-teal-900/40 transition-colors group"
		>
			<svg class="w-5 h-5 mx-auto text-zinc-600 group-hover:text-teal-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
			</svg>
			<p class="text-xs text-zinc-400 mt-2 group-hover:text-zinc-300 transition-colors">Import Supporters</p>
		</a>
		<a
			href="/org/{data.org.slug}/emails/compose"
			class="rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-4 text-center hover:border-teal-900/40 transition-colors group"
		>
			<svg class="w-5 h-5 mx-auto text-zinc-600 group-hover:text-teal-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
			</svg>
			<p class="text-xs text-zinc-400 mt-2 group-hover:text-zinc-300 transition-colors">Compose Email</p>
		</a>
		<a
			href="/org/{data.org.slug}/supporters"
			class="rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-4 text-center hover:border-teal-900/40 transition-colors group"
		>
			<svg class="w-5 h-5 mx-auto text-zinc-600 group-hover:text-teal-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
			</svg>
			<p class="text-xs text-zinc-400 mt-2 group-hover:text-zinc-300 transition-colors">View Supporters</p>
		</a>
	</div>

	<!-- ===== SECTION 5: Recent Activity ===== -->
	{#if data.recentActivity.length > 0}
		<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-6">
			<p class="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-4">Recent Activity</p>
			<div class="space-y-1">
				{#each data.recentActivity as item (item.id)}
					<div class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800/30 transition-colors">
						<!-- I4: Type indicator with label -->
						{#if item.type === 'action'}
							<div class="flex items-center gap-1.5 flex-shrink-0 w-16">
								<div class="w-2 h-2 rounded-full {item.verified ? 'bg-emerald-500' : 'bg-zinc-600'}"></div>
								<span class="text-[9px] font-mono text-zinc-600">Action</span>
							</div>
						{:else}
							<div class="flex items-center gap-1.5 flex-shrink-0 w-16">
								<div class="w-2 h-2 rounded-full bg-teal-500/60"></div>
								<span class="text-[9px] font-mono text-zinc-600">Signup</span>
							</div>
						{/if}

						<!-- Content -->
						<div class="min-w-0 flex-1">
							<p class="text-xs text-zinc-300 truncate">
								<span class="font-medium">{item.label}</span>
								{#if item.type === 'action'}
									<span class="text-zinc-600"> acted on </span>
									<span class="text-zinc-400">{item.detail}</span>
								{:else}
									<span class="text-zinc-600"> signed up via </span>
									<span class="text-zinc-400">{item.detail}</span>
								{/if}
							</p>
						</div>

						<!-- Tier badge (actions only) -->
						{#if item.type === 'action' && item.tier > 0}
							<span class="text-[9px] font-mono px-1 py-0.5 rounded bg-zinc-800 text-zinc-500 flex-shrink-0">
								T{item.tier}
							</span>
						{/if}

						<!-- Timestamp -->
						<span class="text-[10px] font-mono text-zinc-700 flex-shrink-0">
							{relativeTime(item.timestamp)}
						</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Error flash -->
	{#if errorFlash}
		<div class="rounded-lg border border-red-900/40 bg-red-950/30 px-4 py-2 text-xs text-red-400">
			{errorFlash}
		</div>
	{/if}

	<!-- ===== Endorsed Templates ===== -->
	<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-6">
		<div class="flex items-center justify-between mb-4">
			<p class="text-sm font-medium text-zinc-300">
				Endorsed Templates
				{#if endorsedList.length > 0}
					<span class="text-zinc-600 ml-1">&middot; {endorsedList.length}</span>
				{/if}
			</p>
		</div>

		{#if endorsedList.length > 0}
			<div class="space-y-2 mb-4">
				{#each endorsedList as item (item.templateId)}
					<div class="group flex items-center gap-3 rounded-lg border border-zinc-800/40 bg-zinc-950/40 px-4 py-3 transition-colors hover:border-teal-900/40">
						<div class="w-0.5 h-8 rounded-full bg-teal-500/60 flex-shrink-0"></div>
						<div class="min-w-0 flex-1">
							<a href="/s/{item.slug}" class="text-sm font-medium text-zinc-200 hover:text-teal-400 transition-colors line-clamp-1">
								{item.title}
							</a>
							<p class="text-xs text-zinc-600 mt-0.5">
								{fmt(item.sends)} sends &middot; {fmt(item.districts)} districts
							</p>
						</div>
						<button
							class="text-xs text-zinc-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
							onclick={() => removeEndorsement(item.templateId)}
						>
							Remove
						</button>
					</div>
				{/each}
			</div>
		{:else}
			<p class="text-xs text-zinc-600 mb-4">No endorsed templates yet. Endorse public templates to signal coalition support.</p>
		{/if}

		<!-- Search to endorse -->
		<div class="relative">
			<input
				type="text"
				class="w-full rounded-lg border border-zinc-800/60 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-700 outline-none focus:border-teal-800/60 transition-colors"
				placeholder="Search templates to endorse..."
				value={searchQuery}
				oninput={handleSearchInput}
			/>
			{#if searchResults.length > 0}
				<div class="absolute left-0 right-0 top-full mt-1 rounded-lg border border-zinc-800/60 bg-zinc-900 shadow-xl z-10 overflow-hidden">
					{#each searchResults as t (t.id)}
						<button
							class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800/50 transition-colors border-b border-zinc-800/30 last:border-0"
							onclick={() => endorseTemplate(t.id)}
						>
							<div class="min-w-0 flex-1">
								<p class="text-sm text-zinc-200 line-clamp-1">{t.title}</p>
								<p class="text-xs text-zinc-600 mt-0.5">
									{fmt(t.verified_sends)} sends
									{#if t.similarity != null}
										<span class="text-zinc-700 mx-1">&middot;</span>
										<span class="text-teal-700">{Math.round(t.similarity * 100)}% match</span>
									{/if}
								</p>
							</div>
							<span class="text-xs font-medium text-teal-500 flex-shrink-0">Endorse</span>
						</button>
					{/each}
				</div>
			{/if}
			{#if searching}
				<div class="absolute right-3 top-1/2 -translate-y-1/2">
					<div class="w-3 h-3 border border-zinc-600 border-t-teal-500 rounded-full animate-spin"></div>
				</div>
			{/if}
		</div>
	</div>

</div>
