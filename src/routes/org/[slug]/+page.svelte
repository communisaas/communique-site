<script lang="ts">
	import VerificationPacket from '$lib/components/org/VerificationPacket.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function fmt(n: number): string {
		return n.toLocaleString('en-US');
	}

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

	// Track endorsed template IDs for filtering search results
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

		// Optimistic: move to endorsed list immediately
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
				// Revert
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
		// Optimistic: remove immediately
		const removed = endorsedList.find(e => e.templateId === templateId);
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

	<!-- Error flash -->
	{#if errorFlash}
		<div class="rounded-lg border border-red-900/40 bg-red-950/30 px-4 py-2 text-xs text-red-400">
			{errorFlash}
		</div>
	{/if}

	<!-- Endorsed Templates — curation surface -->
	<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-6">
		<div class="flex items-center justify-between mb-4">
			<p class="text-sm font-medium text-zinc-300">
				Endorsed Templates
				{#if endorsedList.length > 0}
					<span class="text-zinc-600 ml-1">· {endorsedList.length}</span>
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
								{fmt(item.sends)} sends · {fmt(item.districts)} districts
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
				placeholder="Search templates to endorse…"
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
										<span class="text-zinc-700 mx-1">·</span>
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
