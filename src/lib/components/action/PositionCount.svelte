<script lang="ts">
	import { spring } from 'svelte/motion';

	let {
		count = { support: 0, oppose: 0, districts: 0 }
	}: {
		count: { support: number; oppose: number; districts: number };
	} = $props();

	const total = $derived(count.support + count.oppose);
	let displayTotal = spring(0, { stiffness: 0.2, damping: 0.8 });
	let displayDistricts = spring(0, { stiffness: 0.2, damping: 0.8 });

	// Check for reduced motion preference
	const prefersReducedMotion =
		typeof window !== 'undefined'
			? window.matchMedia('(prefers-reduced-motion: reduce)').matches
			: false;

	$effect(() => {
		if (prefersReducedMotion) {
			displayTotal.set(total, { hard: true });
			displayDistricts.set(count.districts, { hard: true });
		} else {
			displayTotal.set(total);
			displayDistricts.set(count.districts);
		}
	});
</script>

{#if total > 0}
	<p class="text-sm text-slate-500" role="status" aria-live="polite" aria-label="{total} positions registered{count.districts > 0 ? `, ${count.districts} districts` : ''}">
		<span class="font-mono tabular-nums text-slate-700">
			{Math.round($displayTotal).toLocaleString()}
		</span>
		verified positions{#if count.districts > 0}<span class="mx-1.5">&middot;</span><span
				class="font-mono tabular-nums text-slate-700"
				>{Math.round($displayDistricts).toLocaleString()}</span
			>
			districts{/if}
	</p>
{/if}
