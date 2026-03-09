<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const canEdit = $derived(
		data.membership.role === 'owner' || data.membership.role === 'editor'
	);

	const vState = $derived(
		data.supporter.identityCommitment && data.supporter.verified
			? 'VER'
			: data.supporter.postalCode
				? 'POST'
				: 'IMP'
	);

	const currentTagIds = $derived(new Set(data.supporter.tags.map((t) => t.id)));
	const availableTags = $derived(data.allTags.filter((t) => !currentTagIds.has(t.id)));

	function sourceLabel(s: string | null): string {
		switch (s) {
			case 'csv': return 'CSV Import';
			case 'action_network': return 'Action Network';
			case 'organic': return 'Organic';
			case 'widget': return 'Widget';
			default: return 'Unknown';
		}
	}

	function formatDate(iso: string | null): string {
		if (!iso) return '\u2014';
		return new Date(iso).toLocaleDateString('en-US', {
			month: 'short', day: 'numeric', year: 'numeric'
		});
	}
</script>

<div class="space-y-6">
	<!-- Breadcrumb -->
	<nav class="flex items-center gap-2 text-sm text-zinc-500">
		<a href="/org/{data.org.slug}/supporters" class="hover:text-zinc-300 transition-colors">
			Supporters
		</a>
		<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
		</svg>
		<span class="text-zinc-400 truncate">{data.supporter.name || data.supporter.email}</span>
	</nav>

	<!-- Verification status hero -->
	<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-6">
		<div class="flex items-center gap-4">
			{#if vState === 'VER'}
				<div class="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center">
					<span class="inline-block w-5 h-5 rounded-full bg-emerald-500"></span>
				</div>
				<div>
					<p class="font-mono text-sm text-emerald-400">VERIFIED</p>
					<p class="text-xs text-zinc-500 mt-0.5">Identity commitment confirmed via ZK proof</p>
				</div>
			{:else if vState === 'POST'}
				<div class="w-12 h-12 rounded-full bg-amber-500/15 flex items-center justify-center">
					<span class="inline-block w-5 h-5 rounded-full border-2 border-amber-500 bg-amber-500/30"></span>
				</div>
				<div>
					<p class="font-mono text-sm text-amber-400">POSTAL-RESOLVED</p>
					<p class="text-xs text-zinc-500 mt-0.5">Postal code on file, awaiting identity verification</p>
				</div>
			{:else}
				<div class="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center">
					<span class="inline-block w-5 h-5 rounded-full bg-zinc-600"></span>
				</div>
				<div>
					<p class="font-mono text-sm text-zinc-400">IMPORTED</p>
					<p class="text-xs text-zinc-500 mt-0.5">Imported record, no verification data yet</p>
				</div>
			{/if}
		</div>
	</div>

	<!-- Details -->
	<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/30 divide-y divide-zinc-800/60">
		<div class="px-5 py-4 flex items-center justify-between">
			<span class="text-xs text-zinc-500">Email</span>
			<div class="flex items-center gap-2">
				{#if data.supporter.emailStatus === 'unsubscribed'}
					<span class="inline-block w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
				{:else if data.supporter.emailStatus === 'bounced' || data.supporter.emailStatus === 'complained'}
					<span class="inline-block w-1.5 h-1.5 rounded-full bg-red-500"></span>
				{/if}
				<span class="text-sm text-zinc-200 {data.supporter.emailStatus === 'complained' ? 'line-through text-zinc-500' : ''}">{data.supporter.email}</span>
				<span class="text-xs font-mono text-zinc-600 capitalize">({data.supporter.emailStatus})</span>
			</div>
		</div>
		<div class="px-5 py-4 flex items-center justify-between">
			<span class="text-xs text-zinc-500">Name</span>
			<span class="text-sm text-zinc-200">{data.supporter.name || '\u2014'}</span>
		</div>
		<div class="px-5 py-4 flex items-center justify-between">
			<span class="text-xs text-zinc-500">Postal Code</span>
			<span class="text-sm font-mono text-zinc-200">{data.supporter.postalCode || '\u2014'}</span>
		</div>
		<div class="px-5 py-4 flex items-center justify-between">
			<span class="text-xs text-zinc-500">Country</span>
			<span class="text-sm text-zinc-200">{data.supporter.country || '\u2014'}</span>
		</div>
		<div class="px-5 py-4 flex items-center justify-between">
			<span class="text-xs text-zinc-500">Phone</span>
			<span class="text-sm text-zinc-200">{data.supporter.phone || '\u2014'}</span>
		</div>
		<div class="px-5 py-4 flex items-center justify-between">
			<span class="text-xs text-zinc-500">Source</span>
			<span class="text-sm text-zinc-200">{sourceLabel(data.supporter.source)}</span>
		</div>
		<div class="px-5 py-4 flex items-center justify-between">
			<span class="text-xs text-zinc-500">Imported</span>
			<span class="text-sm font-mono text-zinc-200">{formatDate(data.supporter.importedAt)}</span>
		</div>
		<div class="px-5 py-4 flex items-center justify-between">
			<span class="text-xs text-zinc-500">Added</span>
			<span class="text-sm font-mono text-zinc-200">{formatDate(data.supporter.createdAt)}</span>
		</div>
	</div>

	<!-- Tags -->
	<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-5 space-y-4">
		<p class="text-xs font-mono uppercase tracking-wider text-zinc-500">Tags</p>

		{#if form?.error}
			<div class="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
				{form.error}
			</div>
		{/if}

		<!-- Current tags -->
		<div class="flex flex-wrap gap-2">
			{#if data.supporter.tags.length === 0}
				<span class="text-xs text-zinc-600">No tags</span>
			{/if}
			{#each data.supporter.tags as tag}
				<span class="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 pl-3 pr-1.5 py-1 text-xs text-zinc-300">
					{tag.name}
					{#if canEdit}
						<form method="POST" action="?/removeTag" use:enhance class="inline">
							<input type="hidden" name="tagId" value={tag.id} />
							<button type="submit" class="rounded-full p-0.5 hover:bg-zinc-700 transition-colors">
								<svg class="w-3 h-3 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</form>
					{/if}
				</span>
			{/each}
		</div>

		<!-- Add tag -->
		{#if canEdit && availableTags.length > 0}
			<form method="POST" action="?/addTag" use:enhance class="flex items-center gap-2">
				<select
					name="tagId"
					class="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none transition-colors"
				>
					{#each availableTags as tag}
						<option value={tag.id}>{tag.name}</option>
					{/each}
				</select>
				<button
					type="submit"
					class="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
				>
					Add
				</button>
			</form>
		{/if}
	</div>

	<!-- Privacy notice -->
	<div class="rounded-lg border border-zinc-800/40 bg-zinc-950/50 px-4 py-3 text-xs text-zinc-600">
		This organization cannot access the supporter's identity verification details.
		Verification status is derived from the protocol layer.
	</div>
</div>
