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

<div class="space-y-3 md:space-y-6">
	<!-- Guidelines -->
	<div class="rounded-lg border border-blue-100 bg-blue-50 p-2 md:p-4">
		<div class="flex items-start gap-2">
			<Lightbulb class="mt-0.5 h-3 md:h-5 w-3 md:w-5 shrink-0 text-blue-600" />
			<div class="space-y-1 md:space-y-2">
				<h4 class="text-xs md:text-base font-medium text-blue-900">Tips for Effective Advocacy</h4>
				<ul class="space-y-0.5 text-[10px] md:text-sm text-blue-700 leading-tight">
					<li>• Be specific about the issue or bill you're addressing</li>
					<li>• Clear subject lines get opened - save emotion for the message</li>
					<li>• Officials need to quickly understand what action you want</li>
				</ul>
			</div>
		</div>
	</div>

	<div class="space-y-2 md:space-y-4">
		<ValidatedInput
			bind:value={data.title}
			label="Issue Title (will be the subject line when sent)"
			placeholder="e.g., Stop the Internet Censorship Act"
			rules={templateValidationRules.title}
		/>
	</div>

	<!-- Deep Link Customizer (always visible) -->
	<div class="border-t border-slate-200 pt-3 md:pt-6">
		<SlugCustomizer title={data.title} bind:slug={data.slug} {context} />
	</div>
</div>
