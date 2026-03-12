<script lang="ts">
	import WorkflowCard from '$lib/components/automation/WorkflowCard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Workflows | {data.org.name}</title>
</svelte:head>

<div class="min-h-screen bg-zinc-950 text-zinc-100">
	<div class="mx-auto max-w-4xl px-4 py-8">
		<!-- Header -->
		<div class="mb-8 flex items-center justify-between">
			<h1 class="text-2xl font-bold text-zinc-100">Workflows</h1>
			<a
				href="/org/{data.org.slug}/workflows/new"
				class="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-200"
			>
				Create Workflow
			</a>
		</div>

		<!-- Workflow List -->
		{#if data.workflows.length === 0}
			<div class="rounded-lg border border-zinc-800/60 py-16 text-center">
				<p class="text-lg text-zinc-400">No workflows yet.</p>
				<p class="mt-1 text-sm text-zinc-500">Create your first workflow to automate supporter engagement.</p>
				<a
					href="/org/{data.org.slug}/workflows/new"
					class="mt-4 inline-block rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-200"
				>
					Create Workflow
				</a>
			</div>
		{:else}
			<div class="space-y-3">
				{#each data.workflows as workflow (workflow.id)}
					<a href="/org/{data.org.slug}/workflows/{workflow.id}" class="block">
						<WorkflowCard {workflow} />
					</a>
				{/each}
			</div>
		{/if}
	</div>
</div>
