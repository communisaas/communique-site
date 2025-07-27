<script lang="ts">
	import { Lightbulb } from '@lucide/svelte';
	import type { TemplateCreationContext } from '$lib/types/template';
	import SlugCustomizer from './SlugCustomizer.svelte';

	interface Props {
		data: {
			title: string;
			description: string;
			category: string;
			goal: string;
			slug?: string;
		};
		context: TemplateCreationContext;
	}

	let { data, context }: Props = $props();

	// Initialize data if empty
	$effect(() => {
		if (!data.title) data.title = '';
		if (!data.goal) data.goal = '';
		if (!data.description) data.description = '';
		if (!data.slug) data.slug = '';
	});

	const isTitleValid = $derived(data.title.trim().length > 0);
	const isGoalValid = $derived(data.goal.trim().length > 0);
</script>

<div class="space-y-6">
	<!-- Guidelines -->
	<div class="rounded-lg border border-blue-100 bg-blue-50 p-4">
		<div class="flex items-start gap-3">
			<Lightbulb class="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
			<div class="space-y-2">
				<h4 class="font-medium text-blue-900">Writing Tips</h4>
				<ul class="space-y-1 text-sm text-blue-700">
					<li>• Make your goal specific and measurable</li>
					<li>• Focus on a single primary objective</li>
					<li>• Consider both short and long-term impact</li>
				</ul>
			</div>
		</div>
	</div>

	<div class="space-y-4">
		<label class="block">
			<span class="text-sm font-medium text-slate-700">Template Title</span>
			<input
				type="text"
				bind:value={data.title}
				class:border-red-300={!isTitleValid && data.title}
				class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
				placeholder="e.g., Tech Ethics Initiative"
				spellcheck="true"
				lang="en"
			/>
			{#if !isTitleValid && data.title}
				<p class="mt-1 text-sm text-red-600">Title is required</p>
			{/if}
		</label>

		<label class="block">
			<span class="text-sm font-medium text-slate-700">Campaign Goal</span>
			<textarea
				bind:value={data.goal}
				class:border-red-300={!isGoalValid && data.goal}
				class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
				rows="3"
				placeholder="What specific change or action are you seeking?"
				spellcheck="true"
				lang="en"
			></textarea>
			{#if !isGoalValid && data.goal}
				<p class="mt-1 text-sm text-red-600">Goal is required</p>
			{/if}
		</label>
	</div>

	<!-- Deep Link Customizer -->
	{#if data.title}
		<div class="border-t border-slate-200 pt-6">
			<SlugCustomizer 
				bind:title={data.title}
				bind:slug={data.slug}
				{context}
			/>
		</div>
	{/if}
</div>
