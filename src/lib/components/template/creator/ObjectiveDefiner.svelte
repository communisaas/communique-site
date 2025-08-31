<script lang="ts">
	import { Lightbulb } from '@lucide/svelte';
	import type { TemplateCreationContext } from '$lib/types/template';
	import { templateValidationRules } from '$lib/utils/validation';
	import ValidatedInput from '$lib/components/ui/ValidatedInput.svelte';
	import SlugCustomizer from './SlugCustomizer.svelte';

	interface Props {
		data: {
			title: string;
			description: string;
			category: string;
			slug?: string;
		};
		context: TemplateCreationContext;
	}

	let { data = $bindable(), context }: Props = $props();

	// Initialize data if empty
	$effect(() => {
		if (!data.title) data.title = '';
		if (!data.description) data.description = '';
		if (!data.slug) data.slug = '';
	});

	const isTitleValid = $derived(data.title.trim().length > 0);
</script>

<div class="space-y-4 md:space-y-6">
	<!-- Hero Focus: Main Action -->
	<div class="space-y-3 md:space-y-4">
		<div class="space-y-2">
			<ValidatedInput
				bind:value={data.title}
				label="Issue Title (will be the subject line when sent)"
				placeholder="e.g., Update City Park Hours"
				rules={templateValidationRules.title}
			/>
			{#if data.title.trim()}
				<div class="flex items-center gap-2 text-xs text-green-600">
					<div class="h-2 w-2 rounded-full bg-green-500"></div>
					<span>Campaign created! Keep going to build your message.</span>
				</div>
			{/if}
		</div>
	</div>

	<!-- Live Campaign Link Generation -->
	<div class="space-y-3">
		<SlugCustomizer title={data.title} bind:slug={data.slug} {context} />
	</div>

	<!-- Reference Tips - Available When Needed -->
	<div class="space-y-3 border-t border-slate-100 pt-4">
		<details class="group">
			<summary class="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900">
				<Lightbulb class="h-4 w-4 text-blue-600 group-open:text-blue-700" />
				Tips for Effective Advocacy
				<span class="ml-auto text-xs text-slate-500 group-open:hidden">Click to expand</span>
			</summary>
			<div class="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
				<ul class="space-y-1.5 text-xs md:text-sm text-blue-700 leading-relaxed">
					<li>• Be specific about the issue or bill you're addressing</li>
					<li>• Clear subject lines get opened - save emotion for the message</li>
					<li>• Officials need to quickly understand what action you want</li>
				</ul>
			</div>
		</details>
	</div>
</div>
