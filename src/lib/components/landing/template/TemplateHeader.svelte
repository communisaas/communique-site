<script lang="ts">
	import { Send } from 'lucide-svelte';
	import type { Template } from '$lib/types/template';
	import Badge from '../../ui/Badge.svelte';
	import Button from '../../ui/Button.svelte';

	export let template: Template;
</script>

<div class="mb-6 flex items-start justify-between gap-4">
	<div class="min-w-0">
		<h2 class="mb-2 truncate text-lg font-semibold text-slate-900 sm:text-xl">
			{template.title}
		</h2>
		<div class="flex flex-wrap items-center gap-2 sm:gap-4">
			<span class="rounded bg-blue-100 px-2 py-1 text-xs text-blue-600 sm:text-sm">
				{template.category}
			</span>
			<Badge type={template.type} />
		</div>
	</div>
	<Button variant="primary" classNames="shrink-0">
		<span class="hidden sm:inline">Use Template</span>
		<span class="sm:hidden">Use</span>
		<Send class="h-4 w-4" />
	</Button>
</div>
