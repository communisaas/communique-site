<script lang="ts">
	import WorkflowCard from '$lib/components/automation/WorkflowCard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Workflows | {data.org.name}</title>
</svelte:head>

<div class="min-h-screen bg-surface-raised text-text-primary">
	<div class="mx-auto max-w-4xl px-4 py-8">
		<!-- Header -->
		<div class="mb-8 flex items-center justify-between">
			<h1 class="text-2xl font-bold text-text-primary">Workflows</h1>
			<a
				href="/org/{data.org.slug}/workflows/new"
				class="rounded-lg bg-surface-overlay px-4 py-2 text-sm font-semibold text-text-primary hover:bg-surface-raised"
			>
				Create Workflow
			</a>
		</div>

		<!-- Workflow List -->
		{#if data.workflows.length === 0}
			<div class="rounded-lg border border-surface-border py-16 text-center">
				<p class="text-lg text-text-tertiary">No workflows yet.</p>
				<p class="mt-1 text-sm text-text-tertiary">Create your first workflow to automate supporter engagement.</p>
				<a
					href="/org/{data.org.slug}/workflows/new"
					class="mt-4 inline-block rounded-lg bg-surface-overlay px-4 py-2 text-sm font-semibold text-text-primary hover:bg-surface-raised"
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
