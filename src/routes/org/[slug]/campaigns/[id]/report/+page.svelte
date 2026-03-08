<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let selectedTargets = $state<Set<string>>(new Set());

	const selectedCount = $derived(selectedTargets.size);
	const hasTargets = $derived(data.targets.length > 0);

	$effect(() => {
		selectedTargets = new Set(data.targets.map((t: { email: string }) => t.email));
	});

	function toggleTarget(email: string) {
		const next = new Set(selectedTargets);
		if (next.has(email)) {
			next.delete(email);
		} else {
			next.add(email);
		}
		selectedTargets = next;
	}

	function toggleAll() {
		if (selectedTargets.size === data.targets.length) {
			selectedTargets = new Set();
		} else {
			selectedTargets = new Set(data.targets.map((t) => t.email));
		}
	}

	function statusBadgeClass(status: string): string {
		switch (status) {
			case 'sent':
				return 'bg-teal-500/15 text-teal-400 border-teal-500/20';
			case 'delivered':
				return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
			case 'opened':
				return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
			case 'bounced':
				return 'bg-red-500/15 text-red-400 border-red-500/20';
			case 'queued':
				return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20';
			default:
				return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20';
		}
	}

	function formatDate(iso: string): string {
		const d = new Date(iso);
		return d.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}
</script>

<div class="space-y-6">
	<!-- Breadcrumb -->
	<nav class="flex items-center gap-2 text-sm text-zinc-500">
		<a href="/org/{data.org.slug}/campaigns" class="hover:text-zinc-300 transition-colors">
			Campaigns
		</a>
		<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
		</svg>
		<a href="/org/{data.org.slug}/campaigns/{data.campaign.id}" class="hover:text-zinc-300 transition-colors">
			{data.campaign.title}
		</a>
		<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
		</svg>
		<span class="text-zinc-400">Report</span>
	</nav>

	<!-- Error/success messages -->
	{#if form?.error}
		<div class="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
			{form.error}
		</div>
	{/if}
	{#if form?.success}
		<div class="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
			Report sent to {form.sentCount} target{form.sentCount === 1 ? '' : 's'}
		</div>
	{/if}

	<!-- Targets + Send -->
	<form method="POST" action="?/send" use:enhance={({ cancel }) => {
		if (!confirm(`Send report to ${selectedCount} target${selectedCount === 1 ? '' : 's'}? This cannot be undone.`)) {
			cancel();
			return;
		}
		return async ({ update }) => {
			await update({ reset: false });
		};
	}} class="space-y-6">
		<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-6 space-y-4">
			<div class="flex items-center justify-between">
				<p class="text-xs font-mono uppercase tracking-wider text-zinc-500">Sending to</p>
				{#if hasTargets}
					<button
						type="button"
						onclick={toggleAll}
						class="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
					>
						{selectedTargets.size === data.targets.length ? 'Deselect all' : 'Select all'}
					</button>
				{/if}
			</div>

			{#if !hasTargets}
				<div class="py-4 text-center">
					<p class="text-sm text-zinc-500">No targets configured for this campaign.</p>
					<p class="text-xs text-zinc-600 mt-1">
						Add decision-maker targets in the campaign settings to enable report delivery.
					</p>
				</div>
			{:else}
				<div class="space-y-2">
					{#each data.targets as target}
						{@const isSelected = selectedTargets.has(target.email)}
						<label
							class="flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors
								{isSelected
									? 'border-teal-500/30 bg-teal-500/5'
									: 'border-zinc-800/40 bg-zinc-950/30 opacity-60'}"
						>
							<input
								type="checkbox"
								name="target"
								value={target.email}
								checked={isSelected}
								onchange={() => toggleTarget(target.email)}
								class="rounded border-zinc-600 bg-zinc-800 text-teal-500 focus:ring-teal-500/40 focus:ring-offset-0"
							/>
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2">
									<span class="text-sm text-zinc-200 truncate">
										{target.name ?? target.email}
									</span>
									{#if target.title}
										<span class="text-xs text-zinc-500 truncate">{target.title}</span>
									{/if}
								</div>
								<div class="flex items-center gap-3 mt-0.5">
									<span class="text-xs font-mono text-zinc-500">{target.email}</span>
									{#if target.district}
										<span class="text-xs text-teal-500/60">{target.district}</span>
									{/if}
								</div>
							</div>
						</label>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Email Preview -->
		<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-6 space-y-4">
			<p class="text-xs font-mono uppercase tracking-wider text-zinc-500">Email Preview</p>
			<div class="rounded-lg border border-zinc-800/40 bg-zinc-950/50 overflow-hidden" style="max-height: 600px; overflow-y: auto;">
				<iframe
					srcdoc={data.renderedHtml}
					title="Report email preview"
					class="w-full border-0"
					style="height: 600px; background: #09090b;"
					sandbox=""
				></iframe>
			</div>
		</div>

		<!-- Send button -->
		{#if hasTargets}
			<div class="flex items-center gap-4">
				<button
					type="submit"
					disabled={selectedCount === 0}
					class="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
				>
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
					</svg>
					Send to {selectedCount} target{selectedCount === 1 ? '' : 's'}
				</button>
				<a
					href="/org/{data.org.slug}/campaigns/{data.campaign.id}"
					class="rounded-lg bg-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-600 transition-colors"
				>
					Back to dashboard
				</a>
			</div>
		{:else}
			<a
				href="/org/{data.org.slug}/campaigns/{data.campaign.id}"
				class="inline-flex rounded-lg bg-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-600 transition-colors"
			>
				Back to dashboard
			</a>
		{/if}
	</form>

	<!-- Past Deliveries -->
	{#if data.pastDeliveries.length > 0}
		<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-6 space-y-4">
			<p class="text-xs font-mono uppercase tracking-wider text-zinc-500">Delivery History</p>

			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-zinc-800/60">
							<th class="text-left text-xs font-mono text-zinc-600 pb-2 pr-4">Recipient</th>
							<th class="text-left text-xs font-mono text-zinc-600 pb-2 pr-4">Status</th>
							<th class="text-left text-xs font-mono text-zinc-600 pb-2 pr-4">Sent</th>
							<th class="text-left text-xs font-mono text-zinc-600 pb-2">District</th>
						</tr>
					</thead>
					<tbody>
						{#each data.pastDeliveries as delivery}
							<tr class="border-b border-zinc-800/30">
								<td class="py-2.5 pr-4">
									<div class="text-zinc-200 truncate max-w-[200px]">
										{delivery.targetName ?? delivery.targetEmail}
									</div>
									{#if delivery.targetName}
										<div class="text-xs font-mono text-zinc-500 truncate max-w-[200px]">
											{delivery.targetEmail}
										</div>
									{/if}
								</td>
								<td class="py-2.5 pr-4">
									<span class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-mono {statusBadgeClass(delivery.status)}">
										{delivery.status}
									</span>
								</td>
								<td class="py-2.5 pr-4">
									<span class="text-xs font-mono tabular-nums text-zinc-500">
										{delivery.sentAt ? formatDate(delivery.sentAt) : '\u2014'}
									</span>
								</td>
								<td class="py-2.5">
									<span class="text-xs text-teal-500/60">
										{delivery.targetDistrict ?? '\u2014'}
									</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>
