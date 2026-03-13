<script lang="ts">
	let { length }: { length: number } = $props();

	const segments = $derived(Math.ceil(length / 160) || 1);
	const remaining = $derived(160 - (length % 160 || 160));
	const color = $derived(
		length <= 160 ? 'text-green-400' : length <= 480 ? 'text-yellow-400' : 'text-zinc-400'
	);
</script>

<p class="text-xs {color}">
	{length} / 1600 chars &middot; {segments} {segments === 1 ? 'segment' : 'segments'}
	{#if length > 0 && length <= 1600}
		&middot; {remaining} left in segment
	{/if}
</p>
