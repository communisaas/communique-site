<script lang="ts">
	import { Shield, AtSign } from '@lucide/svelte';
	import Tooltip from './Tooltip.svelte';

	let { type }: { type: 'certified' | 'direct' } = $props();

	const badges = {
		certified: {
			tooltip: 'Verified to Congress, reputation tracked',
			class: 'bg-blue-100 text-blue-700',
			icon: Shield,
			text: 'US Congress'
		},
		direct: {
			tooltip: 'Opens your email client',
			class: 'bg-blue-100 text-blue-600',
			icon: AtSign,
			text: 'Email'
		}
	};

	const badge = badges[type];
</script>

<Tooltip content={badge.tooltip} showInfoIcon={false}>
	<span class="inline-flex items-center gap-1 rounded px-2 py-1 text-xs md:text-sm {badge.class}">
		{#snippet iconSnippet()}
			{@const IconComponent = badge.icon}
			<IconComponent class="h-3 w-3 md:h-4 md:w-4" />
		{/snippet}
		{@render iconSnippet()}
		{badge.text}
	</span>
</Tooltip>
