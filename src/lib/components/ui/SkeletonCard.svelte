<script lang="ts">
	let {
		lines = 3,
		showActions = false,
		classNames = ''
	}: {
		lines?: number;
		showActions?: boolean;
		classNames?: string;
	} = $props();
</script>

<div class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm {classNames}">
	<!-- Title skeleton -->
	<div class="mb-3 h-6 w-3/4 animate-pulse rounded bg-slate-200"></div>

	<!-- Content lines -->
	{#each Array(lines) as _, _i}
		<div class="mb-2 h-4 animate-pulse rounded bg-slate-100" style="width: {90 - _i * 10}%"></div>
	{/each}

	<!-- Actions skeleton -->
	{#if showActions}
		<div class="mt-4 flex gap-2">
			<div class="h-8 w-20 animate-pulse rounded bg-slate-200"></div>
			<div class="h-8 w-20 animate-pulse rounded bg-slate-200"></div>
		</div>
	{/if}
</div>
