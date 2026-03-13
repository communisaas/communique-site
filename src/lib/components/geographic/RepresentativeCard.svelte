<script lang="ts">
	let {
		representative
	}: {
		representative: {
			name: string;
			party: string | null;
			constituencyName: string;
			chamber: string | null;
			office: string | null;
			phone: string | null;
			email: string | null;
			websiteUrl: string | null;
			countryCode: string;
		};
	} = $props();

	const partyColors: Record<string, string> = {
		Democrat: 'bg-blue-900/30 text-blue-400 border-blue-500/20',
		Republican: 'bg-red-900/30 text-red-400 border-red-500/20',
		Labour: 'bg-red-900/30 text-red-400 border-red-500/20',
		Conservative: 'bg-blue-900/30 text-blue-400 border-blue-500/20',
		Liberal: 'bg-red-900/30 text-red-400 border-red-500/20',
		NDP: 'bg-orange-900/30 text-orange-400 border-orange-500/20',
		Green: 'bg-green-900/30 text-green-400 border-green-500/20'
	};

	const partyClass = $derived(
		representative.party
			? (partyColors[representative.party] ?? 'bg-zinc-700/30 text-zinc-400 border-zinc-600/20')
			: 'bg-zinc-700/30 text-zinc-400 border-zinc-600/20'
	);
</script>

<div class="rounded-lg border border-zinc-800/60 p-4 transition-colors hover:border-zinc-700">
	<div class="flex items-start gap-3">
		<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold text-zinc-400">
			{representative.name.charAt(0).toUpperCase()}
		</div>
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2">
				<p class="truncate text-sm font-medium text-zinc-200">{representative.name}</p>
				{#if representative.party}
					<span class="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium {partyClass}">
						{representative.party}
					</span>
				{/if}
			</div>
			<p class="mt-0.5 text-xs text-zinc-500">
				{#if representative.chamber}
					{representative.chamber} &middot;
				{/if}
				{representative.constituencyName}
			</p>
			{#if representative.office}
				<p class="mt-0.5 text-xs text-zinc-600">{representative.office}</p>
			{/if}

			<div class="mt-2 flex flex-wrap items-center gap-3">
				{#if representative.email}
					<a
						href="mailto:{representative.email}"
						class="text-xs text-teal-500 hover:text-teal-400 transition-colors"
					>
						{representative.email}
					</a>
				{/if}
				{#if representative.phone}
					<a
						href="tel:{representative.phone}"
						class="font-mono text-xs text-zinc-400 hover:text-zinc-300 transition-colors"
					>
						{representative.phone}
					</a>
				{/if}
				{#if representative.websiteUrl}
					<a
						href={representative.websiteUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
					>
						Website
					</a>
				{/if}
			</div>
		</div>
	</div>
</div>
