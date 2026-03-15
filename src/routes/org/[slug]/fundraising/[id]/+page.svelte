<script lang="ts">
	import DonationMetrics from '$lib/components/fundraising/DonationMetrics.svelte';
	import DonorTable from '$lib/components/fundraising/DonorTable.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let updating = $state(false);

	const statusColors: Record<string, string> = {
		DRAFT: 'bg-surface-border-strong text-text-secondary',
		ACTIVE: 'bg-green-900/50 text-green-400',
		PAUSED: 'bg-yellow-900/50 text-yellow-400',
		COMPLETED: 'bg-blue-900/50 text-blue-400'
	};

	function formatDate(iso: string): string {
		return new Intl.DateTimeFormat('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		}).format(new Date(iso));
	}

	async function updateStatus(status: string) {
		updating = true;
		try {
			const res = await fetch(`/api/org/${data.org.slug}/fundraising/${data.campaign.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status })
			});
			if (res.ok) {
				window.location.reload();
			}
		} catch {
			/* ignore */
		} finally {
			updating = false;
		}
	}
</script>

<svelte:head>
	<title>{data.campaign.title} | {data.org.name}</title>
</svelte:head>

<div class="min-h-screen bg-surface-raised text-text-primary">
	<div class="mx-auto max-w-4xl px-4 py-8">
		<!-- Back link -->
		<a href="/org/{data.org.slug}/fundraising" class="mb-6 inline-block text-sm text-text-tertiary hover:text-text-primary">
			&larr; All Fundraisers
		</a>

		<!-- Header -->
		<div class="mb-6 flex flex-wrap items-start justify-between gap-4">
			<div>
				<div class="mb-2 flex items-center gap-3">
					<h1 class="text-2xl font-bold text-text-primary">{data.campaign.title}</h1>
					<span class="rounded-full px-2.5 py-0.5 text-xs font-medium {statusColors[data.campaign.status] ?? 'bg-surface-border-strong text-text-secondary'}">
						{data.campaign.status}
					</span>
				</div>
				<p class="text-sm text-text-tertiary">Created {formatDate(data.campaign.createdAt)}</p>
			</div>

			<!-- Actions -->
			<div class="flex gap-2">
				<a
					href="/d/{data.campaign.id}"
					target="_blank"
					rel="noopener"
					class="rounded-lg border border-surface-border-strong px-3 py-1.5 text-sm text-text-secondary hover:border-text-tertiary hover:text-text-primary"
				>
					View Public Page
				</a>
				{#if data.campaign.status === 'DRAFT' || data.campaign.status === 'PAUSED'}
					<button
						onclick={() => updateStatus('ACTIVE')}
						disabled={updating}
						class="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
					>
						Publish
					</button>
				{:else if data.campaign.status === 'ACTIVE'}
					<button
						onclick={() => updateStatus('PAUSED')}
						disabled={updating}
						class="rounded-lg bg-yellow-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-yellow-500 disabled:opacity-50"
					>
						Pause
					</button>
				{/if}
			</div>
		</div>

		<!-- Metrics -->
		<DonationMetrics campaign={data.campaign} />

		<!-- Description -->
		{#if data.campaign.body}
			<div class="mt-6 rounded-lg border border-surface-border p-4">
				<h3 class="mb-2 text-sm font-medium text-text-tertiary">Description</h3>
				<p class="whitespace-pre-line text-sm text-text-secondary">{data.campaign.body}</p>
			</div>
		{/if}

		<!-- Donor List -->
		<div class="mt-6">
			<h3 class="mb-3 text-sm font-medium text-text-tertiary">Donors ({data.donors.length})</h3>
			<DonorTable donors={data.donors} currency={data.campaign.donationCurrency} />
		</div>
	</div>
</div>
