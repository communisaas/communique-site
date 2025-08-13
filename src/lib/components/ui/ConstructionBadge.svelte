<script lang="ts">
	import { Wrench } from '@lucide/svelte';
	import Tooltip from './Tooltip.svelte';

	interface Props {
		feature?: string;
		message?: string;
	}

	const { feature = 'Feature', message = 'Under active development' }: Props = $props();
</script>

<Tooltip content="{feature} {message}. Available soon!" showInfoIcon={false}>
	<span class="inline-flex items-center gap-1 rounded px-2 py-1 text-xs md:text-sm bg-amber-100 text-amber-700">
		<Wrench class="h-3 w-3 md:h-4 md:w-4" />
		Under Construction
	</span>
</Tooltip>