<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import CampaignDashboard from '$lib/components/analytics/CampaignDashboard.svelte';
	import { FileText, Edit, Send, PlusCircle, BarChart3 } from '@lucide/svelte';
	import type { PageData } from './$types';
	import { enhance } from '$app/forms';

	let { data }: { data: PageData } = $props();

	const templates = $derived(data.templates || []);
	let showAnalytics = $state(false);
</script>

<svelte:head>
	<title>My Templates</title>
	<meta name="description" content="Manage your Communiqué message templates." />
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-3xl font-bold text-slate-900">My Templates</h1>
		<div class="flex items-center space-x-3">
			<button
				onclick={() => showAnalytics = !showAnalytics}
				class={`inline-flex items-center gap-2 rounded-lg px-4 py-2 transition-colors ${
					showAnalytics 
					? 'bg-purple-600 text-white hover:bg-purple-700' 
					: 'bg-gray-100 text-gray-700 hover:bg-gray-200'
				}`}
			>
				<BarChart3 class="h-5 w-5" />
				{showAnalytics ? 'Hide Analytics' : 'Show Analytics'}
			</button>
			<a
				href="/templates/create"
				class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
			>
				<PlusCircle class="h-5 w-5" />
				New Template
			</a>
		</div>
	</div>
	
	{#if showAnalytics && data.user}
		<div class="mb-8">
			<CampaignDashboard userId={data.user.id} />
		</div>
	{/if}

	{#if templates.length > 0}
		<div class="space-y-4">
			{#each templates as template (template.id)}
				<div
					class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md"
				>
					<div class="flex flex-wrap items-start justify-between gap-4">
						<div class="flex-1">
							<div class="flex items-center gap-3">
								<h2 class="text-lg font-semibold text-slate-800">
									{template.title}
								</h2>
								<Badge color={template.status === 'published' ? 'green' : 'yellow'}>
									{template.status}
								</Badge>
							</div>
							<p class="mt-1 text-sm text-slate-600">
								{template.description}
							</p>
							<p class="mt-2 text-xs text-slate-400">
								Last updated: {new Date(template.updatedAt).toLocaleDateString()}
							</p>
						</div>

						<div class="flex flex-shrink-0 items-center gap-2">
							<a
								href={`/demo/lucia/login`}
								class="inline-flex items-center gap-2 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
							>
								<Edit class="h-4 w-4" />
								Edit
							</a>

							{#if template.status === 'draft'}
								<form method="POST" action="?/publish" use:enhance>
									<input type="hidden" name="id" value={template.id} />
									<button
										type="submit"
										class="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
									>
										<Send class="h-4 w-4" />
										Publish
									</button>
								</form>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div
			class="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 py-20 text-center"
		>
			<FileText class="h-12 w-12 text-slate-400" />
			<h3 class="mt-4 text-lg font-semibold text-slate-800">No templates yet</h3>
			<p class="mt-1 text-sm text-slate-500">
				Get started by creating your first message template.
			</p>
			<a
				href="/templates/create"
				class="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
			>
				<PlusCircle class="h-5 w-5" />
				Create Template
			</a>
		</div>
	{/if}
</div>
