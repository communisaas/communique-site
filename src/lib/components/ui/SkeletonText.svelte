<script lang="ts">
	let { 
		lines = 1,
		width = '100%',
		lineHeight = 'h-4',
		spacing = 'mb-2',
		animate = true,
		classNames = ''
	}: {
		lines?: number;
		width?: string | string[];
		lineHeight?: string;
		spacing?: string;
		animate?: boolean;
		classNames?: string;
	} = $props();

	// Convert width to array if it's a single value
	const widths = Array.isArray(width) ? width : Array(lines).fill(width);
</script>

<div class="skeleton-text {classNames}">
	{#each Array(lines) as _, i}
		<div 
			class="skeleton-line {lineHeight} bg-slate-200 rounded {i < lines - 1 ? spacing : ''} {animate ? 'animate-pulse' : ''}"
			style="width: {widths[i] || widths[0]}"
		></div>
	{/each}
</div>

<style>
	.skeleton-line {
		@apply relative overflow-hidden;
		background: linear-gradient(
			90deg,
			theme('colors.slate.200') 0%,
			theme('colors.slate.100') 50%,
			theme('colors.slate.200') 100%
		);
	}

	.skeleton-line.animate-pulse {
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