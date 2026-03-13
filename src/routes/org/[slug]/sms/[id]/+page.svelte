<script lang="ts">
	import SmsMessageTable from '$lib/components/sms/SmsMessageTable.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let deleting = $state(false);

	const statusColors: Record<string, string> = {
		draft: 'bg-zinc-700 text-zinc-300',
		sending: 'bg-yellow-900/50 text-yellow-400',
		sent: 'bg-green-900/50 text-green-400',
		failed: 'bg-red-900/50 text-red-400'
	};

	function formatDate(iso: string): string {
		return new Intl.DateTimeFormat('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		}).format(new Date(iso));
	}

	async function deleteBlast() {
		if (!confirm('Delete this SMS campaign? This cannot be undone.')) return;
		deleting = true;
		try {
			const res = await fetch(`/api/org/${data.org.slug}/sms/${data.blast.id}`, {
				method: 'DELETE'
			});
			if (res.ok) {
				window.location.href = `/org/${data.org.slug}/sms`;
			}
		} catch {
			/* ignore */
		} finally {
			deleting = false;
		}
	}
</script>

<svelte:head>
	<title>SMS Campaign | {data.org.name}</title>
</svelte:head>

<div class="min-h-screen bg-zinc-950 text-zinc-100">
	<div class="mx-auto max-w-4xl px-4 py-8">
		<!-- Back link -->
		<a href="/org/{data.org.slug}/sms" class="mb-6 inline-block text-sm text-zinc-400 hover:text-zinc-200">
			&larr; All SMS Campaigns
		</a>

		<!-- Header -->
		<div class="mb-6 flex flex-wrap items-start justify-between gap-4">
			<div>
				<div class="mb-2 flex items-center gap-3">
					<h1 class="text-2xl font-bold text-zinc-100">SMS Campaign</h1>
					<span class="rounded-full px-2.5 py-0.5 text-xs font-medium {statusColors[data.blast.status] ?? 'bg-zinc-700 text-zinc-300'}">
						{data.blast.status}
					</span>
				</div>
				<p class="text-sm text-zinc-500">Created {formatDate(data.blast.createdAt)}</p>
				{#if data.blast.sentAt}
					<p class="text-sm text-zinc-500">Sent {formatDate(data.blast.sentAt)}</p>
				{/if}
			</div>

			<!-- Actions -->
			<div class="flex gap-2">
				{#if data.blast.status === 'draft' || data.blast.status === 'sent'}
					<button
						onclick={deleteBlast}
						disabled={deleting}
						class="rounded-lg border border-red-800/60 px-3 py-1.5 text-sm text-red-400 hover:border-red-600 hover:text-red-300 disabled:opacity-50"
					>
						Delete
					</button>
				{/if}
			</div>
		</div>

		<!-- Metrics -->
		<div class="mb-6 grid grid-cols-4 gap-3">
			<div class="rounded-lg border border-zinc-800/60 p-4">
				<p class="text-xs font-medium text-zinc-500">Recipients</p>
				<p class="mt-1 text-lg font-bold text-zinc-100">{data.blast.totalRecipients}</p>
			</div>
			<div class="rounded-lg border border-zinc-800/60 p-4">
				<p class="text-xs font-medium text-zinc-500">Sent</p>
				<p class="mt-1 text-lg font-bold text-zinc-100">{data.blast.sentCount}</p>
			</div>
			<div class="rounded-lg border border-zinc-800/60 p-4">
				<p class="text-xs font-medium text-zinc-500">Delivered</p>
				<p class="mt-1 text-lg font-bold text-green-400">{data.blast.deliveredCount}</p>
			</div>
			<div class="rounded-lg border border-zinc-800/60 p-4">
				<p class="text-xs font-medium text-zinc-500">Failed</p>
				<p class="mt-1 text-lg font-bold text-red-400">{data.blast.failedCount}</p>
			</div>
		</div>

		<!-- Message Body -->
		<div class="mb-6 rounded-lg border border-zinc-800/60 p-4">
			<h3 class="mb-3 text-sm font-medium text-zinc-400">Message</h3>
			<div class="rounded-lg bg-zinc-900/50 px-4 py-3">
				<p class="whitespace-pre-wrap text-sm text-zinc-200">{data.blast.body}</p>
			</div>
		</div>

		<!-- Messages -->
		<div>
			<h3 class="mb-3 text-sm font-medium text-zinc-400">Delivery Status</h3>
			<SmsMessageTable messages={data.messages} />
		</div>
	</div>
</div>
