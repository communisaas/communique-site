<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import SegmentBuilder from '$lib/components/segments/SegmentBuilder.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Segment builder toggle
	let showSegmentBuilder = $state(false);

	// Local state for "load more" accumulation
	let allSupporters = $state(data.supporters);
	let hasMore = $state(data.hasMore);
	let nextCursor = $state(data.nextCursor);
	let loadingMore = $state(false);

	// Reset accumulated list when filters/data change from URL navigation
	$effect(() => {
		allSupporters = data.supporters;
		hasMore = data.hasMore;
		nextCursor = data.nextCursor;
	});

	// Search debounce
	let searchInput = $state(data.filters.q);
	let searchTimeout: ReturnType<typeof setTimeout> | undefined;

	function onSearchInput(e: Event) {
		const value = (e.target as HTMLInputElement).value;
		searchInput = value;
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			updateFilter('q', value || null);
		}, 300);
	}

	// Filter helpers
	function updateFilter(key: string, value: string | null) {
		const url = new URL($page.url);
		if (value) {
			url.searchParams.set(key, value);
		} else {
			url.searchParams.delete(key);
		}
		// Reset cursor when filters change
		url.searchParams.delete('cursor');
		goto(url.toString(), { replaceState: true, keepFocus: true });
	}

	function removeFilter(key: string) {
		updateFilter(key, null);
		if (key === 'q') searchInput = '';
	}

	// Active filter chips
	const activeChips = $derived(buildActiveChips());

	function buildActiveChips(): Array<{ key: string; label: string }> {
		const chips: Array<{ key: string; label: string }> = [];
		if (data.filters.q) chips.push({ key: 'q', label: `Search: "${data.filters.q}"` });
		if (data.filters.status) chips.push({ key: 'status', label: `Status: ${data.filters.status}` });
		if (data.filters.verified) chips.push({ key: 'verified', label: data.filters.verified === 'true' ? 'Verified' : 'Unverified' });
		if (data.filters.source) chips.push({ key: 'source', label: `Source: ${sourceLabel(data.filters.source)}` });
		if (data.filters.tagId) {
			const tag = data.tags.find((t) => t.id === data.filters.tagId);
			if (tag) chips.push({ key: 'tag', label: `Tag: ${tag.name}` });
		}
		return chips;
	}

	// Load more
	async function loadMore() {
		if (!nextCursor || loadingMore) return;
		loadingMore = true;
		try {
			const url = new URL($page.url);
			url.searchParams.set('cursor', nextCursor);
			const response = await fetch(url.toString(), {
				headers: { accept: 'application/json' }
			});
			// SvelteKit returns the page data when fetching with the same URL
			// We need to use goto and accumulate instead
			// Actually, let's use the __data.json endpoint
			const dataUrl = new URL($page.url);
			dataUrl.searchParams.set('cursor', nextCursor);
			// Navigate but capture the data
			goto(dataUrl.toString(), { replaceState: true, keepFocus: true, noScroll: true });
		} catch {
			// ignore
		} finally {
			loadingMore = false;
		}
	}

	// Role check
	const canEdit = $derived(
		data.membership.role === 'owner' || data.membership.role === 'editor'
	);

	// Verification status helper
	function verificationState(s: typeof data.supporters[0]): 'VER' | 'POST' | 'IMP' {
		if (s.identityCommitment && s.verified) return 'VER';
		if (s.postalCode) return 'POST';
		return 'IMP';
	}

	// Source label
	function sourceLabel(source: string | null): string {
		switch (source) {
			case 'csv': return 'CSV';
			case 'action_network': return 'AN';
			case 'organic': return 'ORG';
			case 'widget': return 'WID';
			default: return '\u2014';
		}
	}

	// Relative time formatting
	function relativeTime(iso: string): string {
		const now = Date.now();
		const then = new Date(iso).getTime();
		const diffMs = now - then;
		const diffMin = Math.floor(diffMs / 60000);
		const diffHr = Math.floor(diffMs / 3600000);
		const diffDay = Math.floor(diffMs / 86400000);

		if (diffMin < 1) return 'just now';
		if (diffMin < 60) return `${diffMin}m ago`;
		if (diffHr < 24) return `${diffHr}h ago`;
		if (diffDay < 7) return `${diffDay}d ago`;

		const d = new Date(iso);
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	// Format number with commas
	function fmt(n: number): string {
		return n.toLocaleString('en-US');
	}

	// Email status filters
	const emailStatuses = ['subscribed', 'unsubscribed', 'bounced', 'complained'] as const;

	// Source options
	const sourceOptions = [
		{ value: 'csv', label: 'CSV' },
		{ value: 'action_network', label: 'Action Network' },
		{ value: 'organic', label: 'Organic' },
		{ value: 'widget', label: 'Widget' }
	] as const;
</script>

<div class="space-y-5">
	<!-- Header -->
	<div class="flex items-center justify-between gap-4">
		<div class="flex items-baseline gap-3">
			<h1 class="text-xl font-semibold text-zinc-100">Supporters</h1>
			<span class="font-mono text-lg text-zinc-500">{fmt(data.total)}</span>
		</div>
		<div class="flex items-center gap-3">
			{#if canEdit}
				<a
					href="/org/{data.org.slug}/supporters/import"
					class="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 transition-colors"
				>
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
					</svg>
					Import
				</a>
			{/if}
		</div>
	</div>

	<!-- Search -->
	<div class="relative">
		<svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
			<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
		</svg>
		<input
			type="text"
			placeholder="Search by name or email..."
			value={searchInput}
			oninput={onSearchInput}
			class="w-full rounded-lg border border-zinc-700 bg-zinc-900 pl-10 pr-4 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none transition-colors"
		/>
	</div>

	<!-- Filter bar -->
	<div class="flex flex-wrap items-center gap-3">
		<!-- Email status pills -->
		<div class="flex items-center gap-1 rounded-lg border border-zinc-800/60 p-0.5">
			<button
				type="button"
				class="px-3 py-1.5 text-xs rounded-md transition-colors {!data.filters.status
					? 'bg-zinc-800 text-zinc-100'
					: 'text-zinc-500 hover:text-zinc-300'}"
				onclick={() => removeFilter('status')}
			>
				All
			</button>
			{#each emailStatuses as es}
				<button
					type="button"
					class="px-3 py-1.5 text-xs rounded-md transition-colors capitalize {data.filters.status === es
						? 'bg-zinc-800 text-zinc-100'
						: 'text-zinc-500 hover:text-zinc-300'}"
					onclick={() => updateFilter('status', es)}
				>
					{es}
				</button>
			{/each}
		</div>

		<!-- Verification toggle -->
		<div class="flex items-center gap-1 rounded-lg border border-zinc-800/60 p-0.5">
			<button
				type="button"
				class="px-3 py-1.5 text-xs rounded-md transition-colors {!data.filters.verified
					? 'bg-zinc-800 text-zinc-100'
					: 'text-zinc-500 hover:text-zinc-300'}"
				onclick={() => removeFilter('verified')}
			>
				All
			</button>
			<button
				type="button"
				class="px-3 py-1.5 text-xs rounded-md transition-colors {data.filters.verified === 'true'
					? 'bg-zinc-800 text-zinc-100'
					: 'text-zinc-500 hover:text-zinc-300'}"
				onclick={() => updateFilter('verified', 'true')}
			>
				Verified
			</button>
			<button
				type="button"
				class="px-3 py-1.5 text-xs rounded-md transition-colors {data.filters.verified === 'false'
					? 'bg-zinc-800 text-zinc-100'
					: 'text-zinc-500 hover:text-zinc-300'}"
				onclick={() => updateFilter('verified', 'false')}
			>
				Unverified
			</button>
		</div>

		<!-- Tag dropdown -->
		{#if data.tags.length > 0}
			<select
				class="rounded-lg border border-zinc-800/60 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none transition-colors"
				onchange={(e) => {
					const val = (e.target as HTMLSelectElement).value;
					updateFilter('tag', val || null);
				}}
			>
				<option value="" selected={!data.filters.tagId}>All tags</option>
				{#each data.tags as tag}
					<option value={tag.id} selected={data.filters.tagId === tag.id}>{tag.name}</option>
				{/each}
			</select>
		{/if}

		<!-- Source dropdown -->
		<select
			class="rounded-lg border border-zinc-800/60 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none transition-colors"
			onchange={(e) => {
				const val = (e.target as HTMLSelectElement).value;
				updateFilter('source', val || null);
			}}
		>
			<option value="" selected={!data.filters.source}>All sources</option>
			{#each sourceOptions as opt}
				<option value={opt.value} selected={data.filters.source === opt.value}>{opt.label}</option>
			{/each}
		</select>

		<!-- Segment builder toggle -->
		<button
			type="button"
			class="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors {showSegmentBuilder
				? 'border-teal-500/30 bg-teal-500/10 text-teal-400'
				: 'border-zinc-800/60 text-zinc-400 hover:text-zinc-300 hover:border-zinc-700'}"
			onclick={() => (showSegmentBuilder = !showSegmentBuilder)}
		>
			<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
			</svg>
			Segments
		</button>
	</div>

	<!-- Segment Builder Panel -->
	{#if showSegmentBuilder}
		<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-5">
			<SegmentBuilder
				orgSlug={data.org.slug}
				tags={data.tags}
				campaigns={data.campaigns}
			/>
		</div>
	{/if}

	<!-- Active filter chips -->
	{#if activeChips.length > 0}
		<div class="flex flex-wrap items-center gap-2">
			{#each activeChips as chip}
				<button
					type="button"
					class="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
					onclick={() => removeFilter(chip.key)}
				>
					{chip.label}
					<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			{/each}
			{#if activeChips.length > 1}
				<button
					type="button"
					class="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
					onclick={() => {
						const url = new URL($page.url);
						url.search = '';
						searchInput = '';
						goto(url.toString(), { replaceState: true });
					}}
				>
					Clear all
				</button>
			{/if}
		</div>
	{/if}

	<!-- Summary bar -->
	{#if data.total > 0}
		<div class="flex items-center gap-4 rounded-lg border border-zinc-800/60 bg-zinc-900/30 px-4 py-2.5 text-xs">
			<span class="flex items-center gap-1.5">
				<span class="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
				<span class="font-mono text-zinc-300">{fmt(data.summary.verified)}</span>
				<span class="text-zinc-500">verified</span>
			</span>
			<span class="text-zinc-800">|</span>
			<span class="flex items-center gap-1.5">
				<span class="inline-block w-2 h-2 rounded-full bg-amber-500"></span>
				<span class="font-mono text-zinc-300">{fmt(data.summary.postal)}</span>
				<span class="text-zinc-500">postal-resolved</span>
			</span>
			<span class="text-zinc-800">|</span>
			<span class="flex items-center gap-1.5">
				<span class="inline-block w-2 h-2 rounded-full bg-zinc-600"></span>
				<span class="font-mono text-zinc-300">{fmt(data.summary.imported)}</span>
				<span class="text-zinc-500">imported</span>
			</span>
		</div>
	{/if}

	<!-- Table -->
	{#if allSupporters.length === 0}
		<!-- Empty state -->
		<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-12 text-center">
			<div class="mx-auto w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4">
				<svg class="w-6 h-6 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
				</svg>
			</div>
			<p class="text-sm text-zinc-400 mb-1">No supporters yet.</p>
			<p class="text-sm text-zinc-500">
				{#if canEdit}
					<a href="/org/{data.org.slug}/supporters/import" class="text-teal-400 hover:text-teal-300 transition-colors">Import from CSV or Action Network</a> to get started.
				{:else}
					Ask an editor to import supporters.
				{/if}
			</p>
		</div>
	{:else}
		<div class="rounded-xl border border-zinc-800/60 overflow-hidden">
			<div class="overflow-x-auto">
				<table class="w-full text-left">
					<thead>
						<tr class="border-b border-zinc-800/60 bg-zinc-900/50">
							<th class="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider w-16">Status</th>
							<th class="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Name</th>
							<th class="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Email</th>
							<th class="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider hidden lg:table-cell">Postal</th>
							<th class="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider hidden xl:table-cell">Tags</th>
							<th class="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider hidden lg:table-cell w-16">Source</th>
							<th class="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider hidden md:table-cell w-24">Added</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-zinc-800/40">
						{#each allSupporters as supporter (supporter.id)}
							{@const vState = verificationState(supporter)}
							<tr class="hover:bg-zinc-800/40 transition-colors group">
								<!-- Verification status -->
								<td class="px-4 py-3">
									{#if vState === 'VER'}
										<span class="inline-flex items-center gap-1.5">
											<span class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
											<span class="font-mono text-xs text-emerald-400">VER</span>
										</span>
									{:else if vState === 'POST'}
										<span class="inline-flex items-center gap-1.5">
											<span class="inline-block w-2.5 h-2.5 rounded-full border-2 border-amber-500 bg-amber-500/30"></span>
											<span class="font-mono text-xs text-amber-400">POST</span>
										</span>
									{:else}
										<span class="inline-flex items-center gap-1.5">
											<span class="inline-block w-2.5 h-2.5 rounded-full bg-zinc-600"></span>
											<span class="font-mono text-xs text-zinc-500">IMP</span>
										</span>
									{/if}
								</td>

								<!-- Name -->
								<td class="px-4 py-3">
									<a
										href="/org/{data.org.slug}/supporters/{supporter.id}"
										class="text-sm text-zinc-100 hover:text-teal-400 transition-colors"
									>
										{supporter.name || '\u2014'}
									</a>
								</td>

								<!-- Email with status dot -->
								<td class="px-4 py-3">
									<div class="flex items-center gap-1.5 min-w-0">
										{#if supporter.emailStatus === 'unsubscribed'}
											<span class="inline-block w-1.5 h-1.5 rounded-full bg-yellow-500 flex-shrink-0"></span>
										{:else if supporter.emailStatus === 'bounced'}
											<span class="inline-block w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0"></span>
										{:else if supporter.emailStatus === 'complained'}
											<span class="inline-block w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0"></span>
										{/if}
										<span class="text-sm truncate max-w-48 {supporter.emailStatus === 'complained' ? 'text-zinc-500 line-through' : 'text-zinc-400'}">
											{supporter.email}
										</span>
									</div>
								</td>

								<!-- Postal -->
								<td class="px-4 py-3 hidden lg:table-cell">
									<span class="font-mono text-sm text-zinc-500">{supporter.postalCode || '\u2014'}</span>
								</td>

								<!-- Tags -->
								<td class="px-4 py-3 hidden xl:table-cell">
									{#if supporter.tags.length > 0}
										<div class="flex items-center gap-1 flex-wrap">
											{#each supporter.tags.slice(0, 3) as tag}
												<span class="inline-flex items-center rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
													{tag.name}
												</span>
											{/each}
											{#if supporter.tags.length > 3}
												<span class="text-xs text-zinc-600">+{supporter.tags.length - 3} more</span>
											{/if}
										</div>
									{:else}
										<span class="text-zinc-700">&mdash;</span>
									{/if}
								</td>

								<!-- Source -->
								<td class="px-4 py-3 hidden lg:table-cell">
									<span class="inline-flex items-center rounded bg-zinc-800/80 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 uppercase">
										{sourceLabel(supporter.source)}
									</span>
								</td>

								<!-- Added -->
								<td class="px-4 py-3 hidden md:table-cell">
									<span class="font-mono text-xs text-zinc-600">{relativeTime(supporter.createdAt)}</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<!-- Load more -->
		{#if hasMore}
			<div class="flex justify-center pt-2">
				<button
					type="button"
					disabled={loadingMore}
					class="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-5 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:border-zinc-600 transition-colors disabled:opacity-50"
					onclick={loadMore}
				>
					{#if loadingMore}
						<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
						</svg>
						Loading...
					{:else}
						Load more
					{/if}
				</button>
			</div>
		{/if}
	{/if}
</div>
