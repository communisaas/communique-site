<script lang="ts">
	let { blast }: {
		blast: {
			id: string;
			body: string;
			status: string;
			sentCount: number;
			deliveredCount: number;
			failedCount: number;
			totalRecipients: number;
			createdAt: string;
		};
	} = $props();

	const statusColors: Record<string, string> = {
		draft: 'bg-zinc-700 text-zinc-300',
		sending: 'bg-yellow-900/50 text-yellow-400',
		sent: 'bg-green-900/50 text-green-400',
		failed: 'bg-red-900/50 text-red-400'
	};

	const preview = $derived(
		blast.body.length > 80 ? blast.body.slice(0, 80) + '...' : blast.body
	);

	function formatDate(iso: string): string {
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		}).format(new Date(iso));
	}
</script>

<div class="rounded-lg border border-zinc-800/60 p-4 transition-colors hover:border-zinc-700">
	<div class="flex items-start justify-between gap-3">
		<div class="min-w-0 flex-1">
			<div class="mb-1 flex items-center gap-2">
				<p class="truncate text-sm text-zinc-200">{preview}</p>
				<span class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium {statusColors[blast.status] ?? 'bg-zinc-700 text-zinc-300'}">
					{blast.status}
				</span>
			</div>
			<p class="text-sm text-zinc-500">{formatDate(blast.createdAt)}</p>
		</div>

		<div class="shrink-0 text-right">
			<p class="text-sm text-zinc-300">{blast.totalRecipients} recipients</p>
			<p class="mt-0.5 text-xs text-zinc-500">
				{blast.sentCount} sent &middot;
				{blast.deliveredCount} delivered &middot;
				{blast.failedCount} failed
			</p>
		</div>
	</div>
</div>
