<script lang="ts">
	import { AlertTriangle } from '@lucide/svelte';
	import type { TemplateFormData, TemplateCreationContext } from '$lib/types/template';
	import { templateValidator } from '$lib/services/template-correction';
	import { styleTemplateVariables } from '$lib/utils/variable-styling';

	let {
		data,
		context,
		isActiveStep = true
	}: {
		data: TemplateFormData;
		context: TemplateCreationContext;
		isActiveStep?: boolean;
	} = $props();

	// Simple validation with safe defaults
	const validation = $derived(() => {
		try {
			return templateValidator.validate({
				title: data.objective?.title || '',
				message_body: data.content?.preview || '',
				deliveryMethod: context.channelId === 'certified' ? 'cwc' : 'email'
			});
		} catch (error) {
			console.error('Validation error:', error);
			return { isValid: true, issues: [] };
		}
	});
</script>

<div class="space-y-6">
	<!-- Validation issues -->
	{#if isActiveStep && validation.issues && validation.issues.length > 0}
		<div class="space-y-3">
			{#each validation.issues as issue}
				<div class="rounded-lg border border-amber-200 bg-amber-50 p-3">
					<div class="flex items-start gap-2">
						<AlertTriangle class="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
						<p class="text-sm text-amber-800">{issue}</p>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Message preview -->
	<div class="rounded-lg border border-slate-200 bg-white p-4">
		<h3 class="mb-3 text-sm font-medium text-slate-900">Your Message</h3>
		<div class="rounded-md bg-slate-50 p-3">
			<div class="whitespace-pre-wrap font-mono text-sm leading-normal text-slate-600">
				{@html styleTemplateVariables(
					(data.content?.preview || '').substring(0, 300) +
						((data.content?.preview || '').length > 300 ? '...' : '')
				)}
			</div>
		</div>
	</div>
</div>
