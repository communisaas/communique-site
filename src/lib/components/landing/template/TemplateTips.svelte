<script lang="ts">
	import { Info } from 'lucide-svelte';
	export let isCertified = false;
</script>

<div class="mt-6 rounded-lg border border-blue-100 bg-blue-50 p-4">
	<h4 class="mb-2 text-sm font-medium text-blue-800">Customization Tips</h4>
	<ul class="space-y-2 text-sm text-blue-700">
		<li class="flex items-center gap-2">
			<Info class="h-4 w-4" />
			Replace [bracketed text] with your personal details
		</li>
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
