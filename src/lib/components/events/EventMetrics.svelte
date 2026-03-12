<script lang="ts">
	let { rsvpCount, attendeeCount, verifiedAttendees, capacity }: {
		rsvpCount: number;
		attendeeCount: number;
		verifiedAttendees: number;
		capacity: number | null;
	} = $props();

	const rsvpPercent = $derived(capacity ? Math.min(100, (rsvpCount / capacity) * 100) : null);
	const verifiedPercent = $derived(attendeeCount > 0 ? (verifiedAttendees / attendeeCount) * 100 : 0);
</script>

<div class="grid grid-cols-3 gap-3">
	<!-- RSVP Count -->
	<div class="rounded-lg border border-zinc-800/60 p-4">
		<p class="text-xs font-medium text-zinc-500">RSVPs</p>
		<p class="mt-1 text-2xl font-bold text-zinc-100">
			{rsvpCount}
			{#if capacity}
				<span class="text-sm font-normal text-zinc-500">/ {capacity}</span>
			{/if}
		</p>
		{#if rsvpPercent !== null}
			<div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
				<div
					class="h-full rounded-full bg-zinc-400 transition-all"
					style="width: {rsvpPercent}%"
				></div>
			</div>
		{/if}
	</div>

	<!-- Attendee Count -->
	<div class="rounded-lg border border-zinc-800/60 p-4">
		<p class="text-xs font-medium text-zinc-500">Checked In</p>
		<p class="mt-1 text-2xl font-bold text-zinc-100">{attendeeCount}</p>
		{#if rsvpCount > 0}
			<div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
				<div
					class="h-full rounded-full bg-blue-500 transition-all"
					style="width: {Math.min(100, (attendeeCount / rsvpCount) * 100)}%"
				></div>
			</div>
		{/if}
	</div>

	<!-- Verified Attendees -->
	<div class="rounded-lg border border-zinc-800/60 p-4">
		<p class="text-xs font-medium text-zinc-500">Verified</p>
		<p class="mt-1 text-2xl font-bold text-green-400">{verifiedAttendees}</p>
		{#if attendeeCount > 0}
			<div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
				<div
					class="h-full rounded-full bg-green-500 transition-all"
					style="width: {verifiedPercent}%"
				></div>
			</div>
		{/if}
	</div>
</div>
