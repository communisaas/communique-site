<script lang="ts">
	let {
		width = 'w-24',
		height = 'h-10',
		rounded = 'rounded-lg',
		animate = true,
		classNames = ''
	}: {
		width?: string;
		height?: string;
		rounded?: string;
		animate?: boolean;
		classNames?: string;
	} = $props();
</script>

<div
	class="skeleton-button bg-slate-200 {width} {height} {rounded} {animate
		? 'animate-pulse'
		: ''} {classNames}"
></div>

<style>
	.skeleton-button {
		@apply relative overflow-hidden;
		background: linear-gradient(
			90deg,
			theme('colors.slate.200') 0%,
			theme('colors.slate.100') 50%,
			theme('colors.slate.200') 100%
		);
	}

	.skeleton-button.animate-pulse {
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
