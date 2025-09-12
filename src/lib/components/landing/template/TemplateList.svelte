<script lang="ts">
	import { ChevronRight } from 'lucide-svelte';
	import type { Template } from '$lib/types/template';
	import Badge from '../../ui/Badge.svelte';
	import MessageMetrics from './MessageMetrics.svelte';

	export let templates: Template[];
	export let selectedId: number | null;
	export let onSelect: (id: number) => void;
</script>

<div class="space-y-3 sm:space-y-4">
	{#each templates as template (template.id)}
		<div
			class="flex cursor-pointer items-start justify-between gap-3 rounded-lg border p-3 transition-all sm:p-4"
			class:border-blue-400={selectedId === template.id}
			class:bg-blue-50={selectedId === template.id}
			class:border-slate-200={selectedId !== template.id}
			class:hover:border-blue-200={selectedId !== template.id}
			on:click={() => onSelect(template.id)}
		>
			<div class="min-w-0 flex-1">
				<!-- Add min-w-0 to allow text truncation -->
				<Badge type={template.type} />

				<h3 class="mt-2 truncate font-medium text-slate-900 sm:mt-3">
					{template.title}
				</h3>
				<p class="mb-2 line-clamp-2 text-xs text-slate-600 sm:mb-3 sm:text-sm">
					{template.description}
				</p>

				<MessageMetrics {template} />
			</div>

			<!-- Mobile indicator -->
			<div class="shrink-0 text-slate-400 sm:hidden">
				<ChevronRight class="h-5 w-5" />
			</div>
		</div>
	{/each}
</div>
