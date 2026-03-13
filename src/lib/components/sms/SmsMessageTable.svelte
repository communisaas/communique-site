<script lang="ts">
	let { messages }: {
		messages: Array<{
			id: string;
			recipientName: string;
			to: string;
			status: string;
			errorCode: string | null;
			createdAt: string;
		}>;
	} = $props();

	const statusColors: Record<string, string> = {
		queued: 'bg-zinc-700 text-zinc-300',
		sent: 'bg-blue-900/50 text-blue-400',
		delivered: 'bg-green-900/50 text-green-400',
		failed: 'bg-red-900/50 text-red-400',
		undelivered: 'bg-yellow-900/50 text-yellow-400'
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

{#if messages.length === 0}
	<p class="py-8 text-center text-sm text-zinc-500">No messages yet</p>
{:else}
	<div class="overflow-x-auto rounded-lg border border-zinc-800/60">
		<table class="w-full text-left text-sm">
			<thead>
				<tr class="border-b border-zinc-800/60 text-xs text-zinc-500">
					<th class="px-4 py-3 font-medium">Recipient</th>
					<th class="px-4 py-3 font-medium">Status</th>
					<th class="px-4 py-3 font-medium">Error</th>
					<th class="px-4 py-3 font-medium">Sent</th>
				</tr>
			</thead>
			<tbody>
				{#each messages as msg (msg.id)}
					<tr class="border-b border-zinc-800/40 last:border-0">
						<td class="px-4 py-3">
							<p class="text-zinc-200">{msg.recipientName}</p>
							<p class="text-xs text-zinc-500">{msg.to}</p>
						</td>
						<td class="px-4 py-3">
							<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium {statusColors[msg.status] ?? 'bg-zinc-700 text-zinc-300'}">
								{msg.status}
							</span>
						</td>
						<td class="px-4 py-3 text-zinc-500">
							{#if msg.errorCode}
								<span class="text-xs text-red-400">{msg.errorCode}</span>
							{:else}
								<span class="text-zinc-600">-</span>
							{/if}
						</td>
						<td class="px-4 py-3 text-zinc-500">{formatDate(msg.createdAt)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
