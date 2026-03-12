<script lang="ts">
	let { event }: {
		event: {
			id: string;
			title: string;
			startAt: string;
			endAt: string | null;
			timezone: string;
			venue: string | null;
			city: string | null;
			eventType: string;
			status: string;
			rsvpCount: number;
			capacity: number | null;
			attendeeCount: number;
			verifiedAttendees: number;
		};
	} = $props();

	const statusColors: Record<string, string> = {
		DRAFT: 'bg-zinc-700 text-zinc-300',
		PUBLISHED: 'bg-green-900/50 text-green-400',
		CANCELLED: 'bg-red-900/50 text-red-400',
		COMPLETED: 'bg-blue-900/50 text-blue-400'
	};

	function formatDate(iso: string): string {
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			timeZone: event.timezone
		}).format(new Date(iso));
	}

	const locationLabel = $derived(
		event.venue
			? [event.venue, event.city].filter(Boolean).join(', ')
			: event.eventType === 'VIRTUAL'
				? 'Virtual'
				: null
	);

	const capacityPercent = $derived(
		event.capacity ? Math.min(100, (event.rsvpCount / event.capacity) * 100) : null
	);
</script>

<div class="rounded-lg border border-zinc-800/60 p-4 transition-colors hover:border-zinc-700">
	<div class="flex items-start justify-between gap-3">
		<div class="min-w-0 flex-1">
			<div class="mb-1 flex items-center gap-2">
				<h3 class="truncate text-base font-semibold text-zinc-100">{event.title}</h3>
				<span class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium {statusColors[event.status] ?? 'bg-zinc-700 text-zinc-300'}">
					{event.status}
				</span>
			</div>

			<p class="text-sm text-zinc-400">{formatDate(event.startAt)}</p>

			{#if locationLabel}
				<p class="mt-0.5 text-sm text-zinc-500">{locationLabel}</p>
			{/if}
		</div>

		<div class="shrink-0 text-right">
			<p class="text-lg font-bold text-zinc-200">{event.rsvpCount}</p>
			<p class="text-xs text-zinc-500">
				RSVP{event.rsvpCount !== 1 ? 's' : ''}
				{#if event.capacity}
					/ {event.capacity}
				{/if}
			</p>
		</div>
	</div>

	{#if capacityPercent !== null}
		<div class="mt-3 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
			<div
				class="h-full rounded-full transition-all duration-300 {capacityPercent >= 90 ? 'bg-amber-500' : 'bg-zinc-500'}"
				style="width: {capacityPercent}%"
			></div>
		</div>
	{/if}

	{#if event.verifiedAttendees > 0}
		<div class="mt-2 flex items-center gap-1">
			<svg class="h-3.5 w-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
			<span class="text-xs text-green-400">{event.verifiedAttendees} verified</span>
		</div>
	{/if}
</div>
