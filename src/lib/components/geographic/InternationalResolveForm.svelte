<script lang="ts">
	import { DISTRICT_CONFIG } from '$lib/core/location/district-config';
	import RepresentativeCard from './RepresentativeCard.svelte';

	let { country }: { country: string } = $props();

	let input = $state('');
	let resolving = $state(false);
	let error = $state('');
	let result = $state<{
		district: { id: string; name: string; type: string; country: string; extra?: Record<string, string> };
		representatives: Array<{
			name: string;
			party: string | null;
			constituencyName: string;
			chamber: string | null;
			office: string | null;
			phone: string | null;
			email: string | null;
			websiteUrl: string | null;
			countryCode: string;
		}>;
	} | null>(null);

	const config = $derived(DISTRICT_CONFIG[country]);
	const placeholder = $derived(config?.postalPlaceholder ?? 'Enter postcode');
	const pattern = $derived(config?.postalPattern);

	const isValid = $derived(() => {
		if (!input.trim()) return false;
		if (pattern) return pattern.test(input.trim());
		return true;
	});

	async function resolve() {
		if (!input.trim() || resolving) return;
		resolving = true;
		error = '';
		result = null;

		try {
			const res = await fetch('/api/geographic/resolve', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ countryCode: country, input: input.trim() })
			});

			const data = await res.json();

			if (!res.ok || !data.resolved) {
				error = data.error || 'Could not resolve district';
				return;
			}

			result = {
				district: data.district,
				representatives: data.representatives ?? []
			};
		} catch {
			error = 'Network error. Please try again.';
		} finally {
			resolving = false;
		}
	}
</script>

<div class="space-y-4">
	<div class="flex gap-2">
		<input
			type="text"
			bind:value={input}
			placeholder={placeholder}
			class="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none transition-colors"
			onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); resolve(); } }}
		/>
		<button
			type="button"
			disabled={!input.trim() || resolving}
			onclick={resolve}
			class="shrink-0 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
		>
			{resolving ? 'Resolving...' : 'Lookup'}
		</button>
	</div>

	{#if error}
		<div class="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-400">
			{error}
		</div>
	{/if}

	{#if result}
		<div class="rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-4 space-y-3">
			<div>
				<p class="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Resolved District</p>
				<p class="mt-1 text-sm font-medium text-zinc-200">{result.district.name}</p>
				<p class="text-xs text-zinc-500">
					{result.district.type}
					{#if result.district.extra}
						{#each Object.entries(result.district.extra) as [key, val]}
							&middot; {val}
						{/each}
					{/if}
				</p>
			</div>

			{#if result.representatives.length > 0}
				<div>
					<p class="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-2">Representatives</p>
					<div class="space-y-2">
						{#each result.representatives as rep}
							<RepresentativeCard representative={rep} />
						{/each}
					</div>
				</div>
			{:else}
				<p class="text-xs text-zinc-600">No representatives found for this district.</p>
			{/if}
		</div>
	{/if}
</div>
