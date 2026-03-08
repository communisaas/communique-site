<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Unsubscribe — commons.email</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
	<div class="max-w-md w-full text-center space-y-4">
		{#if data.status === 'success'}
			<div class="rounded-xl border border-teal-500/20 bg-teal-500/5 p-8">
				<svg
					class="w-12 h-12 mx-auto text-teal-400 mb-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<h1 class="text-lg font-semibold text-zinc-100">Unsubscribed</h1>
				<p class="text-sm text-zinc-400 mt-2">
					You will no longer receive emails from this organization.
				</p>
			</div>
		{:else if data.status === 'already'}
			<div class="rounded-xl border border-zinc-700/50 bg-zinc-900/50 p-8">
				<h1 class="text-lg font-semibold text-zinc-100">Already Unsubscribed</h1>
				<p class="text-sm text-zinc-400 mt-2">You were already unsubscribed from this list.</p>
			</div>
		{:else}
			<div class="rounded-xl border border-red-500/20 bg-red-500/5 p-8">
				<h1 class="text-lg font-semibold text-zinc-100">Invalid Link</h1>
				<p class="text-sm text-zinc-400 mt-2">{data.message}</p>
			</div>
		{/if}
		<a
			href="https://commons.email"
			class="inline-block text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
		>
			commons.email
		</a>
	</div>
</div>
