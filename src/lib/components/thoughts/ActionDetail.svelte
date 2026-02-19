<!--
ActionDetail: L2 depth expansion for action traces

Shows research/retrieval details:
- Target researched
- Time taken (duration)
- Status (pending/complete/error)
- Pages visited (for research)
- Findings list
- Retrieval results (for retrieve actions)
- Error message (if failed)

PERCEPTUAL ENGINEERING:
- Status badge provides immediate state (color-coded)
- Timeline shows duration (concrete metric reduces uncertainty)
- Pages list shows research path (transparency builds trust)
- Findings emphasize key outcomes (what matters most)
- Error state is clear and actionable

ACCESSIBILITY:
- Status announced by screen reader
- Links are keyboard accessible
- Color not sole indicator of state (icons + text)
-->
<script lang="ts">
	import type { ActionTrace } from '$lib/core/thoughts/types';
	import { Clock, CheckCircle, AlertCircle, Loader, ExternalLink } from '@lucide/svelte';

	interface Props {
		action: ActionTrace;
	}

	let { action }: Props = $props();

	// Status badge styling
	const statusSchemes = {
		pending: {
			bg: 'bg-blue-50',
			text: 'text-blue-700',
			border: 'border-blue-200',
			icon: Loader
		},
		complete: {
			bg: 'bg-emerald-50',
			text: 'text-emerald-700',
			border: 'border-emerald-200',
			icon: CheckCircle
		},
		error: {
			bg: 'bg-rose-50',
			text: 'text-rose-700',
			border: 'border-rose-200',
			icon: AlertCircle
		}
	};

	const scheme = $derived(statusSchemes[action.status]);
	const StatusIcon = $derived(scheme.icon);

	// Calculate duration
	const duration = $derived(action.endTime ? action.endTime - action.startTime : Date.now() - action.startTime);
	const durationSeconds = $derived((duration / 1000).toFixed(1));

	// Format target type
	const targetTypeLabels: Record<string, string> = {
		congress: 'Congressional',
		state_legislature: 'State Legislature',
		local_government: 'Local Government',
		corporate: 'Corporate',
		nonprofit: 'Nonprofit',
		education: 'Education',
		healthcare: 'Healthcare',
		labor: 'Labor',
		media: 'Media'
	};
</script>

<div class="action-detail space-y-5">
	<!-- Status badge -->
	<div class="flex items-center gap-2">
		<span
			class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium
				{scheme.bg} {scheme.text} {scheme.border}"
		>
			<StatusIcon class="h-3.5 w-3.5" aria-hidden="true" />
			<span class="capitalize">{action.status}</span>
		</span>
	</div>

	<!-- Target info -->
	<div class="space-y-3">
		<!-- Target -->
		<div class="space-y-1">
			<span class="block text-xs font-medium uppercase tracking-wider" style="color: oklch(0.5 0.02 60);">
				Target
			</span>
			<p class="text-sm font-semibold" style="color: oklch(0.2 0.02 60);">
				{action.target}
			</p>
			{#if action.targetType}
				<p class="text-xs" style="color: oklch(0.45 0.02 60);">
					{targetTypeLabels[action.targetType] || action.targetType}
				</p>
			{/if}
		</div>

		<!-- Duration -->
		<div class="flex items-center gap-2 text-sm" style="color: oklch(0.45 0.02 60);">
			<Clock class="h-4 w-4" aria-hidden="true" />
			<span>{durationSeconds}s</span>
		</div>
	</div>

	<!-- Research-specific: Pages visited -->
	{#if action.pagesVisited && action.pagesVisited.length > 0}
		<div class="space-y-2">
			<h4 class="text-xs font-medium uppercase tracking-wider" style="color: oklch(0.5 0.02 60);">
				Pages Visited ({action.pagesVisited.length})
			</h4>
			<ul class="space-y-2">
				{#each action.pagesVisited as page}
					<li
						class="rounded-lg border p-3 transition-colors duration-150"
						class:opacity-60={!page.relevant}
						style="
							background: oklch(0.99 0.003 60);
							border-color: {page.relevant ? 'oklch(0.7 0.08 140 / 0.3)' : 'oklch(0.88 0.01 60 / 0.25)'};
						"
					>
						<div class="flex flex-col gap-1">
							<a
								href={page.url}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-start gap-1.5 text-xs font-medium transition-colors duration-150
									hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-1
									rounded-sm"
								style="color: oklch(0.5 0.15 240);"
							>
								<span class="break-all leading-tight">{page.title}</span>
								<ExternalLink class="h-3 w-3 shrink-0 translate-y-0.5" aria-hidden="true" />
								<span class="sr-only">(opens in new tab)</span>
							</a>
							{#if page.relevant}
								<span
									class="inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
									style="
										background: oklch(0.85 0.08 140 / 0.3);
										color: oklch(0.35 0.12 140);
									"
								>
									Relevant
								</span>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<!-- Findings -->
	{#if action.findings && action.findings.length > 0}
		<div class="space-y-2">
			<h4 class="text-xs font-medium uppercase tracking-wider" style="color: oklch(0.5 0.02 60);">
				Findings ({action.findings.length})
			</h4>
			<ul class="space-y-2">
				{#each action.findings as finding}
					<li
						class="rounded-lg border-l-4 p-3"
						style="
							background: oklch(0.99 0.003 60);
							border-left-color: oklch(0.65 0.1 140);
						"
					>
						<p class="text-sm leading-relaxed" style="color: oklch(0.25 0.02 60);">
							{finding}
						</p>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<!-- Retrieval-specific: Results -->
	{#if action.topResults && action.topResults.length > 0}
		<div class="space-y-2">
			<h4 class="text-xs font-medium uppercase tracking-wider" style="color: oklch(0.5 0.02 60);">
				Top Results ({action.resultsCount || action.topResults.length})
			</h4>
			<ul class="space-y-2">
				{#each action.topResults as result}
					<li
						class="rounded-lg border p-3"
						style="
							background: oklch(0.99 0.003 60);
							border-color: oklch(0.88 0.01 60 / 0.25);
						"
					>
						<div class="flex items-start justify-between gap-2">
							<div class="min-w-0 flex-1">
								<p class="text-sm font-medium" style="color: oklch(0.25 0.02 60);">
									{result.title}
								</p>
								<code
									class="mt-1 block text-xs font-mono"
									style="color: oklch(0.45 0.02 60);"
								>
									{result.id}
								</code>
							</div>
							<span
								class="shrink-0 rounded-full px-2 py-1 text-xs font-medium"
								style="
									background: oklch(0.85 0.08 220 / 0.3);
									color: oklch(0.35 0.12 220);
								"
							>
								{(result.score * 100).toFixed(0)}%
							</span>
						</div>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<!-- Query (for retrieve actions) -->
	{#if action.query}
		<div class="space-y-1">
			<span class="block text-xs font-medium uppercase tracking-wider" style="color: oklch(0.5 0.02 60);">
				Query
			</span>
			<code
				class="block rounded-lg p-3 text-xs font-mono leading-relaxed"
				style="
					background: oklch(0.97 0.003 60);
					color: oklch(0.3 0.02 60);
				"
			>
				{action.query}
			</code>
		</div>
	{/if}

	<!-- Error message -->
	{#if action.error}
		<div
			class="rounded-lg border border-rose-200 p-4"
			style="background: oklch(0.98 0.015 15);"
		>
			<div class="flex gap-3">
				<AlertCircle class="h-5 w-5 shrink-0 text-rose-600" aria-hidden="true" />
				<div class="min-w-0 flex-1">
					<h5 class="text-sm font-semibold text-rose-700">Error</h5>
					<p class="mt-1 text-sm text-rose-600">
						{action.error}
					</p>
				</div>
			</div>
		</div>
	{/if}
</div>
