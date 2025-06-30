<script lang="ts">
	import { Send } from 'lucide-svelte';
	import type { Template } from '$lib/types/template';
	import Badge from '../../ui/Badge.svelte';
	import Button from '../../ui/Button.svelte';

	export let template: Template;

	$: mailtoLink = template.type === 'direct' ? generateMailtoLink(template) : undefined;

	function generateMailtoLink(template: Template): string {
		const recipients = template.recipientEmails?.join(',') || '';
		const subject = encodeURIComponent(template.title);
		const body = encodeURIComponent(template.preview || '');
		return `mailto:${recipients}?subject=${subject}&body=${body}`;
	}
</script>

<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
	<div class="min-w-0 flex-1">
		<h2 class="mb-2 truncate text-lg font-semibold text-slate-900 sm:text-xl">
			{template.title}
		</h2>
		<div class="flex flex-wrap items-center gap-2 sm:gap-4">
			<span class="rounded bg-blue-100 px-2 py-1 text-xs text-blue-600 sm:text-sm">
				{template.category}
			</span>
			<Badge type={template.deliveryMethod === 'both' ? 'certified' : 'direct'} />
		</div>
	</div>
	<div class="flex items-center">
		<Button
			variant="primary"
			classNames="w-full sm:w-auto shrink-0 focus:ring-green-600/50"
			href={mailtoLink}
			rel={mailtoLink ? 'noopener noreferrer' : undefined}
		>
			<span class="hidden sm:inline">Use Template</span>
			<span class="sm:hidden">Use</span>
			<Send class="ml-2 h-4 w-4" />
		</Button>
	</div>
</div>
