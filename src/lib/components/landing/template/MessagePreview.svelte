<script lang="ts">
	import { Mail } from 'lucide-svelte';

	export let title: string;
	export let preview: string;
</script>

<div class="flex h-full flex-col">
	<div class="mb-2 flex shrink-0 items-center gap-2">
		<Mail class="h-4 w-4 shrink-0 text-slate-500" />
		<h3 class="text-sm font-medium text-slate-900 sm:text-base">Message Preview</h3>
	</div>
	<div class="min-h-0 flex-1">
		<pre
			class="h-full overflow-y-auto whitespace-pre-wrap
                   rounded-lg border border-slate-200
                   bg-slate-50 p-2 font-mono text-xs
                   text-slate-600 sm:p-4 sm:text-sm">{preview}</pre>
	</div>
</div>

<style>
	/* Custom scrollbar styling */
	pre::-webkit-scrollbar {
		width: 8px;
	}

	pre::-webkit-scrollbar-track {
		background: transparent;
	}

	pre::-webkit-scrollbar-thumb {
		background-color: rgba(156, 163, 175, 0.5);
		border-radius: 4px;
	}

	pre::-webkit-scrollbar-thumb:hover {
		background-color: rgba(156, 163, 175, 0.7);
	}
</style>
