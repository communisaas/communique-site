<script lang="ts">
	let { 
		rows = 5,
		columns = 4,
		showHeader = true,
		animate = true,
		classNames = ''
	}: {
		rows?: number;
		columns?: number;
		showHeader?: boolean;
		animate?: boolean;
		classNames?: string;
	} = $props();

	// Generate random widths for more realistic appearance
	function getRandomWidth(min: number, max: number): string {
		return `${Math.floor(Math.random() * (max - min + 1) + min)}%`;
	}
</script>

<div class="skeleton-table bg-white rounded-lg border border-slate-200 overflow-hidden {classNames}">
	<table class="w-full">
		{#if showHeader}
			<thead class="bg-slate-50 border-b border-slate-200">
				<tr>
					{#each Array(columns) as _, col}
						<th class="px-4 py-3">
							<div 
								class="h-4 bg-slate-300 rounded {animate ? 'animate-pulse' : ''}"
								style="width: {getRandomWidth(40, 80)}"
							></div>
						</th>
					{/each}
				</tr>
			</thead>
		{/if}
		
		<tbody>
			{#each Array(rows) as _, row}
				<tr class="border-b border-slate-100 last:border-0">
					{#each Array(columns) as _, col}
						<td class="px-4 py-3">
							<div 
								class="h-3 bg-slate-200 rounded {animate ? 'animate-pulse' : ''}"
								style="width: {getRandomWidth(30, 90)}; animation-delay: {(row * columns + col) * 50}ms"
							></div>
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.skeleton-table div {
		@apply relative overflow-hidden;
		background: linear-gradient(
			90deg,
			theme('colors.slate.200') 0%,
			theme('colors.slate.100') 50%,
			theme('colors.slate.200') 100%
		);
	}

	.skeleton-table thead div {
		background: linear-gradient(
			90deg,
			theme('colors.slate.300') 0%,
			theme('colors.slate.200') 50%,
			theme('colors.slate.300') 100%
		);
	}

	.skeleton-table div.animate-pulse {
		animation: shimmer 1.8s ease-in-out infinite;
	}

	@keyframes shimmer {
		0% {
			background-position: -200% 0;
		}
		100% {
			background-position: 200% 0;
		}
	}
</style>