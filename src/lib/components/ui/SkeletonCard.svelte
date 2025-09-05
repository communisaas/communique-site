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

<div class="bg-white rounded-lg shadow-sm border border-slate-200 p-6 {classNames}">
	<!-- Title skeleton -->
	<div class="h-6 bg-slate-200 rounded w-3/4 mb-3 animate-pulse"></div>
	
	<!-- Content lines -->
	{#each Array(lines) as _, i}
		<div class="h-4 bg-slate-100 rounded mb-2 animate-pulse" style="width: {90 - i * 10}%"></div>
	{/each}
	
	<!-- Actions skeleton -->
	{#if showActions}
		<div class="flex gap-2 mt-4">
			<div class="h-8 bg-slate-200 rounded w-20 animate-pulse"></div>
			<div class="h-8 bg-slate-200 rounded w-20 animate-pulse"></div>
		</div>
	{/if}
</div>