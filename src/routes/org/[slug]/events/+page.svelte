<script lang="ts">
	import EventCard from '$lib/components/events/EventCard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Events | {data.org.name}</title>
</svelte:head>

<div class="min-h-screen bg-zinc-950 text-zinc-100">
	<div class="mx-auto max-w-4xl px-4 py-8">
		<!-- Header -->
		<div class="mb-8 flex items-center justify-between">
			<h1 class="text-2xl font-bold text-zinc-100">Events</h1>
			<a
				href="/org/{data.org.slug}/events/new"
				class="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-200"
			>
				Create Event
			</a>
		</div>

		<!-- Event List -->
		{#if data.events.length === 0}
			<div class="rounded-lg border border-zinc-800/60 py-16 text-center">
				<p class="text-lg text-zinc-400">No events yet.</p>
				<p class="mt-1 text-sm text-zinc-500">Create your first event to get started.</p>
				<a
					href="/org/{data.org.slug}/events/new"
					class="mt-4 inline-block rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-200"
				>
					Create Event
				</a>
			</div>
		{:else}
			<div class="space-y-3">
				{#each data.events as event (event.id)}
					<a href="/org/{data.org.slug}/events/{event.id}" class="block">
						<EventCard {event} />
					</a>
				{/each}
			</div>
		{/if}
	</div>
</div>
