<script lang="ts">
	import SmsBlastCard from '$lib/components/sms/SmsBlastCard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>SMS Campaigns | {data.org.name}</title>
</svelte:head>

<div class="min-h-screen bg-surface-raised text-text-primary">
	<div class="mx-auto max-w-4xl px-4 py-8">
		<!-- Header -->
		<div class="mb-8 flex items-center justify-between">
			<h1 class="text-2xl font-bold text-text-primary">SMS Campaigns</h1>
			<a
				href="/org/{data.org.slug}/sms/new"
				class="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500"
			>
				New SMS Campaign
			</a>
		</div>

		<!-- Blast List -->
		{#if data.blasts.length === 0}
			<div class="rounded-lg border border-surface-border py-16 text-center">
				<p class="text-lg text-text-tertiary">No SMS campaigns yet.</p>
				<p class="mt-1 text-sm text-text-tertiary">Send your first SMS campaign to reach supporters directly.</p>
				<a
					href="/org/{data.org.slug}/sms/new"
					class="mt-4 inline-block rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500"
				>
					New SMS Campaign
				</a>
			</div>
		{:else}
			<div class="space-y-3">
				{#each data.blasts as blast (blast.id)}
					<a href="/org/{data.org.slug}/sms/{blast.id}" class="block">
						<SmsBlastCard {blast} />
					</a>
				{/each}
			</div>
		{/if}
	</div>
</div>
