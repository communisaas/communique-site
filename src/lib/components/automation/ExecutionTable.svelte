<script lang="ts">
	let { executions }: {
		executions: Array<{
			id: string;
			supporterName: string;
			supporterEmail: string;
			status: string;
			currentStep: number;
			error: string | null;
			createdAt: string;
			completedAt: string | null;
		}>;
	} = $props();

	const statusColors: Record<string, string> = {
		pending: 'bg-zinc-700 text-zinc-300',
		running: 'bg-blue-900/50 text-blue-400',
		completed: 'bg-green-900/50 text-green-400',
		failed: 'bg-red-900/50 text-red-400',
		paused: 'bg-yellow-900/50 text-yellow-400'
	};

	function formatDate(iso: string): string {
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		}).format(new Date(iso));
	}
</script>

{#if executions.length === 0}
	<p class="py-8 text-center text-sm text-zinc-500">No executions yet</p>
{:else}
	<div class="overflow-x-auto rounded-lg border border-zinc-800/60">
		<table class="w-full text-left text-sm">
			<thead>
				<tr class="border-b border-zinc-800/60 text-xs text-zinc-500">
					<th class="px-4 py-3 font-medium">Supporter</th>
					<th class="px-4 py-3 font-medium">Status</th>
					<th class="px-4 py-3 font-medium">Step</th>
					<th class="px-4 py-3 font-medium">Started</th>
					<th class="px-4 py-3 font-medium">Completed</th>
				</tr>
			</thead>
			<tbody>
				{#each executions as exec (exec.id)}
					<tr class="border-b border-zinc-800/40 last:border-0">
						<td class="px-4 py-3">
							<p class="text-zinc-200">{exec.supporterName}</p>
							<p class="text-xs text-zinc-500">{exec.supporterEmail}</p>
						</td>
						<td class="px-4 py-3">
							<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium {statusColors[exec.status] ?? 'bg-zinc-700 text-zinc-300'}">
								{exec.status}
							</span>
							{#if exec.error}
								<p class="mt-1 max-w-48 truncate text-xs text-red-400" title={exec.error}>{exec.error}</p>
							{/if}
						</td>
						<td class="px-4 py-3 text-zinc-400">{exec.currentStep}</td>
						<td class="px-4 py-3 text-zinc-500">{formatDate(exec.createdAt)}</td>
						<td class="px-4 py-3 text-zinc-500">
							{exec.completedAt ? formatDate(exec.completedAt) : '-'}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
