<script lang="ts">
	let { calls }: {
		calls: Array<{
			id: string;
			supporterName: string;
			targetName: string | null;
			targetPhone: string;
			status: string;
			duration: number | null;
			createdAt: string;
		}>;
	} = $props();

	const statusColors: Record<string, string> = {
		initiated: 'bg-zinc-700 text-zinc-300',
		ringing: 'bg-yellow-900/50 text-yellow-400',
		'in-progress': 'bg-blue-900/50 text-blue-400',
		completed: 'bg-green-900/50 text-green-400',
		failed: 'bg-red-900/50 text-red-400',
		'no-answer': 'bg-zinc-700 text-zinc-300',
		busy: 'bg-yellow-900/50 text-yellow-400'
	};

	function formatDuration(seconds: number | null): string {
		if (seconds == null) return '-';
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	function formatDate(iso: string): string {
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		}).format(new Date(iso));
	}
</script>

{#if calls.length === 0}
	<p class="py-8 text-center text-sm text-zinc-500">No calls yet</p>
{:else}
	<div class="overflow-x-auto rounded-lg border border-zinc-800/60">
		<table class="w-full text-left text-sm">
			<thead>
				<tr class="border-b border-zinc-800/60 text-xs text-zinc-500">
					<th class="px-4 py-3 font-medium">Supporter</th>
					<th class="px-4 py-3 font-medium">Target</th>
					<th class="px-4 py-3 font-medium">Status</th>
					<th class="px-4 py-3 font-medium">Duration</th>
					<th class="px-4 py-3 font-medium">Date</th>
				</tr>
			</thead>
			<tbody>
				{#each calls as call (call.id)}
					<tr class="border-b border-zinc-800/40 last:border-0">
						<td class="px-4 py-3 text-zinc-200">{call.supporterName}</td>
						<td class="px-4 py-3">
							<p class="text-zinc-200">{call.targetName ?? 'Unknown'}</p>
							<p class="text-xs text-zinc-500">{call.targetPhone}</p>
						</td>
						<td class="px-4 py-3">
							<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium {statusColors[call.status] ?? 'bg-zinc-700 text-zinc-300'}">
								{call.status}
							</span>
						</td>
						<td class="px-4 py-3 text-zinc-400">{formatDuration(call.duration)}</td>
						<td class="px-4 py-3 text-zinc-500">{formatDate(call.createdAt)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
