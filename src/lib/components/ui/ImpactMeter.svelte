<script lang="ts">
	type Level = 'good' | 'strong' | 'highest';

	interface Props {
		level?: Level;
		delta?: number; // 0..100 heuristic, client-only
		testId?: string;
	}

	const { level = 'good', delta = 0, testId }: Props = $props();

	const labels: Record<Level, string> = {
		good: 'Good',
		strong: 'Strong',
		highest: 'Highest'
	} as const;

	function levelToPercent(l: Level): number {
		if (l === 'good') return 33;
		if (l === 'strong') return 66;
		return 100;
	}

	const percent = $derived(levelToPercent(level));
</script>

<div class="flex items-center gap-2" data-testid={testId || 'impact-meter'} hidden>
	<div class="relative h-2 w-24 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
		<div
			class="h-full bg-gradient-to-r from-emerald-500 via-blue-500 to-indigo-500 transition-all duration-300"
			style={`width: ${percent}%`}
		></div>
	</div>
	<span class="text-xs text-slate-600" aria-label={`Impact level: ${labels[level]}`}>
		{labels[level]}
	</span>
	{#if delta > 0}
		<span
			class="ml-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200"
		>
			+Δ
		</span>
	{/if}
</div>
