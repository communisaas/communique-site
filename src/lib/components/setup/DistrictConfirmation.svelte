<script lang="ts">
	/**
	 * DistrictConfirmation — Boundary-straddling disambiguation.
	 *
	 * ~5% of H3 cells sit on a district boundary. When the mapping
	 * returns multiple candidates, the user picks their district.
	 * Choice is remembered in IndexedDB.
	 *
	 * Voice: direct question. No emotional framing.
	 */
	import { fly } from 'svelte/transition';
	import { MapPin } from '@lucide/svelte';

	let {
		candidates,
		onConfirm
	}: {
		candidates: Array<{ code: string; name: string }>;
		onConfirm: (districtCode: string) => void;
	} = $props();
</script>

{#if candidates.length > 1}
	<div
		class="rounded-lg border border-amber-200/60 bg-amber-50/30 px-4 py-3"
		in:fly={{ y: 8, duration: 200 }}
	>
		<div class="flex items-start gap-2.5 mb-3">
			<MapPin class="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
			<div>
				<p class="text-sm font-medium text-amber-900">
					Which district are you in?
				</p>
				<p class="text-xs text-amber-700 mt-0.5">
					Your location is near a district boundary.
				</p>
			</div>
		</div>
		<div class="flex flex-wrap gap-2">
			{#each candidates as district (district.code)}
				<button
					onclick={() => onConfirm(district.code)}
					class="flex items-center gap-2 rounded-lg border border-amber-300/60 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-amber-50 hover:border-amber-400/60 min-h-[44px]"
				>
					<span class="font-mono text-xs text-amber-700">{district.code}</span>
					<span class="text-slate-500">{district.name}</span>
				</button>
			{/each}
		</div>
	</div>
{/if}
