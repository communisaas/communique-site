<script lang="ts">
	import EventMetrics from '$lib/components/events/EventMetrics.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const statusColors: Record<string, string> = {
		DRAFT: 'bg-surface-border-strong text-text-secondary',
		PUBLISHED: 'bg-green-900/50 text-green-400',
		CANCELLED: 'bg-red-900/50 text-red-400',
		COMPLETED: 'bg-blue-900/50 text-blue-400'
	};

	function formatDate(iso: string): string {
		return new Intl.DateTimeFormat('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			timeZone: data.event.timezone,
			timeZoneName: 'short'
		}).format(new Date(iso));
	}
</script>

<svelte:head>
	<title>{data.event.title} | {data.org.name}</title>
</svelte:head>

<div class="min-h-screen bg-surface-raised text-text-primary">
	<div class="mx-auto max-w-4xl px-4 py-8">
		<!-- Back link -->
		<a href="/org/{data.org.slug}/events" class="mb-6 inline-block text-sm text-text-tertiary hover:text-text-primary">
			&larr; All Events
		</a>

		<!-- Header -->
		<div class="mb-6 flex flex-wrap items-start justify-between gap-4">
			<div>
				<div class="mb-2 flex items-center gap-3">
					<h1 class="text-2xl font-bold text-text-primary">{data.event.title}</h1>
					<span class="rounded-full px-2.5 py-0.5 text-xs font-medium {statusColors[data.event.status] ?? 'bg-surface-border-strong text-text-secondary'}">
						{data.event.status}
					</span>
				</div>
				<p class="text-sm text-text-tertiary">
					{formatDate(data.event.startAt)}
					{#if data.event.endAt} &mdash; {formatDate(data.event.endAt)}{/if}
				</p>
				{#if data.event.venue}
					<p class="mt-1 text-sm text-text-tertiary">{[data.event.venue, data.event.city, data.event.state].filter(Boolean).join(', ')}</p>
				{/if}
			</div>

			<!-- Actions -->
			<div class="flex gap-2">
				<a
					href="/e/{data.event.id}"
					target="_blank"
					rel="noopener"
					class="rounded-lg border border-surface-border-strong px-3 py-1.5 text-sm text-text-secondary hover:border-text-tertiary hover:text-text-primary"
				>
					View Public Page
				</a>
			</div>
		</div>

		<!-- Metrics -->
		<EventMetrics
			rsvpCount={data.event.rsvpCount}
			attendeeCount={data.event.attendeeCount}
			verifiedAttendees={data.event.verifiedAttendees}
			capacity={data.event.capacity}
		/>

		<!-- Check-in Code -->
		{#if data.event.checkinCode}
			<div class="mt-6 rounded-lg border border-surface-border p-4">
				<h3 class="mb-2 text-sm font-medium text-text-tertiary">Check-in Code</h3>
				<p class="font-mono text-2xl font-bold tracking-wider text-text-primary">{data.event.checkinCode}</p>
				<p class="mt-1 text-xs text-text-tertiary">Share this code with attendees to verify their attendance</p>
			</div>
		{/if}

		<!-- RSVP List -->
		<div class="mt-6">
			<h3 class="mb-3 text-sm font-medium text-text-tertiary">RSVPs ({data.rsvps.length})</h3>
			{#if data.rsvps.length === 0}
				<p class="py-8 text-center text-sm text-text-tertiary">No RSVPs yet</p>
			{:else}
				<div class="overflow-x-auto rounded-lg border border-surface-border">
					<table class="w-full text-left text-sm">
						<thead>
							<tr class="border-b border-surface-border text-xs text-text-tertiary">
								<th class="px-4 py-3 font-medium">Name</th>
								<th class="px-4 py-3 font-medium">Email</th>
								<th class="px-4 py-3 font-medium">Status</th>
								<th class="px-4 py-3 font-medium">District</th>
								<th class="px-4 py-3 font-medium">Checked In</th>
							</tr>
						</thead>
						<tbody>
							{#each data.rsvps as rsvp (rsvp.id)}
								<tr class="border-b border-surface-border last:border-0">
									<td class="px-4 py-3 text-text-primary">{rsvp.name}</td>
									<td class="px-4 py-3 text-text-tertiary">{rsvp.email}</td>
									<td class="px-4 py-3">
										<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium {
											rsvp.status === 'GOING' ? 'bg-green-900/50 text-green-400' :
											rsvp.status === 'MAYBE' ? 'bg-yellow-900/50 text-yellow-400' :
											rsvp.status === 'WAITLISTED' ? 'bg-blue-900/50 text-blue-400' :
											'bg-surface-border-strong text-text-secondary'
										}">
											{rsvp.status}
										</span>
									</td>
									<td class="px-4 py-3 font-mono text-xs text-text-tertiary">{rsvp.districtHash ?? '-'}</td>
									<td class="px-4 py-3">
										{#if rsvp.checkedIn}
											<span class="text-green-400" title="Checked in{rsvp.verified ? ' (verified)' : ''}">
												{rsvp.verified ? 'Verified' : 'Yes'}
											</span>
										{:else}
											<span class="text-text-quaternary">-</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	</div>
</div>
