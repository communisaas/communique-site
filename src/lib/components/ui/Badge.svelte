<script lang="ts">
	export let variant: 'congressional' | 'direct' | 'success' | 'warning' | 'error' | 'neutral' = 'neutral';
	export let size: 'sm' | 'md' = 'sm';
	export let pulse: boolean = false;
	
	const variants = {
		congressional: 'bg-congressional-50 text-congressional-700 border-congressional-200',
		direct: 'bg-direct-50 text-direct-700 border-direct-200',
		success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
		warning: 'bg-amber-50 text-amber-700 border-amber-200',
		error: 'bg-red-50 text-red-700 border-red-200',
		neutral: 'bg-gray-50 text-gray-700 border-gray-200'
	};
	
	const sizes = {
		sm: 'px-2 py-0.5 text-xs',
		md: 'px-3 py-1 text-sm'
	};
	
	const pulseColors = {
		congressional: 'bg-congressional-500',
		direct: 'bg-direct-500',
		success: 'bg-emerald-500',
		warning: 'bg-amber-500',
		error: 'bg-red-500',
		neutral: 'bg-gray-500'
	};
</script>

<span class="inline-flex items-center gap-1.5 border rounded-full font-medium transition-colors {variants[variant]} {sizes[size]}">
	{#if pulse}
		<div class="w-1.5 h-1.5 rounded-full animate-save-pulse {pulseColors[variant]}" />
	{/if}
	<slot />
</span>