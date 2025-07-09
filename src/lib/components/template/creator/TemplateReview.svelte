<script lang="ts">
	import { CheckCircle2, AlertCircle, Users, Mail, Target, Building2 } from '@lucide/svelte';
	import type { TemplateCreationContext, TemplateFormData } from '$lib/types/template';

	export let data: TemplateFormData;
	export let context: TemplateCreationContext;

	$: isComplete = validateTemplate();

	function validateTemplate() {
		const checks = {
			objective: data.objective.title && data.objective.goal,
			audience: data.audience.organizations.length > 0 || data.audience.roles.length > 0,
			content: data.content.preview.length > 0
		};

		return Object.values(checks).every((v) => v);
	}

	const sections = [
		{
			title: 'Campaign Objective',
			icon: Target,
			items: [
				{ label: 'Title', value: () => data.objective.title },
				{ label: 'Category', value: () => data.objective.category || 'General' },
				{ label: 'Goal', value: () => data.objective.goal }
			]
		},
		{
			title: 'Target Audience',
			icon: Users,
			items: [
				{
					label: 'Organizations',
					value: () => data.audience.organizations.join(', ') || 'None specified',
					type: 'list'
				},
				{
					label: 'Decision Maker Roles',
					value: () => data.audience.roles.join(', ') || 'None specified',
					type: 'list'
				}
			]
		},
		{
			title: 'Delivery Method',
			icon: Mail,
			items: [
				{ label: 'Channel', value: () => context.channelTitle },
				{
					label: 'Email Patterns',
					value: () => data.audience.emailPatterns.join(', ') || 'None specified',
					type: 'list'
				}
			]
		}
	];
</script>

<div class="space-y-6">
	<!-- Status Banner -->
	<div class="rounded-md bg-{isComplete ? 'green' : 'yellow'}-50 p-4">
		<div class="flex">
			<div class="flex-shrink-0">
				{#if isComplete}
					<CheckCircle2 class="h-5 w-5 text-green-400" />
				{:else}
					<AlertCircle class="h-5 w-5 text-yellow-400" />
				{/if}
			</div>
			<div class="ml-3">
				<h3 class="text-sm font-medium text-{isComplete ? 'green' : 'yellow'}-800">
					{isComplete ? 'Template Ready for Creation' : 'Template Needs Attention'}
				</h3>
				<div class="mt-2 text-sm text-{isComplete ? 'green' : 'yellow'}-700">
					{#if isComplete}
						<p>
							All required information has been provided. Review the details below before creating
							your template.
						</p>
					{:else}
						<p>Please ensure all required information is complete before creating your template.</p>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<!-- Review Sections -->
	{#each sections as section}
		<div class="divide-y divide-gray-200 rounded-lg bg-white shadow">
			<div class="px-4 py-5 sm:px-6">
				<h3 class="flex items-center gap-2 text-lg font-medium leading-6 text-gray-900">
					<svelte:component this={section.icon} class="h-5 w-5 text-slate-400" />
					{section.title}
				</h3>
			</div>
			<div class="px-4 py-5 sm:p-6">
				<dl class="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
					{#each section.items as item}
						<div class="sm:col-span-1">
							<dt class="text-sm font-medium text-gray-500">
								{item.label}
							</dt>
							<dd class="mt-1 text-sm text-gray-900">
								{#if item.type === 'list' && Array.isArray(item.value())}
									<div class="flex flex-wrap gap-2">
										{#each item.value().split(', ') as value}
											<span
												class="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800"
											>
												{value}
											</span>
										{/each}
									</div>
								{:else}
									{item.value()}
								{/if}
							</dd>
						</div>
					{/each}
				</dl>
			</div>
		</div>
	{/each}

	<!-- Message Preview -->
	<div class="rounded-lg bg-white shadow">
		<div class="px-4 py-5 sm:px-6">
			<h3 class="flex items-center gap-2 text-lg font-medium leading-6 text-gray-900">
				<Mail class="h-5 w-5 text-slate-400" />
				Message Preview
			</h3>
		</div>
		<div class="prose prose-sm max-w-none px-4 py-5 sm:p-6">
			{#each data.content.preview.split('\n') as line}
				<p class="whitespace-pre-wrap">{line}</p>
			{/each}
		</div>
	</div>
</div>
