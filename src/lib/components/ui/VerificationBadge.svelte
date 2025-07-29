<script lang="ts">
	import { Shield } from '@lucide/svelte';

	let {
		size = 'sm',
		showText = true,
		variant = 'default'
	}: {
		size?: 'xs' | 'sm' | 'md';
		showText?: boolean;
		variant?: 'default' | 'compact';
	} = $props();

	const sizeClasses = {
		xs: 'px-1.5 py-0.5 text-xs',
		sm: 'px-2 py-1 text-xs',
		md: 'px-3 py-1.5 text-sm'
	};

	const iconSizes = {
		xs: 'h-2.5 w-2.5',
		sm: 'h-3 w-3', 
		md: 'h-4 w-4'
	};
</script>

<div class="inline-flex items-center gap-1 rounded-full bg-green-100 font-medium text-green-700 {sizeClasses[size]}">
	<Shield class={iconSizes[size]} />
	{#if showText}
		<span>Verified</span>
	{/if}
</div>