<script lang="ts">
	import { Info } from '@lucide/svelte';
	interface Props {
		isCertified?: boolean;
	}

	const { isCertified = false }: Props = $props();
</script>

<div class="rounded-lg border border-blue-100 bg-blue-50 p-4">
	<ul class="space-y-2 text-sm text-blue-700">
		{#if isCertified}
			<li class="flex items-center gap-2">
				<Info class="h-4 w-4" />
				Address verification required for Congressional delivery
			</li>
		{/if}
		<li class="flex items-center gap-2">
			<Info class="h-4 w-4" />
			Adding personal experience increases message impact
		</li>
	</ul>
</div>
