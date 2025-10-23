<script lang="ts">
	let {
		size = 'md',
		shape = 'circle',
		animate = true,
		classNames = ''
	}: {
		size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
		shape?: 'circle' | 'square' | 'rounded';
		animate?: boolean;
		classNames?: string;
	} = $props();

	const sizeClasses = {
		xs: 'h-6 w-6',
		sm: 'h-8 w-8',
		md: 'h-10 w-10',
		lg: 'h-12 w-12',
		xl: 'h-16 w-16'
	};

	const shapeClasses = {
		circle: 'rounded-full',
		square: 'rounded-none',
		rounded: 'rounded-lg'
	};
</script>

<div
	class="skeleton-avatar bg-slate-200 {sizeClasses[size]} {shapeClasses[shape]} {animate
		? 'animate-pulse'
		: ''} {classNames}"
></div>

<style>
	.skeleton-avatar {
		@apply relative overflow-hidden;
		background: linear-gradient(
			90deg,
			theme('colors.slate.200') 0%,
			theme('colors.slate.100') 50%,
			theme('colors.slate.200') 100%
		);
	}

	.skeleton-avatar.animate-pulse {
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
