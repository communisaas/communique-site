<script lang="ts">
	import { FileText, ChevronDown, ChevronUp } from '@lucide/svelte';

	interface Props {
		researchLog: string[];
		expanded?: boolean;
	}

	let { researchLog, expanded = $bindable(false) }: Props = $props();
</script>

<div class="rounded-lg border border-slate-200 bg-white">
	<!-- Header -->
	<button
		type="button"
		onclick={() => (expanded = !expanded)}
		class="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-slate-50"
	>
		<div class="flex items-center gap-3">
			<div class="rounded-lg bg-slate-100 p-2">
				<FileText class="h-5 w-5 text-slate-600" />
			</div>
			<div>
				<h3 class="font-semibold text-slate-900">Research Log</h3>
				<p class="text-xs text-slate-600 md:text-sm">
					{researchLog.length} research steps · See how we built this message
				</p>
			</div>
		</div>

		<div class="text-slate-400">
			{#if expanded}
				<ChevronUp class="h-5 w-5" />
			{:else}
				<ChevronDown class="h-5 w-5" />
			{/if}
		</div>
	</button>

	<!-- Expanded log -->
	{#if expanded}
		<div class="border-t border-slate-100 p-4 pt-3">
			<div class="space-y-3">
				{#each researchLog as step, i}
					<div class="flex gap-3">
						<!-- Step number -->
						<div
							class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600"
						>
							{i + 1}
						</div>

						<!-- Step text -->
						<div class="flex-1 pt-0.5">
							<p class="text-sm leading-relaxed text-slate-700">{step}</p>
						</div>
					</div>
				{/each}
			</div>

			<!-- Educational context -->
			<div class="mt-4 rounded-lg bg-slate-50 p-3">
				<p class="text-xs leading-relaxed text-slate-600">
					<span class="font-semibold text-slate-700">Why transparency matters:</span>
					This log shows the agent's research process. You can verify the reasoning, check sources, and
					understand why specific points were included. No black box—just traceable civic intelligence.
				</p>
			</div>
		</div>
	{/if}
</div>
