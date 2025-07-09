<script lang="ts">
	import { Shield, AtSign } from '@lucide/svelte';
	import Tooltip from './Tooltip.svelte';

	export let type: 'certified' | 'direct';

	const badges = {
		certified: {
			tooltip: 'Messages delivered through official Congressional CWC system',
			class: 'bg-green-100 text-green-700',
			icon: Shield,
			text: 'Certified Delivery'
		},
		direct: {
			tooltip: 'Direct email outreach to decision makers',
			class: 'bg-blue-100 text-blue-600',
			icon: AtSign,
			text: 'Direct Outreach'
		}
	};

	const badge = badges[type];
</script>

<Tooltip content={badge.tooltip} showInfoIcon={false}>
	<span class="inline-flex items-center gap-1 rounded px-2 py-1 text-xs md:text-sm {badge.class}">
		<svelte:component this={badge.icon} class="h-3 w-3 md:h-4 md:w-4" />
		{badge.text}
	</span>
</Tooltip>
