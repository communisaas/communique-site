<script lang="ts">
	import { ExternalLink, ChevronDown, ChevronUp } from '@lucide/svelte';
	import type { Source } from '$lib/types/template';
	import { getSourceTypeBadge, formatSourceCitation } from '$lib/utils/message-processing';

	interface Props {
		source: Source;
	}

	let { source }: Props = $props();

	let expanded = $state(false);

	const badge = $derived(getSourceTypeBadge(source.type));
	const citationText = $derived(formatSourceCitation(source));

	// Extract domain from URL for compact display
	const domain = $derived.by(() => {
		try {
			const url = new URL(source.url);
			return url.hostname.replace('www.', '');
		} catch {
			return source.url;
		}
	});
</script>

<div class="rounded-lg border border-slate-200 bg-white transition-all hover:shadow-sm">
	<!-- Compact view -->
	<button
		type="button"
		onclick={() => (expanded = !expanded)}
		class="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-slate-50"
	>
		<!-- Citation number -->
		<div
			class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-participation-primary-100 text-sm font-semibold text-participation-primary-700"
		>
			[{source.num}]
		</div>

		<!-- Source info -->
		<div class="flex-1 space-y-1">
			<h4 class="font-medium text-slate-900">{source.title}</h4>
			<div class="flex items-center gap-2 text-xs text-slate-600">
				<span
					class="inline-flex items-center rounded-full border px-2 py-0.5 font-medium {badge.bg} {badge.text} {badge.border}"
				>
					{source.type}
				</span>
				<span class="text-slate-400">•</span>
				<span class="truncate">{domain}</span>
			</div>
		</div>

		<!-- Expand icon -->
		<div class="flex-shrink-0 text-slate-400">
			{#if expanded}
				<ChevronUp class="h-5 w-5" />
			{:else}
				<ChevronDown class="h-5 w-5" />
			{/if}
		</div>
	</button>

	<!-- Expanded view -->
	{#if expanded}
		<div class="border-t border-slate-100 p-4 pt-3">
			<!-- Full URL with visit link -->
			<div class="flex items-start justify-between gap-3">
				<div class="flex-1 space-y-1">
					<p class="text-xs font-medium text-slate-700">Source URL</p>
					<p class="break-all text-sm text-slate-600">{source.url}</p>
				</div>
				<a
					href={source.url}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
					onclick={(e) => e.stopPropagation()}
				>
					Visit
					<ExternalLink class="h-3.5 w-3.5" />
				</a>
			</div>

			<!-- Citation format -->
			<div class="mt-3 rounded-lg bg-slate-50 p-3">
				<p class="text-xs font-medium text-slate-700">Citation</p>
				<p class="mt-1 font-mono text-xs text-slate-600">{citationText}</p>
			</div>
		</div>
	{/if}
</div>
